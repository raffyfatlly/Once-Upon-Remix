
import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowRight, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { updateOrderStatusInDb, restoreStockForOrder, getOrderById } from '../firebase';
import { trackPurchase } from '../analytics';
import { CakenicTicketView } from './CakenicTicketView';
import { Order } from '../types';

export const PaymentCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'cancelled' | 'unconfirmed'>('loading');
  const [displayOrderId, setDisplayOrderId] = useState<string>('');
  const [order, setOrder] = useState<Order | null>(null);
  const [isManualChecking, setIsManualChecking] = useState<boolean>(false);
  const [checkFeedback, setCheckFeedback] = useState<string>('');
  const isCancelledRef = useRef<boolean>(false);
  
  const checkPaymentWithGateway = async (orderId: string): Promise<boolean> => {
    try {
      const verifyResp = await fetch(`/api/chip/verify/${encodeURIComponent(orderId)}`);
      if (verifyResp.ok) {
        const text = await verifyResp.text();
        try {
          const verifyData = JSON.parse(text);
          if (verifyData && verifyData.paid === true) {
            return true;
          }
        } catch (_) {}
      }
    } catch (verifyErr) {
      console.warn("[PaymentCallback] Live verify fetch failed:", verifyErr);
    }
    return false;
  };

  const handleManualRecheck = async () => {
    if (!displayOrderId) return;
    setIsManualChecking(true);
    setCheckFeedback('Connecting to CHIP gateway...');
    try {
      const isPaid = await checkPaymentWithGateway(displayOrderId);
      if (isPaid) {
        setCheckFeedback('✅ Payment confirmed! Updating order...');
        await updateOrderStatusInDb(displayOrderId, 'paid');
        const refreshedOrder = await getOrderById(displayOrderId);
        if (refreshedOrder) {
          setOrder(refreshedOrder);
          try {
            trackPurchase(displayOrderId, refreshedOrder.total);
          } catch (_) {}
        }
        setStatus('success');
      } else {
        const dbOrder = await getOrderById(displayOrderId);
        if (dbOrder && ['paid', 'packed', 'shipped', 'delivered'].includes(dbOrder.status)) {
          setOrder(dbOrder);
          setStatus('success');
        } else {
          setCheckFeedback('Payment is not yet confirmed by bank. Please allow 1-2 minutes or check your bank statement.');
        }
      }
    } catch (err: any) {
      setCheckFeedback('Verification check error: ' + err.message);
    } finally {
      setIsManualChecking(false);
    }
  };

  const handleExplicitCancelOrder = async () => {
    if (!displayOrderId) return;
    if (window.confirm("Are you sure you want to cancel this order reservation and return items to stock?")) {
      try {
        await restoreStockForOrder(displayOrderId, 'cancelled');
        setStatus('cancelled');
      } catch (e) {
        console.error("Cancel order error:", e);
      }
    }
  };

  useEffect(() => {
    isCancelledRef.current = false;
    const result = searchParams.get('result');
    const orderId = searchParams.get('order');
    const method = searchParams.get('method');
    if (orderId) setDisplayOrderId(orderId);
    
    const runVerificationPipeline = async () => {
      if (!orderId) {
        setStatus('failed');
        return;
      }

      try {
        const fetchedOrder = await getOrderById(orderId);
        if (fetchedOrder) {
          setOrder(fetchedOrder);
        }

        if (method === 'bank_transfer') {
          await updateOrderStatusInDb(orderId, 'pending_transfer');
          setStatus('bank_transfer' as any);
          return;
        }

        // 1. If order was ALREADY marked as paid (by CHIP server webhook or background sync)
        if (fetchedOrder && (fetchedOrder.status === 'paid' || fetchedOrder.status === 'packed' || fetchedOrder.status === 'shipped' || fetchedOrder.status === 'delivered')) {
          setStatus('success');
          setOrder(fetchedOrder);
          return;
        }

        // 2. Direct success redirect: mark as paid immediately
        if (result === 'success') {
          await updateOrderStatusInDb(orderId, 'paid');
          setStatus('success');
          if (fetchedOrder) {
            setOrder({ ...fetchedOrder, status: 'paid' });
            try {
              trackPurchase(orderId, fetchedOrder.total);
            } catch (trackingErr) {
              console.warn("Purchase tracking failed (silent):", trackingErr);
            }
          }
          return;
        }

        // 3. Multi-attempt polling rescue check
        // Often customers authorize on banking app and redirect takes 2-8 seconds to reflect on CHIP.
        // We poll CHIP up to 4 times before deciding.
        const delays = [500, 2000, 3000, 3500];
        for (let attempt = 0; attempt < delays.length; attempt++) {
          if (isCancelledRef.current) return;
          await new Promise(r => setTimeout(r, delays[attempt]));

          // Live check with gateway
          const isPaid = await checkPaymentWithGateway(orderId);
          if (isPaid) {
            console.log(`[PaymentCallback] CHIP Gateway confirmed Order #${orderId} is PAID on attempt ${attempt + 1}!`);
            await updateOrderStatusInDb(orderId, 'paid');
            const latestOrder = await getOrderById(orderId);
            if (latestOrder) {
              setOrder(latestOrder);
              try {
                trackPurchase(orderId, latestOrder.total);
              } catch (_) {}
            }
            setStatus('success');
            return;
          }

          // Double check database in case server webhook resolved it
          const latestDbOrder = await getOrderById(orderId);
          if (latestDbOrder && ['paid', 'packed', 'shipped', 'delivered'].includes(latestDbOrder.status)) {
            setOrder(latestDbOrder);
            setStatus('success');
            return;
          }
        }

        // If after all polling attempts the payment is still not confirmed:
        // 🛡️ CRITICAL SAFETY: DO NOT automatically destroy/cancel the order immediately!
        // Keep order in pending state so late webhooks can still settle it, and offer manual re-verify.
        if (result === 'cancelled') {
          setStatus('unconfirmed');
        } else if (result === 'failed') {
          setStatus('failed');
        } else {
          setStatus('unconfirmed');
        }
      } catch (error) {
        console.error("Failed to update order status:", error);
        if (result === 'success') setStatus('success');
        else setStatus('unconfirmed');
      }
    };

    runVerificationPipeline();

    return () => {
      isCancelledRef.current = true;
    };
  }, [searchParams]);

  // Determine if this is a Cakenic order or Once Upon store order
  const shopParam = searchParams.get('shop');
  const isCakenicParam = searchParams.get('cakenic') === 'true';

  const isCakenicOrder = shopParam === 'cakenic' || isCakenicParam || Boolean(order && (
    order.source === 'cakenic' || 
    order.channel === 'Cakenic Sales' || 
    order.utm_source === 'cakenic_landing_page' || 
    (order.shippingAddress && order.shippingAddress.toLowerCase().trim() === 'cakenic') ||
    order.items?.some(i => i.collection === 'Cakenic Ticket' || i.category === 'Event Ticket' || Boolean(i.isCakenicOnly) || (i.id && i.id.startsWith('cakenic')))
  ));

  return (
    <div className={`min-h-screen ${isCakenicOrder ? 'bg-[#F1E8E2]' : 'bg-[#FAF8F5]'} flex items-center justify-center p-4 sm:p-6 animate-fade-in`}>
      <div className="max-w-xl w-full text-center">
        
        {/* --- LOADING STATES --- */}
        {status === 'loading' && (
          isCakenicOrder ? (
            <div className="flex flex-col items-center bg-[#FBF6F1] p-10 rounded-[32px] border border-[#332524]/10 shadow-lg max-w-md mx-auto animate-pulse">
              <Loader2 size={44} className="text-[#E3A099] animate-spin mb-5" />
              <h2 className="font-serif text-2xl sm:text-3xl text-[#332524]">Verifying Ticket Payment...</h2>
              <p className="text-[#6B5450] text-xs mt-2 font-medium">Checking authorization with payment gateway</p>
            </div>
          ) : (
            <div className="flex flex-col items-center bg-white p-10 rounded-[32px] border border-gray-100 shadow-lg max-w-md mx-auto">
              <Loader2 size={44} className="text-brand-flamingo animate-spin mb-5" />
              <h2 className="font-serif text-2xl sm:text-3xl text-gray-900">Verifying Payment Status...</h2>
              <p className="text-gray-500 text-xs mt-2 font-medium">Checking bank authorization with CHIP Gateway</p>
            </div>
          )
        )}

        {/* --- CAKENIC EVENT SPECIFIC VIEW --- */}
        {status !== 'loading' && isCakenicOrder && (
          order ? (
            <CakenicTicketView 
              order={order} 
              isCancel={status === 'cancelled' || status === 'failed'} 
              onClose={() => navigate('/cakenic')}
            />
          ) : (
            <div className="bg-[#FBF6F1] p-8 sm:p-10 rounded-[32px] shadow-lg border border-[#332524]/10 max-w-md mx-auto text-[#332524]">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 mb-4">
                <AlertCircle size={32} />
              </div>
              <h2 className="font-serif text-2xl font-semibold mb-2">Cakenic Reservation Update</h2>
              <p className="text-xs text-[#6B5450] mb-6">
                {status === 'cancelled' ? 'Your ticket reservation was cancelled.' : 'Payment is currently pending verification.'}
              </p>
              <button 
                onClick={() => navigate('/cakenic')}
                className="bg-[#E3A099] text-white px-8 py-3 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#d88f87] transition-colors"
              >
                Return to Cakenic
              </button>
            </div>
          )
        )}

        {/* --- ONCE UPON MAIN STORE VIEW (BLANKETS / SWADDLES / GIFTS) --- */}
        {status !== 'loading' && !isCakenicOrder && (
          <div className="bg-white p-8 sm:p-10 rounded-[32px] shadow-xl border border-brand-latte/10 max-w-md mx-auto">
            {status === 'success' && (
              <div className="flex flex-col items-center animate-slide-up">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <CheckCircle size={40} className="text-brand-green" />
                </div>
                <h1 className="font-serif text-3xl md:text-4xl text-gray-900 mb-2">Payment Successful</h1>
                {displayOrderId && (
                  <div className="mb-4 bg-brand-grey/10 px-4 py-1.5 rounded-full text-xs font-mono text-gray-600 font-semibold">
                    Order #{displayOrderId}
                  </div>
                )}
                <p className="font-sans text-gray-500 mb-8 text-sm leading-relaxed">
                  Thank you for your purchase from Once Upon. Your order has been confirmed and a receipt has been sent to your email.
                </p>
                <button 
                  onClick={() => navigate('/')}
                  className="bg-brand-flamingo text-white px-8 py-3.5 font-sans uppercase tracking-[0.2em] text-[10px] font-bold hover:bg-brand-gold transition-colors rounded-full flex items-center gap-2 shadow-md hover:shadow-lg"
                >
                  Continue Shopping <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* UNCONFIRMED / PENDING AUTHORIZATION STATE */}
            {status === 'unconfirmed' && (
              <div className="flex flex-col items-center animate-slide-up">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                  <AlertCircle size={40} className="text-amber-500" />
                </div>
                <h1 className="font-serif text-2xl md:text-3xl text-gray-900 mb-2">Payment Authorization Pending</h1>
                {displayOrderId && (
                  <div className="mb-3 bg-amber-50 border border-amber-200 px-4 py-1 rounded-full text-xs font-mono text-amber-800 font-bold">
                    Order #{displayOrderId}
                  </div>
                )}
                <p className="font-sans text-gray-600 mb-4 text-xs sm:text-sm leading-relaxed">
                  If your bank or card was already charged, your payment is being processed by the gateway. You do not need to pay twice.
                </p>

                {checkFeedback && (
                  <div className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-xs p-3 rounded mb-4 animate-fade-in">
                    {checkFeedback}
                  </div>
                )}

                <div className="flex flex-col gap-2.5 w-full">
                  <button 
                    onClick={handleManualRecheck}
                    disabled={isManualChecking}
                    className="w-full bg-brand-flamingo hover:bg-brand-flamingo/95 text-white py-3 font-sans uppercase tracking-[0.15em] text-[10px] font-bold transition-colors rounded-full flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {isManualChecking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {isManualChecking ? 'Checking CHIP Gateway...' : 'Check Payment Status Now'}
                  </button>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigate('/checkout')}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 font-sans uppercase tracking-[0.15em] text-[10px] font-bold rounded-full transition-colors"
                    >
                      Return to Checkout
                    </button>
                    <button 
                      onClick={handleExplicitCancelOrder}
                      className="flex-1 text-red-500 hover:bg-red-50 py-2.5 font-sans uppercase tracking-[0.15em] text-[10px] font-bold rounded-full transition-colors border border-red-200"
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              </div>
            )}

            {status === 'failed' && (
              <div className="flex flex-col items-center animate-slide-up">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                  <XCircle size={40} className="text-red-400" />
                </div>
                <h1 className="font-serif text-3xl md:text-4xl text-gray-900 mb-3">Payment Failed</h1>
                <p className="font-sans text-gray-500 mb-6 text-sm leading-relaxed">
                  We couldn't process your payment. If you were charged, please check the status below.
                </p>

                {checkFeedback && (
                  <div className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-xs p-3 rounded mb-4 animate-fade-in">
                    {checkFeedback}
                  </div>
                )}

                <div className="flex flex-col gap-3 w-full justify-center">
                  <button 
                    onClick={handleManualRecheck}
                    disabled={isManualChecking}
                    className="w-full bg-brand-flamingo text-white py-3 font-sans uppercase tracking-[0.15em] text-[10px] font-bold hover:bg-brand-gold transition-colors rounded-full flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isManualChecking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    {isManualChecking ? 'Verifying with Bank...' : 'Check Payment Status with CHIP'}
                  </button>
                  <div className="flex gap-2 w-full">
                    <button 
                      onClick={() => navigate('/checkout')}
                      className="flex-1 bg-gray-900 text-white py-2.5 font-sans uppercase tracking-[0.15em] text-[10px] font-bold hover:bg-brand-flamingo transition-colors rounded-full shadow-sm"
                    >
                      Try Again
                    </button>
                    <button 
                      onClick={() => navigate('/')}
                      className="flex-1 text-gray-500 py-2.5 font-sans uppercase tracking-[0.15em] text-[10px] font-bold hover:text-gray-900 transition-colors"
                    >
                      Return Home
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(status as any) === 'bank_transfer' && (
              <div className="flex flex-col items-center animate-slide-up">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                  <span className="text-3xl">🏦</span>
                </div>
                <h1 className="font-serif text-3xl md:text-4xl text-gray-900 mb-2">Order Reserved!</h1>
                {displayOrderId && (
                  <div className="mb-4 bg-brand-grey/10 px-4 py-1 rounded-full text-xs font-mono text-gray-700 font-bold">
                    Order #{displayOrderId}
                  </div>
                )}
                <p className="font-sans text-gray-600 mb-6 text-sm leading-relaxed max-w-sm">
                  Please transfer your payment to Maybank to complete your order confirmation:
                </p>

                <div className="w-full max-w-sm bg-brand-grey/5 p-5 rounded-2xl border border-brand-latte/20 text-left mb-6 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-medium">Bank Name:</span>
                    <span className="font-bold text-gray-900">Maybank</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-medium">Account Number:</span>
                    <span className="font-bold text-brand-flamingo font-mono text-sm">562188327902</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-medium">Account Name:</span>
                    <span className="font-bold text-gray-900">VANILLICIOUS ENTERPRISE</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-gray-500 font-medium">Payment Reference:</span>
                    <span className="font-bold text-gray-900 font-mono">#{displayOrderId}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full max-w-sm">
                  <a 
                    href={`https://wa.me/60120000000?text=${encodeURIComponent(`Hi Vanillicious team! I have completed payment for Order #${displayOrderId}.\n\nHere is my payment receipt screenshot.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#25D366] text-white py-3.5 font-sans uppercase tracking-[0.15em] text-[11px] font-bold hover:bg-[#1ebd53] transition-colors rounded-full flex items-center justify-center gap-2 shadow-md"
                  >
                    Send Receipt on WhatsApp
                  </a>
                  <button 
                    onClick={() => navigate('/')}
                    className="text-gray-500 py-2.5 font-sans uppercase tracking-[0.15em] text-[10px] font-bold hover:text-gray-900 transition-colors"
                  >
                    Return to Store
                  </button>
                </div>
              </div>
            )}

            {status === 'cancelled' && (
              <div className="flex flex-col items-center animate-slide-up">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                  <AlertCircle size={40} className="text-amber-500" />
                </div>
                <h1 className="font-serif text-3xl md:text-4xl text-gray-900 mb-3">Payment Cancelled</h1>
                <p className="font-sans text-gray-500 mb-8 text-sm leading-relaxed">
                  You cancelled the payment process. Any items reserved for your order have been returned to stock.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                  <button 
                    onClick={() => navigate('/checkout')}
                    className="bg-brand-flamingo text-white px-8 py-3.5 font-sans uppercase tracking-[0.2em] text-[10px] font-bold hover:bg-brand-gold transition-colors rounded-full shadow-sm"
                  >
                    Return to Checkout
                  </button>
                  <button 
                    onClick={() => navigate('/')}
                    className="text-gray-500 px-6 py-3.5 font-sans uppercase tracking-[0.2em] text-[10px] font-bold hover:text-gray-900 transition-colors"
                  >
                    Return to Store
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
