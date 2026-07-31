
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { ArrowLeft, Minus, Plus, ShoppingBag, Truck, Info, Leaf, Loader2, Check, AlertCircle, Ruler, Share2, Clock, ArrowRight } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProductCard } from './ProductCard';
import { trackViewItem } from '../analytics';

interface ProductDetailsProps {
  products: Product[];
  onAddToCart: (product: Product, quantity: number) => void;
}

const getProductSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

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
      let found = products.find(p => getProductSlug(p.name) === slug);
      if (!found) {
        found = products.find(p => p.id === slug);
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
      const isAdult = selectedSize === 'adult';
      
      const tailoredProduct = product.hasSizes ? { 
          ...product,
          id: `${product.id}-${selectedSize}`,
          baseProductId: product.id,
          name: `${product.name} (${isAdult ? 'Adult' : 'Baby'})`,
          price: isAdult ? (product.adultPrice || 108) : (product.babyPrice || 88),
          sizeOption: selectedSize,
          size: isAdult ? (product.adultSizeDesc || '150 cm x 100 cm') : (product.babySizeDesc || '70 cm x 100 cm')
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
  const productGroup = (!product.collection || product.collection === 'Blankets' || product.collection.toLowerCase().includes('blanket') || (product.category && product.category.toLowerCase().includes('blanket'))) ? 'Blankets' : 'Swaddle';
  const isBlanket = productGroup === 'Blankets';

  const isPreOrder = stock <= 0 && isBlanket;
  const isSoldOut = stock <= 0 && !isBlanket;
  const isLowStock = stock > 0 && stock <= 5;
  
  // If pre-order, quantity is effectively unlimited (or reasonable max), else capped by stock
  const maxQty = isPreOrder ? 100 : stock;

  // Filter out any checkout addon or wellness addon products so we only recommend premium main products (swaddles or blankets)
  const isAddonProduct = (p: Product) => Boolean(p.isCheckoutAddon) || (p.name || '').toLowerCase().includes('perfume') || (p.name || '').toLowerCase().includes('hair oil') || (p.name || '').toLowerCase().includes('oil');
  const mainProducts = products.filter(p => p.isLive !== false && !isAddonProduct(p) && p.id !== product.id && getProductSlug(p.name) !== slug);

  // Dynamic image lookups for collection navigation cards
  const blanketImage = products.find(p => !isAddonProduct(p) && (!p.collection || p.collection === 'Blankets' || p.collection.toLowerCase().includes('blanket') || (p.category && p.category.toLowerCase().includes('blanket'))))?.image;
  const swaddleImage = products.find(p => !isAddonProduct(p) && (p.collection === 'Swaddle' || p.collection?.toLowerCase().includes('swaddle') || (p.category && p.category.toLowerCase().includes('swaddle'))))?.image;

  // Up to 3 related designs of the same type/category (excluding current product)
  const relatedProducts = mainProducts
    .filter(p => {
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
               <img src={activeImage || product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
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
                  ? (selectedSize === 'adult' ? (product.adultPrice || 108) : (product.babyPrice || 88))
                  : product.price}
              </span>
              <div className="h-4 w-[1px] bg-gray-200"></div>
              <span className="font-script text-xl text-brand-gold">{(!product.collection || product.collection === 'Blankets') ? 'Blanket Collection' : product.collection}</span>
            </div>
            <p className="font-serif italic text-gray-600 text-base leading-relaxed mb-6 border-l-2 border-brand-flamingo pl-6">"{product.description}"</p>

            {/* Size Selector */}
            {product.hasSizes && (
            <div className="mb-8">
              <span className="block font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-4">Select Size</span>
              <div className="flex gap-4">
                <button
                  onClick={() => setSelectedSize('baby')}
                  className={`flex flex-col items-center justify-center p-4 border rounded-[2px] transition-all duration-300 flex-1 sm:flex-none sm:w-36 ${selectedSize === 'baby' ? 'border-brand-flamingo bg-brand-flamingo/5 text-brand-flamingo' : 'border-brand-latte/30 hover:border-brand-latte text-gray-500 bg-white'}`}
                >
                  <span className="font-bold text-sm">Baby</span>
                  <span className="text-[10px] mt-1 text-gray-400">{product.babySizeDesc || '70 cm × 100 cm'}</span>
                  <span className="text-xs font-bold mt-2">RM {product.babyPrice || 88}</span>
                </button>
                <button
                  onClick={() => setSelectedSize('adult')}
                  className={`flex flex-col items-center justify-center p-4 border rounded-[2px] transition-all duration-300 flex-1 sm:flex-none sm:w-36 ${selectedSize === 'adult' ? 'border-brand-flamingo bg-brand-flamingo/5 text-brand-flamingo' : 'border-brand-latte/30 hover:border-brand-latte text-gray-500 bg-white'}`}
                >
                  <span className="font-bold text-sm">Adult</span>
                  <span className="text-[10px] mt-1 text-gray-400">{product.adultSizeDesc || '150 cm × 100 cm'}</span>
                  <span className="text-xs font-bold mt-2">RM {product.adultPrice || 108}</span>
                </button>
              </div>
            </div>
            )}

            <div className="flex flex-col gap-4 mb-12">
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
                     <p className="font-bold text-xs uppercase tracking-wider mb-1">Item Sold Out</p>
                     <p className="font-serif italic text-sm text-gray-600">This item is available for <strong>pre-order</strong>. It is currently crafting and will ship in approximately <strong>2 weeks</strong>.</p>
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
              <AccordionItem title="Dimensions" isOpen={openSection === 'size'} toggle={() => toggleSection('size')}>
                <div className="flex items-start gap-3"><Ruler size={16} className="text-brand-latte mt-1 flex-shrink-0" /><p>{product.size || 'One size fits most.'}</p></div>
              </AccordionItem>
              <AccordionItem title="Care Instructions" isOpen={openSection === 'care'} toggle={() => toggleSection('care')}>
                <div className="flex items-start gap-3"><Info size={16} className="text-brand-latte mt-1 flex-shrink-0" /><p>{product.care || 'Gentle hand wash recommended to preserve the softness of the fibers.'}</p></div>
              </AccordionItem>
              <AccordionItem title="Shipping & Returns" isOpen={openSection === 'shipping'} toggle={() => toggleSection('shipping')}>
                 <div className="flex items-start gap-3"><Truck size={16} className="text-brand-latte mt-1 flex-shrink-0" /><div className="flex flex-col gap-3"><p>Delivery to West Malaysia starts at RM 8.00 (1 item), RM 10.00 (2-3 items), and RM 12.00 (4-6 items). </p><p>Shipping to East Malaysia starts at RM 15.00 (1 item), RM 18.00 (2-3 items), and RM 20.00 (4-6 items).</p><p className="italic text-brand-gold">Please kindly note that all sales are final. We are unable to accept returns or exchanges.</p></div></div>
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
                      navigate(`/product/${getProductSlug(p.name)}`);
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Blankets Card */}
            <div 
              id="nav-blankets-card"
              onClick={() => navigate('/collections/Blankets')}
              className={`group/col-nav relative overflow-hidden rounded-[20px] p-6 sm:p-8 flex flex-row items-center justify-between min-h-[140px] md:min-h-[160px] cursor-pointer border transition-all duration-300 shadow-sm hover:shadow-md ${
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
                  <h3 className="font-serif text-xl sm:text-2xl text-gray-900 mb-1 leading-tight">
                    The Blanket Collection
                  </h3>
                  <p className="font-sans text-[11px] text-gray-500 leading-relaxed line-clamp-2 pr-2">
                    Signature stories woven in clouds of warmth and cozy adventures.
                  </p>
                </div>
                
                <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-flamingo group-hover/col-nav:text-brand-gold transition-colors">
                  <span>Browse Blankets</span>
                  <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {blanketImage && (
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shadow-md border border-white rotate-3 group-hover/col-nav:rotate-0 group-hover/col-nav:scale-105 transition-all duration-300 flex-shrink-0">
                  <img src={blanketImage} alt="Blanket Collection" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Swaddle Card */}
            <div 
              id="nav-swaddles-card"
              onClick={() => navigate('/collections/Swaddle')}
              className={`group/col-nav relative overflow-hidden rounded-[20px] p-6 sm:p-8 flex flex-row items-center justify-between min-h-[140px] md:min-h-[160px] cursor-pointer border transition-all duration-300 shadow-sm hover:shadow-md ${
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
                  <h3 className="font-serif text-xl sm:text-2xl text-gray-900 mb-1 leading-tight">
                    The Swaddle Collection
                  </h3>
                  <p className="font-sans text-[11px] text-gray-500 leading-relaxed line-clamp-2 pr-2">
                    Gentle, breathable cocoons made of silky soft bamboo fabric.
                  </p>
                </div>
                
                <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-gold group-hover/col-nav:text-brand-flamingo transition-colors">
                  <span>Browse Swaddles</span>
                  <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {swaddleImage && (
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shadow-md border border-white -rotate-3 group-hover/col-nav:rotate-0 group-hover/col-nav:scale-105 transition-all duration-300 flex-shrink-0">
                  <img src={swaddleImage} alt="Swaddle Collection" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
