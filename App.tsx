
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ProductCard } from './components/ProductCard';
import { Newsletter } from './components/Newsletter';
import { Footer } from './components/Footer';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { ProductDetails } from './components/ProductDetails';
import { CartView } from './components/CartView';
import { CheckoutView } from './components/CheckoutView';
import { PaymentCallback } from './components/PaymentCallback';
import { OrderLookup } from './components/OrderLookup';
import { CollectionView } from './components/CollectionView';
import { IntroOverlay } from './components/IntroOverlay';
import { OurStory } from './components/OurStory';
import { RefundPolicy, ShippingPolicy, PrivacyPolicy, TermsPolicy, BusinessInfoPolicy } from './components/Policies';
import { LinkRedirector } from './components/LinkRedirector';
import { getProductSlug, sortCollectionProducts } from './constants';
import { AmbassadorLogin } from './components/AmbassadorLogin';
import { AmbassadorDashboard } from './components/AmbassadorDashboard';
import { CakenicLandingPage } from './components/CakenicLandingPage';
import { Product, SiteConfig, CartItem, Order, Ambassador } from './types';
import { Star, Cloud, AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Sparkles, Clock } from 'lucide-react';
import { subscribeToProducts, subscribeToOrders } from './firebase';
import { initializeAnalytics, trackAddToCart } from './analytics';
import { PRODUCTS } from './constants';

const SectionDivider = () => (
  <div className="flex items-center justify-center gap-4 py-8 opacity-40">
    <div className="h-[1px] w-12 md:w-24 bg-brand-latte"></div>
    <Star size={12} className="text-brand-latte" />
    <div className="h-[1px] w-12 md:w-24 bg-brand-latte"></div>
  </div>
);

const REVIEWS = [
  {
    id: 1,
    text: "The only blanket my daughter sleeps with. It feels like a cloud, pure magic!",
    author: "Sophie M.",
    location: "Kuala Lumpur"
  },
  {
    id: 2,
    text: "Absolutely stunning quality. The print is even more beautiful in person, like a piece of art.",
    author: "Sarah J.",
    location: "Selangor"
  },
  {
    id: 3,
    text: "The fabric is so soft! The perfect go-to gift for every new mum.",
    author: "Emily T.",
    location: "Penang"
  }
];

// Layout Component wrapping Navbar and Footer
const Layout: React.FC<{ 
  children: React.ReactNode;
  cartCount: number;
  products: Product[];
}> = ({ children, cartCount, products }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden selection:bg-brand-pink/20 selection:text-brand-flamingo">
      <Navbar 
        cartCount={cartCount} 
        products={products}
      />
      <main className="flex-grow">
        {children}
      </main>
      <Footer onAdminClick={() => navigate('/admin/login')} />
    </div>
  );
};

// Main Store View Component
const StoreFront: React.FC<{ 
  products: Product[]; 
  siteConfig: SiteConfig; 
  onAddToCart: (p: Product, qty: number) => void; 
}> = ({ products, siteConfig, onAddToCart }) => {
  const navigate = useNavigate();
  
  // Group products by collection
  const getProductGroup = (product: Product) => {
    const raw = product.category?.trim() || product.collection || 'Blankets';
    const lower = raw.toLowerCase();
    if (lower.includes('luggage')) return 'Luggage Cover';
    if (lower.includes('blanket')) return 'Blankets';
    if (lower.includes('swaddle')) return 'Swaddle';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const PARISIAN_FLIGHT_LUGGAGE_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1792298424226_The_Parisian_Flight_luggage_artwork.png?alt=media&token=407936c3-559b-4c6a-9dd3-ad356979f1da';

  const groupedProducts = React.useMemo(() => {
    // Only group products that are LIVE (p.isLive !== false)
    const liveProducts = products.filter(p => p.isLive !== false && (p as any).isLive !== 'false');

    const rawGroups = liveProducts.reduce((acc, product) => {
      const collection = getProductGroup(product);
      if (!acc[collection]) acc[collection] = [];
      acc[collection].push(product);
      return acc;
    }, {} as Record<string, Product[]>);

    // Order collections (Blankets first, then Swaddle, then Luggage Cover, then others)
    // ONLY include collections that actually have at least 1 live product!
    const orderedGroups: Record<string, Product[]> = {};
    const preferredOrder = ['Blankets', 'Swaddle', 'Luggage Cover'];
    preferredOrder.forEach(key => {
      if (rawGroups[key] && rawGroups[key].length > 0) {
        orderedGroups[key] = sortCollectionProducts(key, rawGroups[key]);
      }
    });
    Object.keys(rawGroups).forEach(key => {
      if (!preferredOrder.includes(key) && rawGroups[key] && rawGroups[key].length > 0) {
        orderedGroups[key] = sortCollectionProducts(key, rawGroups[key]);
      }
    });
    return orderedGroups;
  }, [products]);

  // Category card preview images (Jubilee Carousel for Blanket, Whimsy Fair for Swaddle, Parisian Flight for Luggage Cover)
  const blanketCardImage = 
    products.find(p => {
      const name = (p.name || '').toLowerCase();
      const isBlanket = getProductGroup(p) === 'Blankets';
      return isBlanket && (name.includes('carousel') || name.includes('jubilee'));
    })?.image || 
    products.find(p => {
      const name = (p.name || '').toLowerCase();
      return name.includes('carousel') || name.includes('jubilee');
    })?.image || 
    groupedProducts['Blankets']?.[0]?.image;

  const swaddleCardImage = 
    products.find(p => {
      const name = (p.name || '').toLowerCase();
      const isSwaddle = getProductGroup(p) === 'Swaddle';
      return isSwaddle && (name.includes('whimsy') || name.includes('fair'));
    })?.image || 
    products.find(p => {
      const name = (p.name || '').toLowerCase();
      return name.includes('whimsy') || name.includes('fair');
    })?.image || 
    groupedProducts['Swaddle']?.[0]?.image;

  const luggageCardImage = 
    products.find(p => {
      const name = (p.name || '').toLowerCase();
      const isLuggage = getProductGroup(p) === 'Luggage Cover';
      return isLuggage && (name.includes('parisian') || name.includes('flight')) && p.image;
    })?.image || 
    PARISIAN_FLIGHT_LUGGAGE_IMAGE;

  // Review Carousel State
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  const nextReview = () => {
    setCurrentReviewIndex((prev) => (prev + 1) % REVIEWS.length);
  };

  const prevReview = () => {
    setCurrentReviewIndex((prev) => (prev - 1 + REVIEWS.length) % REVIEWS.length);
  };

  // Auto-rotate reviews
  useEffect(() => {
    const interval = setInterval(() => {
      nextReview();
    }, 6000); // 6 seconds per slide
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Hero backgroundImage={siteConfig.heroImage} onEnterShop={() => {
           document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
      }}/>
      
      <SectionDivider />

      <section id="products" className="py-24 md:py-32 relative min-h-screen">
        <Cloud className="absolute top-20 left-[-20px] text-brand-grey/60 w-32 h-32 animate-float opacity-50" strokeWidth={0.5} />
        <Cloud className="absolute bottom-40 right-[-20px] text-brand-grey/60 w-24 h-24 animate-float-delayed opacity-50" strokeWidth={0.5} />

        <div className="container mx-auto max-w-[1400px] relative z-10">
          
          {/* Enhanced Collection Header */}
          <div className="relative mb-24 md:mb-36 flex flex-col items-center text-center px-6">
             
             {/* Background Watermark */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none select-none whitespace-nowrap z-0">
               <span className="font-serif text-[8rem] md:text-[14rem] leading-none text-gray-900">
                 Signature
               </span>
             </div>

             <div className="relative z-10">
               <div className="flex items-center justify-center gap-4 mb-6 opacity-60">
                 <div className="h-[1px] w-8 md:w-12 bg-gray-400"></div>
                 <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-gray-500 font-bold">
                   Curated for Dreamers
                 </span>
                 <div className="h-[1px] w-8 md:w-12 bg-gray-400"></div>
               </div>

               <h2 className="font-serif text-5xl md:text-7xl text-gray-900 leading-none mb-2">
                 The Signature
               </h2>
               
               <div className="relative -mt-2 md:-mt-4">
                  <span className="font-script text-6xl md:text-8xl text-brand-flamingo block drop-shadow-sm">
                    Collection
                  </span>
                  <Star size={16} className="absolute top-2 -right-4 md:top-4 md:-right-6 text-brand-gold animate-pulse" fill="currentColor" />
               </div>

               <div className="mt-12 max-w-lg mx-auto">
                 <p className="font-serif italic text-lg text-gray-600 leading-relaxed mb-6">
                   "Weaving stories into the softest threads. Every piece is designed to be cherished, held, and loved."
                 </p>
                 <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase tracking-widest text-brand-gold/80 text-center">
                   {Object.keys(groupedProducts).length > 0 ? (
                      Object.keys(groupedProducts).map((c, i) => (
                        <React.Fragment key={c}>
                          <span>{c}</span>
                          {i < Object.keys(groupedProducts).length - 1 && <span>•</span>}
                        </React.Fragment>
                      ))
                   ) : (
                     <>
                        <span>Blankets</span>
                        <span>•</span>
                        <span>Swaddle (coming soon)</span>
                     </>
                   )}
                 </div>
               </div>
             </div>
          </div>

          {(() => {
            const hasLiveBlankets = Boolean(groupedProducts['Blankets'] && groupedProducts['Blankets'].length > 0);
            const hasLiveSwaddles = Boolean(groupedProducts['Swaddle'] && groupedProducts['Swaddle'].length > 0);
            const hasLiveLuggageCovers = Boolean(groupedProducts['Luggage Cover'] && groupedProducts['Luggage Cover'].length > 0);
            const visibleCardsCount = (hasLiveBlankets ? 1 : 0) + (hasLiveSwaddles ? 1 : 0) + (hasLiveLuggageCovers ? 1 : 0);

            if (visibleCardsCount === 0) return null;

            return (
              <div className="px-6 mb-24 max-w-6xl mx-auto">
                <div className={`grid gap-6 md:gap-6 lg:gap-8 ${
                  visibleCardsCount === 1 ? 'grid-cols-1 max-w-md mx-auto' :
                  visibleCardsCount === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto' :
                  'grid-cols-1 md:grid-cols-3'
                }`}>
                  {/* Blankets Card */}
                  {hasLiveBlankets && (
                    <div 
                      onClick={() => navigate('/collections/Blankets')}
                      className="group/col-card relative overflow-hidden rounded-[24px] bg-brand-pink/5 border border-brand-latte/20 p-6 sm:p-7 flex flex-col justify-between min-h-[220px] md:min-h-[280px] cursor-pointer hover:border-brand-flamingo/30 transition-all duration-500 shadow-sm hover:shadow-md text-left"
                    >
                      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-brand-pink/20 to-transparent rounded-bl-full pointer-events-none group-hover/col-card:scale-110 transition-transform duration-500" />
                      <Star className="absolute top-6 right-6 text-brand-gold/40 animate-pulse pointer-events-none" size={20} />
                      
                      {blanketCardImage && (
                        <div className="absolute right-2 bottom-4 w-24 h-24 sm:right-3 sm:bottom-4 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden shadow-xl border-2 border-white rotate-6 group-hover/col-card:rotate-3 group-hover/col-card:scale-105 transition-all duration-500 block">
                          <img src={blanketCardImage} alt="Jubilee Carousel Blanket" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className="relative z-10 max-w-[62%] sm:max-w-none">
                        <h3 className="font-serif text-xl sm:text-2xl md:text-3xl text-gray-900 mb-2 leading-tight flex flex-wrap items-center gap-1.5 tracking-tight pr-2 sm:pr-0">
                          The <span className="italic font-serif font-medium text-brand-gold">Blanket</span> Collection
                          <Sparkles size={14} className="text-brand-gold/60 inline-block" />
                        </h3>
                        <p className="font-sans text-xs text-gray-500 max-w-full sm:max-w-[190px] md:max-w-[210px] leading-relaxed">
                          Wrap them in their very first story. Each beautiful design brings a new adventure to life.
                        </p>
                      </div>

                      <div className="mt-6 flex items-center gap-2 relative z-10">
                        <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-brand-flamingo group-hover/col-card:text-brand-gold transition-colors">
                          Explore Blankets
                        </span>
                        <span className="w-4 h-[1px] bg-brand-flamingo group-hover/col-card:w-8 group-hover/col-card:bg-brand-gold transition-all duration-300"></span>
                      </div>
                    </div>
                  )}

                  {/* Swaddle Card */}
                  {hasLiveSwaddles && (
                    <div 
                      onClick={() => navigate('/collections/Swaddle')}
                      className="group/col-card relative overflow-hidden rounded-[24px] bg-brand-gold/5 border border-brand-latte/20 p-6 sm:p-7 flex flex-col justify-between min-h-[220px] md:min-h-[280px] cursor-pointer hover:border-brand-flamingo/30 transition-all duration-500 shadow-sm hover:shadow-md text-left"
                    >
                      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-brand-gold/20 to-transparent rounded-bl-full pointer-events-none group-hover/col-card:scale-110 transition-transform duration-500" />
                      <Star className="absolute top-6 right-6 text-brand-gold/40 animate-pulse pointer-events-none" size={20} />

                      {swaddleCardImage && (
                        <div className="absolute right-2 bottom-4 w-24 h-24 sm:right-3 sm:bottom-4 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden shadow-xl border-2 border-white rotate-6 group-hover/col-card:rotate-3 group-hover/col-card:scale-105 transition-all duration-500 block">
                          <img src={swaddleCardImage} alt="Whimsy Fair Swaddle" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className="relative z-10 max-w-[62%] sm:max-w-none">
                        <h3 className="font-serif text-xl sm:text-2xl md:text-3xl text-gray-900 mb-2 leading-tight flex flex-wrap items-center gap-1.5 tracking-tight pr-2 sm:pr-0">
                          The <span className="italic font-serif font-medium text-brand-gold">Swaddle</span> Collection
                          <Sparkles size={14} className="text-brand-gold/60 inline-block" />
                        </h3>
                        <p className="font-sans text-xs text-gray-500 max-w-full sm:max-w-[190px] md:max-w-[210px] leading-relaxed">
                          A beautiful canvas for their earliest chapters. Silky, breathable softness cocooning newborn dreams.
                        </p>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/20 text-[8.5px] font-bold uppercase tracking-[0.12em] mt-2">
                          <Sparkles size={9} />
                          <span>Newly Released</span>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center gap-2 relative z-10">
                        <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-brand-flamingo group-hover/col-card:text-brand-gold transition-colors">
                          Explore Swaddles
                        </span>
                        <span className="w-4 h-[1px] bg-brand-flamingo group-hover/col-card:w-8 group-hover/col-card:bg-brand-gold transition-all duration-300"></span>
                      </div>
                    </div>
                  )}

                  {/* Luggage Cover Card (Only shown if collection has live products) */}
                  {hasLiveLuggageCovers && (
                    <div 
                      onClick={() => navigate('/collections/Luggage%20Cover')}
                      className="group/col-card relative overflow-hidden rounded-[24px] bg-brand-latte/10 border border-brand-latte/20 p-6 sm:p-7 flex flex-col justify-between min-h-[220px] md:min-h-[280px] cursor-pointer hover:border-brand-flamingo/30 transition-all duration-500 shadow-sm hover:shadow-md text-left"
                    >
                      <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-brand-latte/30 to-transparent rounded-bl-full pointer-events-none group-hover/col-card:scale-110 transition-transform duration-500" />
                      <Star className="absolute top-6 right-6 text-brand-gold/40 animate-pulse pointer-events-none" size={20} />

                      {luggageCardImage && (
                        <div className="absolute right-2 bottom-4 w-24 h-24 sm:right-3 sm:bottom-4 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden shadow-xl border-2 border-white rotate-6 group-hover/col-card:rotate-3 group-hover/col-card:scale-105 transition-all duration-500 block">
                          <img src={luggageCardImage} alt="The Parisian Flight Luggage Cover" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className="relative z-10 max-w-[62%] sm:max-w-none">
                        <h3 className="font-serif text-xl sm:text-2xl md:text-3xl text-gray-900 mb-2 leading-tight flex flex-wrap items-center gap-1.5 tracking-tight pr-2 sm:pr-0">
                          The <span className="italic font-serif font-medium text-brand-gold">Luggage Cover</span> Collection
                          <Sparkles size={14} className="text-brand-gold/60 inline-block" />
                        </h3>
                        <p className="font-sans text-xs text-gray-500 max-w-full sm:max-w-[190px] md:max-w-[210px] leading-relaxed">
                          Once Upon a Traveller. New places, same dreams, together. Premium fairytale travel covers.
                        </p>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/20 text-[8.5px] font-bold uppercase tracking-[0.12em] mt-2">
                          <Clock size={9} />
                          <span>Pre-Order Open</span>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center gap-2 relative z-10">
                        <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-brand-flamingo group-hover/col-card:text-brand-gold transition-colors">
                          Explore Luggage Covers
                        </span>
                        <span className="w-4 h-[1px] bg-brand-flamingo group-hover/col-card:w-8 group-hover/col-card:bg-brand-gold transition-all duration-300"></span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {products.length === 0 ? (
             <div className="text-center text-gray-400 font-sans text-sm italic py-20 bg-brand-grey/5 rounded-lg border border-dashed border-brand-latte/30 mx-6">
               <div className="flex flex-col items-center gap-2">
                 <AlertCircle className="text-brand-latte" />
                 <p>No products found or database not connected.</p>
               </div>
             </div>
          ) : (
            <div>
              {Object.entries(groupedProducts).map(([collectionName, collectionProducts], colIndex) => {
                const isBlanket = collectionName.toLowerCase().includes('blanket');
                const isSwaddle = collectionName.toLowerCase().includes('swaddle');
                const isLuggage = collectionName.toLowerCase().includes('luggage');

                // Distinctive atmospheric background per collection - delicate, airy, and ultra-light
                const sectionBg = isBlanket 
                  ? 'bg-gradient-to-b from-white via-[#FCFAF7]/40 to-white border-y border-brand-latte/10'
                  : isSwaddle
                  ? 'bg-gradient-to-b from-[#FDFCF9] via-[#FAF6EE]/40 to-[#FDFCF9] border-y border-brand-gold/15'
                  : isLuggage
                  ? 'bg-gradient-to-b from-[#FAF8F4]/50 via-[#F6F2EB]/35 to-[#FAF8F4]/50 border-y border-brand-latte/20'
                  : 'bg-white border-y border-brand-latte/10';

                const chapterLabel = isBlanket
                  ? 'Chapter I • Blankets'
                  : isSwaddle
                  ? 'Chapter II • Swaddles'
                  : isLuggage
                  ? 'Chapter III • Luggage Covers'
                  : collectionName;

                const collectionSubtitle = isBlanket
                  ? 'The signature of warmth and dreams'
                  : isSwaddle
                  ? 'Gentle touch for peaceful sleep'
                  : isLuggage
                  ? 'Once Upon a Traveller • Same Dreams, Together'
                  : 'Curated stories and cherished gifts';

                return (
                  <div key={collectionName} className="relative">
                    {/* Storybook Inter-Collection Divider */}
                    {colIndex > 0 && (
                      <div className="flex items-center justify-center gap-3 py-4 md:py-6 my-1">
                        <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent to-brand-latte/25"></div>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-latte/[0.06] border border-brand-latte/15 text-[9px] font-bold uppercase tracking-widest text-brand-gold/90">
                          <Star size={9} className="text-brand-gold/60" fill="currentColor" />
                          <span>{chapterLabel}</span>
                          <Star size={9} className="text-brand-gold/60" fill="currentColor" />
                        </div>
                        <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-l from-transparent to-brand-latte/25"></div>
                      </div>
                    )}

                    <div 
                      id={`row-section-${collectionName}`} 
                      className={`py-8 md:py-12 my-2 md:my-4 rounded-3xl md:rounded-[32px] transition-all duration-500 relative group overflow-hidden ${sectionBg}`}
                    >
                      {/* Fairytale corner glow */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-radial from-brand-gold/[0.02] to-transparent pointer-events-none rounded-bl-full" />
                      
                      {Object.keys(groupedProducts).length > 1 && (
                        <div id={`row-title-${collectionName}`} className="px-6 mb-5 md:mb-7 flex flex-col items-center relative text-center">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-brand-gold">
                              {chapterLabel}
                            </span>
                            {isSwaddle && (
                              <span className="text-[9px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/25">
                                New Release
                              </span>
                            )}
                            {isLuggage && (
                              <span className="text-[9px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/25">
                                Pre-Order Open
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-center w-full">
                            <h2 className="font-serif text-3xl md:text-4xl text-gray-900 tracking-tight text-center">
                              {isBlanket 
                                ? 'The Blanket Collection' 
                                : isSwaddle 
                                ? 'The Swaddle Collection' 
                                : isLuggage
                                ? 'The Luggage Cover Collection'
                                : collectionName}
                            </h2>
                          </div>

                          <div className="font-script text-lg md:text-xl text-brand-gold mt-1 text-center">
                            <span>{collectionSubtitle}</span>
                          </div>

                          <div className="h-[2px] w-12 bg-brand-gold/30 mt-3 rounded-full mb-3 mx-auto" />
                          
                          {collectionProducts.length > 1 && (
                            <div className="flex md:hidden items-center justify-center gap-1.5 text-[10px] text-brand-flamingo uppercase tracking-[0.15em] font-bold animate-pulse mt-1">
                              <span>Swipe to explore</span>
                              <ArrowRight size={10} className="text-brand-flamingo" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Desktop scroll buttons */}
                      {collectionProducts.length > 2 && (
                        <>
                          <button 
                            onClick={() => document.getElementById(`row-${collectionName.replace(/\s+/g, '-')}`)?.scrollBy({ left: -400, behavior: 'smooth' })}
                            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/95 backdrop-blur items-center justify-center rounded-full shadow-md border border-brand-latte/20 text-brand-latte hover:text-brand-flamingo hover:scale-105 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-auto"
                            aria-label="Scroll left"
                          >
                            <ChevronLeft size={24} />
                          </button>
                          <button 
                            onClick={() => document.getElementById(`row-${collectionName.replace(/\s+/g, '-')}`)?.scrollBy({ left: 400, behavior: 'smooth' })}
                            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/95 backdrop-blur items-center justify-center rounded-full shadow-md border border-brand-latte/20 text-brand-latte hover:text-brand-flamingo hover:scale-105 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-auto cursor-pointer"
                            aria-label="Scroll right"
                          >
                            <ChevronRight size={24} />
                          </button>
                        </>
                      )}

                      {/* Carousel Layout */}
                      <div 
                        id={`row-${collectionName.replace(/\s+/g, '-')}`}
                        className="overflow-x-auto pb-4 md:pb-6 hide-scrollbar w-full scroll-smooth pointer-events-auto snap-x snap-mandatory"
                      >
                        <div className="
                          flex flex-row gap-6 sm:gap-8 px-[7.5vw]
                          md:gap-16 md:px-12 items-stretch
                          w-fit min-w-full md:justify-center
                        ">
                          {(collectionProducts as Product[]).map((product, index) => (
                            <div 
                              key={product.id} 
                              className="w-[85vw] sm:w-[350px] md:min-w-[400px] md:max-w-[400px] snap-center flex-shrink-0"
                            >
                              <ProductCard 
                                product={product} 
                                onAddToCart={(p, qty) => onAddToCart(p, qty)}
                                onClick={(p) => navigate(`/product/${getProductSlug(p)}`)}
                                index={index}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      
      <section className="py-24 md:py-32 relative overflow-hidden bg-brand-grey/10">
         <div className="absolute top-0 left-0 right-0 h-2 scallop-border opacity-20"></div>

        <div className="container mx-auto px-6 max-w-4xl text-center relative z-10">
          
          {/* Review Carousel Wrapper */}
          <div className="relative">
             
             {/* Nav Arrows (Desktop) */}
             <button onClick={prevReview} className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 p-3 text-brand-latte hover:text-brand-flamingo transition-colors z-20 group">
                <ChevronLeft size={32} strokeWidth={1} className="group-hover:-translate-x-1 transition-transform" />
             </button>
             <button onClick={nextReview} className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 p-3 text-brand-latte hover:text-brand-flamingo transition-colors z-20 group">
                <ChevronRight size={32} strokeWidth={1} className="group-hover:translate-x-1 transition-transform" />
             </button>

             {/* Slider Window */}
             <div className="overflow-hidden">
                <div 
                   className="flex transition-transform duration-700 ease-in-out" 
                   style={{ transform: `translateX(-${currentReviewIndex * 100}%)` }}
                >
                   {REVIEWS.map((review) => (
                      <div key={review.id} className="w-full flex-shrink-0 px-4 md:px-8 flex flex-col items-center">
                         <div className="mb-8 flex justify-center gap-1">
                             {[1,2,3,4,5].map(i => <Star key={i} size={12} className="text-brand-gold fill-brand-gold" />)}
                         </div>
                         
                         <blockquote className="font-serif text-2xl md:text-3xl lg:text-4xl text-gray-900 italic leading-snug mb-10 relative max-w-2xl mx-auto">
                            <span className="absolute -top-6 left-0 md:-left-6 font-script text-6xl md:text-8xl text-brand-cream opacity-50 select-none">"</span>
                            {review.text}
                         </blockquote>
                         
                         <cite className="not-italic flex flex-col items-center gap-1">
                            <span className="font-sans text-xs font-bold tracking-[0.2em] uppercase text-gray-900">{review.author}</span>
                            <span className="font-script text-xl text-brand-flamingo">{review.location}</span>
                         </cite>
                      </div>
                   ))}
                </div>
             </div>

             {/* Mobile Nav & Dots */}
             <div className="flex items-center justify-center gap-6 mt-12">
                <button onClick={prevReview} className="md:hidden text-brand-latte hover:text-brand-flamingo p-2">
                   <ChevronLeft size={20} />
                </button>
                
                <div className="flex justify-center gap-2">
                   {REVIEWS.map((_, idx) => (
                     <button
                       key={idx}
                       onClick={() => setCurrentReviewIndex(idx)}
                       className={`transition-all duration-500 rounded-full h-1.5 ${
                         idx === currentReviewIndex 
                           ? 'w-8 bg-brand-gold' 
                           : 'w-1.5 bg-brand-latte/30 hover:bg-brand-latte'
                       }`}
                       aria-label={`Go to review ${idx + 1}`}
                     />
                   ))}
                </div>

                <button onClick={nextReview} className="md:hidden text-brand-latte hover:text-brand-flamingo p-2">
                   <ChevronRight size={20} />
                </button>
             </div>

          </div>
        </div>
        
         <div className="absolute bottom-0 left-0 right-0 h-2 scallop-border opacity-20 rotate-180"></div>
      </section>

      <Newsletter />
    </>
  );
};

const App: React.FC = () => {
  const { pathname } = useLocation();
  
  // Data State with instant cache restoration
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('ou_products_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return PRODUCTS;
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const cached = localStorage.getItem('ou_orders_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Initialize showIntro. 
  // If we are landing on the payment callback page (e.g. returning from gateway) or cakenic pages,
  // we default to FALSE to avoid showing the book cover overlay.
  const [showIntro, setShowIntro] = useState(() => {
    if (window.location.href.includes('payment/callback') || window.location.href.includes('cakenic')) return false;
    return true;
  });

  // Site config
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => {
    try {
      const saved = localStorage.getItem('ou_config');
      return saved ? JSON.parse(saved) : { heroImage: '' };
    } catch (e) {
      return { heroImage: '' };
    }
  });

  // Cart State
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('ou_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');

  // Ambassador Session State
  const [currentAmbassador, setCurrentAmbassador] = useState<Ambassador | null>(() => {
    try {
      const saved = localStorage.getItem('ou_ambassador_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (currentAmbassador) {
        localStorage.setItem('ou_ambassador_session', JSON.stringify(currentAmbassador));
      } else {
        localStorage.removeItem('ou_ambassador_session');
      }
    } catch (e) {}
  }, [currentAmbassador]);

  // --- FIREBASE SUBSCRIPTIONS ---
  useEffect(() => {
    const unsubscribeProducts = subscribeToProducts((fetchedProducts) => {
      if (fetchedProducts && fetchedProducts.length > 0) {
        setProducts(fetchedProducts);
        try {
          localStorage.setItem('ou_products_cache', JSON.stringify(fetchedProducts));
        } catch (e) {}
      }
    });
    const unsubscribeOrders = subscribeToOrders((fetchedOrders) => {
      if (fetchedOrders) {
        setOrders(fetchedOrders);
        try {
          if (fetchedOrders.length > 0) {
            localStorage.setItem('ou_orders_cache', JSON.stringify(fetchedOrders));
          }
        } catch (e) {}
      }
    });
    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
    };
  }, []);

  // Capture PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      console.log("PWA install prompt captured in App");
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ou_config', JSON.stringify(siteConfig));
    } catch (e) {}
  }, [siteConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('ou_cart', JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Self-hosted Analytics session/pageview initialization
  useEffect(() => {
    initializeAnalytics();
  }, [pathname]);

  // Cart Handlers
  const isAddonProduct = (p: Product | CartItem) => {
    if (!p) return false;
    const name = (p.name || '').toLowerCase();
    const collection = (p.collection || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    const isOilProduct = /\bhair oil\b|\bbody oil\b|\bessential oil\b|\bperfume oil\b|\boil\b/.test(name);
    return Boolean(p.isCheckoutAddon) || 
           name.includes('perfume') || 
           isOilProduct || 
           collection.includes('add-on') || 
           collection.includes('addon') || 
           category.includes('add-on') || 
           category.includes('addon');
  };

  const handleAddToCart = (product: Product, quantity: number = 1) => {
    // Prevent adding out-of-stock add-ons unconditionally
    const isAddon = isAddonProduct(product);
    if (isAddon && (product.stock || 0) <= 0) {
      alert(`Sorry, ${product.name} is currently sold out and cannot be pre-ordered.`);
      return;
    }

    const stock = product.stock || 0;
    const productGroup = (!product.collection || product.collection === 'Blankets' || product.collection.toLowerCase().includes('blanket') || (product.category && product.category.toLowerCase().includes('blanket'))) ? 'Blankets' : 'Swaddle';
    const isBlanket = productGroup === 'Blankets';

    if (stock <= 0 && !isBlanket) {
      alert(`Sorry, ${product.name} is currently sold out and cannot be pre-ordered.`);
      return;
    }

    // Determine if this is a pre-order (stock <= 0)
    const isPreOrder = stock <= 0 && isBlanket;

    setCart(prev => {
      const mainProductsCount = prev.reduce((sum, item) => isAddonProduct(item) ? sum : sum + item.quantity, 0);
      
      if (isAddon) {
        const currentAddonQty = prev.find(i => i.id === product.id)?.quantity || 0;
        const potentialMax = Math.min(product.stock || 0, mainProductsCount);
        
        if (currentAddonQty + quantity > potentialMax) {
          if (potentialMax === 0) {
            alert(`You must add a main product to your bag before adding an add-on.`);
          } else if (currentAddonQty === potentialMax) {
             alert(`You can only add up to ${potentialMax} of ${product.name} based on your main product quantity and available stock.`);
          } else {
             const allowedToAdd = potentialMax - currentAddonQty;
             alert(`You can only add up to ${potentialMax} of ${product.name} based on your main product quantity and available stock.`);
             quantity = allowedToAdd;
          }
          if (quantity <= 0) return prev;
        }
      }

      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        // Update quantity and ensure isPreOrder flag is current
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity, isPreOrder } : item);
      }
      return [...prev, { ...product, quantity: quantity, isPreOrder }];
    });

    // Track self-hosted analytics add_to_cart event
    trackAddToCart(product.id, product.name, product.price, quantity);
  };

  const handleUpdateCartQuantity = (id: string, delta: number) => {
    setCart(prev => {
      let newCart = prev.map(item => {
        if (item.id === id) {
          return { ...item, quantity: Math.max(1, item.quantity + delta) };
        }
        return item;
      });

      const mainProductsCount = newCart.reduce((sum, item) => isAddonProduct(item) ? sum : sum + item.quantity, 0);

      newCart = newCart.map(item => {
        if (isAddonProduct(item)) {
           const maxAllowed = Math.min(item.stock || 0, mainProductsCount);
           if (item.quantity > maxAllowed) {
              if (item.id === id && delta > 0) {
                 alert(`You can only have up to ${maxAllowed} of ${item.name} based on main products and stock.`);
              }
              return { ...item, quantity: maxAllowed };
           }
        }
        return item;
      }).filter(item => item.quantity > 0);

      return newCart;
    });
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => {
      let newCart = prev.filter(item => item.id !== id);
      
      const mainProductsCount = newCart.reduce((sum, item) => isAddonProduct(item) ? sum : sum + item.quantity, 0);

      newCart = newCart.map(item => {
        if (isAddonProduct(item)) {
           const maxAllowed = Math.min(item.stock || 0, mainProductsCount);
           if (item.quantity > maxAllowed) {
              return { ...item, quantity: maxAllowed };
           }
        }
        return item;
      }).filter(item => item.quantity > 0);

      return newCart;
    });
  };

  const isProtectionDuplicate = (p: Product) => {
    if (!p) return false;
    const id = p.id || '';
    const name = p.name || '';
    return id.endsWith('-protected') || name.includes('+ Extra Protection Box') || name.includes('Extra Protection Box');
  };

  const handleToggleShippingBox = (itemId: string, addBox: boolean) => {
    setCart(prev => {
      const itemToUpdate = prev.find(item => item.id === itemId);
      if (!itemToUpdate) return prev;

      const hasBox = itemToUpdate.id.endsWith('-protected') || !!itemToUpdate.addShippingBox;
      if (hasBox === addBox) return prev;

      const baseProductId = itemToUpdate.baseProductId || itemToUpdate.id.replace(/-protected$/, '');

      let targetId = itemToUpdate.id;
      let targetName = itemToUpdate.name;
      let targetPrice = itemToUpdate.price;

      if (addBox) {
        targetId = `${baseProductId}-protected`;
        if (itemToUpdate.sizeOption) {
          targetId = `${baseProductId}-${itemToUpdate.sizeOption}-protected`;
        }
        if (!targetName.includes(' + Extra Protection Box')) {
          targetName = `${targetName} + Extra Protection Box`;
        }
        targetPrice = itemToUpdate.price + 2;
      } else {
        // Strip out protected suffix
        targetId = baseProductId;
        if (itemToUpdate.sizeOption) {
          targetId = `${baseProductId}-${itemToUpdate.sizeOption}`;
        }
        targetName = itemToUpdate.name.replace(' + Extra Protection Box', '');
        targetPrice = Math.max(0, itemToUpdate.price - 2);
      }

      // Check if another item with targetId already exists in cart
      const existingItemIndex = prev.findIndex(item => item.id === targetId);

      if (existingItemIndex !== -1 && existingItemIndex !== prev.indexOf(itemToUpdate)) {
        // Merge them!
        return prev.map((item, idx) => {
          if (idx === existingItemIndex) {
            return {
              ...item,
              quantity: item.quantity + itemToUpdate.quantity
            };
          }
          return item;
        }).filter(item => item.id !== itemId);
      } else {
        // Just update the item
        return prev.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              id: targetId,
              name: targetName,
              price: targetPrice,
              addShippingBox: addBox,
              baseProductId: baseProductId
            };
          }
          return item;
        });
      }
    });
  };

  const handleOrderComplete = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const regularProducts = products.filter(p => !isAddonProduct(p) && !p.isPosOnly && !p.isCakenicOnly && p.isLive !== false && (p as any).isLive !== 'false' && !isProtectionDuplicate(p));
  const isCakenicPage = pathname.startsWith('/cakenic');

  return (
    <>
      {showIntro && !isCakenicPage && (
        <IntroOverlay 
           onComplete={() => setShowIntro(false)} 
           coverImage="https://i.postimg.cc/vmfxp5XF/Gemini-Generated-Image-6xc5k56xc5k56xc5-(1).png"
        />
      )}
      
      <Routes>
        {/* Public Store Routes */}
        <Route path="/" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <StoreFront products={regularProducts} siteConfig={siteConfig} onAddToCart={handleAddToCart} />
          </Layout>
        } />
        
        <Route path="/story" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <OurStory />
          </Layout>
        } />

        {/* Clean URL Product Route (Slug or ID) */}
        <Route path="/product/:slug" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <ProductDetails products={products.filter(p => !p.isPosOnly && !p.isCakenicOnly && p.isLive !== false && (p as any).isLive !== 'false' && !isProtectionDuplicate(p))} onAddToCart={handleAddToCart} />
          </Layout>
        } />
        
        <Route path="/collections/:name" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <CollectionView products={regularProducts} onAddToCart={handleAddToCart} />
          </Layout>
        } />
        
        <Route path="/cart" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <CartView 
              cart={cart}
              products={products}
              onUpdateQuantity={handleUpdateCartQuantity}
              onRemoveItem={handleRemoveFromCart}
              onAddToCart={handleAddToCart}
              onToggleShippingBox={handleToggleShippingBox}
            />
          </Layout>
        } />
        
        <Route path="/orders" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <OrderLookup />
          </Layout>
        } />
        
        <Route path="/checkout" element={
          <CheckoutView 
            cart={cart}
            onOrderSuccess={handleOrderComplete}
          />
        } />

        <Route path="/payment/callback" element={
          <PaymentCallback />
        } />

        {/* Cakenic Event Landing Page Routes */}
        <Route path="/cakenic" element={
          <CakenicLandingPage 
            onAddToCart={handleAddToCart}
            products={products}
          />
        } />
        <Route path="/cakenic/*" element={
          <CakenicLandingPage 
            onAddToCart={handleAddToCart}
            products={products}
          />
        } />
        <Route path="/cakenic-event" element={
          <CakenicLandingPage 
            onAddToCart={handleAddToCart}
            products={products}
          />
        } />
        <Route path="/cakenic-event/*" element={
          <CakenicLandingPage 
            onAddToCart={handleAddToCart}
            products={products}
          />
        } />

        {/* Policy Routes */}
        <Route path="/policies/refund" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <RefundPolicy />
          </Layout>
        } />
        <Route path="/policies/shipping" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <ShippingPolicy />
          </Layout>
        } />
        <Route path="/policies/privacy" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <PrivacyPolicy />
          </Layout>
        } />
        <Route path="/policies/terms" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <TermsPolicy />
          </Layout>
        } />
        <Route path="/policies/business-info" element={
          <Layout cartCount={cartCount} products={regularProducts}>
            <BusinessInfoPolicy />
          </Layout>
        } />

        {/* Admin Routes */}
        <Route path="/admin/login" element={
          <AdminLogin onLogin={(email) => {
            setIsAuthenticated(true);
            setAdminEmail(email);
          }} />
        } />
        
        <Route path="/admin/dashboard" element={
          isAuthenticated ? (
            <AdminDashboard 
              products={products}
              siteConfig={siteConfig}
              orders={orders}
              onUpdateProducts={setProducts}
              onUpdateSiteConfig={setSiteConfig}
              onUpdateOrders={setOrders}
              onLogout={() => {
                setIsAuthenticated(false);
                setAdminEmail('');
              }}
              installPrompt={deferredPrompt}
              adminEmail={adminEmail}
            />
          ) : (
            <AdminLogin onLogin={(email) => {
              setIsAuthenticated(true);
              setAdminEmail(email);
            }} />
          )
        } />

        {/* Ambassador Routes */}
        <Route path="/ambassador/login" element={
          currentAmbassador ? (
            <Navigate to="/ambassador/dashboard" replace />
          ) : (
            <AmbassadorLogin onLogin={(amb) => setCurrentAmbassador(amb)} />
          )
        } />

        <Route path="/ambassador/dashboard" element={
          currentAmbassador ? (
            <AmbassadorDashboard 
              ambassador={currentAmbassador}
              products={regularProducts}
              orders={orders}
              onLogout={() => setCurrentAmbassador(null)}
            />
          ) : (
            <Navigate to="/ambassador/login" replace />
          )
        } />

        {/* Short Link Redirector */}
        <Route path="/l/:shortCode" element={<LinkRedirector />} />
        
        {/* Catch-all Route: Redirect to Home if 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
