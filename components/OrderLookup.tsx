
import React, { useState } from 'react';
import { getCustomerOrders, getOrderById } from '../firebase';
import { Order } from '../types';
import { Search, Loader2, Package, Calendar, AlertCircle, ArrowRight, Truck, CheckCircle, CreditCard, MessageCircle, ExternalLink, Box } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Helper for SEO URLs
const getProductSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

const OrderStatusStepper = ({ status }: { status: string }) => {
  if (status === 'cancelled' || status === 'failed') {
    return (
      <div className="bg-red-50 border border-red-100 rounded-[2px] p-4 flex items-center gap-3 text-red-600 mb-6 mx-6">
        <AlertCircle size={20} />
        <div>
          <p className="font-bold text-xs uppercase tracking-widest">Order {status}</p>
          <p className="text-xs opacity-80">This order was not completed. Please contact support if you have questions.</p>
        </div>
      </div>
    );
  }

  const steps = [
    { id: 'paid', label: 'Order Paid', icon: CreditCard },
    { id: 'packed', label: 'Packed', icon: Package },
    { id: 'shipped', label: 'Shipped', icon: Truck },
    { id: 'delivered', label: 'Delivered', icon: CheckCircle },
  ];

  let activeIndex = -1;
  if (status === 'paid') activeIndex = 0;
  if (status === 'packed') activeIndex = 1;
  if (status === 'shipped') activeIndex = 2;
  if (status === 'delivered') activeIndex = 3;

  // Handle pending or other states
  if (activeIndex === -1 && status !== 'pending') activeIndex = -1;

  return (
    <div className="w-full py-8 px-6 bg-brand-grey/5 border-y border-brand-latte/10 mb-6">
       <div className="relative flex items-center justify-between w-full max-w-sm mx-auto">
          {/* Connecting Line Background */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-brand-latte/30 -z-10"></div>
          
          {/* Active Progress Line */}
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-[1px] bg-brand-flamingo transition-all duration-1000 ease-out -z-10"
            style={{ width: `${Math.max(0, (activeIndex / (steps.length - 1)) * 100)}%` }}
          ></div>

          {steps.map((step, index) => {
            const isActive = index <= activeIndex;
            const Icon = step.icon;
            
            return (
               <div key={step.id} className="flex flex-col items-center gap-3 bg-brand-grey/5 px-2">
                  <div className={`
                    w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border transition-all duration-500 z-10
                    ${isActive 
                      ? 'bg-brand-flamingo border-brand-flamingo text-white shadow-lg shadow-brand-flamingo/20 scale-110' 
                      : 'bg-white border-brand-latte/30 text-gray-300'}
                  `}>
                     <Icon size={14} className="md:w-4 md:h-4" strokeWidth={isActive ? 2 : 1.5} />
                  </div>
                  <span className={`text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-colors duration-300 ${isActive ? 'text-brand-flamingo' : 'text-gray-300'}`}>
                    {step.label}
                  </span>
               </div>
            )
          })}
       </div>
       
       {/* Helper Text */}
       <div className="text-center mt-6">
          {status === 'pending' && <p className="text-xs text-gray-500 font-serif italic">Payment processing...</p>}
          {status === 'paid' && <p className="text-xs text-gray-500 font-serif italic">We are preparing your package.</p>}
          {status === 'packed' && <p className="text-xs text-gray-500 font-serif italic">Your order has been packed and is ready for courier pickup.</p>}
          {status === 'shipped' && <p className="text-xs text-gray-500 font-serif italic">Your order is on its way to you.</p>}
          {status === 'delivered' && <p className="text-xs text-gray-500 font-serif italic">We hope you love your new treasures.</p>}
       </div>
    </div>
  )
};

export const OrderLookup: React.FC = () => {
  const navigate = useNavigate();
  const [searchMode, setSearchMode] = useState<'tracking' | 'history'>('tracking');
  
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orderId, setOrderId] = useState('');

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');

  // Normalize phone for comparison (remove spaces, dashes, etc)
  const normalizePhone = (p: string) => p.replace(/\D/g, '');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setHasSearched(false);
    setOrders([]);

    try {
      if (searchMode === 'tracking') {
        if (!orderId || !email) {
          setError('Please provide Order ID and Email for verification.');
          setLoading(false);
          return;
        }
        
        const order = await getOrderById(orderId.trim());
        
        if (order && order.customerEmail.toLowerCase() === email.toLowerCase()) {
           setOrders([order]);
           setHasSearched(true);
        } else {
           setError('Order not found or email does not match.');
        }

      } else {
        // History Mode
        if (!email || !phone) {
          setError('Please provide both email and phone number for verification.');
          setLoading(false);
          return;
        }

        const results = await getCustomerOrders(email);
        const searchPhoneNorm = normalizePhone(phone);
        
        const verifiedOrders = results.filter(order => {
          if (!order.customerPhone) return false;
          const orderPhoneNorm = normalizePhone(order.customerPhone);
          return orderPhoneNorm.includes(searchPhoneNorm) || searchPhoneNorm.includes(orderPhoneNorm);
        });

        if (verifiedOrders.length > 0) {
            setOrders(verifiedOrders);
            setHasSearched(true);
        } else {
            setError('No orders found matching these details.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('We could not retrieve your orders at this time. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white animate-fade-in pt-24 pb-20">
      <div className="container mx-auto px-6 max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-16">
          <span className="font-script text-3xl text-brand-gold mb-2 block">Tracking</span>
          <h1 className="font-serif text-3xl md:text-4xl text-gray-900 mb-6">Track Your Order</h1>
          <p className="font-sans text-gray-500 font-light max-w-md mx-auto text-sm leading-relaxed">
            Track a specific order or view your entire purchase history.
          </p>
        </div>

        {/* Search Form */}
        <div className="max-w-md mx-auto bg-brand-grey/5 p-8 border border-brand-latte/20 rounded-[2px] mb-16 shadow-sm">
          
          {/* Tabs */}
          <div className="flex border-b border-brand-latte/20 mb-8">
             <button 
               onClick={() => { setSearchMode('tracking'); setError(''); setHasSearched(false); }}
               className={`flex-1 pb-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${searchMode === 'tracking' ? 'text-brand-flamingo border-b-2 border-brand-flamingo -mb-[1px]' : 'text-gray-400 hover:text-gray-600'}`}
             >
               Track by Order #
             </button>
             <button 
               onClick={() => { setSearchMode('history'); setError(''); setHasSearched(false); }}
               className={`flex-1 pb-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${searchMode === 'history' ? 'text-brand-flamingo border-b-2 border-brand-flamingo -mb-[1px]' : 'text-gray-400 hover:text-gray-600'}`}
             >
               View History
             </button>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col gap-6">
            
            {searchMode === 'tracking' ? (
                <>
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Order Number</label>
                    <input 
                        type="text" 
                        value={orderId}
                        onChange={(e) => setOrderId(e.target.value)}
                        placeholder="e.g. 1024"
                        className="w-full bg-white border border-brand-latte/30 px-4 py-3 font-sans text-gray-800 focus:outline-none focus:border-brand-flamingo focus:ring-1 focus:ring-brand-flamingo/20 transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="For verification"
                        className="w-full bg-white border border-brand-latte/30 px-4 py-3 font-sans text-gray-800 focus:outline-none focus:border-brand-flamingo focus:ring-1 focus:ring-brand-flamingo/20 transition-all placeholder:text-gray-300"
                    />
                  </div>
                </>
            ) : (
                <>
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="hello@example.com"
                        className="w-full bg-white border border-brand-latte/30 px-4 py-3 font-sans text-gray-800 focus:outline-none focus:border-brand-flamingo focus:ring-1 focus:ring-brand-flamingo/20 transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Phone Number</label>
                    <input 
                        type="tel" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+60..."
                        className="w-full bg-white border border-brand-latte/30 px-4 py-3 font-sans text-gray-800 focus:outline-none focus:border-brand-flamingo focus:ring-1 focus:ring-brand-flamingo/20 transition-all placeholder:text-gray-300"
                    />
                  </div>
                </>
            )}
            
            {error && (
              <div className="flex items-start gap-2 text-red-500 text-xs bg-red-50 p-3 border border-red-100 animate-fade-in">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="mt-2 bg-brand-flamingo text-white h-12 flex items-center justify-center gap-2 hover:bg-brand-gold transition-colors font-sans text-[11px] uppercase tracking-[0.2em] font-bold shadow-lg shadow-brand-flamingo/20 disabled:opacity-70 rounded-[2px]"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={14} />}
              {searchMode === 'tracking' ? 'Track Order' : 'Find History'}
            </button>
          </form>
        </div>

        {/* Results */}
        {hasSearched && (
          <div className="animate-slide-up">
            <div className="flex items-center gap-4 mb-8">
               <div className="h-[1px] flex-1 bg-brand-latte/20"></div>
               <span className="font-serif text-xl text-gray-900">
                   {searchMode === 'tracking' ? 'Order Details' : 'Your History'}
               </span>
               <div className="h-[1px] flex-1 bg-brand-latte/20"></div>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-brand-latte/30 rounded-[2px]">
                <Package size={32} className="mx-auto text-brand-latte mb-3 opacity-50" />
                <p className="text-gray-500 font-sans text-sm">No orders found.</p>
                <button onClick={() => navigate('/')} className="mt-4 text-xs font-bold text-brand-flamingo uppercase tracking-widest hover:text-brand-gold">
                  Return to Shop
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {orders.map((order) => (
                  <div key={order.id} className="bg-white border border-brand-latte/20 rounded-[2px] shadow-sm hover:shadow-md transition-shadow group overflow-hidden">
                    
                    {/* Order Header */}
                    <div className="p-6 md:p-8 pb-0">
                      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-mono text-sm text-gray-400">
                              #{order.id}
                            </span>
                            {/* Date Badge */}
                            <div className="flex items-center gap-2 text-xs text-gray-500 bg-brand-grey/10 px-2 py-1 rounded-[2px]">
                              <Calendar size={12} />
                              {new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="block font-serif text-xl text-gray-900">RM {order.total}</span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest">Total Paid</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Stepper */}
                    <OrderStatusStepper status={order.status} />

                    {/* Content Body */}
                    <div className="px-6 md:px-8 pb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           
                           {/* Items Column */}
                           <div className="flex flex-col gap-4">
                              <h4 className="font-sans text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-2">
                                <Box size={12} /> Items
                              </h4>
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex gap-4 items-center">
                                  <div className="w-12 h-16 bg-brand-grey/10 overflow-hidden rounded-[2px] border border-brand-latte/10">
                                     <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-serif text-gray-900 text-sm">{item.name}</h4>
                                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                  </div>
                                  <div className="text-sm font-bold text-gray-900">RM {item.price}</div>
                                </div>
                              ))}
                              
                              {/* View Item Action */}
                              {order.status !== 'cancelled' && order.status !== 'failed' && (
                                <button 
                                  onClick={() => navigate(`/product/${getProductSlug(order.items[0].name)}`)}
                                  className="text-brand-flamingo text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all mt-2 w-fit"
                                >
                                  View Item <ArrowRight size={12} />
                                </button>
                              )}
                           </div>

                           {/* Delivery & Tracking Column */}
                           <div className="bg-brand-grey/5 p-6 rounded-[2px] border border-brand-latte/10 flex flex-col justify-between">
                              <div className="mb-6">
                                <h4 className="font-sans text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                                   <Truck size={12} /> Shipping To
                                </h4>
                                <p className="font-bold text-sm text-gray-900 mb-1">{order.customerName}</p>
                                <p className="text-xs text-gray-600 leading-relaxed mb-1">{order.shippingAddress}</p>
                                <p className="text-xs text-gray-400">{order.customerPhone}</p>
                              </div>

                               {/* Tracking Actions - SHIPPED or HAS TRACKING */}
                               {(order.status === 'shipped' || order.trackingNumber) && (
                                 <div className="border-t border-brand-latte/10 pt-4">
                                    <h4 className="font-sans text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-3 flex items-center justify-between">
                                       <span>J&T Express Tracking</span>
                                       {order.trackingNumber && <span className="bg-brand-gold/10 text-brand-gold px-2 py-0.5 rounded text-[8px] font-mono uppercase">Available</span>}
                                    </h4>

                                    {order.trackingNumber ? (
                                      <div className="bg-white border border-brand-latte/20 rounded-[2px] p-4 mb-4 flex flex-col gap-2 shadow-sm animate-fade-in">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tracking Number</p>
                                        <div className="flex items-center justify-between bg-brand-grey/5 p-2 rounded border border-brand-latte/10 font-mono text-xs font-bold text-gray-800">
                                          <span>{order.trackingNumber}</span>
                                          <button 
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                await navigator.clipboard.writeText(order.trackingNumber || '');
                                                alert("Tracking number copied to clipboard!");
                                              } catch (err) {
                                                alert("Failed to copy tracking number.");
                                              }
                                            }}
                                            className="text-[9px] uppercase tracking-widest text-brand-flamingo hover:text-brand-gold font-sans font-bold"
                                          >
                                            Copy
                                          </button>
                                        </div>
                                        <p className="text-[9px] text-gray-400 italic">Copy the tracking number above and click "Track on J&T" to search on their official portal.</p>
                                      </div>
                                    ) : (
                                      /* Explanatory Steps */
                                      <div className="bg-white border border-brand-latte/10 rounded-[2px] p-3 mb-4">
                                        <p className="text-[10px] text-gray-500 leading-relaxed mb-1.5 flex items-start gap-2">
                                          <span className="bg-brand-grey/20 text-gray-500 w-4 h-4 rounded-full flex items-center justify-center font-bold text-[8px] flex-shrink-0 mt-0.5">1</span>
                                          <span>Click "Get Tracking No." below to message us on WhatsApp.</span>
                                        </p>
                                        <p className="text-[10px] text-gray-500 leading-relaxed flex items-start gap-2">
                                          <span className="bg-brand-grey/20 text-gray-500 w-4 h-4 rounded-full flex items-center justify-center font-bold text-[8px] flex-shrink-0 mt-0.5">2</span>
                                          <span>Copy the number and track it on the J&T website using the link below.</span>
                                        </p>
                                      </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row gap-3">
                                       {!order.trackingNumber && (
                                         <a 
                                           href="https://wa.link/ad5hui" 
                                           target="_blank" 
                                           rel="noopener noreferrer"
                                           className="flex-1 bg-white border border-brand-green/30 text-brand-green px-4 py-2.5 rounded-[2px] text-[10px] font-bold uppercase tracking-widest hover:bg-brand-green hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                                         >
                                           <MessageCircle size={14} /> Get Tracking No.
                                         </a>
                                       )}
                                       <a 
                                         href="https://www.jtexpress.my/tracking" 
                                         target="_blank" 
                                         rel="noopener noreferrer"
                                         className="flex-1 bg-brand-flamingo text-white px-4 py-2.5 rounded-[2px] text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold transition-all flex items-center justify-center gap-2 shadow-sm"
                                       >
                                         <ExternalLink size={14} /> Track on J&T
                                       </a>
                                    </div>
                                 </div>
                               )}
                           </div>
                        </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
