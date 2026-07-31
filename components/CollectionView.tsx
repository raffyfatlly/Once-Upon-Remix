
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { ProductCard } from './ProductCard';
import { AlertCircle, Star, Sparkles, Instagram } from 'lucide-react';

interface CollectionViewProps {
  products: Product[];
  onAddToCart: (product: Product, quantity: number) => void;
}

// Helper for SEO URLs (can be imported, keeping here for file consistency)
const getProductSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

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
    return product.category?.trim() || product.collection || 'Blankets';
  };

  const filteredProducts = products.filter(p => getProductGroup(p) === collectionName);

  return (
    <div className="min-h-screen bg-white pt-24 pb-20 animate-fade-in">
       {/* Simple Elegant Header */}
       <div className="bg-brand-grey/5 py-16 md:py-24 mb-12 relative overflow-hidden">
          <div className="absolute inset-0 scallop-border opacity-10 rotate-180 top-auto bottom-0"></div>
          
          <div className="container mx-auto px-6 text-center">
            <span className="font-script text-3xl md:text-4xl text-brand-gold mb-2 block animate-fade-in">
               Our Collection
            </span>
            <h1 className="font-serif text-4xl md:text-6xl text-gray-900 mb-6 leading-tight tracking-tight">
               {collectionName === 'Blankets' ? (
                 <>The <span className="italic font-serif font-medium text-brand-gold">Blanket</span> Collection</>
               ) : collectionName === 'Swaddle' ? (
                 <>The <span className="italic font-serif font-medium text-brand-gold">Swaddle</span> Collection</>
               ) : (
                 collectionName
               )}
            </h1>
            <div className="w-16 h-[1px] bg-brand-flamingo mx-auto my-6"></div>
          </div>
       </div>

       <div className="container mx-auto px-6 max-w-6xl">
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
                  onClick={(p) => navigate(`/product/${getProductSlug(p.name)}`)}
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
