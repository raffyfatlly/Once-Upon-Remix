
import React, { useState } from 'react';
import { Product } from '../types';
import { ShoppingBag, Sparkles, Loader2, Check, Clock } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
  onClick: (product: Product) => void;
  index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, onClick }) => {
  const [addState, setAddState] = useState<'idle' | 'loading' | 'success'>('idle');

  const stock = product.stock || 0;
  const productGroup = (!product.collection || product.collection === 'Blankets' || product.collection.toLowerCase().includes('blanket') || (product.category && product.category.toLowerCase().includes('blanket'))) ? 'Blankets' : 'Swaddle';
  const isBlanket = productGroup === 'Blankets';
  
  const isPreOrder = stock <= 0 && isBlanket;
  const isSoldOut = stock <= 0 && !isBlanket;
  const isLowStock = stock > 0 && stock <= 5;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (addState !== 'idle') return;
    
    setAddState('loading');
    setTimeout(() => {
      onAddToCart(product, 1);
      setAddState('success');
      setTimeout(() => setAddState('idle'), 2000);
    }, 600);
  };

  const descriptionPreview = product.description 
    ? product.description.split('.')[0] + '.' 
    : '';

  return (
    <div className="group relative w-full flex flex-col items-center">
      <div onClick={() => onClick(product)} className="relative w-full aspect-[3/4] mx-auto max-w-sm transition-transform duration-500 hover:-translate-y-2 cursor-pointer">
        <div className="absolute top-4 -right-4 w-full h-full bg-brand-latte/20 rounded-[30px] -rotate-2 transition-transform duration-500 group-hover:rotate-0 group-hover:translate-x-2 group-hover:translate-y-2"></div>
        <div className="absolute -bottom-4 -left-4 w-full h-full bg-brand-pink/10 rounded-[30px] rotate-2 transition-transform duration-500 group-hover:rotate-0 group-hover:-translate-x-2 group-hover:-translate-y-2"></div>
        <div className="relative w-full h-full bg-white rounded-[24px] overflow-hidden shadow-2xl shadow-brand-latte/10 ring-1 ring-black/5 flex flex-col">
           <div className="w-full h-full overflow-hidden p-3 bg-white relative">
              <div className="w-full h-full overflow-hidden rounded-[16px] relative">
                {/* Removed grayscale and opacity logic to make product clear */}
                <img src={product.image} alt={product.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-[1.5s] ease-in-out group-hover:scale-110" />
                
                {isPreOrder ? (
                  // Center position. Restored to text-[10px] for better visibility as requested.
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <div className="px-3 py-1.5 bg-white/90 backdrop-blur-[2px] border border-brand-gold/30 rounded-full shadow-sm">
                      <span className="font-serif text-[10px] text-brand-gold font-bold uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                         <Clock size={12} /> Pre-order
                      </span>
                    </div>
                  </div>
                ) : isSoldOut ? (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <div className="px-3 py-1.5 bg-white/90 backdrop-blur-[2px] border border-red-200 rounded-full shadow-sm">
                      <span className="font-serif text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap">
                         Sold Out
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                )}
              </div>
           </div>
           
           <div className="absolute bottom-3 right-3 md:bottom-5 md:right-5 z-30 transform transition-all duration-300 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
             <button onClick={handleAddToCart} disabled={addState !== 'idle' || isSoldOut} className={`p-3 md:p-4 rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center group/btn ${addState === 'success' ? 'bg-brand-green text-white' : isPreOrder ? 'bg-brand-gold text-white hover:bg-brand-flamingo' : isSoldOut ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-flamingo text-white md:hover:bg-brand-gold'}`} aria-label={isPreOrder ? "Pre-order now" : isSoldOut ? "Sold out" : "Add to cart"}>
               {addState === 'loading' ? (<Loader2 size={18} className="animate-spin" />) : addState === 'success' ? (<Check size={18} strokeWidth={2} />) : isSoldOut ? (<span className="text-[10px] font-bold px-1 text-gray-400">SOLD OUT</span>) : (<ShoppingBag size={18} strokeWidth={1.5} className="md:group-hover/btn:animate-bounce" />)}
             </button>
           </div>
        </div>
      </div>
      <div className="mt-6 md:mt-10 text-center px-4 relative z-10 cursor-pointer" onClick={() => onClick(product)}>
        <h3 className="font-serif text-3xl text-gray-900 mb-2 group-hover:text-brand-flamingo transition-colors duration-300">{product.name}</h3>
        <p className="font-script text-2xl text-brand-gold mb-3 -mt-1 flex items-center justify-center gap-2">
          <Sparkles size={12} className="opacity-50" />
          {(!product.collection || product.collection === 'Blankets') ? 'Blanket Collection' : product.collection}
          <Sparkles size={12} className="opacity-50" />
        </p>
        <p className="font-serif text-gray-500 mb-4 max-w-[250px] mx-auto text-sm leading-relaxed line-clamp-2 opacity-80">{descriptionPreview}</p>
        <div className="flex flex-col items-center gap-2">
          <div className="inline-block px-5 py-1.5 rounded-full border border-brand-latte/30 bg-white shadow-sm group-hover:border-brand-flamingo/30 transition-colors">
            <span className="font-sans font-bold text-sm tracking-widest text-gray-900">RM {product.price}</span>
          </div>
          
          {/* Updated Text Description for Pre-orders */}
          {isPreOrder ? (
            <span className="font-serif italic text-[10px] md:text-xs text-brand-gold mt-1 font-medium">
              Sold Out • Pre-order ships in 2 weeks
            </span>
          ) : isSoldOut ? (
            <span className="font-serif italic text-[10px] md:text-xs text-red-500 mt-1 font-medium">
              Temporarily Sold Out
            </span>
          ) : isLowStock && (
            <span className="font-serif italic text-xs text-brand-flamingo mt-1 animate-pulse">
              Only {stock} left
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
