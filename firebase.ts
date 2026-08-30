
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, getDocs, runTransaction, setDoc, getDoc, arrayUnion, limit } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, uploadString, StringFormat } from 'firebase/storage';
import type { Product, Order, SiteConfig, Subscriber, Ambassador } from './types.ts';

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

    // 🛡️ CRITICAL IMMUNITY: Never cancel or restock an order that is already paid or fulfilled!
    if (['paid', 'packed', 'shipped', 'delivered'].includes(orderData.status)) {
      console.warn(`Order ${orderId} is already "${orderData.status}". REFUSING to cancel or restore stock.`);
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

/**
 * RE-DEDUCT STOCK FUNCTION (Used when rescuing a cancelled/failed order to paid)
 */
export const reDeductStockForOrder = async (orderId: string, newStatus: string = 'paid') => {
  if (!db) throw new Error("Database not connected.");
  const orderRef = doc(db, 'orders', orderId);

  await runTransaction(db, async (transaction) => {
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists()) {
      throw new Error("Order not found");
    }

    const orderData = orderDoc.data() as Order;

    // Deduct stock for all items
    if (orderData.items && Array.isArray(orderData.items)) {
      const productReads = orderData.items.map(item => {
        let docId = item.baseProductId || item.id;
        if (typeof docId === 'string' && docId.endsWith('-protected')) {
          docId = docId.replace(/-protected$/, '');
        }
        const ref = doc(db, 'products', docId);
        return { ref, qty: item.quantity };
      });

      const productDocs = await Promise.all(productReads.map(p => transaction.get(p.ref)));

      productDocs.forEach((docSnapshot, index) => {
        if (docSnapshot.exists()) {
          const currentData = docSnapshot.data();
          const currentStock = currentData.stock || 0;
          const qtyToDeduct = productReads[index].qty;
          transaction.update(productReads[index].ref, {
            stock: Math.max(0, currentStock - qtyToDeduct)
          });
        }
      });
    }

    transaction.update(orderRef, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
      statusHistory: arrayUnion({
        status: newStatus,
        timestamp: new Date().toISOString(),
        source: 'stock_rededucted_rescue'
      })
    });
  });
};

// Logic for Admin to update status and handle stock automatically
export const updateOrderAndRestock = async (orderId: string, newStatus: string, currentStatus: string) => {
  if (!db) throw new Error("Database not connected.");

  // If moving FROM cancelled/failed TO paid/packed/shipped/delivered/pending, re-deduct stock
  if ((currentStatus === 'cancelled' || currentStatus === 'failed') && 
      ['paid', 'packed', 'shipped', 'delivered', 'pending'].includes(newStatus)) {
    await reDeductStockForOrder(orderId, newStatus);
  } 
  // If moving TO cancelled/failed from active, return stock
  else if ((newStatus === 'cancelled' || newStatus === 'failed') && 
      (currentStatus !== 'cancelled' && currentStatus !== 'failed')) {
    await restoreStockForOrder(orderId, newStatus as 'cancelled' | 'failed');
  } else {
    // Regular status update (e.g. Paid -> Packed -> Shipped)
    await updateDoc(doc(db, 'orders', orderId), { 
      status: newStatus,
      updatedAt: new Date().toISOString(),
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
      // 🛡️ CRITICAL CHECK: Before cancelling, check CHIP Gateway API to ensure it wasn't paid!
      let isActuallyPaid = false;
      let verifySucceeded = false;
      try {
        if (typeof window !== 'undefined' || typeof fetch !== 'undefined') {
          const verifyResp = await fetch(`/api/chip/verify/${encodeURIComponent(order.id)}`);
          if (verifyResp.ok) {
            const verifyData = await verifyResp.json();
            verifySucceeded = true;
            if (verifyData && verifyData.paid === true) {
              isActuallyPaid = true;
              console.log(`[AutoRelease] Order #${order.id} was confirmed PAID on CHIP! Protected from cancellation.`);
            }
          }
        }
      } catch (verifyErr) {
        console.warn(`[AutoRelease] Could not verify order #${order.id} against CHIP:`, verifyErr);
      }

      // If it is paid, never cancel
      if (isActuallyPaid) {
        return;
      }

      // Only release if verify explicitly succeeded and confirmed unpaid
      if (verifySucceeded && !isActuallyPaid) {
        console.log(`Order ${order.id} is stale (${Math.round(diffMinutes)} mins) and confirmed unpaid. Releasing stock...`);
        try {
          await restoreStockForOrder(order.id, 'cancelled');
          releaseCount++;
        } catch (err) {
          console.error(`Failed to auto-release order ${order.id}:`, err);
        }
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
    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
        callback(orders);
      },
      (error) => {
        console.warn("subscribeToOrders orderBy query error, falling back to simple collection query:", error);
        const fallbackQ = query(collection(db, 'orders'));
        return onSnapshot(fallbackQ, (snapshot) => {
          const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
          orders.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
          callback(orders);
        }, (err) => {
          console.error("subscribeToOrders fallback error:", err);
          callback([]);
        });
      }
    );
  } catch (e) {
    console.error("subscribeToOrders setup error:", e);
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
    const rawId = String(orderId || '').trim();
    const cleanId = rawId.replace(/^#/, '').trim();
    let docRef = doc(db, 'orders', cleanId);
    let docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Order;
    }
    if (rawId && rawId !== cleanId) {
      docRef = doc(db, 'orders', rawId);
      docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Order;
      }
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
    const rawEmail = (email || '').trim();
    const rawPhone = (phone || '').trim();
    const rawOrderId = (orderId || '').trim();

    // Pool all non-empty raw inputs
    const inputPool = [rawEmail, rawPhone, rawOrderId].filter(Boolean);
    if (inputPool.length === 0) return [];

    // Helper: Normalize phone to core digits (strip non-digits, country code +60/60, and leading 0)
    const getCorePhoneDigits = (p: string) => {
      let digits = p.replace(/[^\d]/g, '');
      if (digits.startsWith('60') && digits.length >= 9) digits = digits.substring(2);
      if (digits.startsWith('0') && digits.length >= 8) digits = digits.substring(1);
      return digits;
    };

    const getRawPhoneDigits = (p: string) => p.replace(/[^\d]/g, '');

    // Extract email candidates
    const emailCandidates: string[] = [];
    inputPool.forEach(term => {
      if (term.includes('@')) {
        emailCandidates.push(term.toLowerCase().trim());
      }
    });

    // Extract phone/digit candidates
    const phoneCandidates: string[] = [];
    const corePhoneCandidates: string[] = [];
    const orderIdCandidates: string[] = [];

    inputPool.forEach(term => {
      const cleanTerm = term.replace(/^#/, '').trim();
      const rawDigits = getRawPhoneDigits(term);
      const coreDigits = getCorePhoneDigits(term);

      if (rawDigits.length >= 3 && rawDigits.length <= 8) {
        orderIdCandidates.push(cleanTerm);
        orderIdCandidates.push(rawDigits);
      }
      if (rawDigits.length >= 7) {
        phoneCandidates.push(term);
        phoneCandidates.push(rawDigits);
        if (coreDigits) corePhoneCandidates.push(coreDigits);
      } else if (!term.includes('@')) {
        // Could also be an order ID
        orderIdCandidates.push(cleanTerm);
      }
    });

    // We collect all matching Order objects in a Map by Order ID
    const ordersMap = new Map<string, Order>();

    // 1. Direct ID lookups
    for (const candId of orderIdCandidates) {
      if (candId) {
        try {
          const directOrder = await getOrderById(candId);
          if (directOrder) ordersMap.set(directOrder.id, directOrder);
        } catch (_) {}
      }
    }

    // 2. Targeted Firestore queries by phone variations
    const phoneQueryPromises: Promise<any>[] = [];
    const phoneQueryVariants = new Set<string>();

    phoneCandidates.forEach(p => {
      const digits = getRawPhoneDigits(p);
      const core = getCorePhoneDigits(p);
      if (digits) {
        phoneQueryVariants.add(digits);
        phoneQueryVariants.add(p);
        phoneQueryVariants.add(`+${digits}`);
      }
      if (core) {
        phoneQueryVariants.add(`0${core}`);
        phoneQueryVariants.add(`+60${core}`);
        phoneQueryVariants.add(`60${core}`);
        phoneQueryVariants.add(`+60 ${core.substring(0, 2)}-${core.substring(2)}`);
        phoneQueryVariants.add(`0${core.substring(0, 2)}-${core.substring(2)}`);
      }
    });

    phoneQueryVariants.forEach(variant => {
      if (variant && variant.length >= 5) {
        phoneQueryPromises.push(
          getDocs(query(collection(db, 'orders'), where('customerPhone', '==', variant))).catch(() => null)
        );
      }
    });

    // 3. Targeted Firestore queries by email
    emailCandidates.forEach(em => {
      phoneQueryPromises.push(
        getDocs(query(collection(db, 'orders'), where('customerEmail', '==', em))).catch(() => null)
      );
    });

    // 4. Targeted Cakenic collection queries
    phoneQueryPromises.push(
      getDocs(query(collection(db, 'orders'), where('source', '==', 'cakenic'))).catch(() => null)
    );
    phoneQueryPromises.push(
      getDocs(query(collection(db, 'orders'), where('utm_source', '==', 'cakenic_landing_page'))).catch(() => null)
    );
    phoneQueryPromises.push(
      getDocs(query(collection(db, 'orders'), where('channel', '==', 'Cakenic Sales'))).catch(() => null)
    );

    // 5. Recent orders query (up to 500 orders)
    phoneQueryPromises.push(
      getDocs(query(collection(db, 'orders'), orderBy('date', 'desc'), limit(500))).catch(() => null)
    );
    phoneQueryPromises.push(
      getDocs(query(collection(db, 'orders'), limit(500))).catch(() => null)
    );

    const querySnapshots = await Promise.all(phoneQueryPromises);

    querySnapshots.forEach(snap => {
      if (snap && snap.docs) {
        snap.docs.forEach((d: any) => {
          const data = d.data();
          const ordId = d.id || data.id;
          if (ordId && !ordersMap.has(ordId)) {
            ordersMap.set(ordId, { id: ordId, ...data } as Order);
          }
        });
      }
    });

    const allOrders = Array.from(ordersMap.values());

    // Helper: Determine if an order is related to Cakenic or Ticket
    const isCakenicOrTicketOrder = (order: Order) => {
      if (!order) return false;
      const src = (order.source || '').toLowerCase();
      const ch = (order.channel || '').toLowerCase();
      const utm = (order.utm_source || '').toLowerCase();
      const addr = (order.shippingAddress || '').toLowerCase();
      const notes = `${order.adminNotes || ''} ${(order as any).notes || ''}`.toLowerCase();

      if (src.includes('cakenic') || ch.includes('cakenic') || utm.includes('cakenic') || addr.includes('cakenic') || notes.includes('cakenic')) {
        return true;
      }

      if (addr.includes('putrajaya') || addr.includes('johor') || addr.includes('botani') || addr.includes('ticket') || addr.includes('picnic')) {
        return true;
      }

      if (order.items && Array.isArray(order.items)) {
        return order.items.some(item => {
          if (!item) return false;
          const col = (item.collection || '').toLowerCase();
          const cat = (item.category || '').toLowerCase();
          const itemName = (item.name || '').toLowerCase();
          const itemId = (item.id || '').toLowerCase();

          return (
            col.includes('cakenic') ||
            col.includes('ticket') ||
            col.includes('event') ||
            cat.includes('ticket') ||
            cat.includes('event') ||
            Boolean(item.isCakenicOnly) ||
            itemId.includes('cakenic') ||
            itemId.includes('ticket') ||
            itemId.includes('putrajaya') ||
            itemId.includes('johor') ||
            itemName.includes('cakenic') ||
            itemName.includes('ticket') ||
            itemName.includes('event') ||
            itemName.includes('picnic') ||
            itemName.includes('putrajaya') ||
            itemName.includes('johor') ||
            itemName.includes('botani') ||
            itemName.includes('eco spring') ||
            itemName.includes('pass') ||
            itemName.includes('slot') ||
            itemName.includes('session') ||
            itemName.includes('admission')
          );
        });
      }

      return false;
    };

    // Filter matching orders against inputs
    const matchedOrders = allOrders.filter(order => {
      if (!order) return false;

      const orderEmail = (order.customerEmail || '').toLowerCase().trim();
      const orderPhoneRaw = (order.customerPhone || '').trim();
      const orderPhoneDigits = getRawPhoneDigits(orderPhoneRaw);
      const orderCorePhone = getCorePhoneDigits(orderPhoneRaw);
      const orderIdStr = (order.id || '').toLowerCase().trim();
      const orderCleanId = orderIdStr.replace(/^#/, '');
      const orderCustomerName = (order.customerName || '').toLowerCase().trim();

      // 1. Order ID Match
      for (const cand of orderIdCandidates) {
        const cleanCand = cand.toLowerCase().replace(/^#/, '').trim();
        if (cleanCand && (orderCleanId === cleanCand || orderIdStr === cleanCand)) {
          return true;
        }
      }

      // 2. Email Match
      for (const candEmail of emailCandidates) {
        if (candEmail && orderEmail && (orderEmail === candEmail || orderEmail.includes(candEmail) || candEmail.includes(orderEmail))) {
          return true;
        }
      }

      // 3. Phone Match
      for (const candPhone of phoneCandidates) {
        const candDigits = getRawPhoneDigits(candPhone);
        const candCore = getCorePhoneDigits(candPhone);

        if (candDigits && candDigits.length >= 5) {
          if (orderPhoneDigits === candDigits || orderPhoneDigits.includes(candDigits) || candDigits.includes(orderPhoneDigits)) {
            return true;
          }
        }

        if (candCore && candCore.length >= 5 && orderCorePhone && orderCorePhone.length >= 5) {
          if (orderCorePhone === candCore || orderCorePhone.includes(candCore) || candCore.includes(orderCorePhone)) {
            return true;
          }
        }
      }

      // 4. Fallback search across all input terms
      for (const term of inputPool) {
        const cleanTerm = term.toLowerCase().replace(/^#/, '').trim();
        if (cleanTerm.length >= 3) {
          if (orderIdStr.includes(cleanTerm) || orderCleanId.includes(cleanTerm)) return true;
          if (orderEmail && orderEmail.includes(cleanTerm)) return true;
          if (orderCustomerName && orderCustomerName.includes(cleanTerm)) return true;
        }
      }

      return false;
    });

    // Prioritize Cakenic/Ticket orders
    const cakenicOrders = matchedOrders.filter(isCakenicOrTicketOrder);
    const finalOrders = cakenicOrders.length > 0 ? cakenicOrders : matchedOrders;

    // 🛡️ AUTO-RESCUE: If any retrieved order is pending or cancelled, verify against CHIP in parallel
    const rescuedOrders = await Promise.all(
      finalOrders.map(async (order) => {
        if (order.status === 'pending' || order.status === 'cancelled' || order.status === 'failed') {
          try {
            if (typeof window !== 'undefined' || typeof fetch !== 'undefined') {
              const verifyResp = await fetch(`/api/chip/verify/${encodeURIComponent(order.id)}`);
              if (verifyResp.ok) {
                const verifyData = await verifyResp.json();
                if (verifyData && verifyData.paid === true) {
                  return { ...order, status: 'paid' as Order['status'] };
                }
              }
            }
          } catch (_) {}
        }
        return order;
      })
    );

    return rescuedOrders;
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

