
import React, { useState, useEffect } from 'react';
import { Order, Product, CartItem } from '../../types';
import { Search, User, Users, Package, Calendar, Loader2, Check, Filter, ClipboardCopy, Clock, Mail, MapPin, ChevronDown, ChevronUp, Gift, Phone, Trash2, Printer, Receipt, CheckSquare, Square, TrendingUp, BarChart3, Hash, CreditCard, Tag, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Globe, Store, Edit, Plus, Minus, X, Save, ArrowUpDown } from 'lucide-react';
import { updateOrderAndRestock, deleteOrderFromDb, autoReleaseStaleOrders, updateOrderNotesInDb, updateOrderInDb } from '../../firebase';
import { generateReceiptHtml, generateReceiptText } from './POSSystem';

const getShippedDateString = (order: Order) => {
  if (!order.statusHistory) return null;
  const shippedEntry = [...order.statusHistory].reverse().find(h => h.status === 'shipped');
  return shippedEntry ? shippedEntry.timestamp : null;
};

const formatKLDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: '2-digit',
      month: '2-digit',
      day: '2-digit'
  });
};

const formatKLTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kuala_Lumpur',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
  });
};

const hasManualNote = (order: Order) => {
  if (order.giftMessage && order.giftMessage.trim().length > 0) {
    return true;
  }
  if (!order.adminNotes || !order.adminNotes.trim()) {
    return false;
  }
  if (order.source === 'pos') {
    const blocks = order.adminNotes.split('\n\n').map(b => b.trim()).filter(Boolean);
    return blocks.some(block => {
      const isAuto = block.startsWith('[Pre-Order Shipping]') || 
                     block.startsWith('[Free Shipping Promo applied') || 
                     block.startsWith('[Auto Blanket/Swaddle Promo applied') || 
                     block.startsWith('[POS Discount Applied:') ||
                     (block.startsWith('[') && block.endsWith(']') && (block.includes('Promo') || block.includes('applied') || block.includes('Discount') || block.includes('Shipping')));
      return !isAuto;
    });
  }
  return true;
};

const getKLDateString = (offsetDays: number = 0) => {
   const d = new Date();
   const klTime = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
   klTime.setDate(klTime.getDate() + offsetDays);
   const year = klTime.getFullYear();
   const month = String(klTime.getMonth() + 1).padStart(2, '0');
   const day = String(klTime.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
};

const getKLDateFromIso = (isoString: string) => {
   const klTime = new Date(new Date(isoString).toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
   const year = klTime.getFullYear();
   const month = String(klTime.getMonth() + 1).padStart(2, '0');
   const day = String(klTime.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
};

const getNormalizedProductInfo = (item: { name: string; collection?: string; category?: string; isCheckoutAddon?: boolean }) => {
  const collection = item.collection || '';
  const category = item.category || '';
  let name = item.name.trim().replace(/\s*\+\s*Extra\s+Protection\s+Box/gi, '').trim();

  // Determine if it is an Add-on product
  const isAddon = Boolean(item.isCheckoutAddon) || 
                  collection.toLowerCase().includes('add-on') || 
                  collection.toLowerCase().includes('addon') || 
                  category.toLowerCase().includes('add-on') || 
                  category.toLowerCase().includes('addon') ||
                  name.toLowerCase().includes('perfume') || 
                  name.toLowerCase().includes('hair oil') || 
                  name.toLowerCase().includes('oil') ||
                  name.toLowerCase().includes('gift box') ||
                  name.toLowerCase().includes('tote');

  if (isAddon) {
    return {
      key: name,
      displayLabel: name,
      group: 'other'
    };
  }

  // Determine if it is a blanket
  const isBlanket = collection === 'Blankets' || 
                    collection.toLowerCase().includes('blanket') ||
                    category.toLowerCase().includes('blanket') ||
                    // fallback if collection is empty but name suggests it
                    (!collection && !category && (name.toLowerCase().includes('blanket') || name.toLowerCase().includes('castle') || name.toLowerCase().includes('flight')));

  if (isBlanket) {
    if (name.includes('(Adult)')) {
      const baseName = name.replace('(Adult)', '').trim();
      return {
        key: `${baseName}|Adult|Blankets`,
        displayLabel: `${baseName} (Adult Blanket)`,
        group: 'blanket'
      };
    } else if (name.includes('(Baby)')) {
      const baseName = name.replace('(Baby)', '').trim();
      return {
        key: `${baseName}|Baby|Blankets`,
        displayLabel: `${baseName} (Baby Blanket)`,
        group: 'blanket'
      };
    } else {
      // Default to Baby Blanket if no size is specified
      return {
        key: `${name}|Baby|Blankets`,
        displayLabel: `${name} (Baby Blanket)`,
        group: 'blanket'
      };
    }
  }

  // Determine if it is a swaddle
  const isSwaddle = collection === 'Swaddle' || 
                    collection === 'Swaddles' || 
                    collection.toLowerCase().includes('swaddle') ||
                    category.toLowerCase().includes('swaddle');

  if (isSwaddle) {
    const baseName = name.replace('(Swaddle)', '').trim();
    return {
      key: `${baseName}|Swaddle`,
      displayLabel: `${baseName} (Swaddle)`,
      group: 'swaddle'
    };
  }

  // Fallback
  return {
    key: name,
    displayLabel: name,
    group: 'other'
  };
};

const renderStatusBadge = (status: string) => {
  const baseClasses = "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border";
  let colorClasses = "bg-yellow-50 border-yellow-200 text-yellow-700";
  if (status === 'delivered') colorClasses = "bg-green-50 border-green-200 text-green-700";
  else if (status === 'shipped') colorClasses = "bg-sky-50 border-sky-200 text-sky-700";
  else if (status === 'packed') colorClasses = "bg-purple-50 border-purple-200 text-purple-700";
  else if (status === 'paid') colorClasses = "bg-indigo-50 border-indigo-200 text-indigo-700";
  else if (status === 'failed') colorClasses = "bg-red-50 border-red-200 text-red-700";
  else if (status === 'cancelled') colorClasses = "bg-gray-100 border-gray-300 text-gray-500";
  return <span className={`${baseClasses} ${colorClasses}`}>{status}</span>;
};

interface SalesManagerProps {
  orders: Order[];
  products?: Product[];
}

export const SalesManager: React.FC<SalesManagerProps> = ({ orders, products }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Order Editing States
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('');
  const [selectedSizeToAdd, setSelectedSizeToAdd] = useState<'Baby' | 'Adult'>('Baby');
  const [addQty, setAddQty] = useState<number>(1);
  const [isSavingOrder, setIsSavingOrder] = useState<boolean>(false);

  const handleStartEditOrder = (order: Order) => {
    // Clone the order to avoid mutating the live state during edits
    setEditingOrder(JSON.parse(JSON.stringify(order)));
    setSelectedProductToAdd('');
    setSelectedSizeToAdd('Baby');
    setAddQty(1);
  };

  const handleUpdateEditingCustomerField = (field: keyof Order, value: any) => {
    if (!editingOrder) return;
    setEditingOrder(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleUpdateEditingItemQty = (index: number, change: number) => {
    if (!editingOrder) return;
    setEditingOrder(prev => {
      if (!prev) return null;
      const updatedItems = [...prev.items];
      const newQty = Math.max(1, updatedItems[index].quantity + change);
      updatedItems[index] = { ...updatedItems[index], quantity: newQty };
      
      // Auto recalculate total
      const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      return {
        ...prev,
        items: updatedItems,
        total: parseFloat(newTotal.toFixed(2))
      };
    });
  };

  const handleRemoveEditingItem = (index: number) => {
    if (!editingOrder) return;
    setEditingOrder(prev => {
      if (!prev) return null;
      const updatedItems = prev.items.filter((_, idx) => idx !== index);
      
      // Auto recalculate total
      const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      return {
        ...prev,
        items: updatedItems,
        total: parseFloat(newTotal.toFixed(2))
      };
    });
  };

  const handleToggleItemPickedUp = (index: number) => {
    if (!editingOrder) return;
    setEditingOrder(prev => {
      if (!prev) return null;
      const updatedItems = [...prev.items];
      const nextPickedUp = !updatedItems[index].isPickedUp;
      updatedItems[index] = { 
        ...updatedItems[index], 
        isPickedUp: nextPickedUp,
        isPreOrder: nextPickedUp ? false : updatedItems[index].isPreOrder
      };
      return {
        ...prev,
        items: updatedItems
      };
    });
  };

  const handleToggleItemPreOrder = (index: number) => {
    if (!editingOrder) return;
    setEditingOrder(prev => {
      if (!prev) return null;
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], isPreOrder: !updatedItems[index].isPreOrder };
      return {
        ...prev,
        items: updatedItems
      };
    });
  };

  const handleAddItemToEditingOrder = () => {
    if (!editingOrder || !selectedProductToAdd) return;
    const prod = products?.find(p => p.id === selectedProductToAdd);
    if (!prod) return;

    let itemPrice = prod.price;
    let itemName = prod.name;
    let sizeOption: string | undefined = undefined;

    if (prod.hasSizes) {
      sizeOption = selectedSizeToAdd;
      itemPrice = selectedSizeToAdd === 'Adult' ? (prod.adultPrice || prod.price) : (prod.babyPrice || prod.price);
      itemName = `${prod.name} (${selectedSizeToAdd})`;
    }

    const itemId = prod.id + (sizeOption ? `-${sizeOption}` : '');

    setEditingOrder(prev => {
      if (!prev) return null;
      const updatedItems = [...prev.items];
      const existingIndex = updatedItems.findIndex(i => i.id === itemId);

      if (existingIndex > -1) {
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + addQty
        };
      } else {
        const newItem: CartItem = {
          ...prod,
          id: itemId,
          name: itemName,
          price: itemPrice,
          quantity: addQty,
          sizeOption: sizeOption,
          isPreOrder: false,
          isPickedUp: false,
          baseProductId: prod.id,
        };
        updatedItems.push(newItem);
      }

      // Auto recalculate total
      const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        ...prev,
        items: updatedItems,
        total: parseFloat(newTotal.toFixed(2))
      };
    });

    // Reset fields
    setSelectedProductToAdd('');
    setSelectedSizeToAdd('Baby');
    setAddQty(1);
  };

  const handleSaveEditedOrder = async () => {
    if (!editingOrder) return;
    setIsSavingOrder(true);
    try {
      const { id, ...updates } = editingOrder;
      await updateOrderInDb(id, updates);
      alert('Order updated successfully!');
      setEditingOrder(null);
    } catch (error: any) {
      alert('Failed to save order changes: ' + error.message);
    } finally {
      setIsSavingOrder(false);
    }
  };
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateFilterType, setDateFilterType] = useState<'order' | 'shipped'>('order');
  const [orderSortBy, setOrderSortBy] = useState<'date-desc' | 'date-asc' | 'shipped-desc' | 'shipped-asc' | 'id-desc' | 'id-asc'>('date-desc');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [subTab, setSubTab] = useState<'orders' | 'customers'>('orders');
  const [customerSortBy, setCustomerSortBy] = useState<'spend-desc' | 'spend-asc' | 'orders-desc' | 'name-asc' | 'date-desc'>('spend-desc');
  const [expandedCustomerEmail, setExpandedCustomerEmail] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Email sending states for sales manager
  const [emailingOrderId, setEmailingOrderId] = useState<string | null>(null);
  const [salesEmailInput, setSalesEmailInput] = useState<string>('');
  const [salesIsSending, setSalesIsSending] = useState<boolean>(false);
  const [salesEmailStatus, setSalesEmailStatus] = useState<{ orderId: string; type: 'success' | 'error' | null; message: string } | null>(null);

  const handleSendSalesReceiptEmail = (order: Order) => {
    if (!salesEmailInput) return;
    setSalesIsSending(true);
    setSalesEmailStatus(null);

    try {
      const subject = `Receipt for Order #${order.id.toUpperCase().substring(0, 8)} - Once Upon`;
      const body = generateReceiptText(order);
      const mailtoUrl = `mailto:${encodeURIComponent(salesEmailInput)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // Open default mail app on device
      window.location.href = mailtoUrl;

      setSalesEmailStatus({ orderId: order.id, type: 'success', message: 'Opened device mail client! Please click send.' });
    } catch (error: any) {
      setSalesEmailStatus({ orderId: order.id, type: 'error', message: error.message || 'Failed to open mail client.' });
    } finally {
      setSalesIsSending(false);
    }
  };
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [deleteOrderConfirmation, setDeleteOrderConfirmation] = useState<string | null>(null);

  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});

  const handleNotesChange = (orderId: string, notes: string) => {
    setEditingNotes(prev => ({ ...prev, [orderId]: notes }));
  };

  const handleSaveNotes = async (orderId: string) => {
    try {
      await updateOrderNotesInDb(orderId, editingNotes[orderId] || '');
      alert('Notes saved successfully.');
    } catch (error: any) {
      alert('Failed to save notes: ' + error.message);
    }
  };

  // Auto-cleanup state
  const [lastCleanup, setLastCleanup] = useState<Date>(new Date());
  const [cleanupMessage, setCleanupMessage] = useState<string>('');

  const ORDER_STATUSES = ['pending', 'paid', 'packed', 'shipped', 'delivered', 'failed', 'cancelled'];

  // Extract unique product options with name and collection normalized
  const uniqueProducts = React.useMemo(() => {
    const itemsMap = new Map<string, { key: string; displayLabel: string; group: string }>();
    orders.forEach(o => {
      if (o.items) {
        o.items.forEach(i => {
          const info = getNormalizedProductInfo(i);
          if (!itemsMap.has(info.key)) {
            itemsMap.set(info.key, info);
          }
        });
      }
    });
    return Array.from(itemsMap.values()).sort((a, b) => {
      const weightA = a.group === 'swaddle' ? 1 : a.group === 'blanket' ? 2 : 3;
      const weightB = b.group === 'swaddle' ? 1 : b.group === 'blanket' ? 2 : 3;
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.displayLabel.localeCompare(b.displayLabel);
    });
  }, [orders]);

  // --- AUTOMATED STALE ORDER CLEANUP ---
  // Runs on mount and every 60 seconds
  useEffect(() => {
    const runCleanup = async () => {
      try {
        const releasedCount = await autoReleaseStaleOrders(60); // 60 minutes timeout
        setLastCleanup(new Date());
        if (releasedCount > 0) {
            setCleanupMessage(`Released stock for ${releasedCount} stale order(s).`);
            setTimeout(() => setCleanupMessage(''), 5000);
        }
      } catch (e) {
        console.error("Auto-cleanup failed", e);
      }
    };

    // Run immediately
    runCleanup();

    // Run interval
    const interval = setInterval(runCleanup, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterProduct, startDate, endDate, dateFilterType, filterSource, filterCountry, orderSortBy, subTab, customerSortBy]);

  interface CustomerData {
    email: string;
    name: string;
    phone: string;
    totalOrders: number;
    totalSpend: number;
    lastOrderDate: string;
    sources: Set<'pos' | 'online'>;
    countries: Set<'malaysia' | 'singapore'>;
    orders: Order[];
  }

  const customersList = React.useMemo(() => {
    const customerMap = new Map<string, CustomerData>();
    
    orders.forEach(order => {
      const key = (order.customerEmail || order.customerName || 'anonymous').toLowerCase().trim();
      const orderSource = order.source === 'pos' ? 'pos' : 'online';
      const orderCountry = (order.shippingAddress && order.shippingAddress.toLowerCase().includes('singapore')) ? 'singapore' : 'malaysia';
      
      const existing = customerMap.get(key);
      if (existing) {
        existing.totalOrders += 1;
        const isPaid = ['paid', 'packed', 'shipped', 'delivered'].includes(order.status);
        if (isPaid) {
          existing.totalSpend += order.total;
        }
        if (new Date(order.date) > new Date(existing.lastOrderDate)) {
          existing.lastOrderDate = order.date;
          existing.name = order.customerName || existing.name;
          existing.phone = order.customerPhone || existing.phone;
        }
        existing.sources.add(orderSource);
        existing.countries.add(orderCountry);
        existing.orders.push(order);
      } else {
        const isPaid = ['paid', 'packed', 'shipped', 'delivered'].includes(order.status);
        customerMap.set(key, {
          email: order.customerEmail || '',
          name: order.customerName || 'Anonymous',
          phone: order.customerPhone || '',
          totalOrders: 1,
          totalSpend: isPaid ? order.total : 0,
          lastOrderDate: order.date,
          sources: new Set([orderSource]),
          countries: new Set([orderCountry]),
          orders: [order]
        });
      }
    });

    customerMap.forEach(cust => {
      cust.orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
    
    return Array.from(customerMap.values());
  }, [orders]);

  const filteredCustomers = React.useMemo(() => {
    const list = customersList.filter(cust => {
      const matchesSearch = 
        cust.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        cust.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
        cust.phone.includes(searchQuery);
      
      const matchesSource = filterSource === 'all' || 
        (filterSource === 'pos' && cust.sources.has('pos')) || 
        (filterSource === 'online' && cust.sources.has('online'));
        
      const matchesCountry = filterCountry === 'all' || cust.countries.has(filterCountry as any);
        
      return matchesSearch && matchesSource && matchesCountry;
    });

    if (customerSortBy === 'spend-desc') {
      list.sort((a, b) => b.totalSpend - a.totalSpend);
    } else if (customerSortBy === 'spend-asc') {
      list.sort((a, b) => a.totalSpend - b.totalSpend);
    } else if (customerSortBy === 'orders-desc') {
      list.sort((a, b) => b.totalOrders - a.totalOrders);
    } else if (customerSortBy === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (customerSortBy === 'date-desc') {
      list.sort((a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());
    }

    return list;
  }, [customersList, searchQuery, filterSource, filterCountry, customerSortBy]);

  const customerAnalytics = React.useMemo(() => {
    let totalSpend = 0;
    let onlineCount = 0;
    let posCount = 0;
    customersList.forEach(c => {
      totalSpend += c.totalSpend;
      if (c.sources.has('online')) onlineCount++;
      if (c.sources.has('pos')) posCount++;
    });
    const avgLtv = customersList.length > 0 ? totalSpend / customersList.length : 0;
    return {
      totalCustomers: customersList.length,
      avgLtv,
      onlineCount,
      posCount
    };
  }, [customersList]);

  const setQuickDate = (range: 'today' | 'week' | 'month' | 'clear') => {
    if (range === 'clear') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const endStr = getKLDateString(0);
    let startStr = endStr;

    if (range === 'week') {
      startStr = getKLDateString(-7);
    } else if (range === 'month') {
      startStr = getKLDateString(-30);
    }
    
    setStartDate(startStr);
    setEndDate(endStr);
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string, currentStatus: string) => {
    // If Admin selects Cancelled or Failed, warn them about stock return
    if ((newStatus === 'cancelled' || newStatus === 'failed') && (currentStatus !== 'cancelled' && currentStatus !== 'failed')) {
        const confirm = window.confirm(`Setting this order to '${newStatus}' will AUTOMATICALLY RESTORE STOCK for these items.\n\nAre you sure you want to release the stock back to the store?`);
        if (!confirm) return;
    }

    try {
      await updateOrderAndRestock(orderId, newStatus, currentStatus);
    } catch (error: any) {
      alert("Failed to update status: " + error.message);
    }
  };

  const handleOrderDeleteClick = (id: string) => {
    if (deleteOrderConfirmation === id) {
      handleOrderDelete(id);
    } else {
      setDeleteOrderConfirmation(id);
      setTimeout(() => {
        setDeleteOrderConfirmation(prev => prev === id ? null : prev);
      }, 3000);
    }
  };

  const handleOrderDelete = async (id: string) => {
    setDeletingOrderId(id);
    setDeleteOrderConfirmation(null);
    try {
      await deleteOrderFromDb(id);
    } catch (error: any) {
      console.error("Delete Order Error:", error);
      alert("Failed to delete order.");
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handlePrintOrder = (order: Order) => {
    const printWindow = window.open('', '_blank', 'width=800,height=800');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Packing Slip #${order.id}</title>
         <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&family=Playfair+Display:wght@400;600;700&family=Pinyon+Script&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 0; }
          body { font-family: 'Playfair Display', serif; color: #1a1a1a; margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; }
          .container { padding: 40px 50px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #D9C4B8; }
          .brand-name { font-size: 32px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 5px; color: #1a1a1a; }
          .brand-subtitle { font-family: 'Pinyon Script', cursive; font-size: 24px; color: #C5A992; margin-top: 0; }
          .order-meta { display: flex; justify-content: space-between; margin-bottom: 40px; font-family: 'Lato', sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; }
          
          .address-section { margin-bottom: 40px; }
          .address-title { font-family: 'Lato', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; color: #999; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; width: 100%; }
          .address-content { font-size: 14px; line-height: 1.6; color: #333; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { text-align: left; font-family: 'Lato', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #999; padding: 10px 0; border-bottom: 1px solid #eee; }
          td { padding: 15px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; }
          .item-name { font-weight: 600; color: #1a1a1a; display: flex; align-items: center; gap: 8px; }
          .item-meta { font-size: 12px; color: #666; font-style: italic; }
          .qty-col { width: 60px; text-align: right; }
          .preorder-tag { font-size: 10px; color: #C5A992; text-transform: uppercase; border: 1px solid #C5A992; padding: 1px 4px; border-radius: 3px; font-family: 'Lato', sans-serif; font-weight: 700; }
          
          .footer { text-align: center; margin-top: 60px; padding-top: 30px; border-top: 1px solid #f5f5f5; }
          .thank-you { font-family: 'Pinyon Script', cursive; font-size: 32px; color: #D9C4B8; margin-bottom: 10px; }
          .footer-text { font-family: 'Lato', sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: #999; }
          
          .gift-message { background: #faf8f6; padding: 20px; border: 1px dashed #D9C4B8; margin-bottom: 30px; text-align: center; }
          .gift-title { font-family: 'Lato', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; color: #C5A992; margin-bottom: 10px; }
          .gift-text { font-family: 'Playfair Display', serif; font-style: italic; font-size: 16px; color: #555; }
        </style>
      </head>
      <body>
      <div class="container">
        <div class="header">
          <div class="brand-name">Once Upon</div>
          <div class="brand-subtitle">Kuala Lumpur</div>
        </div>
        
        <div class="order-meta">
          <div>Order #${order.id}</div>
          <div>${formatKLDate(order.date)} - ${formatKLTime(order.date)}</div>
        </div>
        
        <div class="address-section">
          <div class="address-title">Ship To</div>
          <div class="address-content">
            <strong>${order.customerName}</strong><br>
            ${order.shippingAddress}<br>
            Phone: ${order.customerPhone}<br>
            Email: ${order.customerEmail}
          </div>
        </div>
        
        ${order.isGift ? `
        <div class="gift-message">
          <div class="gift-title">A Gift For You</div>
          <div class="gift-text">
             To: ${order.giftTo || 'You'}<br>
             From: ${order.giftFrom || 'Someone Special'}<br><br>
             ${order.giftMessage ? `"${order.giftMessage}"` : ''}
          </div>
        </div>
        ` : ''}
        
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="qty-col">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>
                  <div class="item-name">
                    ${item.name}
                    ${item.isPreOrder ? '<span class="preorder-tag">Pre-order</span>' : ''}
                  </div>
                  <div class="item-meta">${item.collection || 'Blankets'}</div>
                </td>
                <td class="qty-col">${item.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <div class="thank-you">Designed with Love</div>
          <div class="footer-text">www.onceuponmy.com</div>
        </div>
      </div>
      <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleDownloadReceipt = (order: Order) => {
    const printWindow = window.open('', '_blank', 'width=450,height=800');
    if (!printWindow) return;
    const htmlContent = generateReceiptHtml(order);
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const _unused_handleDownloadReceipt = (order: Order) => {
    const printWindow = window.open('', '_blank', 'width=450,height=800');
    if (!printWindow) return;

    // Calculate subtotal from items
    const itemsSubtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Parse discounts from adminNotes
    let autoPromoDiscount = 0;
    let posDiscountAmount = 0;
    let freeShippingSaved = 0;

    if (order.adminNotes) {
      const autoPromoMatch = order.adminNotes.match(/Auto Blanket\/Swaddle Promo applied - Saved RM ([\d\.]+)/i);
      if (autoPromoMatch) {
        autoPromoDiscount = parseFloat(autoPromoMatch[1]);
      }
      
      const posDiscountMatch = order.adminNotes.match(/POS Discount Applied: .*? - Saved RM ([\d\.]+)/i);
      if (posDiscountMatch) {
        posDiscountAmount = parseFloat(posDiscountMatch[1]);
      }

      const freeShippingMatch = order.adminNotes.match(/Free Shipping Promo applied - Saved RM ([\d\.]+)/i);
      if (freeShippingMatch) {
        freeShippingSaved = parseFloat(freeShippingMatch[1]);
      }
    }

    const totalDiscount = autoPromoDiscount + posDiscountAmount;
    
    // Calculate if any shipping was paid
    const shippingPaid = Math.max(0, order.total - itemsSubtotal + totalDiscount);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt_#${order.id}</title>
        <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Pinyon+Script&display=swap" rel="stylesheet">
        <style>
          @media print {
            body {
              background: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            .receipt-container {
              border: none !important;
              box-shadow: none !important;
              margin: 0 auto !important;
              padding: 10px 0 !important;
              max-width: 100% !important;
              background: transparent !important;
            }
          }
          body {
            background-color: #F8F6F4;
            font-family: 'Lato', sans-serif;
            color: #333333;
            margin: 0;
            padding: 40px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            -webkit-print-color-adjust: exact;
          }
          .no-print-bar {
            width: 100%;
            max-width: 380px;
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 20px;
          }
          .btn {
            flex: 1;
            padding: 12px 16px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            text-align: center;
            text-decoration: none;
          }
          .btn-print {
            background-color: #4A5D4F;
            color: white;
          }
          .btn-print:hover {
            background-color: #3b4b40;
          }
          .btn-close {
            background-color: #E2DDD5;
            color: #555;
          }
          .btn-close:hover {
            background-color: #d5cfc5;
          }
          .receipt-container {
            background: #FFFFFF;
            width: 100%;
            max-width: 380px;
            box-sizing: border-box;
            padding: 35px 30px;
            border: 1px solid #E5DFD9;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
            position: relative;
          }
          .scallop-top {
            position: absolute;
            top: -6px;
            left: 0;
            width: 100%;
            height: 6px;
            background-image: radial-gradient(circle at 6px 0, transparent 5px, #FFFFFF 6px);
            background-size: 12px 6px;
            background-repeat: repeat-x;
          }
          .scallop-bottom {
            position: absolute;
            bottom: -6px;
            left: 0;
            width: 100%;
            height: 6px;
            background-image: radial-gradient(circle at 6px 6px, transparent 5px, #FFFFFF 6px);
            background-size: 12px 6px;
            background-repeat: repeat-x;
          }
          .brand-header {
            text-align: center;
            margin-bottom: 25px;
          }
          .brand-name {
            font-family: 'Playfair Display', serif;
            font-size: 26px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #1A1A1A;
            margin: 0 0 4px 0;
          }
          .brand-subtitle {
            font-family: 'Pinyon Script', cursive;
            font-size: 22px;
            color: #C5A992;
            margin: 0;
            line-height: 1;
          }
          .store-info {
            text-align: center;
            font-size: 10px;
            color: #777777;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-top: 6px;
            line-height: 1.5;
          }
          .receipt-title {
            text-align: center;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: #4A5D4F;
            margin: 20px 0 15px 0;
            border-top: 1px dashed #D9C4B8;
            border-bottom: 1px dashed #D9C4B8;
            padding: 6px 0;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            row-gap: 6px;
            font-size: 11px;
            color: #555555;
            margin-bottom: 20px;
          }
          .meta-label {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.08em;
            color: #888888;
          }
          .meta-value {
            text-align: right;
            font-family: 'Courier New', Courier, monospace;
            font-weight: 600;
          }
          .meta-value.customer {
            font-family: inherit;
            font-weight: normal;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .items-table th {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #888888;
            border-bottom: 1px solid #F0F2F2;
            padding-bottom: 6px;
            text-align: left;
          }
          .items-table th.qty { text-align: center; width: 40px; }
          .items-table th.amount { text-align: right; width: 80px; }
          .items-table td {
            padding: 10px 0;
            border-bottom: 1px solid #F8F6F4;
            font-size: 12px;
            vertical-align: top;
          }
          .item-desc {
            font-family: 'Playfair Display', serif;
            font-weight: 600;
            color: #1A1A1A;
          }
          .item-sub {
            font-size: 10px;
            color: #888888;
            margin-top: 2px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .item-qty {
            text-align: center;
            font-weight: bold;
            color: #555;
          }
          .item-amount {
            text-align: right;
            font-weight: bold;
            color: #1A1A1A;
          }
          .totals-section {
            border-top: 1px dashed #D9C4B8;
            padding-top: 12px;
            margin-bottom: 25px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #555555;
            margin-bottom: 6px;
          }
          .totals-row.grand-total {
            font-size: 16px;
            font-weight: 900;
            color: #1A1A1A;
            border-top: 1px solid #1A1A1A;
            padding-top: 10px;
            margin-top: 10px;
          }
          .totals-label {
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .totals-val {
            font-weight: bold;
          }
          .footer-section {
            text-align: center;
            margin-top: 30px;
          }
          .brand-motto {
            font-family: 'Playfair Display', serif;
            font-style: italic;
            font-size: 13px;
            color: #C5A992;
            margin-bottom: 8px;
          }
          .thank-you-msg {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: #777777;
            line-height: 1.4;
          }
          .barcode-container {
            margin-top: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
          }
          .barcode {
            width: 160px;
            height: 40px;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar no-print">
          <button class="btn btn-close" onclick="window.close()">Close</button>
          <button class="btn btn-print" onclick="window.print()">Print / Save PDF</button>
        </div>
        
        <div class="receipt-container">
          <div class="scallop-top"></div>
          <div class="scallop-bottom"></div>
          
          <div class="brand-header">
            <div class="brand-name">Once Upon</div>
            <div class="brand-subtitle">Kuala Lumpur</div>
            <div class="store-info">
              Swaddle & Blankets<br>
              Kuala Lumpur
            </div>
          </div>
          
          <div class="receipt-title">POS Transaction Receipt</div>
          
          <div class="meta-grid">
            <div class="meta-label">Receipt No:</div>
            <div class="meta-value">#POS-${order.id.toUpperCase().substring(0, 8)}</div>
            
            <div class="meta-label">Date:</div>
            <div class="meta-value">${formatKLDate(order.date)}</div>
            
            <div class="meta-label">Time:</div>
            <div class="meta-value">${formatKLTime(order.date)}</div>
            
            <div class="meta-label">Register:</div>
            <div class="meta-value">TERM-01</div>
            
            <div class="meta-label">Cashier:</div>
            <div class="meta-value">ADMIN</div>
            
            <div class="meta-label">Customer:</div>
            <div class="meta-value customer" style="text-align: right;">${order.customerName}</div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th class="qty">Qty</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => {
                const isAddon = Boolean(item.isCheckoutAddon);
                const isBlanket = !item.collection || item.collection === 'Blankets' || item.collection.toLowerCase().includes('blanket') || (item.category && item.category.toLowerCase().includes('blanket'));
                const itemCollection = isAddon ? 'Add-on' : (isBlanket ? 'Blanket' : 'Swaddle');
                return `
                  <tr>
                    <td>
                      <div class="item-desc">${item.name}</div>
                      <div class="item-sub">${itemCollection} ${item.isPreOrder ? '(Pre-Order)' : ''}</div>
                    </td>
                    <td class="item-qty">${item.quantity}</td>
                    <td class="item-amount">RM ${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="totals-section">
            <div class="totals-row">
              <span class="totals-label">Subtotal</span>
              <span class="totals-val">RM ${itemsSubtotal.toFixed(2)}</span>
            </div>
            ${shippingPaid > 0 ? `
            <div class="totals-row">
              <span class="totals-label">Shipping</span>
              <span class="totals-val">RM ${shippingPaid.toFixed(2)}</span>
            </div>
            ` : ''}
            ${autoPromoDiscount > 0 ? `
            <div class="totals-row" style="color: #4A5D4F;">
              <span class="totals-label">Promo Discount (RM 8/item)</span>
              <span class="totals-val">-RM ${autoPromoDiscount.toFixed(2)}</span>
            </div>
            ` : ''}
            ${posDiscountAmount > 0 ? `
            <div class="totals-row" style="color: #4A5D4F;">
              <span class="totals-label">POS Discount</span>
              <span class="totals-val">-RM ${posDiscountAmount.toFixed(2)}</span>
            </div>
            ` : ''}
            ${totalDiscount > 0 && autoPromoDiscount === 0 && posDiscountAmount === 0 ? `
            <div class="totals-row" style="color: #4A5D4F;">
              <span class="totals-label">Discount</span>
              <span class="totals-val">-RM ${totalDiscount.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="totals-row">
              <span class="totals-label">SST (6%)</span>
              <span class="totals-val">RM 0.00</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">Payment Mode</span>
              <span class="totals-val" style="text-transform: uppercase;">${(order.paymentMethod || 'cash').replace('_', ' ')}</span>
            </div>
            <div class="totals-row grand-total">
              <span class="totals-label">Total Paid</span>
              <span class="totals-val">RM ${Number(order.total).toFixed(2)}</span>
            </div>
          </div>
          
          <div class="footer-section">
            <div class="brand-motto">Where every design tells a story.</div>
            <div class="thank-you-msg">
              Thank you for shopping at Once Upon.<br>
              Please keep this receipt as proof of purchase.<br>
              Follow us on Instagram @onceuponbysyahirah
            </div>
            
            <div class="barcode-container">
              <svg class="barcode" viewBox="0 0 100 25" preserveAspectRatio="none">
                <g fill="#000000">
                  <rect x="0" y="0" width="1" height="20" />
                  <rect x="2" y="0" width="1" height="20" />
                  <rect x="4" y="0" width="2" height="20" />
                  <rect x="7" y="0" width="1" height="20" />
                  <rect x="9" y="0" width="3" height="20" />
                  <rect x="13" y="0" width="1" height="20" />
                  <rect x="15" y="0" width="2" height="20" />
                  <rect x="18" y="0" width="1" height="20" />
                  <rect x="20" y="0" width="2" height="20" />
                  <rect x="23" y="0" width="4" height="20" />
                  <rect x="28" y="0" width="1" height="20" />
                  <rect x="30" y="0" width="1" height="20" />
                  <rect x="32" y="0" width="3" height="20" />
                  <rect x="36" y="0" width="2" height="20" />
                  <rect x="39" y="0" width="1" height="20" />
                  <rect x="41" y="0" width="2" height="20" />
                  <rect x="44" y="0" width="4" height="20" />
                  <rect x="49" y="0" width="1" height="20" />
                  <rect x="51" y="0" width="2" height="20" />
                  <rect x="54" y="0" width="1" height="20" />
                  <rect x="56" y="0" width="3" height="20" />
                  <rect x="60" y="0" width="2" height="20" />
                  <rect x="63" y="0" width="1" height="20" />
                  <rect x="65" y="0" width="2" height="20" />
                  <rect x="68" y="0" width="4" height="20" />
                  <rect x="73" y="0" width="1" height="20" />
                  <rect x="75" y="0" width="1" height="20" />
                  <rect x="77" y="0" width="3" height="20" />
                  <rect x="81" y="0" width="2" height="20" />
                  <rect x="84" y="0" width="1" height="20" />
                  <rect x="86" y="0" width="2" height="20" />
                  <rect x="89" y="0" width="3" height="20" />
                  <rect x="93" y="0" width="1" height="20" />
                  <rect x="95" y="0" width="1" height="20" />
                  <text x="50" y="25" font-family="'Courier New', monospace" font-size="4" text-anchor="middle" letter-spacing="1">POS*${order.id.substring(0, 6).toUpperCase()}*</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const toggleOrderSelection = (id: string) => {
    const newSet = new Set(selectedOrders);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedOrders(newSet);
  };
  
  const filteredOrders = orders.filter(order => {
     const matchesSearch = 
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.includes(searchQuery) ||
      (order.customerPhone && order.customerPhone.includes(searchQuery));
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesProduct = filterProduct === 'all' || order.items.some(item => {
      const info = getNormalizedProductInfo(item);
      return info.key === filterProduct;
    });

    let matchesDate = true;
    if (startDate || endDate) {
      if (dateFilterType === 'order') {
        const orderKLDateStr = getKLDateFromIso(order.date);
        if (startDate) matchesDate = matchesDate && orderKLDateStr >= startDate;
        if (endDate) matchesDate = matchesDate && orderKLDateStr <= endDate;
      } else {
        const shippedDateStr = getShippedDateString(order);
        if (shippedDateStr) {
          const shippedKLDateStr = getKLDateFromIso(shippedDateStr);
          if (startDate) matchesDate = matchesDate && shippedKLDateStr >= startDate;
          if (endDate) matchesDate = matchesDate && shippedKLDateStr <= endDate;
        } else {
          matchesDate = false;
        }
      }
    }

    const matchesSource = filterSource === 'all' || 
      (filterSource === 'pos' && order.source === 'pos') || 
      (filterSource === 'online' && order.source !== 'pos');

    const isSingapore = order.shippingAddress ? order.shippingAddress.toLowerCase().includes('singapore') : false;
    const matchesCountry = filterCountry === 'all' || 
      (filterCountry === 'singapore' && isSingapore) || 
      (filterCountry === 'malaysia' && !isSingapore);

    return matchesSearch && matchesStatus && matchesDate && matchesProduct && matchesSource && matchesCountry;
  });

  const sortedOrders = React.useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      if (orderSortBy === 'date-desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (orderSortBy === 'date-asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (orderSortBy === 'shipped-desc') {
        const dateA = getShippedDateString(a);
        const dateB = getShippedDateString(b);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }
      if (orderSortBy === 'shipped-asc') {
        const dateA = getShippedDateString(a);
        const dateB = getShippedDateString(b);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      }
      if (orderSortBy === 'id-desc') {
        return Number(b.id) - Number(a.id);
      }
      if (orderSortBy === 'id-asc') {
        return Number(a.id) - Number(b.id);
      }
      return 0;
    });
  }, [filteredOrders, orderSortBy]);

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };
  
  const handleBulkCopy = async () => {
    const ordersToCopy = orders.filter(o => selectedOrders.has(o.id));
    
    if (ordersToCopy.length === 0) return;

    const textToCopy = ordersToCopy.map(order => order.id).join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      alert(`${ordersToCopy.length} Order Number(s) copied to clipboard!`);
    } catch (err) {
      console.error("Copy failed", err);
      alert("Failed to copy to clipboard.");
    }
  };

  // Helper to identify old pending orders
  const isStalePending = (order: Order) => {
    if (order.status !== 'pending') return false;
    const orderTime = new Date(order.date).getTime();
    const now = new Date().getTime();
    // Consider stale if older than 60 minutes
    return (now - orderTime) > (60 * 60 * 1000); 
  };

  // --- ANALYTICS CALCULATION ---
  // Only consider 'paid', 'packed', 'shipped', 'delivered' as valid sales for revenue calculation
  const analytics = filteredOrders.reduce((acc, order) => {
    const isSale = ['paid', 'packed', 'shipped', 'delivered'].includes(order.status);
    
    if (isSale) {
      acc.totalRevenue += order.total;
      acc.totalItems += order.items.reduce((sum, item) => sum + item.quantity, 0);
      acc.successfulOrders += 1;
    }
    
    acc.totalOrders += 1; // Tracks visible rows regardless of status
    return acc;
  }, { totalRevenue: 0, totalOrders: 0, totalItems: 0, successfulOrders: 0 });

  const averageOrderValue = analytics.successfulOrders > 0 
    ? analytics.totalRevenue / analytics.successfulOrders 
    : 0;

  // --- PAGINATION CALCULATION ---
  const activeCount = subTab === 'orders' ? filteredOrders.length : filteredCustomers.length;
  const totalPages = Math.ceil(activeCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = sortedOrders.slice(startIndex, startIndex + itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-brand-latte/10 pb-6">
        <div>
            <h2 className="font-serif text-2xl md:text-3xl text-gray-900">Sales & Customers</h2>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400 uppercase tracking-widest">Manage orders and check status</p>
                <div className="h-1 w-1 bg-gray-300 rounded-full"></div>
                <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded border border-green-100 animate-pulse">
                    <RefreshCw size={10} className="animate-spin-slow" /> Auto-Monitor Active
                </div>
            </div>
            {cleanupMessage && <p className="text-[10px] text-brand-flamingo font-bold mt-1 animate-fade-in">{cleanupMessage}</p>}
        </div>
        
        {/* SubTab Toggle */}
        <div className="flex bg-brand-grey/10 p-1 rounded-[2px] border border-brand-latte/10">
          <button 
            onClick={() => setSubTab('orders')}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-[2px] transition-all flex items-center gap-2 ${
              subTab === 'orders' 
                ? 'bg-white text-brand-flamingo shadow-sm' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Orders ({filteredOrders.length})
          </button>
          <button 
            onClick={() => setSubTab('customers')}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-[2px] transition-all flex items-center gap-2 ${
              subTab === 'customers' 
                ? 'bg-white text-brand-flamingo shadow-sm' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Customers ({filteredCustomers.length})
          </button>
        </div>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          {/* Date Range Selector - Only for Orders tab */}
          {subTab === 'orders' && (
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white border border-brand-latte/20 p-2 rounded-[2px] self-start shadow-sm">
              <div className="flex gap-1.5 items-center px-2 text-gray-500">
                {dateFilterType === 'order' ? <Clock size={13} className="text-gray-400" /> : <Package size={13} className="text-sky-500" />}
                <div className="relative">
                  <select 
                    value={dateFilterType} 
                    onChange={(e) => {
                      const val = e.target.value as 'order' | 'shipped';
                      setDateFilterType(val);
                      if (val === 'shipped') {
                        setOrderSortBy('shipped-desc');
                      } else {
                        setOrderSortBy('date-desc');
                      }
                    }} 
                    className="appearance-none bg-transparent hover:bg-brand-grey/5 border-0 pl-1 pr-6 py-1.5 rounded-[2px] text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:ring-0 text-gray-700 cursor-pointer transition-colors"
                  >
                    <option value="order">Order Date</option>
                    <option value="shipped">Shipped Date</option>
                  </select>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-gray-500">
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="currentColor" className="text-current"><path d="M4 6L0 0H8L4 6Z" /></svg>
                  </div>
                </div>
              </div>
              <div className="h-6 w-[1px] bg-brand-latte/20 hidden sm:block"></div>
              <div className="flex gap-1">
                  <button onClick={() => setQuickDate('today')} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-brand-grey/10 hover:bg-brand-flamingo hover:text-white rounded-[2px] transition-colors">Today</button>
                  <button onClick={() => setQuickDate('week')} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-brand-grey/10 hover:bg-brand-flamingo hover:text-white rounded-[2px] transition-colors">7 Days</button>
                  <button onClick={() => setQuickDate('month')} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-brand-grey/10 hover:bg-brand-flamingo hover:text-white rounded-[2px] transition-colors">30 Days</button>
                  {(startDate || endDate) && (<button onClick={() => setQuickDate('clear')} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-50 rounded-[2px] transition-colors">Clear</button>)}
              </div>
              <div className="h-6 w-[1px] bg-brand-latte/20 hidden sm:block"></div>
              <div className="flex gap-2 items-center flex-1 w-full sm:w-auto">
                  <div className="relative w-full sm:w-auto group">
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-latte group-hover:text-brand-flamingo transition-colors"><Calendar size={14} /></div>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} onClick={(e) => (e.currentTarget as any).showPicker()} className="pl-3 pr-8 py-1.5 bg-brand-grey/5 hover:bg-white border border-transparent hover:border-brand-latte/30 rounded-[2px] text-[10px] font-bold uppercase tracking-widest text-gray-600 focus:outline-none focus:border-brand-flamingo w-full sm:w-auto cursor-pointer transition-all [&::-webkit-calendar-picker-indicator]:hidden" />
                  </div>
                  <span className="text-gray-300">-</span>
                  <div className="relative w-full sm:w-auto group">
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-latte group-hover:text-brand-flamingo transition-colors"><Calendar size={14} /></div>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} onClick={(e) => (e.currentTarget as any).showPicker()} className="pl-3 pr-8 py-1.5 bg-brand-grey/5 hover:bg-white border border-transparent hover:border-brand-latte/30 rounded-[2px] text-[10px] font-bold uppercase tracking-widest text-gray-600 focus:outline-none focus:border-brand-flamingo w-full sm:w-auto cursor-pointer transition-all [&::-webkit-calendar-picker-indicator]:hidden" />
                  </div>
              </div>
            </div>
          )}

          {/* Core Filters Panel */}
          <div className="flex flex-col lg:flex-row gap-3">
              {/* Order Specific Filters */}
              {subTab === 'orders' && (
                <>
                  <div className="relative">
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="appearance-none bg-white border border-brand-latte/30 px-4 py-3 pr-10 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo text-gray-600 w-full lg:w-36">
                        <option value="all">All Status</option>
                        {ORDER_STATUSES.map(status => (<option key={status} value={status}>{status}</option>))}
                    </select>
                    <Filter size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  
                  <div className="relative">
                    <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="appearance-none bg-white border border-brand-latte/30 px-4 py-3 pr-10 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo text-gray-600 w-full lg:w-44 truncate">
                        <option value="all">All Products</option>
                        {uniqueProducts.map(p => {
                          return (
                            <option key={p.key} value={p.key}>
                              {p.displayLabel}
                            </option>
                          );
                        })}
                    </select>
                    <Tag size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>

                  {/* Order Sorting Dropdown */}
                  <div className="relative">
                    <select value={orderSortBy} onChange={(e) => setOrderSortBy(e.target.value as any)} className="appearance-none bg-white border border-brand-latte/30 px-4 py-3 pr-10 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo text-gray-600 w-full lg:w-56">
                        <option value="date-desc">Newest First (Order)</option>
                        <option value="date-asc">Oldest First (Order)</option>
                        <option value="shipped-desc">Newest First (Shipped)</option>
                        <option value="shipped-asc">Oldest First (Shipped)</option>
                        <option value="id-desc">Order No (Highest)</option>
                        <option value="id-asc">Order No (Lowest)</option>
                    </select>
                    <ArrowUpDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </>
              )}

              {subTab === 'customers' && (
                <div className="relative">
                  <select value={customerSortBy} onChange={(e) => setCustomerSortBy(e.target.value as any)} className="appearance-none bg-white border border-brand-latte/30 px-4 py-3 pr-10 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo text-gray-600 w-full lg:w-56">
                      <option value="spend-desc">Highest Spend (LTV)</option>
                      <option value="spend-asc">Lowest Spend (LTV)</option>
                      <option value="orders-desc">Most Orders</option>
                      <option value="name-asc">Name (A - Z)</option>
                      <option value="date-desc">Latest Activity</option>
                  </select>
                  <ArrowUpDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              )}

              {/* Country Selector - For Both Tabs */}
              <div className="relative">
                <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} className="appearance-none bg-white border border-brand-latte/30 px-4 py-3 pr-10 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo text-gray-600 w-full lg:w-44">
                    <option value="all">All Countries</option>
                    <option value="malaysia">Malaysia</option>
                    <option value="singapore">Singapore</option>
                </select>
                <Globe size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Source/Channel Selector - For Both Tabs */}
              <div className="relative">
                <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="appearance-none bg-white border border-brand-latte/30 px-4 py-3 pr-10 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo text-gray-600 w-full lg:w-44">
                    <option value="all">All Channels</option>
                    <option value="online">Online Sales</option>
                    <option value="pos">POS Sales Only</option>
                </select>
                <Store size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Universal Search */}
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder={subTab === 'orders' ? "Search order #, name, email, phone..." : "Search customer name, email, phone..."} 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full pl-10 pr-4 py-3 bg-white border border-brand-latte/30 focus:border-brand-flamingo outline-none text-sm rounded-[2px] shadow-sm" 
                />
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
          </div>
        </div>

        {/* --- ANALYTICS CARDS --- */}
        {subTab === 'orders' ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
             <div className="bg-white p-5 border border-brand-latte/20 rounded-[2px] shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10 text-brand-flamingo"><CreditCard size={48} /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Sales</p>
                <h3 className="font-serif text-2xl text-gray-900">RM {analytics.totalRevenue.toLocaleString()}</h3>
             </div>
             
             <div className="bg-white p-5 border border-brand-latte/20 rounded-[2px] shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10 text-brand-gold"><Hash size={48} /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Orders Count</p>
                <h3 className="font-serif text-2xl text-gray-900">{analytics.totalOrders}</h3>
             </div>

             <div className="bg-white p-5 border border-brand-latte/20 rounded-[2px] shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10 text-brand-green"><Package size={48} /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Items Sold</p>
                <h3 className="font-serif text-2xl text-gray-900">{analytics.totalItems}</h3>
             </div>

             <div className="bg-white p-5 border border-brand-latte/20 rounded-[2px] shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10 text-blue-400"><TrendingUp size={48} /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Avg. Order Value</p>
                <h3 className="font-serif text-2xl text-gray-900">RM {averageOrderValue.toFixed(2)}</h3>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
             <div className="bg-white p-5 border border-brand-latte/20 rounded-[2px] shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10 text-brand-flamingo"><Users size={48} /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Customers</p>
                <h3 className="font-serif text-2xl text-gray-900">{customerAnalytics.totalCustomers}</h3>
             </div>
             
             <div className="bg-white p-5 border border-brand-latte/20 rounded-[2px] shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10 text-brand-gold"><TrendingUp size={48} /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Average Spend (LTV)</p>
                <h3 className="font-serif text-2xl text-gray-900">RM {customerAnalytics.avgLtv.toFixed(2)}</h3>
             </div>

             <div className="bg-white p-5 border border-brand-latte/20 rounded-[2px] shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10 text-brand-green"><Globe size={48} /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Online Buyers</p>
                <h3 className="font-serif text-2xl text-gray-900">{customerAnalytics.onlineCount}</h3>
             </div>

             <div className="bg-white p-5 border border-brand-latte/20 rounded-[2px] shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 p-4 opacity-10 text-blue-400"><Store size={48} /></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">POS Buyers</p>
                <h3 className="font-serif text-2xl text-gray-900">{customerAnalytics.posCount}</h3>
             </div>
          </div>
        )}

        {subTab === 'orders' && selectedOrders.size > 0 && (
        <div className="bg-brand-flamingo/5 border border-brand-flamingo/20 p-3 rounded-[2px] mb-4 flex items-center justify-between animate-fade-in">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-flamingo px-2">{selectedOrders.size} Selected</span>
            <button onClick={handleBulkCopy} className="bg-white border border-brand-flamingo/20 text-brand-flamingo px-4 py-2 rounded-[2px] text-[10px] font-bold uppercase tracking-widest hover:bg-brand-flamingo hover:text-white transition-colors flex items-center gap-2">
            <ClipboardCopy size={14} /> Copy Order Numbers
            </button>
        </div>
        )}
        {subTab === 'orders' ? (
          filteredOrders.length === 0 ? (
          <div className="text-center py-24 bg-white border border-dashed border-brand-latte/30 rounded-[2px]">
            <Package size={32} className="mx-auto text-brand-latte mb-3 opacity-50" />
            <p className="text-gray-400 text-sm">No orders found matching filters.</p>
            {(searchQuery || filterStatus !== 'all' || filterProduct !== 'all' || startDate || endDate || filterCountry !== 'all') && (
              <button 
                onClick={() => {
                  setSearchQuery(''); 
                  setFilterStatus('all'); 
                  setFilterProduct('all'); 
                  setStartDate(''); 
                  setEndDate('');
                  setFilterCountry('all');
                }} 
                className="text-brand-flamingo text-xs font-bold uppercase mt-2 hover:underline"
              >
                Clear Filters
              </button>
            )}
        </div>
        ) : (
        <div className="bg-white border border-brand-latte/20 rounded-[2px] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                <tr className="bg-brand-grey/10 border-b border-brand-latte/20">
                    <th className="p-4 w-12"><button onClick={toggleSelectAll} className="text-gray-400 hover:text-brand-flamingo">{selectedOrders.size > 0 && selectedOrders.size === filteredOrders.length ? (<CheckSquare size={16} className="text-brand-flamingo" />) : (<Square size={16} />)}</button></th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Order ID / Date</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Customer</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Items</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Total</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Status</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 w-24 text-center">Actions</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-brand-latte/10">
                {paginatedOrders.map(order => {
                    const shippedDateStr = getShippedDateString(order);
                    return (
                    <React.Fragment key={order.id}>
                    <tr 
                        className={`transition-colors cursor-pointer group ${
                        expandedOrderId === order.id ? 'bg-brand-grey/10' : selectedOrders.has(order.id) ? 'bg-brand-flamingo/5' : 'hover:bg-brand-grey/5'
                        }`}
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                    >
                        <td className="p-4" onClick={(e) => e.stopPropagation()}><button onClick={() => toggleOrderSelection(order.id)} className="text-gray-400 hover:text-brand-flamingo">{selectedOrders.has(order.id) ? (<CheckSquare size={16} className="text-brand-flamingo" />) : (<Square size={16} />)}</button></td>
                        <td className="p-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-mono text-xs text-gray-400 font-bold" title={order.id}>{order.id.length > 8 ? `#${order.id.substring(0,6)}...` : `#${order.id}`}</div>
                                {hasManualNote(order) && (
                                    <span 
                                        className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded animate-pulse shadow-sm"
                                        title={order.adminNotes || order.giftMessage}
                                    >
                                        <AlertTriangle size={10} className="text-amber-500" /> HAS NOTE
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col mt-1.5 gap-0.5">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500" title="Order Date"><Calendar size={12} /> {formatKLDate(order.date)}</div>
                                <div className="flex items-center gap-1.5 text-xs text-gray-400" title="Order Time"><Clock size={12} /> {formatKLTime(order.date)}</div>
                                {order.source === 'pos' && (
                                  <div className="mt-1 bg-brand-flamingo/10 text-brand-flamingo text-[9px] font-bold uppercase px-1.5 py-0.5 rounded w-fit tracking-widest border border-brand-flamingo/20">POS</div>
                                )}
                                {shippedDateStr && (
                                  <div className="mt-1.5 pt-1.5 border-t border-dashed border-brand-latte/20">
                                    <div className="text-[9px] uppercase tracking-widest font-bold text-blue-600">Shipped At:</div>
                                    <div className="flex items-center gap-1.5 text-xs text-blue-700 font-medium" title="Shipped Date"><Calendar size={12} /> {formatKLDate(shippedDateStr)}</div>
                                    <div className="flex items-center gap-1.5 text-xs text-blue-500" title="Shipped Time"><Clock size={12} /> {formatKLTime(shippedDateStr)}</div>
                                  </div>
                                )}
                            </div>
                            {/* Stale Warning for Pending > 60 mins */}
                            {isStalePending(order) && (
                                <div className="mt-1 flex items-center gap-1 text-[9px] font-bold uppercase text-red-500 animate-pulse bg-red-50 px-1.5 py-0.5 rounded w-fit border border-red-100">
                                    <Clock size={10} /> Stuck?
                                </div>
                            )}
                        </td>
                        <td className="p-4"><div className="flex items-start gap-2"><div className="bg-brand-latte/20 p-1.5 rounded-full mt-0.5"><User size={12} className="text-brand-latte" /></div><div><div className="font-serif text-gray-900">{order.customerName}</div><div className="text-xs text-gray-400">{order.customerEmail}</div>{order.customerPhone && (<div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5"><Phone size={10} /> {order.customerPhone}</div>)}</div></div></td>
                        <td className="p-4">
                            <div className="text-xs text-gray-600">
                                {order.items.map(i => {
                                    const isAddon = Boolean(i.isCheckoutAddon);
                                    const isBlanket = !i.collection || i.collection === 'Blankets' || i.collection.toLowerCase().includes('blanket') || (i.category && i.category.toLowerCase().includes('blanket'));
                                    const itemCollection = isAddon ? 'Add-on' : (isBlanket ? 'Blanket' : 'Swaddle');
                                    return (
                                        <div key={i.id} className="mb-1.5 flex items-center gap-1 flex-wrap">
                                            <span>{i.quantity}x {i.name}</span>
                                            {i.isPickedUp === true ? (
                                                <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 uppercase tracking-wider whitespace-nowrap">
                                                    🤝 Handed Over
                                                </span>
                                            ) : order.source === 'pos' ? (
                                                <span className="text-[8px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 uppercase tracking-wider whitespace-nowrap">
                                                    📦 To Pack
                                                </span>
                                            ) : null}
                                            <span className={`text-[8px] font-sans font-bold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap ${
                                                isAddon 
                                                    ? 'bg-gray-100 text-gray-500 border-gray-200' 
                                                    : isBlanket 
                                                        ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/20' 
                                                        : 'bg-brand-flamingo/10 text-brand-flamingo border-brand-flamingo/20'
                                            }`}>
                                                {itemCollection}
                                            </span>
                                            {i.isPreOrder && (
                                                <span className="text-[9px] font-bold text-brand-gold bg-brand-gold/10 px-1 rounded uppercase tracking-wider whitespace-nowrap">
                                                    Pre-order
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-sm text-gray-900">RM {order.total}</div>
                          {order.paymentMethod && (
                            <div className="text-[9px] text-gray-400 font-bold uppercase mt-1 tracking-widest">{order.paymentMethod.replace('_', ' ')}</div>
                          )}
                        </td>
                        <td className="p-4" onClick={(e) => e.stopPropagation()}><div className="relative inline-block"><select value={order.status} onChange={(e) => handleStatusUpdate(order.id, e.target.value, order.status)} className={`appearance-none pl-3 pr-8 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-flamingo ${ order.status === 'delivered' ? 'bg-green-50 border-green-200 text-green-700' : order.status === 'shipped' ? 'bg-sky-50 border-sky-200 text-sky-700' : order.status === 'packed' ? 'bg-purple-50 border-purple-200 text-purple-700' : order.status === 'paid' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : order.status === 'failed' ? 'bg-red-50 border-red-200 text-red-700' : order.status === 'cancelled' ? 'bg-gray-100 border-gray-300 text-gray-500' : 'bg-yellow-50 border-yellow-200 text-yellow-700' }`}>{ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select><div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"><svg width="8" height="6" viewBox="0 0 8 6" fill="currentColor" className="text-current"><path d="M4 6L0 0H8L4 6Z" /></svg></div></div></td>
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleDownloadReceipt(order)} className="text-gray-400 hover:text-brand-flamingo p-1.5 hover:bg-brand-flamingo/5 rounded transition-colors" title="Download Receipt"><Receipt size={16} /></button>
                            <button 
                                onClick={() => {
                                    setExpandedOrderId(order.id);
                                    setEmailingOrderId(order.id);
                                    setSalesEmailInput(order.customerEmail || '');
                                    setSalesEmailStatus(null);
                                }} 
                                className="text-gray-400 hover:text-brand-flamingo p-1.5 hover:bg-brand-flamingo/5 rounded transition-colors" 
                                title="Email Receipt"
                            >
                                <Mail size={16} />
                            </button>
                            <button onClick={() => handlePrintOrder(order)} className="text-gray-400 hover:text-brand-flamingo p-1.5 hover:bg-brand-flamingo/5 rounded transition-colors" title="Print Packing Slip"><Printer size={16} /></button>
                            <button onClick={() => handleOrderDeleteClick(order.id)} disabled={deletingOrderId === order.id} className={`p-1.5 rounded transition-all ${ deleteOrderConfirmation === order.id ? 'bg-red-50 text-red-500 ring-1 ring-red-200' : 'text-gray-300 hover:text-red-400 hover:bg-red-50' }`} title="Delete Order">{deletingOrderId === order.id ? (<Loader2 size={16} className="animate-spin" />) : deleteOrderConfirmation === order.id ? (<Check size={16} />) : (<Trash2 size={16} />)}</button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setExpandedOrderId(expandedOrderId === order.id ? null : order.id); }}
                                className="text-gray-400 hover:text-brand-flamingo p-1.5 rounded transition-colors"
                            >
                                {expandedOrderId === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>
                        </td>
                    </tr>
                    {/* EXPANDED ROW */}
                    {expandedOrderId === order.id && (
                        <tr className="bg-brand-grey/5 border-b border-brand-latte/20 animate-fade-in relative shadow-inner">
                        <td colSpan={7} className="p-0">
                            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                                {/* Left: Items */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-4 gap-4">
                                        <h4 className="font-serif text-sm font-bold uppercase tracking-widest text-gray-900">Order Items</h4>
                                        <button 
                                            onClick={() => handleStartEditOrder(order)}
                                            className="bg-brand-flamingo hover:bg-brand-flamingo/90 text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 rounded-[2px]"
                                            title="Edit items, customer info, gift message, or manual price override for this order"
                                        >
                                            <Edit size={12} /> Edit Order
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                    {order.items.map((item, idx) => {
                                        const isAddon = Boolean(item.isCheckoutAddon);
                                        const isBlanket = !item.collection || item.collection === 'Blankets' || item.collection.toLowerCase().includes('blanket') || (item.category && item.category.toLowerCase().includes('blanket'));
                                        const itemCollection = isAddon ? 'Add-on' : (isBlanket ? 'Blanket Collection' : 'Swaddle Collection');
                                        return (
                                            <div key={idx} className="flex gap-4 items-center bg-white p-3 rounded-[2px] border border-brand-latte/20">
                                                <img src={item.image} className="w-12 h-16 object-cover bg-gray-100" />
                                                <div className="flex-1">
                                                    <p className="font-serif text-gray-900 mb-1">{item.name}</p>
                                                    <span className={`inline-block text-[9px] font-sans font-bold uppercase px-2 py-0.5 rounded border mb-1 tracking-wider ${
                                                        isAddon 
                                                            ? 'bg-gray-100 text-gray-500 border-gray-200' 
                                                            : isBlanket 
                                                                ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/20' 
                                                                : 'bg-brand-flamingo/10 text-brand-flamingo border-brand-flamingo/20'
                                                    }`}>
                                                        {itemCollection}
                                                    </span>
                                                    {item.isPreOrder && (
                                                        <span className="text-[10px] font-bold text-brand-gold bg-brand-gold/10 px-1.5 py-0.5 rounded border border-brand-gold/20 uppercase tracking-wider flex items-center gap-1 w-fit">
                                                            <Clock size={10} /> Pre-order
                                                        </span>
                                                    )}
                                                    {item.isPickedUp === true ? (
                                                        <span className="mt-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 uppercase tracking-wider flex items-center gap-1 w-fit" title="Handed over in-store at the time of purchase. Do NOT pack!">
                                                            🤝 Handed Over In-store
                                                        </span>
                                                    ) : order.source === 'pos' ? (
                                                        <span className="mt-1 text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 uppercase tracking-wider flex items-center gap-1 w-fit">
                                                            📦 To Pack & Ship
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                                    <p className="font-bold text-gray-900">RM {item.price}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    </div>
                                    <div className="mt-4 text-right">
                                    <span className="text-xs uppercase tracking-widest text-gray-500 mr-4">Total Amount</span>
                                    <span className="font-serif text-xl text-gray-900 font-bold">RM {order.total}</span>
                                    </div>
                                    <div className="mt-4 flex flex-col items-end gap-3">
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleDownloadReceipt(order)} 
                                                className="bg-brand-green text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-green/95 transition-colors flex items-center gap-2 rounded-[2px]"
                                            >
                                                <Receipt size={14} /> View & Print Receipt
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if (emailingOrderId === order.id) {
                                                        setEmailingOrderId(null);
                                                    } else {
                                                        setEmailingOrderId(order.id);
                                                        setSalesEmailInput(order.customerEmail || '');
                                                        setSalesEmailStatus(null);
                                                    }
                                                }} 
                                                className="bg-brand-gold text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold/90 transition-colors flex items-center gap-2 rounded-[2px]"
                                            >
                                                <Mail size={14} /> Email Receipt
                                            </button>
                                        </div>

                                            {/* Collapsible Email Input Form */}
                                            {emailingOrderId === order.id && (
                                                <div className="w-full max-w-md border border-brand-latte/20 p-3 rounded bg-brand-grey/5 flex flex-col gap-2 mt-2">
                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <input 
                                                            type="email"
                                                            placeholder="customer@example.com"
                                                            value={salesEmailInput}
                                                            onChange={(e) => setSalesEmailInput(e.target.value)}
                                                            className="flex-1 px-3 py-2 sm:py-1.5 bg-white border border-brand-latte/30 focus:border-brand-flamingo outline-none text-xs rounded-[2px]"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendSalesReceiptEmail(order)}
                                                            disabled={!salesEmailInput}
                                                            className="bg-brand-gold hover:bg-brand-gold/90 text-white px-3 py-2 sm:py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1 min-h-[36px]"
                                                        >
                                                            <Mail size={12} /> Open Email
                                                        </button>
                                                    </div>
                                                    {salesEmailStatus?.orderId === order.id && salesEmailStatus.message && (
                                                        <div className={`text-[11px] text-left ${salesEmailStatus.type === 'success' ? 'text-green-600 font-medium' : 'text-red-500'}`}>
                                                            {salesEmailStatus.message}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                </div>

                                {/* Right: Details */}
                                <div className="w-full md:w-1/3 space-y-6">
                                    {/* Shipping */}
                                    <div>
                                    <h4 className="font-serif text-sm font-bold uppercase tracking-widest text-gray-900 mb-2 flex items-center gap-2">
                                        <MapPin size={14} /> Shipping Details
                                    </h4>
                                    <div className="bg-white p-4 rounded-[2px] border border-brand-latte/20 text-sm text-gray-600 leading-relaxed">
                                        <p className="font-bold text-gray-900 mb-1">{order.customerName}</p>
                                        <p>{order.shippingAddress}</p>
                                        <div className="mt-3 pt-3 border-t border-brand-latte/10 flex flex-col gap-1 text-xs">
                                            <p className="flex items-center gap-2"><Mail size={12}/> {order.customerEmail}</p>
                                            <p className="flex items-center gap-2"><Phone size={12}/> {order.customerPhone}</p>
                                        </div>
                                    </div>
                                    </div>

                                    {/* Gift Info */}
                                    {(order.isGift || order.giftTo || order.giftFrom || order.giftMessage) && (
                                    <div>
                                        <h4 className="font-serif text-sm font-bold uppercase tracking-widest text-brand-gold mb-2 flex items-center gap-2">
                                            <Gift size={14} /> Gift Message
                                        </h4>
                                        <div className="bg-white p-4 rounded-[2px] border border-brand-latte/20 text-sm">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between border-b border-brand-latte/10 pb-2">
                                                <span className="text-xs text-gray-400 uppercase tracking-wide">To</span>
                                                <span className="font-serif text-gray-900">{order.giftTo || '-'}</span>
                                                </div>
                                                <div className="flex justify-between pt-1">
                                                <span className="text-xs text-gray-400 uppercase tracking-wide">From</span>
                                                <span className="font-serif text-gray-900">{order.giftFrom || '-'}</span>
                                                </div>
                                                {order.giftMessage && (
                                                <div className="flex flex-col pt-1">
                                                <span className="text-xs text-gray-400 uppercase tracking-wide mb-1">Message</span>
                                                <span className="font-serif text-gray-900 text-xs italic break-words whitespace-pre-wrap">{order.giftMessage}</span>
                                                </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    )}
                                    
                                    {/* Admin Notes */}
                                    <div>
                                        <h4 className="font-serif text-sm font-bold uppercase tracking-widest text-gray-900 mb-2 flex items-center gap-2">
                                            <Package size={14} /> Admin Notes
                                        </h4>
                                        <div className="bg-white p-4 rounded-[2px] border border-brand-latte/20 text-sm">
                                            <textarea 
                                                className="w-full bg-brand-grey/5 border border-brand-latte/30 px-3 py-2 rounded-[2px] text-sm focus:outline-none focus:border-brand-flamingo min-h-[80px]"
                                                placeholder="Add private notes about this order..."
                                                value={editingNotes[order.id] !== undefined ? editingNotes[order.id] : (order.adminNotes || '')}
                                                onChange={(e) => handleNotesChange(order.id, e.target.value)}
                                            />
                                            <button 
                                                onClick={() => handleSaveNotes(order.id)}
                                                className="mt-2 text-xs font-bold uppercase tracking-widest text-brand-flamingo hover:text-brand-gold transition-colors"
                                            >
                                                Save Notes
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Status History */}
                                    <div>
                                        <h4 className="font-serif text-sm font-bold uppercase tracking-widest text-gray-900 mb-2 flex items-center gap-2">
                                            <Clock size={14} /> Status History
                                        </h4>
                                        <div className="bg-white p-4 rounded-[2px] border border-brand-latte/20 text-sm">
                                            {(!order.statusHistory || order.statusHistory.length === 0) ? (
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="font-bold uppercase tracking-widest text-gray-600">PENDING</span>
                                                    <span className="text-gray-400">{formatKLDate(order.date)} {formatKLTime(order.date)}</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    {order.statusHistory.map((history, idx) => (
                                                        <div key={idx} className="flex justify-between items-start text-xs border-b border-brand-latte/10 pb-2 last:border-0 last:pb-0">
                                                            <span className="font-bold uppercase tracking-widest flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-brand-flamingo"></span>
                                                                {history.status}
                                                            </span>
                                                            <div className="text-right text-gray-400 flex flex-col items-end">
                                                                <span>{formatKLDate(history.timestamp)}</span>
                                                                <span className="text-[10px]">{formatKLTime(history.timestamp)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status Change (Duplicate of row action but handy in detail view) */}
                                    <div>
                                    <h4 className="font-serif text-sm font-bold uppercase tracking-widest text-gray-900 mb-2">Update Status</h4>
                                    <div className="bg-white border border-brand-latte/20 p-4 rounded-[2px]">
                                        {/* Status Info for Admin */}
                                        {order.status === 'pending' && isStalePending(order) && (
                                            <div className="mb-3 text-[10px] text-red-500 bg-red-50 p-2 rounded border border-red-100 flex gap-2">
                                                <AlertTriangle size={14} className="flex-shrink-0" />
                                                This order has been pending for more than 60 minutes. The stock is still reserved. Change to 'Cancelled' to release stock.
                                            </div>
                                        )}
                                        <select 
                                            value={order.status} 
                                            onChange={(e) => handleStatusUpdate(order.id, e.target.value, order.status)} 
                                            className="w-full bg-white border border-brand-latte/30 px-3 py-2 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo"
                                        >
                                            {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    </div>
                                </div>
                            </div>
                        </td>
                        </tr>
                    )}
                    </React.Fragment>
                );
                })}
                </tbody>
            </table>
            </div>

            {/* Pagination Controls */}
            {filteredOrders.length > itemsPerPage && (
                <div className="border-t border-brand-latte/20 bg-brand-grey/5 p-4 flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                        Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredOrders.length)} of {filteredOrders.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-2 bg-white border border-brand-latte/20 rounded-[2px] text-gray-500 hover:text-brand-flamingo disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                        <span className="text-xs font-bold text-gray-700 px-2">Page {currentPage} of {totalPages}</span>
                        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 bg-white border border-brand-latte/20 rounded-[2px] text-gray-500 hover:text-brand-flamingo disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                    </div>
                </div>
            )}
        </div>
        )) : (
          filteredCustomers.length === 0 ? (
            <div className="text-center py-24 bg-white border border-dashed border-brand-latte/30 rounded-[2px]">
                <Users size={32} className="mx-auto text-brand-latte mb-3 opacity-50" />
                <p className="text-gray-400 text-sm">No customers found matching filters.</p>
                {(searchQuery || filterSource !== 'all' || filterCountry !== 'all') && (
                  <button 
                    onClick={() => {
                      setSearchQuery(''); 
                      setFilterSource('all');
                      setFilterCountry('all');
                      setCustomerSortBy('spend-desc');
                    }} 
                    className="text-brand-flamingo text-xs font-bold uppercase mt-2 hover:underline"
                  >
                    Clear Filters
                  </button>
                )}
            </div>
          ) : (
            <div className="bg-white border border-brand-latte/20 rounded-[2px] shadow-sm overflow-hidden animate-fade-in">
                <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                    <tr className="bg-brand-grey/10 border-b border-brand-latte/20">
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 w-12"></th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Customer Details</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Purchase (LTV)</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Orders Count</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Channels & Markets</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Last Active</th>
                        <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center w-36">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-latte/10">
                    {paginatedCustomers.map(cust => {
                        const isExpanded = expandedCustomerEmail === cust.email;
                        return (
                        <React.Fragment key={cust.email || cust.name}>
                        <tr 
                            className={`transition-colors cursor-pointer group ${
                              isExpanded ? 'bg-brand-grey/10' : 'hover:bg-brand-grey/5'
                            }`}
                            onClick={() => setExpandedCustomerEmail(isExpanded ? null : cust.email)}
                        >
                            <td className="p-4 text-center">
                              <button className="text-gray-400 hover:text-brand-flamingo">
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </td>
                            <td className="p-4">
                              <div className="flex items-start gap-2">
                                <div className="bg-brand-latte/20 p-2 rounded-full mt-0.5 text-brand-latte">
                                  <User size={14} />
                                </div>
                                <div>
                                  <div className="font-serif font-bold text-gray-900 text-sm">{cust.name}</div>
                                  <div className="text-xs text-gray-400 font-mono mt-0.5">{cust.email || 'No email registered'}</div>
                                  {cust.phone && (
                                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                      <Phone size={10} /> {cust.phone}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-gray-900 text-sm">RM {cust.totalSpend.toFixed(2)}</div>
                              <div className="text-[10px] font-bold text-brand-flamingo uppercase tracking-wider mt-0.5">All-time LTV</div>
                            </td>
                            <td className="p-4">
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-grey/15 rounded text-xs font-bold text-gray-700">
                                <Hash size={11} className="text-gray-400" /> {cust.totalOrders} {cust.totalOrders === 1 ? 'Order' : 'Orders'}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1">
                                {Array.from(cust.sources).map(s => (
                                  <span key={s} className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded">
                                    {s}
                                  </span>
                                ))}
                                {Array.from(cust.countries).map(c => (
                                  <span key={c} className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200 rounded">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Calendar size={12} className="text-gray-400" /> {formatKLDate(cust.lastOrderDate)}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                <Clock size={12} className="text-gray-400" /> {formatKLTime(cust.lastOrderDate)}
                              </div>
                            </td>
                            <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button 
                                onClick={() => setExpandedCustomerEmail(isExpanded ? null : cust.email)}
                                className="bg-brand-flamingo/5 border border-brand-flamingo/20 text-brand-flamingo hover:bg-brand-flamingo hover:text-white px-3 py-1.5 rounded-[2px] text-[10px] font-bold uppercase tracking-widest transition-colors"
                              >
                                {isExpanded ? 'Hide History' : 'View History'}
                              </button>
                            </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="bg-brand-grey/5 p-6 border-t border-b border-brand-latte/10">
                              <div className="max-w-4xl mx-auto text-left">
                                <div className="flex items-center justify-between mb-4 pb-2 border-b border-brand-latte/10">
                                  <h4 className="font-serif text-sm font-bold uppercase tracking-widest text-brand-gold flex items-center gap-2">
                                    <Clock size={14} /> Full Order History of All Time ({cust.totalOrders} {cust.totalOrders === 1 ? 'order' : 'orders'})
                                  </h4>
                                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">LTV: RM {cust.totalSpend.toFixed(2)}</span>
                                </div>
                                
                                <div className="space-y-4">
                                  {cust.orders.map((histOrder, idx) => {
                                    const oDate = formatKLDate(histOrder.date);
                                    const oTime = formatKLTime(histOrder.date);
                                    return (
                                      <div key={histOrder.id} className="bg-white border border-brand-latte/20 p-4 rounded-[2px] shadow-sm relative overflow-hidden group hover:border-brand-flamingo/30 transition-all">
                                        {/* Corner Line Indicator */}
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-flamingo/40"></div>
                                        
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                                          <div className="flex items-center gap-2 flex-wrap pl-1">
                                            <span className="font-mono text-xs font-bold text-gray-900">#{histOrder.id.substring(0, 8).toUpperCase()}</span>
                                            <span className="text-[9px] font-bold uppercase bg-brand-grey/10 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                                              {histOrder.source || 'online'}
                                            </span>
                                            {histOrder.paymentMethod && (
                                              <span className="text-[9px] font-bold uppercase bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">
                                                {histOrder.paymentMethod.replace('_', ' ')}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <div className="text-right text-xs text-gray-500 flex items-center gap-1 mr-2">
                                              <Calendar size={12} className="text-gray-400" /> {oDate}
                                              <Clock size={12} className="text-gray-400 ml-1" /> {oTime}
                                            </div>
                                            {/* Status Badge */}
                                            {renderStatusBadge(histOrder.status)}
                                          </div>
                                        </div>

                                        {/* Items */}
                                        <div className="bg-brand-grey/5 rounded-[2px] p-3 mb-3 border border-brand-latte/5 pl-4">
                                          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Items Ordered</p>
                                          <div className="divide-y divide-brand-latte/5 space-y-1.5">
                                            {histOrder.items.map(item => (
                                              <div key={item.id} className="flex justify-between text-xs text-gray-700 pt-1.5 first:pt-0">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-bold text-brand-flamingo">{item.quantity}x</span>
                                                  <span>{item.name} {item.sizeOption ? `(${item.sizeOption})` : ''}</span>
                                                  {item.isPreOrder && (
                                                    <span className="text-[8px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">Pre-Order</span>
                                                  )}
                                                </div>
                                                <div className="font-mono text-gray-500">RM {((item.price || 0) * (item.quantity || 1)).toFixed(2)}</div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Details & Total Footer */}
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-brand-latte/10 pl-1">
                                          <div className="text-xs text-gray-500 space-y-1">
                                            {histOrder.shippingAddress && (
                                              <div className="flex items-start gap-1">
                                                <MapPin size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                                <span className="truncate max-w-md" title={histOrder.shippingAddress}>Shipping: {histOrder.shippingAddress}</span>
                                              </div>
                                            )}
                                            {histOrder.adminNotes && (
                                              <div className="flex items-center gap-1 text-amber-700 bg-amber-50/50 px-1.5 py-0.5 rounded border border-amber-100/50 w-fit">
                                                <AlertTriangle size={11} className="text-amber-500" />
                                                <span>Note: {histOrder.adminNotes}</span>
                                              </div>
                                            )}
                                          </div>
                                          <div className="text-right flex items-center gap-4 self-end sm:self-auto">
                                            <button 
                                              onClick={async () => {
                                                try {
                                                  await navigator.clipboard.writeText(histOrder.id);
                                                  alert(`Order Number #${histOrder.id} copied to clipboard!`);
                                                } catch (e) {
                                                  alert("Failed to copy order ID");
                                                }
                                              }}
                                              className="text-gray-400 hover:text-brand-flamingo text-xs flex items-center gap-1"
                                              title="Copy Order ID"
                                            >
                                              <ClipboardCopy size={13} /> Copy ID
                                            </button>
                                            <div className="font-serif text-sm font-bold text-gray-900">
                                              Total Paid: <span className="text-brand-flamingo text-base">RM {histOrder.total.toFixed(2)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                        );
                    })}
                    </tbody>
                </table>
                </div>

                {/* Pagination Controls */}
                {filteredCustomers.length > itemsPerPage && (
                    <div className="border-t border-brand-latte/20 bg-brand-grey/5 p-4 flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-2 bg-white border border-brand-latte/20 rounded-[2px] text-gray-500 hover:text-brand-flamingo disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                            <span className="text-xs font-bold text-gray-700 px-2">Page {currentPage} of {totalPages}</span>
                            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 bg-white border border-brand-latte/20 rounded-[2px] text-gray-500 hover:text-brand-flamingo disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>
          )
        )}

        {/* EDIT ORDER MODAL */}
        {editingOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-[2px] border border-brand-latte/30 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-fade-in text-left">
              {/* Header */}
              <div className="p-6 border-b border-brand-latte/10 flex justify-between items-center bg-brand-grey/10">
                <div>
                  <h3 className="font-serif text-lg md:text-xl text-gray-900 font-bold">Edit Order #{editingOrder.id.substring(0, 8).toUpperCase()}</h3>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mt-0.5">Modify items, prices, shipping, and notes</p>
                </div>
                <button 
                  onClick={() => setEditingOrder(null)}
                  className="text-gray-400 hover:text-brand-flamingo p-2 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content (Scrollable) */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Customer & Shipping Details */}
                  <div className="space-y-4">
                    <h4 className="font-serif text-xs font-bold uppercase tracking-widest text-brand-gold border-b border-brand-latte/10 pb-1">Customer & Shipping Information</h4>
                    
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Customer Name</label>
                      <input 
                        type="text"
                        value={editingOrder.customerName || ''}
                        onChange={(e) => handleUpdateEditingCustomerField('customerName', e.target.value)}
                        className="w-full bg-white border border-brand-latte/30 px-3 py-2 text-sm rounded-[2px] focus:outline-none focus:border-brand-flamingo"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Customer Email</label>
                        <input 
                          type="email"
                          value={editingOrder.customerEmail || ''}
                          onChange={(e) => handleUpdateEditingCustomerField('customerEmail', e.target.value)}
                          className="w-full bg-white border border-brand-latte/30 px-3 py-2 text-sm rounded-[2px] focus:outline-none focus:border-brand-flamingo"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Customer Phone</label>
                        <input 
                          type="text"
                          value={editingOrder.customerPhone || ''}
                          onChange={(e) => handleUpdateEditingCustomerField('customerPhone', e.target.value)}
                          className="w-full bg-white border border-brand-latte/30 px-3 py-2 text-sm rounded-[2px] focus:outline-none focus:border-brand-flamingo"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Shipping Address</label>
                      <textarea 
                        rows={3}
                        value={editingOrder.shippingAddress || ''}
                        onChange={(e) => handleUpdateEditingCustomerField('shippingAddress', e.target.value)}
                        className="w-full bg-white border border-brand-latte/30 px-3 py-2 text-sm rounded-[2px] focus:outline-none focus:border-brand-flamingo resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Admin Notes</label>
                      <textarea 
                        rows={2}
                        placeholder="Private notes about this order..."
                        value={editingOrder.adminNotes || ''}
                        onChange={(e) => handleUpdateEditingCustomerField('adminNotes', e.target.value)}
                        className="w-full bg-white border border-brand-latte/30 px-3 py-2 text-sm rounded-[2px] focus:outline-none focus:border-brand-flamingo resize-none"
                      />
                    </div>

                    {/* Gift Settings */}
                    <div className="bg-brand-grey/5 p-4 rounded border border-brand-latte/20 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={!!editingOrder.isGift}
                          onChange={(e) => handleUpdateEditingCustomerField('isGift', e.target.checked)}
                          className="text-brand-flamingo focus:ring-brand-flamingo rounded"
                        />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1">
                          <Gift size={14} className="text-brand-gold" /> This is a Gift
                        </span>
                      </label>

                      {editingOrder.isGift && (
                        <div className="space-y-3 pt-2 border-t border-brand-latte/10">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Gift To</label>
                              <input 
                                type="text"
                                value={editingOrder.giftTo || ''}
                                onChange={(e) => handleUpdateEditingCustomerField('giftTo', e.target.value)}
                                className="w-full bg-white border border-brand-latte/30 px-2 py-1.5 text-xs rounded-[2px] focus:outline-none focus:border-brand-flamingo"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Gift From</label>
                              <input 
                                type="text"
                                value={editingOrder.giftFrom || ''}
                                onChange={(e) => handleUpdateEditingCustomerField('giftFrom', e.target.value)}
                                className="w-full bg-white border border-brand-latte/30 px-2 py-1.5 text-xs rounded-[2px] focus:outline-none focus:border-brand-flamingo"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Gift Message</label>
                            <textarea 
                              rows={2}
                              value={editingOrder.giftMessage || ''}
                              onChange={(e) => handleUpdateEditingCustomerField('giftMessage', e.target.value)}
                              className="w-full bg-white border border-brand-latte/30 px-2 py-1.5 text-xs rounded-[2px] focus:outline-none focus:border-brand-flamingo resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Order Items & Pricing */}
                  <div className="space-y-4 flex flex-col">
                    <h4 className="font-serif text-xs font-bold uppercase tracking-widest text-brand-gold border-b border-brand-latte/10 pb-1">Order Items</h4>
                    
                    {/* Items List */}
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 flex-1">
                      {editingOrder.items.length === 0 ? (
                        <p className="text-xs text-gray-400 italic py-4 text-center">No items in this order. Add items below.</p>
                      ) : (
                        editingOrder.items.map((item, idx) => (
                          <div key={idx} className="flex gap-3 items-center bg-brand-grey/5 p-3 rounded border border-brand-latte/10 text-xs text-left">
                            <img src={item.image} className="w-10 h-14 object-cover bg-gray-100 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-serif text-gray-900 font-bold truncate">{item.name}</p>
                              <p className="text-[10px] text-gray-500 font-semibold">RM {item.price}</p>
                              
                              {/* Special item toggles */}
                              <div className="flex gap-2 mt-1.5 flex-wrap">
                                <label className="flex items-center gap-1 cursor-pointer select-none">
                                  <input 
                                    type="checkbox"
                                    checked={!!item.isPickedUp}
                                    onChange={() => handleToggleItemPickedUp(idx)}
                                    className="rounded text-brand-flamingo focus:ring-brand-flamingo w-3 h-3"
                                  />
                                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">Handed over</span>
                                </label>

                                <label className="flex items-center gap-1 cursor-pointer select-none">
                                  <input 
                                    type="checkbox"
                                    checked={!!item.isPreOrder}
                                    onChange={() => handleToggleItemPreOrder(idx)}
                                    className="rounded text-brand-flamingo focus:ring-brand-flamingo w-3 h-3"
                                  />
                                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">Pre-order</span>
                                </label>
                              </div>
                            </div>

                            {/* Qty & Delete */}
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center border border-brand-latte/30 rounded bg-white">
                                <button 
                                  type="button"
                                  onClick={() => handleUpdateEditingItemQty(idx, -1)}
                                  className="p-1 text-gray-500 hover:text-brand-flamingo hover:bg-brand-grey/5 transition-colors"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="px-2 font-bold text-gray-800 text-xs min-w-[20px] text-center">{item.quantity}</span>
                                <button 
                                  type="button"
                                  onClick={() => handleUpdateEditingItemQty(idx, 1)}
                                  className="p-1 text-gray-500 hover:text-brand-flamingo hover:bg-brand-grey/5 transition-colors"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                              <button 
                                type="button"
                                onClick={() => handleRemoveEditingItem(idx)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="Remove product"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Product Form */}
                    <div className="bg-brand-grey/5 p-4 rounded border border-brand-latte/20 space-y-3">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Add Product to Order</label>
                      <div className="flex flex-col gap-2">
                        <select
                          value={selectedProductToAdd}
                          onChange={(e) => {
                            setSelectedProductToAdd(e.target.value);
                            const prod = products?.find(p => p.id === e.target.value);
                            if (prod && !prod.hasSizes) {
                              setSelectedSizeToAdd('Baby');
                            }
                          }}
                          className="w-full bg-white border border-brand-latte/30 px-3 py-2 text-xs rounded-[2px] focus:outline-none focus:border-brand-flamingo"
                        >
                          <option value="">-- Select a product to add --</option>
                          {products?.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (RM {p.price})</option>
                          ))}
                        </select>

                        {/* Variant Selection if product has sizes */}
                        {products?.find(p => p.id === selectedProductToAdd)?.hasSizes && (
                          <div className="flex gap-2 items-center">
                            <span className="text-[10px] font-bold uppercase text-gray-400">Size:</span>
                            <select
                              value={selectedSizeToAdd}
                              onChange={(e) => setSelectedSizeToAdd(e.target.value as 'Baby' | 'Adult')}
                              className="flex-1 bg-white border border-brand-latte/30 px-2 py-1.5 text-xs rounded-[2px] focus:outline-none"
                            >
                              <option value="Baby">Baby Blanket</option>
                              <option value="Adult">Adult Blanket</option>
                            </select>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <div className="flex items-center border border-brand-latte/30 rounded bg-white w-24">
                            <button 
                              type="button"
                              onClick={() => setAddQty(prev => Math.max(1, prev - 1))}
                              className="p-1.5 text-gray-500 hover:text-brand-flamingo"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="flex-1 text-center font-bold text-xs">{addQty}</span>
                            <button 
                              type="button"
                              onClick={() => setAddQty(prev => prev + 1)}
                              className="p-1.5 text-gray-500 hover:text-brand-flamingo"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={handleAddItemToEditingOrder}
                            disabled={!selectedProductToAdd}
                            className="flex-1 bg-brand-gold hover:bg-brand-gold/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded transition-colors flex items-center justify-center gap-1"
                          >
                            <Plus size={14} /> Add Item
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Pricing Overrides */}
                    <div className="border-t border-brand-latte/15 pt-3 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Order Total Amount</span>
                        <p className="text-[10px] text-gray-400">Editable for custom discounts or manual shipping overrides</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700 text-sm">RM</span>
                        <input 
                          type="number"
                          step="0.01"
                          value={editingOrder.total}
                          onChange={(e) => handleUpdateEditingCustomerField('total', parseFloat(parseFloat(e.target.value || '0').toFixed(2)))}
                          className="w-24 bg-white border border-brand-latte/30 px-2 py-1.5 text-sm rounded font-bold text-gray-900 focus:outline-none focus:border-brand-flamingo text-right"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-brand-latte/10 flex justify-end gap-3 bg-brand-grey/10">
                <button 
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 border border-brand-latte/30 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:bg-brand-grey/5 transition-colors rounded-[2px]"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEditedOrder}
                  disabled={isSavingOrder}
                  className="bg-brand-flamingo hover:bg-brand-flamingo/90 text-white px-5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 rounded-[2px] flex items-center gap-1.5"
                >
                  {isSavingOrder ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};
