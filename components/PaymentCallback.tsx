
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { updateOrderStatusInDb, restoreStockForOrder, getOrderById } from '../firebase';
import { trackPurchase } from '../analytics';

export const PaymentCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'cancelled'>('loading');
  const [displayOrderId, setDisplayOrderId] = useState<string>('');
  
  useEffect(() => {
    const result = searchParams.get('result');
    const orderId = searchParams.get('order');
    
    if (orderId) setDisplayOrderId(orderId);
    
    const handleCallback = async () => {
      if (!orderId) {
        setStatus('failed');
        return;
      }

      try {
        if (result === 'success') {
          // Payment Successful: Stock was already deducted at checkout.
          // Just update status to Paid.
          await updateOrderStatusInDb(orderId, 'paid');
          setStatus('success');
          
          // Track purchase in self-hosted analytics
          try {
            const order = await getOrderById(orderId);
            if (order) {
              trackPurchase(orderId, order.total);
            }
          } catch (trackingErr) {
            console.warn("Purchase tracking failed (silent):", trackingErr);
          }
        } else if (result === 'failed') {
          // Payment Failed: Restore the stock quantity.
          await restoreStockForOrder(orderId, 'failed');
          setStatus('failed');
        } else if (result === 'cancelled') {
          // Payment Cancelled: Restore the stock quantity.
          await restoreStockForOrder(orderId, 'cancelled');
          setStatus('cancelled');
        } else {
          // Unknown State: Default to failed/restore safety
          await restoreStockForOrder(orderId, 'failed');
          setStatus('failed');
        }
      } catch (error) {
        console.error("Failed to update order status:", error);
        // Fallback UI based on result parameter if DB update fails
        // Note: If restoration fails, stock might be temporarily out of sync, 
        // but this is safer than overselling.
        if (result === 'success') setStatus('success');
        else if (result === 'cancelled') setStatus('cancelled');
        else setStatus('failed');
      }
    };

    // Small delay to ensure smooth transition
    const timer = setTimeout(() => {
      handleCallback();
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full text-center">
        
        {status === 'loading' && (
          <div className="flex flex-col items-center">
             <Loader2 size={48} className="text-brand-gold animate-spin mb-6" />
             <h2 className="font-serif text-2xl text-gray-900">Processing...</h2>
             <p className="text-gray-400 text-xs mt-2">Updating your order status</p>
          </div>
        )}

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
    </div>
  );
};
