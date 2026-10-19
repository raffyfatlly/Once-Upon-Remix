
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { ProductCard } from './ProductCard';
import { AlertCircle, Star, Sparkles, Instagram } from 'lucide-react';
import { getProductSlug, sortCollectionProducts } from '../constants';

interface CollectionViewProps {
  products: Product[];
  onAddToCart: (product: Product, quantity: number) => void;
}

const SectionDivider = () => (
  <div className="flex items-center justify-center gap-4 py-8 opacity-40">
    <div className="h-[1px] w-12 md:w-24 bg-brand-latte"></div>
    <Star size={12} className="text-brand-latte" />
    <div className="h-[1px] w-12 md:w-24 bg-brand-latte"></div>
  </div>
);

export const CollectionView: React.FC<CollectionViewProps> = ({ products, onAddToCart }) => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const collectionName = name ? decodeURIComponent(name) : '';

  const getProductGroup = (product: Product) => {
    const raw = product.category?.trim() || product.collection || 'Blankets';
    const lower = raw.toLowerCase();
    if (lower.includes('luggage')) return 'Luggage Cover';
    if (lower.includes('blanket')) return 'Blankets';
    if (lower.includes('swaddle')) return 'Swaddle';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const isLuggageCollection = collectionName.toLowerCase().includes('luggage');

  const filteredProducts = React.useMemo(() => {
    const list = products.filter(p => {
      const group = getProductGroup(p);
      if (isLuggageCollection) {
        return group === 'Luggage Cover' || (p.collection && p.collection.toLowerCase().includes('luggage')) || (p.category && p.category.toLowerCase().includes('luggage'));
      }
      return group === collectionName;
    });
    return sortCollectionProducts(collectionName, list);
  }, [products, collectionName, isLuggageCollection]);

  const luggageSizeMPrice = React.useMemo(() => {
    const item = filteredProducts.find(p => p.babyPrice != null || p.price != null);
    return item?.babyPrice ?? item?.price ?? 98;
  }, [filteredProducts]);

  const luggageSizeLPrice = React.useMemo(() => {
    const item = filteredProducts.find(p => p.adultPrice != null);
    return item?.adultPrice ?? 118;
  }, [filteredProducts]);

  return (
    <div className="min-h-screen bg-white pt-24 pb-20 animate-fade-in">
       {/* Simple Elegant Header */}
       <div className="bg-brand-grey/5 py-16 md:py-24 mb-12 relative overflow-hidden">
          <div className="absolute inset-0 scallop-border opacity-10 rotate-180 top-auto bottom-0"></div>
          
          <div className="container mx-auto px-6 text-center">
            <span className="font-script text-3xl md:text-4xl text-brand-gold mb-2 block animate-fade-in">
               {isLuggageCollection ? 'Once Upon a Traveller' : 'Our Collection'}
            </span>
            <h1 className="font-serif text-4xl md:text-6xl text-gray-900 mb-6 leading-tight tracking-tight">
               {collectionName === 'Blankets' ? (
                 <>The <span className="italic font-serif font-medium text-brand-gold">Blanket</span> Collection</>
               ) : collectionName === 'Swaddle' ? (
                 <>The <span className="italic font-serif font-medium text-brand-gold">Swaddle</span> Collection</>
               ) : isLuggageCollection ? (
                 <>The <span className="italic font-serif font-medium text-brand-gold">Luggage Cover</span> Collection</>
               ) : (
                 collectionName
               )}
            </h1>
            <p className="font-serif italic text-base md:text-lg text-gray-600 max-w-xl mx-auto leading-relaxed">
              {isLuggageCollection 
                ? '"New Places, Same Dreams, Together. Wrap your suitcase in whimsical fairytale cover for every voyage."' 
                : collectionName === 'Blankets'
                ? '"Weaving stories into the softest threads. Every piece is designed to be cherished, held, and loved."'
                : 'Curated stories and cherished gifts.'}
            </p>
            <div className="w-16 h-[1px] bg-brand-flamingo mx-auto my-6"></div>
          </div>
       </div>

       <div className="container mx-auto px-6 max-w-6xl">
          {/* Luggage Cover Size Guide & Pre-Order Info Banner */}
          {isLuggageCollection && filteredProducts.length > 0 && (
            <div className="mb-14 p-6 sm:p-8 bg-brand-latte/10 rounded-3xl border border-brand-latte/20 shadow-sm relative overflow-hidden text-center md:text-left">
              <div className="absolute -top-12 -right-12 w-44 h-44 bg-gradient-to-bl from-brand-gold/15 to-transparent rounded-full pointer-events-none" />
              
              <div className="flex flex-col md:flex-row items-center md:items-center justify-between gap-6 relative z-10">
                <div className="max-w-xl text-center md:text-left flex flex-col items-center md:items-start">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/20 text-[9px] font-bold uppercase tracking-widest mb-3 mx-auto md:mx-0">
                    <Sparkles size={11} />
                    <span>Pre-Order Open</span>
                  </div>
                  <h3 className="font-serif text-2xl text-gray-900 mb-2 text-center md:text-left">
                    Luggage Cover Size Guide & Specs
                  </h3>
                  <p className="font-sans text-xs text-gray-600 leading-relaxed mb-3 text-center md:text-left">
                    Specially crafted with high-elasticity spandex-polyester blend fabric. Double-sided vivid storybook print, dual top handle openings, side zip access, and reinforced bottom zipper with heavy-duty safety buckle.
                  </p>
                  
                  <div className="p-3 bg-amber-50/90 border border-amber-300/80 rounded-2xl flex items-start gap-2.5 text-amber-950 text-xs text-left max-w-lg">
                    <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[10.5px] uppercase tracking-wider font-bold mb-0.5 text-amber-950">
                        ⚠️ Strictly No Size Replacement Policy
                      </strong>
                      <span className="text-[11px] leading-relaxed text-amber-900 block">
                        Suitcase dimensions vary by brand. Please measure your luggage height (excluding wheels), width, and depth carefully. We <strong>do not accept size replacements or exchanges</strong>.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto grid grid-cols-1 sm:grid-cols-2 gap-4 flex-shrink-0">
                  <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-brand-latte/20 shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-serif font-bold text-gray-900 text-sm">Size M</span>
                      <span className="text-[10px] font-bold bg-brand-flamingo/10 text-brand-flamingo px-2 py-0.5 rounded-full">22" – 26"</span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-sans leading-tight">
                      Approx 58–63 cm (H) × 39–42 cm (W) × 23–27 cm (D)
                    </p>
                    <span className="text-[10px] text-brand-gold font-serif mt-1 block font-medium">RM {luggageSizeMPrice}</span>
                  </div>

                  <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-brand-latte/20 shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-serif font-bold text-gray-900 text-sm">Size L</span>
                      <span className="text-[10px] font-bold bg-brand-flamingo/10 text-brand-flamingo px-2 py-0.5 rounded-full">28" – 32"</span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-sans leading-tight">
                      Approx 65–70 cm (H) × 47–50 cm (W) × 26–30 cm (D)
                    </p>
                    <span className="text-[10px] text-brand-gold font-serif mt-1 block font-medium">RM {luggageSizeLPrice}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {filteredProducts.length === 0 ? collectionName === 'Swaddle' ? (
             <div className="text-center max-w-2xl mx-auto py-16 px-6 sm:px-10 bg-brand-pink/5 rounded-3xl border border-brand-latte/20 relative overflow-hidden shadow-sm animate-fade-in">
               <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-bl from-brand-gold/10 to-transparent rounded-full pointer-events-none" />
               <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-gradient-to-tr from-brand-pink/10 to-transparent rounded-full pointer-events-none" />
               
               <div className="relative z-10 flex flex-col items-center gap-4">
                 <div className="p-3 bg-brand-gold/10 text-brand-gold rounded-full mb-2">
                   <Sparkles size={24} />
                 </div>
                 
                 <span className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">
                   Newly Released
                 </span>
                 
                 <h2 className="font-serif text-2xl sm:text-3xl text-gray-900 mt-1 max-w-md leading-snug">
                   The All-New Premium Swaddle Collection
                 </h2>
                 
                 <p className="font-serif italic text-base text-gray-600 mt-2 max-w-lg leading-relaxed">
                   A beautiful canvas for their earliest chapters. Spun for silky, breathable softness, these generous wraps gracefully cocoon your newborn in peaceful dreams.
                 </p>
                 
                 <div className="mt-4 px-5 py-2.5 rounded-full bg-brand-gold/15 text-brand-gold text-xs font-bold tracking-wider uppercase border border-brand-gold/20">
                    Now Live & Available
                 </div>
                 
                 <p className="font-sans text-xs text-gray-500 mt-6 max-w-sm leading-relaxed text-center">
                   Explore our newly released premium swaddles. Follow us on Instagram for beautiful inspiration, newborn styling tips, and new releases!
                 </p>
                 
                 <a 
                   href="https://www.instagram.com/onceuponbysyahirah"
                   target="_blank"
                   rel="noopener noreferrer"
                   className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-brand-flamingo hover:bg-brand-gold text-white font-sans text-xs font-bold uppercase tracking-widest rounded-full transition-all duration-300 shadow-md hover:shadow-lg active:scale-95"
                 >
                   <Instagram size={14} />
                   Follow Us @onceuponbysyahirah
                 </a>
               </div>
             </div>
           ) : (
             <div className="text-center text-gray-400 font-sans text-sm italic py-20 bg-brand-grey/5 rounded-lg border border-dashed border-brand-latte/30">
               <div className="flex flex-col items-center gap-2">
                 <AlertCircle className="text-brand-latte" />
                 <p>No products found in this collection.</p>
                 <button onClick={() => navigate('/')} className="mt-4 text-brand-flamingo font-bold uppercase tracking-widest text-xs hover:text-brand-gold">
                   Return to Shop
                 </button>
               </div>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-24 items-start px-4 md:px-0">
              {filteredProducts.map((product, index) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  onAddToCart={(p, qty) => onAddToCart(p, qty)}
                  onClick={(p) => navigate(`/product/${getProductSlug(p)}`)}
                  index={index}
                />
              ))}
            </div>
          )}
       </div>
       
       <div className="py-20">
          <SectionDivider />
       </div>
    </div>
  );
};
