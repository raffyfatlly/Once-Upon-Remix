
import React, { useState } from 'react';
import { Order } from '../../types';
import { ClipboardCopy, Package, Search, CheckSquare, Square, Truck, Check, X, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { updateOrderAndRestock, updateOrderInDb, getOrderById } from '../../firebase';

interface PackingManagerProps {
  orders: Order[];
}

export const PackingManager: React.FC<PackingManagerProps> = ({ orders }) => {
  const [inputText, setInputText] = useState('');
  const [foundOrders, setFoundOrders] = useState<Order[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // States for J&T Tracking Updates
  const [trackingInput, setTrackingInput] = useState('');
  const [isTrackingUpdating, setIsTrackingUpdating] = useState(false);
  const [trackingFeedback, setTrackingFeedback] = useState<{ success: number; failed: string[] } | null>(null);

  const handleFindOrders = () => {
    setHasSearched(true);
    
    // 1. Extract all sequences of digits from the input text, ignoring long sequences (like 12-digit tracking numbers)
    const matches = (inputText.match(/\d+/g) || []).filter(m => m.length < 7);
    
    if (matches.length === 0) {
      setFoundOrders([]);
      setSelectedIds(new Set());
      return;
    }

    // 2. Create a standardized Set of strings for lookup
    // We trim and ensure they are strings to prevent type mismatches
    const matchSet = new Set(matches.map(m => String(m).trim()));

    // 3. Filter orders
    // We strictly convert order.id to string and trim it before checking
    const results = orders.filter(o => {
        const orderIdStr = String(o.id).trim();
        return matchSet.has(orderIdStr);
    });

    setFoundOrders(results);
    // Auto-select all found results for convenience
    setSelectedIds(new Set(results.map(o => o.id)));
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === foundOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(foundOrders.map(o => o.id)));
    }
  };

  const handleCopyShipping = async () => {
    const selected = foundOrders.filter(o => selectedIds.has(o.id));
    if (selected.length === 0) return;

    // Format specifically based on user request:
    // Order No:
    // Name:
    // Phone:
    // Address:
    // Items:
    const text = selected.map(order => {
      const itemsToPack = order.items.filter(i => i.isPickedUp !== true);
      const itemsList = itemsToPack.length > 0
        ? itemsToPack.map(i => `${i.name} (x${i.quantity})`).join(', ')
        : 'None - All items collected in-store';

      return `
Order No: ${order.id}
Name: ${order.customerName}
Phone: ${order.customerPhone}
Address: ${order.shippingAddress}
Items: ${itemsList}
      `.trim();
    }).join('\n\n----------------------------------------\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      alert('Failed to copy to clipboard');
    }
  };

  const handleBulkShip = async () => {
    const selected = foundOrders.filter(o => selectedIds.has(o.id));
    if (selected.length === 0) return;

    if (!window.confirm(`Mark ${selected.length} orders as SHIPPED?`)) return;

    setIsUpdating(true);
    try {
      // Execute updates in parallel
      await Promise.all(selected.map(order => 
        updateOrderAndRestock(order.id, 'shipped', order.status)
      ));
      
      // Update local state to reflect changes immediately
      setFoundOrders(prev => prev.map(o => 
        selectedIds.has(o.id) ? { ...o, status: 'shipped' } : o
      ));
      
    } catch (error: any) {
      console.error("Bulk update failed:", error);
      alert("Failed to update status.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateTrackingNumbers = async () => {
    if (!trackingInput.trim()) return;
    setIsTrackingUpdating(true);
    setTrackingFeedback(null);
    
    const lines = trackingInput.split('\n');
    const updates: { orderId: string; trackingNumber: string }[] = [];
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      let orderId = '';
      let trackingNumber = '';
      
      const smartMatch = line.match(/^(?:Order\s*#?|#)?\s*(\d{3,6})\s*[-:\s]\s*(.+)$/i);
      if (smartMatch) {
        orderId = smartMatch[1].trim();
        trackingNumber = smartMatch[2].trim();
      } else {
        const dashOrColonMatch = line.match(/^(\d+)\s*[-:]\s*(.+)$/);
        if (dashOrColonMatch) {
          orderId = dashOrColonMatch[1].trim();
          trackingNumber = dashOrColonMatch[2].trim();
        } else {
          const words = line.split(/\s+/);
          if (words.length >= 2 && /^\d+$/.test(words[0])) {
            orderId = words[0];
            trackingNumber = words.slice(1).join(' ').trim();
          }
        }
      }
      
      if (orderId && trackingNumber) {
        // Strip any trailing dots or spaces from the tracking number
        trackingNumber = trackingNumber.replace(/\.+$/, '').trim();
        updates.push({ orderId, trackingNumber });
      }
    }
    
    if (updates.length === 0) {
      alert("No valid Order ID and Tracking Number pairs found. Please format as:\nOrderNo - TrackingNo\ne.g., 1822 - 601714279255");
      setIsTrackingUpdating(false);
      return;
    }
    
    let successCount = 0;
    const failedIds: string[] = [];
    
    try {
      const orderIdSet = new Set(orders.map(o => String(o.id).trim()));
      
      const updatePromises = updates.map(async (item) => {
        const normId = String(item.orderId).trim();
        let exists = orderIdSet.has(normId);
        
        if (!exists) {
          const dbOrder = await getOrderById(normId);
          if (dbOrder) {
            exists = true;
          }
        }
        
        if (exists) {
          await updateOrderInDb(normId, { trackingNumber: item.trackingNumber });
          successCount++;
        } else {
          failedIds.push(item.orderId);
        }
      });
      
      await Promise.all(updatePromises);
      setTrackingFeedback({ success: successCount, failed: failedIds });
      if (successCount > 0) {
        setTrackingInput(''); // Clear input on success
      }
    } catch (err) {
      console.error("Failed to update tracking numbers:", err);
      alert("An error occurred while updating tracking numbers.");
    } finally {
      setIsTrackingUpdating(false);
    }
  };
  
  // Identify IDs that were pasted but not found in the database
  const getMissingIds = () => {
     if (!hasSearched) return [];
     const matches = (inputText.match(/\d+/g) || []).filter(m => m.length < 7);
     
     // Normalized Set of IDs found in DB
     const foundIdSet = new Set(foundOrders.map(o => String(o.id).trim()));
     
     // Filter matches that look like IDs (e.g. >= 3 digits) and were not found
     const missing = matches.filter(rawId => {
        const id = String(rawId).trim();
        // Only consider it "missing" if it looks like an order ID (3+ digits)
        return id.length >= 3 && !foundIdSet.has(id);
     });

     return Array.from(new Set(missing));
  };

  const missingIds = getMissingIds();

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-brand-flamingo/10 rounded-full text-brand-flamingo">
             <Package size={24} />
        </div>
        <div>
           <h2 className="font-serif text-2xl text-gray-900">Packing & Logistics</h2>
           <div className="flex items-center gap-2">
             <p className="text-xs text-gray-500 uppercase tracking-wider">Process packed orders from supplier lists</p>
             <span className="text-gray-300">•</span>
             <p className="text-xs text-brand-green font-bold uppercase tracking-wider">{orders.length} Active Orders Scanned</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-200px)] min-h-[600px]">
        {/* Left: Input Area */}
        <div className="lg:col-span-1 flex flex-col gap-4 h-full">
           <div className="bg-white p-5 border border-brand-latte/20 rounded-[2px] shadow-sm flex-1 flex flex-col">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                 1. Paste Supplier Update
              </label>
              <textarea 
                className="w-full flex-1 p-4 text-sm bg-brand-grey/5 border border-brand-latte/20 focus:border-brand-flamingo outline-none resize-none font-mono text-gray-600 rounded-[2px] mb-4"
                placeholder={`Example text from supplier:\n\n"Hi, we have packed the following orders today:\n1058, 1059, 1060\n\nPlease arrange pickup."`}
                value={inputText}
                onChange={(e) => {
                    setInputText(e.target.value);
                    setHasSearched(false); // Reset search state on edit
                }}
              />
              <button 
                onClick={handleFindOrders}
                disabled={!inputText}
                className="w-full bg-gray-900 text-white py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-flamingo transition-colors rounded-[2px] flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
              >
                <Search size={14} /> Find Orders
              </button>
           </div>

           {/* J&T Tracking Updates Input Card */}
           <div className="bg-white p-5 border border-brand-latte/20 rounded-[2px] shadow-sm flex flex-col">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
                 <Truck size={14} className="text-brand-flamingo" /> J&T Tracking Updates
              </label>
              <p className="text-[10px] text-gray-400 mb-3 leading-relaxed font-sans">
                Input J&T tracking numbers for orders below. One order per line.
              </p>
              <textarea 
                className="w-full h-32 p-3 text-xs bg-brand-grey/5 border border-brand-latte/20 focus:border-brand-flamingo outline-none resize-none font-mono text-gray-600 rounded-[2px] mb-3"
                placeholder={`Example:\n1822 - 601714279255\n2120 - JNT62012345678`}
                value={trackingInput}
                onChange={(e) => {
                  setTrackingInput(e.target.value);
                  setTrackingFeedback(null);
                }}
              />
              {trackingFeedback && (
                <div className={`p-3 rounded-[2px] text-xs font-sans mb-3 border ${
                  trackingFeedback.success > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    {trackingFeedback.success > 0 ? <Check size={14} /> : <AlertCircle size={14} />}
                    {trackingFeedback.success > 0 ? 'Update Succeeded' : 'Update Failed'}
                  </div>
                  <p>Successfully updated {trackingFeedback.success} orders.</p>
                  {trackingFeedback.failed.length > 0 && (
                    <p className="mt-1 text-[10px] text-red-500">
                      Orders not found: {trackingFeedback.failed.join(', ')}
                    </p>
                  )}
                </div>
              )}
              <button 
                onClick={handleUpdateTrackingNumbers}
                disabled={!trackingInput.trim() || isTrackingUpdating}
                className="w-full bg-gray-900 text-white py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-flamingo transition-colors rounded-[2px] flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
              >
                {isTrackingUpdating ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Updating...
                  </>
                ) : (
                  <>
                    <Check size={12} /> Save Tracking Numbers
                  </>
                )}
              </button>
           </div>
           
           {/* Missing IDs Warning */}
           {hasSearched && missingIds.length > 0 && (
             <div className="bg-red-50 p-4 border border-red-100 rounded-[2px] animate-fade-in">
               <h4 className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider mb-2">
                 <X size={14} /> IDs Not Found ({missingIds.length})
               </h4>
               <div className="flex flex-wrap gap-2">
                 {missingIds.map((id, i) => (
                   <span key={i} className="text-[10px] bg-white border border-red-200 text-red-500 px-2 py-1 rounded font-mono">
                     {id}
                   </span>
                 ))}
               </div>
               <p className="text-[10px] text-red-400 mt-2 italic leading-relaxed">
                 These numbers appeared in your text but do not match any orders in the system. Please check if they are correct.
               </p>
             </div>
           )}
        </div>

        {/* Right: Results Table */}
        <div className="lg:col-span-2 h-full flex flex-col">
          {!hasSearched && foundOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-brand-grey/5 border border-dashed border-brand-latte/30 rounded-[2px] text-gray-400">
               <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                   <ArrowRight size={24} className="opacity-30" />
               </div>
               <p className="text-sm font-medium">Paste order numbers to extract delivery details.</p>
            </div>
          ) : foundOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white border border-brand-latte/20 rounded-[2px] text-gray-400">
               <AlertCircle size={32} className="text-brand-latte mb-3" />
               <p className="text-sm font-medium">No matching orders found.</p>
               <p className="text-xs mt-1 text-gray-300">Try checking the IDs again.</p>
            </div>
          ) : (
            <div className="bg-white border border-brand-latte/20 rounded-[2px] shadow-sm flex flex-col h-full overflow-hidden animate-fade-in">
               {/* Toolbar */}
               <div className="p-4 border-b border-brand-latte/10 flex justify-between items-center bg-brand-grey/5 flex-shrink-0">
                 <div className="flex items-center gap-2">
                   <div className="flex items-center justify-center w-6 h-6 bg-brand-green/10 rounded-full text-brand-green">
                      <Check size={14} />
                   </div>
                   <span className="font-bold text-gray-900 text-sm">{foundOrders.length} Orders Found</span>
                   <span className="text-xs text-gray-400 border-l border-brand-latte/20 pl-2 ml-1">
                     {selectedIds.size} selected
                   </span>
                 </div>
                 
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={handleBulkShip}
                      disabled={selectedIds.size === 0 || isUpdating}
                      className="flex items-center gap-2 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-[2px] transition-all shadow-sm bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                      Mark Shipped
                    </button>

                    <button 
                      onClick={handleCopyShipping}
                      disabled={selectedIds.size === 0}
                      className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-[2px] transition-all shadow-md ${
                        copyFeedback 
                          ? 'bg-brand-green text-white scale-105' 
                          : 'bg-brand-flamingo text-white hover:bg-brand-gold hover:-translate-y-0.5'
                      }`}
                    >
                      {copyFeedback ? <Check size={14} /> : <ClipboardCopy size={14} />}
                      {copyFeedback ? 'Copied!' : 'Copy Delivery Info'}
                    </button>
                 </div>
               </div>

               {/* Table */}
               <div className="flex-1 overflow-auto">
                 <table className="w-full text-left border-collapse">
                   <thead className="sticky top-0 bg-white z-10 shadow-sm">
                     <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-brand-latte/20">
                       <th className="p-4 w-12 bg-white">
                         <button onClick={toggleSelectAll} className="hover:text-brand-flamingo">
                           {selectedIds.size > 0 && selectedIds.size === foundOrders.length ? <CheckSquare size={16} className="text-brand-flamingo" /> : <Square size={16} />}
                         </button>
                       </th>
                       <th className="p-4 bg-white">ID</th>
                       <th className="p-4 bg-white">Delivery Details</th>
                       <th className="p-4 bg-white w-24">Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-brand-latte/10">
                     {foundOrders.map(order => (
                       <tr 
                          key={order.id} 
                          className={`hover:bg-brand-grey/5 transition-colors cursor-pointer ${selectedIds.has(order.id) ? 'bg-brand-flamingo/5' : ''}`}
                          onClick={() => toggleSelection(order.id)}
                        >
                         <td className="p-4 align-top" onClick={(e) => e.stopPropagation()}>
                           <button onClick={() => toggleSelection(order.id)} className="text-gray-400 hover:text-brand-flamingo">
                             {selectedIds.has(order.id) ? <CheckSquare size={16} className="text-brand-flamingo" /> : <Square size={16} />}
                           </button>
                         </td>
                         <td className="p-4 align-top">
                           <span className="font-mono text-xs font-bold text-gray-900 bg-brand-grey/10 px-2 py-1 rounded">#{order.id}</span>
                         </td>
                         <td className="p-4 align-top">
                           <div className="flex items-start gap-3">
                               <div className="mt-0.5 text-gray-400"><Truck size={14} /></div>
                               <div>
                                   <div className="text-sm font-bold text-gray-900 mb-1">{order.customerName}</div>
                                    {/* Items checklist */}
                                    <div className="mt-3.5 mb-2 pt-3 border-t border-brand-latte/10">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Items in this Order:</div>
                                      <div className="space-y-1.5">
                                        {order.items.map((item, idx) => {
                                          const isCollected = item.isPickedUp === true;
                                          return (
                                            <div key={idx} className="flex flex-wrap items-center justify-between gap-2 text-xs py-1.5 bg-white border border-brand-latte/10 px-2 rounded-[2px] max-w-md">
                                              <div className="flex items-center gap-1.5 font-sans">
                                                <span className="font-bold text-gray-900 bg-brand-grey/15 px-1.5 py-0.5 rounded text-[10px]">{item.quantity}x</span>
                                                <span className="text-gray-700 font-medium">{item.name}</span>
                                              </div>
                                              <div>
                                                {isCollected ? (
                                                  <span className="text-[9px] font-bold uppercase tracking-wider text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 font-sans" title="Customer already collected this item in-store. Do NOT pack!">
                                                    🤝 Already Taken (Do Not Pack)
                                                  </span>
                                                ) : (
                                                  <span className="text-[9px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 font-sans">
                                                    📦 Need to Pack
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                   <div className="text-xs text-gray-600 mb-1 leading-relaxed max-w-md">
                                     {order.shippingAddress}
                                   </div>
                                   <div className="text-[10px] text-gray-400 font-mono">
                                      {order.customerPhone}
                                   </div>
                                   {order.trackingNumber && (
                                     <div className="mt-2 text-xs font-bold text-brand-gold flex items-center gap-1.5 animate-fade-in">
                                       <span className="bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded text-[10px]">J&T Tracking: {order.trackingNumber}</span>
                                     </div>
                                   )}
                                   {order.adminNotes && (
                                     <div className="mt-2 p-2 bg-yellow-50/50 border border-yellow-200/50 rounded flex items-start gap-2">
                                       <Package size={12} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                                       <span className="text-xs text-yellow-800 break-words whitespace-pre-wrap">{order.adminNotes}</span>
                                     </div>
                                   )}
                               </div>
                           </div>
                         </td>
                         <td className="p-4 align-top">
                            <span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded border ${
                              order.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              order.status === 'paid' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              order.status === 'packed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              order.status === 'shipped' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                              'bg-gray-50 text-gray-500 border-gray-200'
                            }`}>
                              {order.status}
                            </span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
