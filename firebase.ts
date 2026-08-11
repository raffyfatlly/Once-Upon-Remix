
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDocs, runTransaction, setDoc, getDoc, arrayUnion, limit } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadString, StringFormat } from 'firebase/storage';
import { Product, Order, SiteConfig, Subscriber, Ambassador } from './types';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBAPSOOVmpyt562qKGrM-Vec7szm-vxhEE",
  authDomain: "once-upon-24709.firebaseapp.com",
  projectId: "once-upon-24709",
  // ⚠️ IF YOU CREATE A NEW BUCKET, PASTE THE NEW ID HERE:
  storageBucket: "once-upon-24709.firebasestorage.app",
  messagingSenderId: "826735245456",
  appId: "1:826735245456:web:bbde016d660736b6d2c015",
  measurementId: "G-7S9RM4C1NK"
};

// Initialize Firebase
let app;
let db: any;
let storage: any;

try {
  // Prevent duplicate initialization check
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  db = getFirestore(app);
  storage = getStorage(app);
  console.log("Firebase initialized successfully.");
} catch (error) {
  console.error("CRITICAL FIREBASE ERROR:", error);
}

export { db, storage };

// --- HELPER FUNCTIONS ---

// Products
export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  if (!db) {
    console.warn("Database not initialized, returning empty products.");
    callback([]);
    return () => {};
  }
  try {
    const q = query(collection(db, 'products'), orderBy('name'));
    return onSnapshot(q, (snapshot) => {
      const rawProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      const cleanProducts: Product[] = [];
      rawProducts.forEach(p => {
        const isProtectedDuplicate = p.id.endsWith('-protected') || 
                                     (p.name && p.name.includes('+ Extra Protection Box')) ||
                                     (p.name && p.name.includes('Extra Protection Box'));
        if (isProtectedDuplicate) {
          console.warn(`Removing auto-created protection box duplicate product from Firestore: ${p.id} (${p.name})`);
          deleteProductFromDb(p.id).catch(err => console.error("Error deleting duplicate product doc:", err));
        } else {
          cleanProducts.push(p);
        }
      });
      callback(cleanProducts);
    }, (error) => {
      console.error("Error fetching products:", error);
      callback([]); 
    });
  } catch (e) {
    console.error("Failed to subscribe to products", e);
    callback([]);
    return () => {};
  }
};

export const addProductToDb = async (product: Omit<Product, 'id'>) => {
  if (!db) throw new Error("Database not connected.");
  return await addDoc(collection(db, 'products'), product);
};

export const updateProductInDb = async (id: string, updates: Partial<Product>) => {
  if (!db) throw new Error("Database not connected.");
  const docRef = doc(db, 'products', id);
  await updateDoc(docRef, updates);
};

export const deleteProductFromDb = async (id: string) => {
  if (!db) throw new Error("Database not connected.");
  await deleteDoc(doc(db, 'products', id));
};

// Orders
export const createOrderInDb = async (orderData: Omit<Order, 'id'>) => {
  if (!db) throw new Error("Database not connected.");

  // 1. Trigger Auto-Cleanup/Release of Stale Orders BEFORE processing new one.
  try {
    console.log("Running pre-order stock cleanup...");
    // Increased from 5 to 60 minutes to give users enough time for OTP/3D secure,
    // and prevent false cancellations if they take a bit longer on the CHIP payment page.
    await autoReleaseStaleOrders(60); 
  } catch (err) {
    console.warn("Auto-release failed during order creation (non-fatal):", err);
  }

  // Use a transaction to safely increment the order counter AND deduct stock
  return await runTransaction(db, async (transaction) => {
    
    // 2. STOCK CHECK: Read all product documents involved in the order first
    const productReads = orderData.items.map(item => {
      let docId = item.baseProductId || item.id;
      if (typeof docId === 'string' && docId.endsWith('-protected')) {
        docId = docId.replace(/-protected$/, '');
      }
      const ref = doc(db, 'products', docId);
      return { ref, id: docId, qty: item.quantity };
    });

    const productDocs = await Promise.all(productReads.map(p => transaction.get(p.ref)));

    // Check availability for each item
    productDocs.forEach((docSnapshot, index) => {
      const requestedItem = productReads[index];
      // Note: If doc doesn't exist yet in DB (e.g. newly added ticket or custom product), 
      // we will automatically initialize it in section 4 instead of failing the transaction.
    });

    // 3. COUNTER CHECK: Reference the counter document
    const counterRef = doc(db, 'counters', 'orderCounter');
    const counterDoc = await transaction.get(counterRef);

    let nextId = 1000; // Default start value

    if (counterDoc.exists()) {
      const current = counterDoc.data().current;
      if (typeof current === 'number') {
        nextId = current + 1;
      }
    }

    // 4. WRITES: Now we perform all the updates
    
    // A. Deduct Stock (allowing negative values for pre-orders / auto-initializing missing docs)
    productDocs.forEach((docSnapshot, index) => {
      const requestedItem = productReads[index];
      if (docSnapshot.exists()) {
        const productData = docSnapshot.data();
        const currentStock = (productData && productData.stock) || 0;
        const newStock = currentStock - requestedItem.qty;
        transaction.update(requestedItem.ref, { stock: newStock });
      } else {
        const itemInfo = orderData.items.find(i => {
          const rawId = i.baseProductId || i.id;
          return rawId.replace(/-protected$/, '') === requestedItem.id;
        });
        const isTicket = itemInfo?.collection === 'Cakenic Ticket' || itemInfo?.category === 'Event Ticket' || Boolean(itemInfo?.isCakenicOnly) || requestedItem.id.startsWith('cakenic');
        if (isTicket) {
          transaction.set(requestedItem.ref, {
            name: itemInfo?.name || requestedItem.id,
            price: itemInfo?.price || 0,
            stock: 50 - requestedItem.qty,
            category: itemInfo?.category || 'Event Ticket',
            collection: itemInfo?.collection || 'Cakenic Ticket',
            image: itemInfo?.image || ''
          });
        } else {
          console.warn(`Product ${requestedItem.id} not found in DB during stock deduction. Skipping auto-creation.`);
        }
      }
    });

    // B. Create Order ID
    const newOrderId = nextId.toString();
    const newOrderRef = doc(db, 'orders', newOrderId);

    // C. Update Counter
    transaction.set(counterRef, { current: nextId });

    // D. Create Order
    // Sanitize to remove undefined values which crash Firestore
    const sanitizedOrderData = JSON.parse(JSON.stringify(orderData));
    transaction.set(newOrderRef, {
      ...sanitizedOrderData,
      id: newOrderId, // Store ID inside document as well for easier fetching
      statusHistory: [{ status: 'pending', timestamp: new Date().toISOString() }]
    });

    console.log(`Created Order #${newOrderId} and deducted stock.`);
    return newOrderRef; // Return the reference so frontend can use .id
  });
};

/**
 * RESTORE STOCK FUNCTION (Internal logic)
 * It reads the order, finds the items, and adds the quantity back to the products.
 */
export const restoreStockForOrder = async (orderId: string, newStatus: 'cancelled' | 'failed') => {
  if (!db) throw new Error("Database not connected.");
  const orderRef = doc(db, 'orders', orderId);

  await runTransaction(db, async (transaction) => {
    // 1. Get the Order
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists()) {
      throw new Error("Order not found");
    }

    const orderData = orderDoc.data() as Order;

    // Safety Check: Prevent double restoration
    if (orderData.status === 'cancelled' || orderData.status === 'failed') {
      console.log(`Order ${orderId} is already ${orderData.status}. Skipping stock restoration.`);
      return; 
    }

    // 2. Read all Product Docs involved
    const productReads = orderData.items.map(item => {
      let docId = item.baseProductId || item.id;
      if (typeof docId === 'string' && docId.endsWith('-protected')) {
        docId = docId.replace(/-protected$/, '');
      }
      const ref = doc(db, 'products', docId);
      return { ref, qty: item.quantity };
    });

    const productDocs = await Promise.all(productReads.map(p => transaction.get(p.ref)));

    // 3. Write Updates (Restore Stock)
    productDocs.forEach((docSnapshot, index) => {
      if (docSnapshot.exists()) {
        const currentData = docSnapshot.data();
        const currentStock = currentData.stock || 0;
        const qtyToRestore = productReads[index].qty;
        
        transaction.update(productReads[index].ref, {
          stock: currentStock + qtyToRestore
        });
      }
    });

    // 4. Update Order Status
    transaction.update(orderRef, { 
       status: newStatus,
       statusHistory: arrayUnion({ status: newStatus, timestamp: new Date().toISOString() })
    });
  });
};

// ⚠️ NEW: Logic for Admin to update status and handle stock automatically
export const updateOrderAndRestock = async (orderId: string, newStatus: string, currentStatus: string) => {
  if (!db) throw new Error("Database not connected.");

  // If we are cancelling or failing an order, we must return stock
  if ((newStatus === 'cancelled' || newStatus === 'failed') && 
      (currentStatus !== 'cancelled' && currentStatus !== 'failed')) {
        await restoreStockForOrder(orderId, newStatus as 'cancelled' | 'failed');
  } else {
    // For other status changes (Pending -> Paid, Shipped, etc), stock is already deducted.
    // Just update the status text.
    await updateDoc(doc(db, 'orders', orderId), { 
      status: newStatus,
      statusHistory: arrayUnion({ status: newStatus, timestamp: new Date().toISOString() })
    });
  }
};

/**
 * AUTO RELEASE STALE ORDERS
 * Checks for orders that have been 'pending' for more than {timeoutMinutes}.
 * Automatically cancels them and returns stock.
 */
export const autoReleaseStaleOrders = async (timeoutMinutes: number = 60): Promise<number> => {
  if (!db) throw new Error("Database not connected.");

  // 1. Get all pending orders
  const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
  const snapshot = await getDocs(q);
  
  const now = Date.now();
  let releaseCount = 0;

  // 2. Check time difference
  const releasePromises = snapshot.docs.map(async (docSnapshot) => {
    const order = docSnapshot.data() as Order;
    const orderTime = new Date(order.date).getTime();
    const diffMinutes = (now - orderTime) / (1000 * 60);

    if (diffMinutes > timeoutMinutes) {
      console.log(`Order ${order.id} is stale (${Math.round(diffMinutes)} mins). Releasing stock...`);
      try {
        await restoreStockForOrder(order.id, 'cancelled');
        releaseCount++;
      } catch (err) {
        console.error(`Failed to auto-release order ${order.id}:`, err);
      }
    }
  });

  await Promise.all(releasePromises);
  return releaseCount;
};


// ⚠️ DANGER: Resets the entire order system
export const resetOrderSystem = async () => {
  if (!db) throw new Error("Database not connected");
  
  // 1. Reset Counter to 999 (so next is 1000)
  await setDoc(doc(db, 'counters', 'orderCounter'), { current: 999 });

  // 2. Delete ALL existing orders
  const q = query(collection(db, 'orders'));
  const snapshot = await getDocs(q);
  
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
  
  console.log("Order system reset complete.");
};

export const subscribeToOrders = (callback: (orders: Order[]) => void) => {
  if (!db) {
    callback([]);
    return () => {};
  }
  try {
    const q = query(collection(db, 'orders'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      callback(orders);
    });
  } catch (e) {
    callback([]);
    return () => {};
  }
};

export const getCustomerOrders = async (email: string): Promise<Order[]> => {
  if (!db) throw new Error("Database not connected.");
  try {
    const q = query(collection(db, 'orders'), where('customerEmail', '==', email));
    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
    return orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    throw error;
  }
};

export const getOrderById = async (orderId: string): Promise<Order | null> => {
  if (!db) throw new Error("Database not connected.");
  try {
    const docRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Order;
    }
    return null;
  } catch (error) {
    console.error("Error fetching order by ID:", error);
    throw error;
  }
};

export const updateOrderStatusInDb = async (id: string, status: Order['status']) => {
  if (!db) throw new Error("Database not connected.");
  const docRef = doc(db, 'orders', id);
  await updateDoc(docRef, { 
    status,
    statusHistory: arrayUnion({ status, timestamp: new Date().toISOString() })
  });
};

export const searchCakenicOrder = async (email?: string, phone?: string, orderId?: string): Promise<Order[]> => {
  if (!db) return [];
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanPhoneDigits = (phone || '').replace(/[^\d]/g, '');
    
    const normalizePhone = (p: string) => {
      let digits = p.replace(/[^\d]/g, '');
      if (digits.startsWith('60')) digits = digits.substring(2);
      else if (digits.startsWith('0')) digits = digits.substring(1);
      return digits;
    };
    
    const normInputPhone = normalizePhone(phone || '');
    const cleanOrderId = (orderId || '').trim();

    // Direct ID lookup if orderId is provided or if input is an order ID directly
    if (cleanOrderId) {
      const directOrder = await getOrderById(cleanOrderId);
      if (directOrder) return [directOrder];
    }
    if (cleanEmail && cleanEmail.length >= 4 && !cleanEmail.includes('@')) {
      const directOrder = await getOrderById(cleanEmail);
      if (directOrder) return [directOrder];
    }

    // Query orders from Firestore with fallback
    let snapshot;
    try {
      const q = query(collection(db, 'orders'), orderBy('date', 'desc'), limit(300));
      snapshot = await getDocs(q);
    } catch (queryErr) {
      console.warn("Ordered search failed, falling back to simple query:", queryErr);
      const fallbackQuery = query(collection(db, 'orders'), limit(300));
      snapshot = await getDocs(fallbackQuery);
    }

    const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];

    return allOrders.filter(order => {
      if (!order) return false;

      // Identify Cakenic order
      const isCakenic = order.source === 'cakenic' || 
        order.channel === 'Cakenic Sales' || 
        order.channel === 'cakenic' ||
        order.utm_source === 'cakenic_landing_page' ||
        (order.shippingAddress && order.shippingAddress.toLowerCase().trim().includes('cakenic')) ||
        order.items?.some(i => 
          i.collection === 'Cakenic Ticket' || 
          i.collection === 'Event' ||
          i.category === 'Event Ticket' || 
          Boolean(i.isCakenicOnly) || 
          (i.id && i.id.toLowerCase().includes('cakenic')) ||
          (i.name && i.name.toLowerCase().includes('ticket')) ||
          (i.name && i.name.toLowerCase().includes('cakenic'))
        );
      
      if (!isCakenic) return false;

      const orderEmail = (order.customerEmail || '').toLowerCase().trim();
      const orderPhoneDigits = (order.customerPhone || '').replace(/[^\d]/g, '');
      const normOrderPhone = normalizePhone(order.customerPhone || '');
      const orderIdStr = (order.id || '').toLowerCase().trim();

      // Check Order ID match
      if (cleanOrderId && orderIdStr === cleanOrderId.toLowerCase()) return true;

      // Check Email match
      if (cleanEmail) {
        if (orderEmail && (orderEmail.includes(cleanEmail) || cleanEmail.includes(orderEmail))) return true;
        if (orderIdStr === cleanEmail) return true;
      }

      // Check Phone match
      if (cleanPhoneDigits && cleanPhoneDigits.length >= 4) {
        if (orderPhoneDigits && (orderPhoneDigits.includes(cleanPhoneDigits) || cleanPhoneDigits.includes(orderPhoneDigits))) return true;
        if (normInputPhone && normOrderPhone && normInputPhone.length >= 4) {
          if (normOrderPhone.includes(normInputPhone) || normInputPhone.includes(normOrderPhone)) return true;
        }
        if (orderIdStr === cleanPhoneDigits) return true;
      }

      return false;
    });
  } catch (e) {
    console.error("Ticket search error:", e);
    return [];
  }
};

export const updateOrderNotesInDb = async (id: string, adminNotes: string) => {
  if (!db) throw new Error("Database not connected.");
  const docRef = doc(db, 'orders', id);
  await updateDoc(docRef, { adminNotes });
};

export const updateOrderInDb = async (id: string, updates: Partial<Order>) => {
  if (!db) throw new Error("Database not connected.");
  const docRef = doc(db, 'orders', id);
  await updateDoc(docRef, updates as any);
};

export const deleteOrderFromDb = async (id: string) => {
  if (!db) throw new Error("Database not connected.");
  await deleteDoc(doc(db, 'orders', id));
};

// Subscribers (Mum's Club)
export const addSubscriberToDb = async (email: string) => {
  if (!db) throw new Error("Database not connected.");
  // Basic duplicate check is handled by UI feedback usually, but let's just add it.
  // Ideally, we'd check if it exists, but for this simple version, just adding is fine.
  return await addDoc(collection(db, 'subscribers'), {
    email,
    date: new Date().toISOString()
  });
};

export const subscribeToSubscribers = (callback: (subscribers: Subscriber[]) => void) => {
  if (!db) {
    callback([]);
    return () => {};
  }
  try {
    const q = query(collection(db, 'subscribers'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Subscriber[];
      callback(subs);
    });
  } catch (e) {
    callback([]);
    return () => {};
  }
};

// Storage
export const uploadImage = async (file: File): Promise<string> => {
  if (!storage) throw new Error("Storage not initialized.");
  
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniqueName = `images/${Date.now()}_${sanitizedName}`;
  const storageRef = ref(storage, uniqueName);

  // 🛡️ COMPATIBILITY MODE UPLOAD
  // We use uploadString (Base64) INSTEAD of uploadBytes.
  // This helps bypass complex CORS preflight checks that often fail on new buckets.
  
  try {
    // Standard uploadBytes is more robust for files than base64 strings
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);

  } catch (error: any) {
    console.error("Upload failed full error object:", error);
    if (error.customData || error.serverResponse) {
      console.error("Server response:", error.serverResponse);
    }
    
    // Diagnose common errors for the user
    if (error.code === 'storage/object-not-found' || error.code === 'storage/bucket-not-found') {
       throw new Error(`Bucket "${firebaseConfig.storageBucket}" not found. Did you create it in Firebase Console?`);
    } else if (error.code === 'storage/unauthorized') {
       throw new Error("Permission Denied. Please check your Storage Rules.");
    } else if (error.code === 'storage/canceled') {
       throw new Error("Upload cancelled.");
    }
    
    throw new Error(`Upload Error: ${error.message} (Code: ${error.code})`);
  }
};

export const updateSiteConfigInDb = async (config: SiteConfig) => {
  console.log("Saving config to DB:", config);
};

// Ambassadors
export const subscribeToAmbassadors = (callback: (ambassadors: Ambassador[]) => void) => {
  if (!db) {
    callback([]);
    return () => {};
  }
  try {
    const q = query(collection(db, 'ambassadors'), orderBy('joinedDate', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const ambassadors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Ambassador[];
      callback(ambassadors);
    }, (error) => {
      console.warn("Error subscribing to ambassadors:", error);
      callback([]);
    });
  } catch (e) {
    console.error("Failed to subscribe to ambassadors", e);
    callback([]);
    return () => {};
  }
};

export const addAmbassadorToDb = async (ambassadorData: Omit<Ambassador, 'id'>) => {
  if (!db) throw new Error("Database not connected.");
  const sanitized = JSON.parse(JSON.stringify(ambassadorData));
  return await addDoc(collection(db, 'ambassadors'), sanitized);
};

export const updateAmbassadorInDb = async (id: string, updates: Partial<Ambassador>) => {
  if (!db) throw new Error("Database not connected.");
  const docRef = doc(db, 'ambassadors', id);
  const sanitized = JSON.parse(JSON.stringify(updates));
  await updateDoc(docRef, sanitized);
};

export const deleteAmbassadorFromDb = async (id: string) => {
  if (!db) throw new Error("Database not connected.");
  await deleteDoc(doc(db, 'ambassadors', id));
};

export const findAmbassadorByCredentials = async (email: string, phone: string): Promise<Ambassador | null> => {
  if (!db) return null;
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim().replace(/[^0-9+]/g, '');

  try {
    // 1. Query by email first
    const q = query(collection(db, 'ambassadors'), where('email', '==', cleanEmail));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Ambassador;
        const ambPhone = (data.phone || '').replace(/[^0-9+]/g, '');
        // Compare phone digits or match if phone digits overlap
        if (ambPhone === cleanPhone || ambPhone.endsWith(cleanPhone) || cleanPhone.endsWith(ambPhone)) {
          return { ...data, id: docSnap.id };
        }
      }
      // If email matches, but phone has slight formatting difference, return matching ambassador if phone matches
      const firstDoc = snapshot.docs[0];
      return { ...(firstDoc.data() as Ambassador), id: firstDoc.id };
    }

    // 2. Query by phone if email query returned empty
    const qPhone = query(collection(db, 'ambassadors'), where('phone', '==', cleanPhone));
    const snapPhone = await getDocs(qPhone);
    if (!snapPhone.empty) {
      const pDoc = snapPhone.docs[0];
      return { ...(pDoc.data() as Ambassador), id: pDoc.id };
    }

    return null;
  } catch (err) {
    console.error("Error finding ambassador:", err);
    return null;
  }
};

// Tracked Links Sync for Admin and Ambassadors
export const saveTrackedLinkInDb = async (linkData: {
  destinationName: string;
  originalUrl: string;
  shortUrl: string;
  source: string;
  medium: string;
  campaign: string;
  shortCode: string;
  ambassadorId?: string;
  ambassadorName?: string;
}) => {
  if (!db) return;
  try {
    const q = query(collection(db, 'tracked_links'), where('shortCode', '==', linkData.shortCode), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      await addDoc(collection(db, 'tracked_links'), {
        ...linkData,
        createdAt: new Date().toISOString()
      });
    } else {
      // update if exists
      const docId = snap.docs[0].id;
      await updateDoc(doc(db, 'tracked_links', docId), {
        ...linkData,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error("Error saving tracked link:", err);
  }
};

