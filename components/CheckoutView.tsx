
import React, { useState, useEffect } from 'react';
import { Product, CartItem } from '../types';
import { Lock, CheckCircle, ArrowLeft, Loader2, CreditCard, AlertTriangle, Tag, X, Gift, PenTool, Sparkles, ChevronRight, Mail, Phone, MapPin, Clock, Plus } from 'lucide-react';
import { createOrderInDb } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { trackBeginCheckout, getAttribution } from '../analytics';

interface CheckoutViewProps {
  cart: CartItem[];
  onOrderSuccess: () => void;
}

const API_URL = '/api/chip/purchases/';

export const CheckoutView: React.FC<CheckoutViewProps> = ({ cart, onOrderSuccess }) => {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Contact, 2: Shipping, 3: Finalize
  
  // Cart & Totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  const isAddonProduct = (p: CartItem) => {
    if (!p) return false;
    const name = (p.name || '').toLowerCase();
    const collection = (p.collection || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    return Boolean(p.isCheckoutAddon) || 
           name.includes('perfume') || 
           name.includes('hair oil') || 
           name.includes('oil') || 
           collection.includes('add-on') || 
           collection.includes('addon') || 
           category.includes('add-on') || 
           category.includes('addon');
  };

  // Packaging Logic: 1 set for every 1 main item
  const mainItemsCount = cart.reduce((sum, item) => isAddonProduct(item) ? sum : sum + item.quantity, 0);
  const packagingCount = mainItemsCount;

  // Swaddle & Blanket counts
  const swaddleCount = cart.reduce((sum, item) => {
    if (isAddonProduct(item)) return sum;
    const isBlanket = !item.collection || item.collection === 'Blankets' || item.collection.toLowerCase().includes('blanket') || (item.category && item.category.toLowerCase().includes('blanket'));
    return isBlanket ? sum : sum + item.quantity;
  }, 0);

  const blanketCount = cart.reduce((sum, item) => {
    if (isAddonProduct(item)) return sum;
    const isBlanket = !item.collection || item.collection === 'Blankets' || item.collection.toLowerCase().includes('blanket') || (item.category && item.category.toLowerCase().includes('blanket'));
    return isBlanket ? sum + item.quantity : sum;
  }, 0);

  const hasAdultBlanket = cart.some(item => !isAddonProduct(item) && item.sizeOption === 'adult');

  // Form Data
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState<'west' | 'east' | 'sg'>('west');

  const [isGift, setIsGift] = useState(false);
  const [giftTo, setGiftTo] = useState('');
  const [giftFrom, setGiftFrom] = useState('');
  const [giftMessage, setGiftMessage] = useState('');

  // Voucher
  const [voucherCode, setVoucherCode] = useState('');
  const [isFreeShipping, setIsFreeShipping] = useState(false);
  const [isTestDiscount, setIsTestDiscount] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Payment Status
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [agreeToPolicies, setAgreeToPolicies] = useState(false);

  // --- SECURITY CHECK ---
  // Redirect to cart if empty to prevent paying for just shipping
  useEffect(() => {
    if (cart.length === 0) {
      navigate('/cart', { replace: true });
    }
  }, [cart, navigate]);

  // Track self-hosted analytics begin_checkout event
  useEffect(() => {
    if (cart && cart.length > 0) {
      trackBeginCheckout(subtotal, totalItems);
    }
  }, []);

  // --- LOGIC ---

  const calculateShipping = () => {
    if (isTestDiscount) return 0;
    if (isFreeShipping) return 0;
    
    if (region === 'sg') {
      if (totalItems === 1) return 40;
      if (totalItems <= 3) return 55;
      if (totalItems <= 6) return 75;
      return 75 + Math.ceil((totalItems - 6) / 3) * 15;
    } else if (region === 'east') {
      if (totalItems === 1) return 15;
      if (totalItems <= 3) return 18;
      if (totalItems <= 6) return 20;
      return 20 + Math.ceil((totalItems - 6) / 3) * 5; // + RM 5 for every 3 additional items
    } else {
      if (totalItems === 1) return 8;
      if (totalItems <= 3) return 10;
      if (totalItems <= 6) return 12;
      return 12 + Math.ceil((totalItems - 6) / 3) * 2; // + RM 2 for every 3 additional items
    }
  };

  const shippingCost = calculateShipping();
  
  // Calculate total and potential discount
  let total = subtotal + shippingCost;
  let discountAmount = 0;

  if (isTestDiscount) {
    // Force total to 1
    discountAmount = total - 1;
    total = 1;
  }

  const getPaymentConfig = () => {
    const env = (import.meta as any).env;
    return {
      brandId: env.VITE_CHIP_ID || env.CHIP_ID,
      apiKey: env.VITE_CHIP_API || env.CHIP_API
    };
  };

  // --- HANDLERS ---

  const handleApplyVoucher = (e: React.MouseEvent) => {
    e.preventDefault();
    setVoucherMessage(null);
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'SHIPFREE88') {
      setIsFreeShipping(true);
      setIsTestDiscount(false);
      setVoucherMessage({ type: 'success', text: 'Free shipping applied!' });
    } else if (code === 'TESTRM1') {
      setIsTestDiscount(true);
      setIsFreeShipping(false);
      setVoucherMessage({ type: 'success', text: 'Test discount applied! Total is RM 1.' });
    } else {
      setIsFreeShipping(false);
      setIsTestDiscount(false);
      setVoucherMessage({ type: 'error', text: 'Invalid voucher code.' });
    }
  };

  const handleRemoveVoucher = () => {
    setVoucherCode('');
    setIsFreeShipping(false);
    setIsTestDiscount(false);
    setVoucherMessage(null);
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (email && phone) setStep(2);
    } else if (step === 2) {
      if (firstName && lastName && address && postcode && city) setStep(3);
    } else if (step === 3) {
      if (!agreeToPolicies) {
        setError("Please read and agree to our Refund & Return and Shipping policies to place your order.");
        return;
      }
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      setError("Your shopping bag is empty.");
      navigate('/cart');
      return;
    }

    if (!agreeToPolicies) {
      setError("Please read and agree to our Refund & Return and Shipping policies to place your order.");
      return;
    }

    setIsProcessing(true);
    setError('');

    const { brandId, apiKey } = getPaymentConfig();
    if (!brandId || !apiKey) {
      setError("Payment Configuration Missing. Please contact support.");
      setIsProcessing(false);
      return;
    }
    
    try {
      // 1. Create Order in Database
      // Note: This function now checks STOCK and deducts it transactionally.
      // If stock is unavailable, it will throw an error.
      const attribution = getAttribution();
      const orderRef = await createOrderInDb({
        customerName: `${firstName} ${lastName}`,
        customerEmail: email,
        customerPhone: phone,
        items: cart,
        total: total,
        status: 'pending',
        date: new Date().toISOString(),
        shippingAddress: `${address}, ${postcode} ${city}, ${region === 'sg' ? 'Singapore' : region === 'east' ? 'East Malaysia' : 'West Malaysia'}`,
        isGift: isGift,
        // Fix: Firestore crashes if fields are undefined. We default to empty strings.
        giftTo: isGift ? (giftTo || '') : '',
        giftFrom: isGift ? (giftFrom || '') : '',
        giftMessage: isGift ? (giftMessage || '') : '',
        utm_source: attribution.first_utm_source || 'direct',
        utm_medium: attribution.first_utm_medium || 'none',
        utm_campaign: attribution.first_utm_campaign || 'none',
        ambassadorCampaign: (attribution.first_utm_campaign && attribution.first_utm_campaign.startsWith('amb-')) ? attribution.first_utm_campaign : ''
      });

      // 2. Chip Payload
      let productsPayload = [];
      
      if (isTestDiscount) {
         // CHIP API may reject negative prices. 
         // For test RM1, we just override the entire product list with a single RM1 item.
         productsPayload = [{
            name: "Test Order (TESTRM1 Applied)",
            quantity: 1,
            price: 100 // RM 1.00
         }];
      } else {
         productsPayload = [
          ...cart.map(item => ({
            name: item.name.substring(0, 256),
            quantity: item.quantity,
            price: Math.round(item.price * 100)
          })),
          {
            name: isFreeShipping ? "Shipping Fee (Waived)" : "Shipping Fee",
            quantity: 1,
            price: Math.round(shippingCost * 100)
          }
        ];
      }

      const payload = {
        brand_id: brandId,
        client: {
          email: email,
          phone: phone, 
          full_name: `${firstName} ${lastName}`.substring(0, 30),
        },
        purchase: {
          currency: 'MYR',
          products: productsPayload
        },
        reference: orderRef.id,
        force_redirect: true,
        // Remove /# from the redirect URLs to support BrowserRouter
        success_redirect: `${window.location.origin}/#/payment/callback?result=success&order=${orderRef.id}`,
        failure_redirect: `${window.location.origin}/#/payment/callback?result=failed&order=${orderRef.id}`,
        cancel_redirect: `${window.location.origin}/#/payment/callback?result=cancelled&order=${orderRef.id}`,
      };

      // 3. Call API
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload)
      });

      let data;
      try { data = await response.json(); } catch (e) { throw new Error("Payment gateway response invalid."); }

      if (!response.ok) {
        console.error("Chip API Error Response:", data);
        const errorDetails = JSON.stringify(data);
        const msg = data.message || (data.errors ? Object.values(data.errors).join(', ') : `Payment initialization failed: ${errorDetails}`);
        throw new Error(msg);
      }

      onOrderSuccess(); 
      if (data.checkout_url) window.location.href = data.checkout_url;
      else throw new Error("No checkout URL returned.");

    } catch (err: any) {
      console.error("Payment Error:", err);
      // Specific handling for out of stock errors coming from Firebase
      if (err.message.includes('out of stock')) {
         setError(err.message);
      } else {
         setError(err.message || "Failed to initiate payment. Please try again.");
      }
      setIsProcessing(false);
    }
  };

  // --- RENDER HELPERS ---

  const StepIndicator = () => (
    <div className="flex items-center gap-4 mb-12">
      <div className={`flex items-center gap-2 ${step >= 1 ? 'text-gray-900' : 'text-gray-300'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-serif text-xs border ${step >= 1 ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300'}`}>1</div>
        <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Contact</span>
      </div>
      <div className={`h-[1px] w-8 ${step >= 2 ? 'bg-gray-900' : 'bg-gray-200'}`}></div>
      <div className={`flex items-center gap-2 ${step >= 2 ? 'text-gray-900' : 'text-gray-300'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-serif text-xs border ${step >= 2 ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300'}`}>2</div>
        <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Shipping</span>
      </div>
      <div className={`h-[1px] w-8 ${step >= 3 ? 'bg-gray-900' : 'bg-gray-200'}`}></div>
      <div className={`flex items-center gap-2 ${step >= 3 ? 'text-gray-900' : 'text-gray-300'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-serif text-xs border ${step >= 3 ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300'}`}>3</div>
        <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Finalize</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white animate-fade-in flex flex-col lg:flex-row">
      
      {/* LEFT COLUMN: WIZARD FORM */}
      <div className="w-full lg:w-[58%] px-6 lg:px-24 pt-12 lg:pt-24 pb-12 border-r border-brand-latte/10 flex flex-col">
        <div className="max-w-xl mx-auto lg:mx-0 w-full flex-1 flex flex-col">
          
          <div className="flex justify-between items-center mb-10">
             <button onClick={() => step === 1 ? navigate('/cart') : setStep(prev => (prev - 1) as any)} className="flex items-center gap-2 text-gray-400 hover:text-brand-flamingo transition-colors text-xs font-bold uppercase tracking-widest group">
               <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> 
               {step === 1 ? 'Back to Bag' : 'Go Back'}
             </button>
          </div>

          <StepIndicator />

          <form onSubmit={handleNextStep} className="flex-1 flex flex-col relative">
            
            {/* --- STEP 1: CONTACT --- */}
            {step === 1 && (
              <div className="animate-fade-in space-y-8">
                 <div>
                   <h1 className="font-serif text-3xl text-gray-900 mb-2">Contact Details</h1>
                   <p className="font-script text-xl text-brand-gold">Where shall we send your receipt?</p>
                 </div>

                 <div className="space-y-6">
                    <div className="relative group">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 group-focus-within:text-brand-flamingo transition-colors">Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="hello@example.com"
                        className="w-full py-3 bg-transparent border-b border-brand-latte/40 focus:border-brand-flamingo outline-none font-sans text-gray-800 placeholder:text-gray-300 transition-colors pl-8"
                      />
                      <Mail size={16} className="absolute left-0 bottom-3.5 text-gray-300 group-focus-within:text-brand-flamingo transition-colors" />
                    </div>

                    <div className="relative group">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 group-focus-within:text-brand-flamingo transition-colors">Phone Number</label>
                      <input 
                        type="tel" 
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+60..."
                        className="w-full py-3 bg-transparent border-b border-brand-latte/40 focus:border-brand-flamingo outline-none font-sans text-gray-800 placeholder:text-gray-300 transition-colors pl-8"
                      />
                       <Phone size={16} className="absolute left-0 bottom-3.5 text-gray-300 group-focus-within:text-brand-flamingo transition-colors" />
                    </div>
                    
                    <div className="bg-brand-grey/5 p-4 rounded-[2px] border border-brand-latte/10 flex items-start gap-3">
                       <CheckCircle size={16} className="text-brand-green mt-0.5" />
                       <p className="text-xs text-gray-500 font-light leading-relaxed">
                         We'll only use these details to send your order confirmation and shipping updates.
                       </p>
                    </div>
                 </div>
              </div>
            )}

            {/* --- STEP 2: SHIPPING --- */}
            {step === 2 && (
              <div className="animate-fade-in space-y-8">
                 <div>
                   <h1 className="font-serif text-3xl text-gray-900 mb-2">Shipping Address</h1>
                   <p className="font-script text-xl text-brand-gold">Where is this package traveling to?</p>
                 </div>

                 <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <input 
                          type="text" placeholder="First Name" required 
                          value={firstName} onChange={e => setFirstName(e.target.value)}
                          className="w-full py-3 bg-transparent border-b border-brand-latte/40 focus:border-brand-flamingo outline-none font-sans text-gray-800 placeholder:text-gray-300 transition-colors" 
                        />
                      </div>
                      <div>
                        <input 
                          type="text" placeholder="Last Name" required 
                          value={lastName} onChange={e => setLastName(e.target.value)}
                          className="w-full py-3 bg-transparent border-b border-brand-latte/40 focus:border-brand-flamingo outline-none font-sans text-gray-800 placeholder:text-gray-300 transition-colors" 
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <input 
                        type="text" placeholder="Street Address" required 
                        value={address} onChange={e => setAddress(e.target.value)}
                        className="w-full py-3 bg-transparent border-b border-brand-latte/40 focus:border-brand-flamingo outline-none font-sans text-gray-800 placeholder:text-gray-300 transition-colors pl-6" 
                      />
                      <MapPin size={16} className="absolute left-0 top-3.5 text-gray-300" />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <input 
                        type="text" placeholder="Postcode" required 
                        value={postcode} onChange={e => setPostcode(e.target.value)}
                        className="w-full py-3 bg-transparent border-b border-brand-latte/40 focus:border-brand-flamingo outline-none font-sans text-gray-800 placeholder:text-gray-300 transition-colors" 
                       />
                       <input 
                        type="text" placeholder="City" required 
                        value={city} onChange={e => setCity(e.target.value)}
                        className="w-full py-3 bg-transparent border-b border-brand-latte/40 focus:border-brand-flamingo outline-none font-sans text-gray-800 placeholder:text-gray-300 transition-colors" 
                       />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Region</label>
                      <div className="relative">
                        <select 
                          value={region}
                          onChange={(e) => setRegion(e.target.value as 'west' | 'east' | 'sg')}
                          className="w-full py-3 bg-transparent border-b border-brand-latte/40 focus:border-brand-flamingo outline-none font-sans text-gray-800 transition-colors appearance-none cursor-pointer"
                        >
                          <option value="west">West Malaysia (Peninsular)</option>
                          <option value="east">East Malaysia (Sabah & Sarawak)</option>
                          <option value="sg">Singapore</option>
                        </select>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L0 0H10L5 6Z" /></svg>
                        </div>
                      </div>
                      {region === 'sg' && (
                        <p className="text-[10px] text-gray-500 italic mt-2 animate-fade-in">
                          Just a heads up: any customs duties or local taxes (like GST) upon delivery are taken care of by the buyer.
                        </p>
                      )}
                    </div>
                 </div>
              </div>
            )}

            {/* --- STEP 3: FINALIZE --- */}
            {step === 3 && (
              <div className="animate-fade-in space-y-8">
                 <div>
                   <h1 className="font-serif text-3xl text-gray-900 mb-2">Finishing Touches</h1>
                   <p className="font-script text-xl text-brand-gold">Make it special.</p>
                 </div>

                 {/* Gift Section */}
                 <div className="bg-brand-grey/5 p-6 rounded-[2px] border border-brand-latte/10">
                    <div className="flex items-center gap-3 mb-4">
                       <input 
                          id="isGift"
                          type="checkbox"
                          checked={isGift}
                          onChange={(e) => setIsGift(e.target.checked)}
                          className="w-4 h-4 text-brand-flamingo rounded border-gray-300 focus:ring-brand-flamingo accent-brand-flamingo"
                       />
                       <label htmlFor="isGift" className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 cursor-pointer select-none">
                         Would you like us to write on the card? (Optional)
                       </label>
                    </div>
                    
                    <div className={`grid grid-cols-2 gap-6 transition-all duration-500 overflow-hidden ${isGift ? 'max-h-64 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                      <div className="col-span-1">
                         <input 
                           type="text" 
                           placeholder="To (Name) - Optional"
                           value={giftTo}
                           onChange={(e) => setGiftTo(e.target.value)}
                           className="w-full bg-white border-b border-brand-latte/40 px-3 py-2 font-serif text-gray-800 focus:outline-none focus:border-brand-flamingo placeholder:text-gray-400 text-sm"
                         />
                      </div>
                      <div className="col-span-1">
                         <input 
                           type="text" 
                           placeholder="From (Name) - Optional"
                           value={giftFrom}
                           onChange={(e) => setGiftFrom(e.target.value)}
                           className="w-full bg-white border-b border-brand-latte/40 px-3 py-2 font-serif text-gray-800 focus:outline-none focus:border-brand-flamingo placeholder:text-gray-400 text-sm"
                         />
                      </div>
                      <div className="col-span-2">
                         <textarea
                           placeholder="Short Message (Max 80 chars) - Optional"
                           value={giftMessage}
                           maxLength={80}
                           rows={2}
                           onChange={(e) => setGiftMessage(e.target.value)}
                           className="w-full bg-white border border-brand-latte/40 px-3 py-2 font-sans text-gray-800 focus:outline-none focus:border-brand-flamingo placeholder:text-gray-400 text-sm rounded-[2px] resize-none"
                         />
                         <div className="text-right text-[10px] text-gray-400 mt-1">
                           {giftMessage.length}/80
                         </div>
                      </div>
                    </div>
                 </div>

                 {/* Voucher Section */}
                 <div>
                    <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-4 flex items-center gap-2">
                       <Tag size={14} className="text-gray-400" /> Have a voucher?
                    </h3>
                    <div className="flex gap-2 relative">
                       <input 
                          type="text" 
                          placeholder="Enter code" 
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value)}
                          disabled={isFreeShipping || isTestDiscount}
                          className="w-full py-3 bg-transparent border-b border-brand-latte/40 focus:border-brand-flamingo outline-none font-sans text-gray-800 placeholder:text-gray-300 transition-colors disabled:opacity-50" 
                        />
                        {(isFreeShipping || isTestDiscount) ? (
                          <button type="button" onClick={handleRemoveVoucher} className="text-gray-400 hover:text-red-400 px-4 border-b border-brand-latte/40"><X size={18} /></button>
                        ) : (
                          <button type="button" onClick={handleApplyVoucher} className="text-[10px] font-bold uppercase tracking-widest hover:text-brand-flamingo transition-colors px-2 border-b border-brand-latte/40">Apply</button>
                        )}
                    </div>
                    {voucherMessage && (
                        <p className={`text-xs mt-2 flex items-center gap-1 ${voucherMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                          {voucherMessage.type === 'success' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                          {voucherMessage.text}
                        </p>
                    )}
                 </div>

                 {/* Policy Consent Box */}
                 <div className="bg-brand-grey/5 p-6 rounded-[2px] border border-brand-latte/10">
                    <div className="flex items-start gap-3">
                       <input 
                          id="agreeToPolicies"
                          type="checkbox"
                          required
                          checked={agreeToPolicies}
                          onChange={(e) => setAgreeToPolicies(e.target.checked)}
                          className="w-4 h-4 text-brand-flamingo rounded border-gray-300 focus:ring-brand-flamingo accent-brand-flamingo mt-0.5 cursor-pointer"
                       />
                       <label htmlFor="agreeToPolicies" className="font-sans text-xs text-gray-600 cursor-pointer select-none leading-relaxed">
                         I have read and agree to the{' '}
                         <a 
                           href="/#/policies/refund" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           className="text-brand-flamingo hover:text-brand-gold font-bold underline transition-colors"
                         >
                           Refund & Return Policy
                         </a>{' '}
                         and{' '}
                         <a 
                           href="/#/policies/shipping" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           className="text-brand-flamingo hover:text-brand-gold font-bold underline transition-colors"
                         >
                           Shipping & Delivery Policy
                         </a>.
                       </label>
                    </div>
                 </div>

                 {/* Error Display */}
                 {error && (
                    <div className="bg-red-50 p-4 rounded border border-red-100 flex items-start gap-3">
                      <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                      <div className="flex-1">
                        <p className="text-red-600 text-sm font-bold mb-1">Could Not Process Order</p>
                        <p className="text-red-500 text-xs">{error}</p>
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* --- ACTION BUTTONS --- */}
            <div className="mt-12 pt-6 border-t border-brand-latte/10">
               <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-brand-flamingo text-white h-14 rounded-full flex items-center justify-center gap-3 hover:bg-brand-gold transition-colors font-sans text-[11px] uppercase tracking-[0.2em] font-bold shadow-lg shadow-brand-flamingo/20 disabled:opacity-70 disabled:cursor-wait group"
               >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> {step === 3 ? 'Processing...' : 'Loading...'}
                    </>
                  ) : step === 3 ? (
                    `Pay RM ${total}`
                  ) : (
                    <>
                      Next Step <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
               </button>
            </div>
            
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: SUMMARY */}
      <div className="w-full lg:w-[42%] bg-brand-grey/5 px-6 lg:px-16 pt-12 lg:pt-24 pb-12 lg:min-h-screen border-l border-brand-latte/10">
        <div className="max-w-md mx-auto lg:mx-0 sticky top-24">
          <h2 className="font-serif text-2xl text-gray-900 mb-8">In Your Bag</h2>
          
          <div className="space-y-6 mb-8 max-h-[40vh] overflow-y-auto hide-scrollbar pr-2">
            {cart.map(item => (
              <div key={item.id} className="flex gap-4 items-start">
                 <div className="w-14 h-18 bg-white border border-brand-latte/20 relative rounded-[2px] overflow-hidden flex-shrink-0">
                    <img src={item.image} className={`w-full h-full object-cover ${item.isPreOrder ? 'grayscale-[20%]' : ''}`} />
                    <span className="absolute -top-0 -right-0 w-4 h-4 bg-brand-latte/90 text-white text-[9px] font-bold flex items-center justify-center rounded-bl-sm">
                      {item.quantity}
                    </span>
                 </div>
                 <div className="flex-1 min-w-0">
                   <h4 className="font-serif text-gray-900 text-sm truncate">{item.name}</h4>
                   <p className="text-[10px] text-gray-500 font-sans mt-0.5 uppercase tracking-wide">RM {item.price}</p>
                   {item.isPreOrder && (
                      <p className="text-[9px] text-brand-gold font-bold uppercase tracking-wide mt-1 flex items-center gap-1">
                        <Clock size={10} /> Ships in 2 weeks
                      </p>
                   )}
                 </div>
                 <div className="font-sans text-sm font-bold text-gray-900">
                   RM {item.price * item.quantity}
                 </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-brand-latte/20 p-5 rounded-[2px] mb-8">
            <h4 className="font-sans text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-3 flex items-center gap-2">
              <Sparkles size={12} /> The Unboxing Experience
            </h4>
            <div className="space-y-3">
              {swaddleCount > 0 && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-grey/10 flex items-center justify-center text-gray-400">
                            <Gift size={12} />
                        </div>
                        <div>
                            <p className="font-serif text-sm text-gray-900">Once Upon 1st Edition Box</p>
                            <p className="text-[10px] text-brand-gold italic">Free with Swaddles</p>
                        </div>
                    </div>
                    <span className="font-serif text-sm text-brand-gold italic">x {swaddleCount}</span>
                </div>
              )}

              {(swaddleCount + blanketCount) > 0 && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-grey/10 flex items-center justify-center text-gray-400">
                            <PenTool size={12} />
                        </div>
                        <p className="font-serif text-sm text-gray-900">Gift Card</p>
                    </div>
                    <span className="font-serif text-sm text-brand-gold italic">x {swaddleCount + blanketCount}</span>
                </div>
              )}

              {(() => {
                const hasSigBox = cart.some(item => item.name.toLowerCase().includes('signature') || item.name.toLowerCase().includes('edition') || item.name.toLowerCase().includes('keepsake'));
                const hasRegularBox = cart.some(item => (item.name.toLowerCase().includes('gift box') || item.name.toLowerCase().includes('box')) && !item.name.toLowerCase().includes('signature') && !item.name.toLowerCase().includes('edition') && !item.name.toLowerCase().includes('keepsake'));

                if (!hasSigBox && !hasRegularBox) return null;

                return (
                  <div className="border-t border-brand-latte/15 pt-3.5 mt-2 text-[10px] font-sans text-brand-gold font-medium leading-relaxed space-y-1.5 animate-fade-in">
                    {hasSigBox && (
                      <p className="flex items-start gap-1.5">
                        <span>✦</span>
                        <span>
                          Notice: Fits exactly one baby-sized blanket or swaddle. {hasAdultBlanket && "(Note: This box does not fit Adult-size blankets)."}
                        </span>
                      </p>
                    )}
                    {hasRegularBox && (
                      <p className="flex items-start gap-1.5">
                        <span>✦</span>
                        <span>
                          Notice: Gift Box fits up to 2 swaddles, 2 baby blankets, or 1 adult blanket.
                        </span>
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="border-t border-brand-latte/20 pt-6 space-y-3">
             <div className="flex justify-between text-sm font-sans text-gray-600">
                <span>Subtotal</span>
                <span>RM {subtotal}</span>
             </div>
             <div className="flex justify-between text-sm font-sans text-gray-600 items-center">
                <span>Shipping</span>
                {step < 2 ? (
                  <span className="text-xs italic text-gray-400">Calculated next step</span>
                ) : (isFreeShipping || isTestDiscount) ? (
                  <span className="text-brand-green font-bold text-xs uppercase tracking-wider flex items-center gap-1"><Tag size={10} /> Free</span>
                ) : (
                  <span>RM {shippingCost}</span>
                )}
             </div>
             {isTestDiscount && (
                 <div className="flex justify-between text-sm font-sans text-brand-flamingo font-bold">
                    <span>Discount (TESTRM1)</span>
                    <span>- RM {discountAmount.toFixed(2)}</span>
                 </div>
             )}
          </div>
          
          <div className="border-t border-brand-latte/20 pt-6 mt-6">
             <div className="flex justify-between items-end">
                <span className="font-serif text-xl text-gray-900">Total</span>
                <span className="font-serif text-3xl text-gray-900">RM {step < 2 ? subtotal : total}</span>
             </div>
          </div>

          <div className="mt-8 flex items-center gap-3 justify-center text-brand-gold opacity-60">
             <Lock size={12} />
             <span className="text-[10px] uppercase tracking-widest font-bold">Secure Payment via CHIP</span>
          </div>

        </div>
      </div>

    </div>
  );
};
