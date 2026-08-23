
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { updateOrderStatusInDb, restoreStockForOrder, getOrderById } from '../firebase';
import { trackPurchase } from '../analytics';
import { CakenicTicketView } from './CakenicTicketView';
import { Order } from '../types';

export const PaymentCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'cancelled'>('loading');
  const [displayOrderId, setDisplayOrderId] = useState<string>('');
  const [order, setOrder] = useState<Order | null>(null);
  
  useEffect(() => {
    const result = searchParams.get('result');
    const orderId = searchParams.get('order');
    
    const method = searchParams.get('method');
    if (orderId) setDisplayOrderId(orderId);
    
    const handleCallback = async () => {
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

        // If order was ALREADY marked as paid (by CHIP server webhook or previous session)
        if (fetchedOrder && (fetchedOrder.status === 'paid' || fetchedOrder.status === 'packed' || fetchedOrder.status === 'shipped' || fetchedOrder.status === 'delivered')) {
          setStatus('success');
          setOrder(fetchedOrder);
          return;
        }

        if (result === 'success') {
          // Payment Successful: Stock was already deducted at checkout.
          // Just update status to Paid.
          await updateOrderStatusInDb(orderId, 'paid');
          setStatus('success');
          if (fetchedOrder) {
            setOrder({ ...fetchedOrder, status: 'paid' });
          }
          
          // Track purchase in self-hosted analytics
          try {
            if (fetchedOrder) {
              trackPurchase(orderId, fetchedOrder.total);
            }
          } catch (trackingErr) {
            console.warn("Purchase tracking failed (silent):", trackingErr);
          }
          return;
        }

        // 🛡️ CRITICAL RESCUE CHECK:
        // Even if result query says "cancelled" or "failed" or is empty (e.g. user pressed Back after paying,
        // or browser popup issue), verify directly with CHIP Gateway API before taking any destructive action!
        let isConfirmedPaidOnGateway = false;
        try {
          const verifyResp = await fetch(`/api/chip/verify/${encodeURIComponent(orderId)}`);
          if (verifyResp.ok) {
            const verifyData = await verifyResp.json();
            if (verifyData && verifyData.paid === true) {
              isConfirmedPaidOnGateway = true;
              console.log(`[PaymentCallback] CHIP Gateway confirmed Order #${orderId} is PAID! Rescuing order.`);
              setStatus('success');
              if (fetchedOrder) {
                setOrder({ ...fetchedOrder, status: 'paid' });
                try {
                  trackPurchase(orderId, fetchedOrder.total);
                } catch (_) {}
              }
              return;
            }
          }
        } catch (verifyErr) {
          console.warn("[PaymentCallback] Live verify fetch failed:", verifyErr);
        }

        // If gateway explicitly confirmed NOT paid, and order is still not paid:
        if (!isConfirmedPaidOnGateway) {
          // Re-check order status from DB once more to ensure webhook didn't set it to paid in the background
          const doubleCheckOrder = await getOrderById(orderId);
          if (doubleCheckOrder && (doubleCheckOrder.status === 'paid' || doubleCheckOrder.status === 'packed' || doubleCheckOrder.status === 'shipped')) {
            setStatus('success');
            setOrder(doubleCheckOrder);
            return;
          }

          if (result === 'failed') {
            await restoreStockForOrder(orderId, 'failed');
            setStatus('failed');
            if (fetchedOrder) setOrder({ ...fetchedOrder, status: 'failed' });
          } else if (result === 'cancelled') {
            await restoreStockForOrder(orderId, 'cancelled');
            setStatus('cancelled');
            if (fetchedOrder) setOrder({ ...fetchedOrder, status: 'cancelled' });
          } else {
            await restoreStockForOrder(orderId, 'failed');
            setStatus('failed');
          }
        }
      } catch (error) {
        console.error("Failed to update order status:", error);
        if (result === 'success') setStatus('success');
        else if (result === 'cancelled') setStatus('cancelled');
        else setStatus('failed');
      }
    };

    const timer = setTimeout(() => {
      handleCallback();
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchParams]);

  // Check if order is Cakenic
  const isCakenicOrder = order && (
    order.source === 'cakenic' || 
    order.channel === 'Cakenic Sales' || 
    order.utm_source === 'cakenic_landing_page' || 
    (order.shippingAddress && order.shippingAddress.toLowerCase().trim() === 'cakenic') ||
    order.items?.some(i => i.collection === 'Cakenic Ticket' || i.category === 'Event Ticket' || Boolean(i.isCakenicOnly) || (i.id && i.id.startsWith('cakenic')))
  );

  return (
    <div className="min-h-screen bg-[#F1E8E2] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="max-w-xl w-full text-center">
        
        {status === 'loading' && (
          <div className="flex flex-col items-center bg-[#FBF6F1] p-10 rounded-[32px] border border-[#332524]/10 shadow-lg">
             <Loader2 size={48} className="text-[#E3A099] animate-spin mb-6" />
             <h2 className="font-serif text-2xl sm:text-3xl text-[#332524]">Processing Ticket Status...</h2>
             <p className="text-[#6B5450] text-xs mt-2 font-medium">Updating your Cakenic order details</p>
          </div>
        )}

        {status !== 'loading' && isCakenicOrder && order && (
          <CakenicTicketView 
            order={order} 
            isCancel={status === 'cancelled' || status === 'failed'} 
          />
        )}

        {status !== 'loading' && (!isCakenicOrder || !order) && (
          <div className="bg-white p-8 sm:p-10 rounded-[32px] shadow-lg border border-gray-100 max-w-md mx-auto">
            {status === 'success' && (
              <div className="flex flex-col items-center animate-slide-up">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle size={40} className="text-brand-green" />
                </div>
                <h1 className="font-serif text-3xl md:text-4xl text-gray-900 mb-2">Payment Successful</h1>
                {displayOrderId && (
                  <div className="mb-4 bg-brand-grey/10 px-4 py-1 rounded-full text-xs font-mono text-gray-500">
                    Order #{displayOrderId}
                  </div>
                )}
                <p className="font-sans text-gray-500 mb-8 leading-relaxed">
                  Thank you for your purchase. Your order has been confirmed. A receipt has been sent to your email.
                </p>
                <button 
                  onClick={() => navigate('/')}
                  className="bg-brand-flamingo text-white px-8 py-3.5 font-sans uppercase tracking-[0.2em] text-[10px] font-bold hover:bg-brand-gold transition-colors rounded-full flex items-center gap-2"
                >
                  Continue Shopping <ArrowRight size={14} />
                </button>
              </div>
            )}

            {status === 'failed' && (
              <div className="flex flex-col items-center animate-slide-up">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                  <XCircle size={40} className="text-red-400" />
                </div>
                <h1 className="font-serif text-3xl md:text-4xl text-gray-900 mb-4">Payment Failed</h1>
                <p className="font-sans text-gray-500 mb-8 leading-relaxed">
                  We couldn't process your payment. The items have been returned to stock.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => navigate('/checkout')}
                    className="bg-gray-900 text-white px-8 py-3.5 font-sans uppercase tracking-[0.2em] text-[10px] font-bold hover:bg-brand-flamingo transition-colors rounded-full"
                  >
                    Try Again
                  </button>
                  <button 
                    onClick={() => navigate('/')}
                    className="text-gray-500 px-6 py-3.5 font-sans uppercase tracking-[0.2em] text-[10px] font-bold hover:text-gray-900 transition-colors"
                  >
                    Return Home
                  </button>
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
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                  <AlertCircle size={40} className="text-gray-400" />
                </div>
                <h1 className="font-serif text-3xl md:text-4xl text-gray-900 mb-4">Payment Cancelled</h1>
                <p className="font-sans text-gray-500 mb-8 leading-relaxed">
                  You cancelled the payment. The stock reserved for you has been released.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => navigate('/checkout')}
                    className="bg-brand-gold text-white px-8 py-3.5 font-sans uppercase tracking-[0.2em] text-[10px] font-bold hover:bg-brand-flamingo transition-colors rounded-full"
                  >
                    Return to Checkout
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
