
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { ArrowLeft, Minus, Plus, ShoppingBag, Truck, Info, Leaf, Loader2, Check, AlertCircle, Ruler, Share2, Clock, ArrowRight } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProductCard } from './ProductCard';
import { trackViewItem } from '../analytics';
import { getProductSlug } from '../constants';

interface ProductDetailsProps {
  products: Product[];
  onAddToCart: (product: Product, quantity: number) => void;
}

const AccordionItem: React.FC<{ title: string; children: React.ReactNode; isOpen: boolean; toggle: () => void }> = ({ title, children, isOpen, toggle }) => (
  <div className="border-b border-brand-latte/20">
    <button onClick={toggle} className="w-full py-4 flex items-center justify-between text-left group">
      <span className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 group-hover:text-brand-flamingo transition-colors">{title}</span>
      {isOpen ? <Minus size={14} className="text-brand-flamingo" /> : <Plus size={14} className="text-gray-400" />}
    </button>
    <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mb-6' : 'max-h-0 opacity-0'}`}>
      <div className="font-sans text-sm text-gray-500 leading-relaxed font-light">
        {children}
      </div>
    </div>
  </div>
);

export const ProductDetails: React.FC<ProductDetailsProps> = ({ products, onAddToCart }) => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<'baby' | 'adult'>('baby');

  const [openSection, setOpenSection] = useState<string>('material');
  const [quantity, setQuantity] = useState(1);
  const [addState, setAddState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    if (products.length > 0 && slug) {
      // 1. Try exact product ID first
      let found = products.find(p => p.id === slug);
      
      // 2. Try exact getProductSlug(p)
      if (!found) {
        found = products.find(p => getProductSlug(p) === slug);
      }

      // 3. Match considering blanket/swaddle/luggage filter if slug specifies it
      if (!found) {
        const wantsLuggage = slug.includes('luggage');
        const wantsBlanket = slug.includes('blanket');
        const wantsSwaddle = slug.includes('swaddle');

        found = products.find(p => {
          const isLuggage = (p.collection && p.collection.toLowerCase().includes('luggage')) || (p.category && p.category.toLowerCase().includes('luggage'));
          const isBlanket = !isLuggage && (!p.collection || p.collection === 'Blankets' || p.collection.toLowerCase().includes('blanket') || (p.category && p.category.toLowerCase().includes('blanket')));
          if (wantsLuggage && !isLuggage) return false;
          if (wantsBlanket && !isBlanket) return false;
          if (wantsSwaddle && (isBlanket || isLuggage)) return false;

          const pSlug = getProductSlug(p);
          const nameOnlySlug = getProductSlug(p.name);
          return pSlug === slug || nameOnlySlug === slug || slug.startsWith(nameOnlySlug);
        });
      }

      // 4. Fallback exact name slug match
      if (!found) {
        found = products.find(p => getProductSlug(p.name) === slug);
      }

      setProduct(found);
      if (found) setActiveImage(found.image);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (products.length === 0) {
      const timer = setTimeout(() => setLoading(false), 2000);
      return () => clearTimeout(timer);
    } else {
        setLoading(false);
    }
  }, [slug, products]);

  // Track product page view event
  useEffect(() => {
    if (product) {
      trackViewItem(product.id, product.name, product.price);
    }
  }, [product]);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? '' : section);
  };

  const handleAddToCart = () => {
    if (addState !== 'idle' || !product) return;
    setAddState('loading');
    setTimeout(() => {
      const isLuggage = (product.collection && product.collection.toLowerCase().includes('luggage')) || (product.category && product.category.toLowerCase().includes('luggage'));
      const isAdult = selectedSize === 'adult';
      
      const tailoredProduct = product.hasSizes ? { 
          ...product,
          id: `${product.id}-${selectedSize}`,
          baseProductId: product.id,
          name: isLuggage 
            ? `${product.name} (${isAdult ? 'Size L' : 'Size M'})`
            : `${product.name} (${isAdult ? 'Adult' : 'Baby'})`,
          price: isAdult 
            ? (product.adultPrice || (isLuggage ? 118 : 108)) 
            : (product.babyPrice || (isLuggage ? 98 : 88)),
          sizeOption: isLuggage ? (isAdult ? 'Size L' : 'Size M') : selectedSize,
          size: isLuggage 
            ? (isAdult ? (product.adultSizeDesc || 'Size L: 28" – 32" Luggage') : (product.babySizeDesc || 'Size M: 22" – 26" Luggage'))
            : (isAdult ? (product.adultSizeDesc || '150 cm x 100 cm') : (product.babySizeDesc || '70 cm x 100 cm'))
      } : {
          ...product,
          baseProductId: product.id
      };

      onAddToCart(tailoredProduct as any, quantity);
      setAddState('success');
      setTimeout(() => {
        setAddState('idle');
      }, 2000);
    }, 600);
  };

  const handleShare = async () => {
    if (!product) return;
    const shareData = {
      title: product.name,
      text: `Check out ${product.name} on Once Upon`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) { console.log('Share canceled or failed'); }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2000);
      } catch (err) { console.error('Failed to copy'); }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24">
        <Loader2 className="animate-spin text-brand-latte" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-24 pb-12">
        <AlertCircle size={48} className="text-brand-latte mb-4 opacity-50" />
        <h2 className="font-serif text-2xl text-gray-900 mb-2">Product Not Found</h2>
        <p className="text-gray-500 mb-6">The item you are looking for does not exist.</p>
        <button onClick={() => navigate('/')} className="text-xs font-bold uppercase tracking-widest text-brand-flamingo hover:text-brand-gold">
          Return to Shop
        </button>
      </div>
    );
  }

  const galleryImages = [product.image, ...(product.additionalImages || [])];
  const stock = product.stock || 0;
  const isLuggage = Boolean((product.collection && product.collection.toLowerCase().includes('luggage')) || (product.category && product.category.toLowerCase().includes('luggage')));
  const isBlanket = !isLuggage && (!product.collection || product.collection === 'Blankets' || product.collection.toLowerCase().includes('blanket') || (product.category && product.category.toLowerCase().includes('blanket')));
  const productGroup = isLuggage ? 'Luggage Cover' : (isBlanket ? 'Blankets' : 'Swaddle');

  const isPreOrder = isLuggage || (stock <= 0 && isBlanket) || Boolean((product as any).isPreOrder) || (product.badge || '').toLowerCase().includes('pre-order');
  const isSoldOut = stock <= 0 && !isBlanket && !isLuggage && !isPreOrder;
  const isLowStock = !isPreOrder && stock > 0 && stock <= 5;
  
  // If pre-order, quantity is effectively unlimited (or reasonable max), else capped by stock
  const maxQty = isPreOrder ? 100 : stock;

  // Filter out any checkout addon or wellness addon products so we only recommend premium main products (swaddles, blankets, or luggage covers)
  const isAddonProduct = (p: Product) => Boolean(p.isCheckoutAddon) || (p.name || '').toLowerCase().includes('perfume') || (p.name || '').toLowerCase().includes('hair oil') || (p.name || '').toLowerCase().includes('oil');
  const mainProducts = products.filter(p => p.isLive !== false && !isAddonProduct(p) && p.id !== product.id && getProductSlug(p) !== slug);

  // Dynamic image lookups for collection navigation cards
  const blanketImage = products.find(p => !isAddonProduct(p) && (!p.collection || p.collection === 'Blankets' || p.collection.toLowerCase().includes('blanket') || (p.category && p.category.toLowerCase().includes('blanket'))))?.image;
  const swaddleImage = products.find(p => !isAddonProduct(p) && (p.collection === 'Swaddle' || p.collection?.toLowerCase().includes('swaddle') || (p.category && p.category.toLowerCase().includes('swaddle'))))?.image;
  const luggageImage = products.find(p => !isAddonProduct(p) && ((p.collection && p.collection.toLowerCase().includes('luggage')) || (p.category && p.category.toLowerCase().includes('luggage'))) && ((p.name || '').toLowerCase().includes('parisian') || (p.name || '').toLowerCase().includes('flight')) && p.image)?.image ||
    products.find(p => !isAddonProduct(p) && ((p.collection && p.collection.toLowerCase().includes('luggage')) || (p.category && p.category.toLowerCase().includes('luggage'))) && p.image)?.image || 
    '/luggage_cover_preview.jpg';

  const hasLiveLuggageCovers = products.some(p => p.isLive !== false && ((p.collection && p.collection.toLowerCase().includes('luggage')) || (p.category && p.category.toLowerCase().includes('luggage')) || p.productType === 'luggage-cover'));

  // Up to 3 related designs of the same type/category (excluding current product)
  const relatedProducts = mainProducts
    .filter(p => {
      if (isLuggage) {
        return (p.collection && p.collection.toLowerCase().includes('luggage')) || (p.category && p.category.toLowerCase().includes('luggage'));
      }
      const pIsBlanket = !p.collection || p.collection === 'Blankets' || p.collection.toLowerCase().includes('blanket') || (p.category && p.category.toLowerCase().includes('blanket'));
      return pIsBlanket === isBlanket;
    })
    .slice(0, 3);

  // If there are less than 3, fill with other main products
  if (relatedProducts.length < 3) {
    const additional = mainProducts
      .filter(p => !relatedProducts.some(rp => rp.id === p.id))
      .slice(0, 3 - relatedProducts.length);
    relatedProducts.push(...additional);
  }

  return (
    <div className="min-h-screen bg-white animate-fade-in pt-24 pb-12">
      <div className="container mx-auto px-6 max-w-6xl">
        <div id="product-details-nav" className="flex items-center mb-8 border-b border-brand-latte/10 pb-4">
          <button id="back-to-shop-btn" onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-400 hover:text-brand-flamingo transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-sans text-[10px] uppercase tracking-widest font-bold">Back to Shop</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">
          <div className="flex flex-col gap-6">
            <div className="relative aspect-[3/4] bg-brand-grey/5 rounded-[2px] overflow-hidden group border border-brand-latte/10">
               {/* Removed grayscale here */}
               {(activeImage || product.image) ? (
                 <img src={activeImage || product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
               ) : (
                 <div className="w-full h-full bg-brand-pink/5 flex flex-col items-center justify-center text-gray-400 p-8 text-center border border-brand-latte/20">
                   <Leaf size={32} className="text-brand-gold/60 mb-3 animate-pulse" />
                   <span className="font-serif text-sm text-gray-500 font-medium">Photo Coming Soon</span>
                 </div>
               )}
               {isPreOrder ? (
                  // Made smaller on mobile (px-3 py-1.5 text-xs) and larger on desktop (md:px-6 md:py-3 md:text-xl)
                  <div className="absolute top-4 right-4 pointer-events-none">
                    <div className="px-3 py-1.5 md:px-6 md:py-3 bg-white/95 border border-brand-gold/30 rounded-full shadow-sm">
                      <span className="font-serif text-xs md:text-xl text-brand-gold font-bold uppercase tracking-widest flex items-center gap-2">
                        <Clock size={14} className="md:w-5 md:h-5" /> Pre-order
                      </span>
                    </div>
                  </div>
               ) : isSoldOut ? (
                  <div className="absolute top-4 right-4 pointer-events-none">
                    <div className="px-3 py-1.5 md:px-6 md:py-3 bg-white/95 border border-red-200 rounded-full shadow-sm">
                      <span className="font-serif text-xs md:text-xl text-red-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle size={14} className="md:w-5 md:h-5" /> Sold Out
                      </span>
                    </div>
                  </div>
               ) : null}
            </div>
            {galleryImages.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                 {galleryImages.map((img, i) => (
                   // Removed grayscale here as well
                   <div key={i} onClick={() => setActiveImage(img)} className={`aspect-square bg-brand-grey/10 cursor-pointer overflow-hidden rounded-[2px] border transition-all duration-300 ${activeImage === img ? 'border-brand-flamingo ring-1 ring-brand-flamingo/50' : 'border-transparent hover:border-brand-latte'}`}>
                     <img src={img} className={`w-full h-full object-cover transition-opacity duration-300 ${activeImage === img ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} alt={`${product.name} view ${i + 1}`} />
                   </div>
                 ))}
              </div>
            )}
          </div>

          <div className="flex flex-col pt-4">
            <div className="flex justify-between items-start gap-4 mb-2">
               <h1 className="font-serif text-3xl md:text-4xl text-gray-900 leading-tight">{product.name}</h1>
               <button onClick={handleShare} className="mt-1 p-2 text-brand-latte hover:text-brand-flamingo hover:bg-brand-flamingo/5 rounded-full transition-all duration-300 relative group flex-shrink-0" aria-label="Share product">
                  <span className={`absolute right-full mr-3 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-widest text-brand-green whitespace-nowrap pointer-events-none transition-all duration-300 ${shareStatus === 'copied' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}>Link Copied</span>
                  {shareStatus === 'copied' ? (<Check size={20} className="text-brand-green" strokeWidth={1.5} />) : (<Share2 size={20} strokeWidth={1.5} />)}
               </button>
            </div>
            <div className="flex items-center gap-4 mb-8">
              <span className="font-serif text-2xl text-gray-900">
                RM {product.hasSizes 
                  ? (selectedSize === 'adult' 
                      ? (product.adultPrice || (isLuggage ? 118 : 108)) 
                      : (product.babyPrice || (isLuggage ? 98 : 88)))
                  : product.price}
              </span>
              <div className="h-4 w-[1px] bg-gray-200"></div>
              <span className="font-script text-xl text-brand-gold">
                {isLuggage ? 'Luggage Cover Collection' : (!product.collection || product.collection === 'Blankets') ? 'Blanket Collection' : product.collection}
              </span>
            </div>
            <p className="font-serif italic text-gray-600 text-base leading-relaxed mb-6 border-l-2 border-brand-flamingo pl-6">"{product.description}"</p>

            {/* Size Selector */}
            {product.hasSizes && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="block font-sans text-xs font-bold uppercase tracking-widest text-gray-900">
                  {isLuggage ? 'Select Luggage Cover Size' : 'Select Size'}
                </span>
                {isLuggage && (
                  <span className="text-[10px] text-brand-gold font-serif italic">
                    Fits 22" – 32" Suitcases
                  </span>
                )}
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setSelectedSize('baby')}
                  className={`flex flex-col items-center justify-center p-4 border rounded-[2px] transition-all duration-300 flex-1 sm:flex-none sm:w-44 ${selectedSize === 'baby' ? 'border-brand-flamingo bg-brand-flamingo/5 text-brand-flamingo' : 'border-brand-latte/30 hover:border-brand-latte text-gray-500 bg-white'}`}
                >
                  <span className="font-bold text-sm">{isLuggage ? 'Size M' : 'Baby'}</span>
                  <span className="text-[10px] mt-1 text-gray-400 text-center">
                    {isLuggage ? (product.babySizeDesc || '22" – 26" Luggage') : (product.babySizeDesc || '70 cm × 100 cm')}
                  </span>
                  <span className="text-xs font-bold mt-2">RM {product.babyPrice || (isLuggage ? 98 : 88)}</span>
                </button>
                <button
                  onClick={() => setSelectedSize('adult')}
                  className={`flex flex-col items-center justify-center p-4 border rounded-[2px] transition-all duration-300 flex-1 sm:flex-none sm:w-44 ${selectedSize === 'adult' ? 'border-brand-flamingo bg-brand-flamingo/5 text-brand-flamingo' : 'border-brand-latte/30 hover:border-brand-latte text-gray-500 bg-white'}`}
                >
                  <span className="font-bold text-sm">{isLuggage ? 'Size L' : 'Adult'}</span>
                  <span className="text-[10px] mt-1 text-gray-400 text-center">
                    {isLuggage ? (product.adultSizeDesc || '28" – 32" Luggage') : (product.adultSizeDesc || '150 cm × 100 cm')}
                  </span>
                  <span className="text-xs font-bold mt-2">RM {product.adultPrice || (isLuggage ? 118 : 108)}</span>
                </button>
              </div>
              {isLuggage && (
                <div className="mt-4 p-4 bg-brand-latte/10 rounded-2xl border border-brand-latte/25 text-xs text-gray-700 font-sans leading-relaxed">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-serif font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <span>🧳</span> <span>Luggage Cover Size Guide</span>
                    </p>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded-full border border-brand-gold/20">
                      High Stretch Fabric
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] mb-3">
                    <div className={`p-2.5 rounded-xl border transition-all ${selectedSize === 'baby' ? 'bg-white border-brand-flamingo/40 shadow-xs' : 'bg-white/60 border-brand-latte/20'}`}>
                      <p className="font-bold text-gray-900 text-xs mb-0.5">Size M (22" – 26" Suitcases)</p>
                      <p className="text-gray-500 font-sans">Body Height: <strong>58–63 cm</strong></p>
                      <p className="text-gray-500 font-sans">Width: <strong>39–42 cm</strong> │ Depth: <strong>23–27 cm</strong></p>
                    </div>

                    <div className={`p-2.5 rounded-xl border transition-all ${selectedSize === 'adult' ? 'bg-white border-brand-flamingo/40 shadow-xs' : 'bg-white/60 border-brand-latte/20'}`}>
                      <p className="font-bold text-gray-900 text-xs mb-0.5">Size L (28" – 32" Suitcases)</p>
                      <p className="text-gray-500 font-sans">Body Height: <strong>65–70 cm</strong></p>
                      <p className="text-gray-500 font-sans">Width: <strong>47–50 cm</strong> │ Depth: <strong>26–30 cm</strong></p>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-500 italic mb-3">
                    💡 <strong>Measurement tip:</strong> Measure your suitcase body height <em>excluding the wheels</em>. If your luggage is expandable or extra-deep, we recommend sizing up to Size L.
                  </p>

                  {/* Strictly No Size Replacement Warning */}
                  <div className="p-3 bg-amber-50/90 border border-amber-300/80 rounded-xl flex items-start gap-2.5 text-amber-900 shadow-xs">
                    <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <strong className="block text-amber-950 font-bold mb-0.5 uppercase tracking-wide text-[10px]">
                        ⚠️ Strictly No Size Replacement
                      </strong>
                      <span>
                        Suitcase dimensions vary significantly by brand and model. Please measure your luggage carefully before placing your order. <strong>We do not accept size replacements, returns, or exchanges</strong> for luggage covers due to incorrect size choice.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            <div className="flex flex-col gap-4 mb-12">
               {isLuggage && (
                 <div className="flex items-center justify-between px-3 py-1.5 bg-brand-pink/5 rounded-full border border-brand-latte/20 text-[10px] text-gray-600 font-sans">
                   <span>Selected: <strong className="text-gray-900 font-bold">{selectedSize === 'baby' ? 'Size M (22"–26")' : 'Size L (28"–32")'}</strong></span>
                   <span className="text-brand-flamingo font-bold uppercase tracking-wider text-[9px]">Final Sale • No Size Replacement</span>
                 </div>
               )}
               <div className="flex flex-col sm:flex-row gap-4">
                 <div className="flex items-center border border-brand-latte/30 rounded-full h-12 w-full sm:w-32 px-4 justify-between bg-white">
                   <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={isSoldOut} className="text-gray-400 hover:text-brand-flamingo disabled:opacity-30"><Minus size={14}/></button>
                   <span className="font-sans font-bold text-sm text-gray-900">{isSoldOut ? 0 : quantity}</span>
                   <button onClick={() => setQuantity(Math.min(maxQty, quantity + 1))} className="text-gray-400 hover:text-brand-flamingo disabled:opacity-30" disabled={isSoldOut || quantity >= maxQty}><Plus size={14}/></button>
                 </div>
                 <button onClick={handleAddToCart} disabled={addState !== 'idle' || isSoldOut} className={`w-full sm:flex-1 h-12 rounded-full flex items-center justify-center gap-3 transition-all duration-300 font-sans text-[11px] uppercase tracking-[0.2em] font-bold shadow-lg ${addState === 'success' ? 'bg-brand-green text-white hover:bg-brand-green/90 shadow-brand-green/20' : isPreOrder ? 'bg-brand-gold text-white hover:bg-brand-flamingo shadow-brand-gold/20' : isSoldOut ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-flamingo text-white hover:bg-brand-gold shadow-brand-flamingo/20'}`}>
                   {addState === 'loading' ? (<Loader2 size={16} className="animate-spin" />) : addState === 'success' ? (<><Check size={16} />Added</>) : isPreOrder ? (<><Clock size={16} strokeWidth={1.5} />Pre-order Item</>) : isSoldOut ? (<>Sold Out</>) : (<><ShoppingBag size={16} strokeWidth={1.5} />Add to Bag</>)}
                 </button>
               </div>
               
               {isPreOrder ? (
                 <div className="flex items-start gap-3 text-brand-gold bg-brand-gold/5 p-4 rounded-[2px] border border-brand-gold/10">
                   <Clock size={18} className="mt-0.5 flex-shrink-0" />
                   <div>
                     <p className="font-bold text-xs uppercase tracking-wider mb-1">
                       {isLuggage ? 'Pre-Order Open' : 'Item Sold Out'}
                     </p>
                     <p className="font-serif italic text-sm text-gray-600">
                       {isLuggage ? (
                         <>This item is available for <strong>pre-order</strong> under our <em>Once Upon a Traveller</em> collection. Pre-orders ensure reservation from our upcoming limited production release.</>
                       ) : (
                         <>This item is available for <strong>pre-order</strong>. It is currently crafting and will ship in approximately <strong>2 weeks</strong>.</>
                       )}
                     </p>
                   </div>
                 </div>
               ) : isSoldOut ? (
                 <div className="flex items-start gap-3 text-red-500 bg-red-50/50 p-4 rounded-[2px] border border-red-200">
                   <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-500" />
                   <div>
                     <p className="font-bold text-xs uppercase tracking-wider mb-1 text-red-700">Currently Sold Out</p>
                     <p className="font-serif italic text-sm text-gray-600">This item is out of stock and we are currently not accepting pre-orders for it. Please subscribe to our newsletter to receive stock restock alerts!</p>
                   </div>
                 </div>
               ) : isLowStock && (
                 <div className="flex items-center gap-2 text-brand-flamingo animate-pulse">
                   <AlertCircle size={14} />
                   <span className="font-serif italic text-sm">Hurry! Only {stock} left in stock.</span>
                 </div>
               )}
            </div>

            <div className="mt-auto">
              <AccordionItem title="Material & Composition" isOpen={openSection === 'material'} toggle={() => toggleSection('material')}>
                <div className="flex items-start gap-3"><Leaf size={16} className="text-brand-latte mt-1 flex-shrink-0" /><p>{product.material || 'Premium ethically sourced fibers.'}</p></div>
              </AccordionItem>
              <AccordionItem title="Dimensions & Sizing" isOpen={openSection === 'size'} toggle={() => toggleSection('size')}>
                <div className="flex items-start gap-3">
                  <Ruler size={16} className="text-brand-latte mt-1 flex-shrink-0" />
                  <div className="text-sm">
                    {isLuggage ? (
                      <div className="space-y-2.5 text-gray-600">
                        <p><strong>Size M (22" – 26" Suitcases):</strong> Height 58–63 cm, Width 39–42 cm, Depth 23–27 cm.</p>
                        <p><strong>Size L (28" – 32" Suitcases):</strong> Height 65–70 cm, Width 47–50 cm, Depth 26–30 cm.</p>
                        <p className="text-xs text-gray-500">Crafted from high-elasticity spandex-polyester blend with dual top handle openings, side zip access, and reinforced bottom zipper with heavy-duty safety buckle.</p>
                        <div className="mt-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs">
                          <strong>⚠️ Size Policy:</strong> Strictly no size exchange or replacement. Please measure your luggage body before ordering.
                        </div>
                      </div>
                    ) : (
                      <p>{product.size || 'One size fits most.'}</p>
                    )}
                  </div>
                </div>
              </AccordionItem>
              <AccordionItem title="Care Instructions" isOpen={openSection === 'care'} toggle={() => toggleSection('care')}>
                <div className="flex items-start gap-3"><Info size={16} className="text-brand-latte mt-1 flex-shrink-0" /><p>{product.care || 'Gentle hand wash recommended to preserve the softness of the fibers.'}</p></div>
              </AccordionItem>
              <AccordionItem title="Shipping & Returns" isOpen={openSection === 'shipping'} toggle={() => toggleSection('shipping')}>
                 <div className="flex items-start gap-3"><Truck size={16} className="text-brand-latte mt-1 flex-shrink-0" /><div className="flex flex-col gap-3"><p>Delivery to West Malaysia starts at RM 8.00 (1 item), RM 10.00 (2-3 items), and RM 12.00 (4-6 items). </p><p>Shipping to East Malaysia (Sabah & Sarawak) is RM 20.00 (1 item), RM 40.00 (2-3 items), and RM 60.00 (4-5 items).</p><p className="italic text-brand-gold">Please kindly note that all sales are final. We are unable to accept returns or exchanges. {isLuggage && <strong className="block mt-1 text-brand-flamingo font-semibold">Luggage covers are final sale with strictly no size replacement.</strong>}</p></div></div>
              </AccordionItem>
            </div>

          </div>
        </div>

        {/* RELATED PRODUCTS SECTION */}
        {relatedProducts.length > 0 && (
          <div id="related-products-section" className="mt-20 pt-16 border-t border-brand-latte/10">
            <h2 id="related-products-title" className="font-serif text-2xl md:text-3xl text-gray-900 text-center mb-10 md:mb-12">More Designs You'll Love</h2>
            <div id="related-products-grid" className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
              {relatedProducts.map((p, index) => {
                const stock = p.stock || 0;
                const pIsBlanket = !p.collection || p.collection === 'Blankets' || p.collection.toLowerCase().includes('blanket') || (p.category && p.category.toLowerCase().includes('blanket'));
                const isPreOrder = stock <= 0 && pIsBlanket;
                const isSoldOut = stock <= 0 && !pIsBlanket;

                return (
                  <div 
                    key={p.id} 
                    onClick={() => {
                      setQuantity(1);
                      navigate(`/product/${getProductSlug(p)}`);
                    }}
                    className={`group cursor-pointer flex flex-col ${index === 2 ? 'hidden md:flex' : 'flex'}`}
                  >
                    {/* Simplified Elegant Card Image */}
                    <div className="relative w-full aspect-[3/4] rounded-[20px] overflow-hidden bg-brand-latte/5 border border-brand-latte/10 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-md">
                      <img 
                        src={p.image} 
                        alt={p.name} 
                        loading="lazy" 
                        className="w-full h-full object-cover transition-transform duration-[1.5s] ease-in-out group-hover:scale-105" 
                      />
                      
                      {/* Minimalist badges */}
                      {isPreOrder && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="px-2 py-0.5 bg-white/90 backdrop-blur-[2px] border border-brand-gold/25 rounded-full text-[8px] font-bold font-serif text-brand-gold uppercase tracking-wider">
                            Pre-order
                          </span>
                        </div>
                      )}
                      {isSoldOut && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="px-2 py-0.5 bg-white/90 backdrop-blur-[2px] border border-red-200 rounded-full text-[8px] font-bold font-serif text-red-500 uppercase tracking-wider">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Highly-refined, compact metadata layout perfect for mobile */}
                    <div className="mt-3 text-center">
                      <h3 className="font-serif text-xs sm:text-base text-gray-900 font-bold tracking-wide line-clamp-1 group-hover:text-brand-flamingo transition-colors duration-300">
                        {p.name}
                      </h3>
                      <p className="font-script text-sm sm:text-lg text-brand-gold mt-0.5 leading-none">
                        {p.collection || (pIsBlanket ? 'Blankets' : 'Swaddles')}
                      </p>
                      <p className="font-sans font-bold text-[10px] sm:text-xs text-gray-500 mt-1 tracking-widest">
                        RM {p.price}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* COLLECTIONS NAVIGATION SECTION */}
        <div id="collections-nav-section" className="mt-20 pt-16 border-t border-brand-latte/10">
          <div className="text-center mb-10">
            <h2 id="collections-nav-title" className="font-serif text-2xl md:text-3xl text-gray-900 mb-3">Explore Our Collections</h2>
            <p className="font-sans text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
              Discover stories woven for every stage of early dreaming, from cozy companion blankets to ultra-soft newborn swaddles.
            </p>
          </div>

          <div className={`grid gap-6 mx-auto ${hasLiveLuggageCovers ? 'grid-cols-1 md:grid-cols-3 max-w-5xl' : 'grid-cols-1 md:grid-cols-2 max-w-3xl'}`}>
            {/* Blankets Card */}
            <div 
              id="nav-blankets-card"
              onClick={() => navigate('/collections/Blankets')}
              className={`group/col-nav relative overflow-hidden rounded-[20px] p-6 sm:p-7 flex flex-row items-center justify-between min-h-[140px] md:min-h-[160px] cursor-pointer border transition-all duration-300 shadow-sm hover:shadow-md ${
                productGroup === 'Blankets' 
                  ? 'bg-brand-pink/10 border-brand-flamingo/30' 
                  : 'bg-brand-pink/[0.03] hover:bg-brand-pink/[0.08] border-brand-latte/15'
              }`}
            >
              <div className="relative z-10 max-w-[60%] flex flex-col justify-between h-full text-left">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-sans text-[9px] uppercase tracking-wider font-bold text-brand-flamingo">
                      {productGroup === 'Blankets' ? 'Currently viewing' : 'Discover'}
                    </span>
                    {productGroup === 'Blankets' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-flamingo animate-pulse" />
                    )}
                  </div>
                  <h3 className="font-serif text-lg sm:text-xl text-gray-900 mb-1 leading-tight">
                    The Blankets
                  </h3>
                  <p className="font-sans text-[11px] text-gray-500 leading-relaxed line-clamp-2 pr-2">
                    Signature stories woven in clouds of warmth.
                  </p>
                </div>
                
                <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-flamingo group-hover/col-nav:text-brand-gold transition-colors">
                  <span>Browse Blankets</span>
                  <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {blanketImage && (
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shadow-md border border-white rotate-3 group-hover/col-nav:rotate-0 group-hover/col-nav:scale-105 transition-all duration-300 flex-shrink-0">
                  <img src={blanketImage} alt="Blanket Collection" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Swaddle Card */}
            <div 
              id="nav-swaddles-card"
              onClick={() => navigate('/collections/Swaddle')}
              className={`group/col-nav relative overflow-hidden rounded-[20px] p-6 sm:p-7 flex flex-row items-center justify-between min-h-[140px] md:min-h-[160px] cursor-pointer border transition-all duration-300 shadow-sm hover:shadow-md ${
                productGroup === 'Swaddle' 
                  ? 'bg-brand-gold/10 border-brand-gold/40' 
                  : 'bg-brand-gold/[0.03] hover:bg-brand-gold/[0.08] border-brand-latte/15'
              }`}
            >
              <div className="relative z-10 max-w-[60%] flex flex-col justify-between h-full text-left">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-sans text-[9px] uppercase tracking-wider font-bold text-brand-gold">
                      {productGroup === 'Swaddle' ? 'Currently viewing' : 'Discover'}
                    </span>
                    {productGroup === 'Swaddle' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                    )}
                  </div>
                  <h3 className="font-serif text-lg sm:text-xl text-gray-900 mb-1 leading-tight">
                    The Swaddles
                  </h3>
                  <p className="font-sans text-[11px] text-gray-500 leading-relaxed line-clamp-2 pr-2">
                    Gentle, breathable cocoons in silky soft fabric.
                  </p>
                </div>
                
                <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-gold group-hover/col-nav:text-brand-flamingo transition-colors">
                  <span>Browse Swaddles</span>
                  <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {swaddleImage && (
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shadow-md border border-white -rotate-3 group-hover/col-nav:rotate-0 group-hover/col-nav:scale-105 transition-all duration-300 flex-shrink-0">
                  <img src={swaddleImage} alt="Swaddle Collection" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Luggage Cover Card (Only shown if collection has live products) */}
            {hasLiveLuggageCovers && (
              <div 
                id="nav-luggage-card"
                onClick={() => navigate('/collections/Luggage%20Cover')}
                className={`group/col-nav relative overflow-hidden rounded-[20px] p-6 sm:p-7 flex flex-row items-center justify-between min-h-[140px] md:min-h-[160px] cursor-pointer border transition-all duration-300 shadow-sm hover:shadow-md ${
                  productGroup === 'Luggage Cover' 
                    ? 'bg-brand-latte/20 border-brand-flamingo/30' 
                    : 'bg-brand-latte/[0.05] hover:bg-brand-latte/[0.12] border-brand-latte/15'
                }`}
              >
                <div className="relative z-10 max-w-[60%] flex flex-col justify-between h-full text-left">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-sans text-[9px] uppercase tracking-wider font-bold text-brand-flamingo">
                        {productGroup === 'Luggage Cover' ? 'Currently viewing' : 'Pre-Order'}
                      </span>
                      {productGroup === 'Luggage Cover' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-flamingo animate-pulse" />
                      )}
                    </div>
                    <h3 className="font-serif text-lg sm:text-xl text-gray-900 mb-1 leading-tight">
                      The Luggage Covers
                    </h3>
                    <p className="font-sans text-[11px] text-gray-500 leading-relaxed line-clamp-2 pr-2">
                      Once Upon a Traveller. Fairytale travel cover.
                    </p>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-flamingo group-hover/col-nav:text-brand-gold transition-colors">
                    <span>Explore Covers</span>
                    <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {luggageImage && (
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shadow-md border border-white rotate-2 group-hover/col-nav:rotate-0 group-hover/col-nav:scale-105 transition-all duration-300 flex-shrink-0">
                    <img src={luggageImage} alt="The Parisian Flight Luggage Cover" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
