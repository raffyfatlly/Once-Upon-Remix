
import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Menu, X, Star, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { NAVIGATION_LINKS, getProductSlug } from '../constants';
import { Product } from '../types';

interface NavbarProps {
  cartCount: number;
  products: Product[];
}

export const Navbar: React.FC<NavbarProps> = ({ cartCount, products }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [animateCart, setAnimateCart] = useState(false);
  const prevCartCount = useRef(cartCount);
  const navigate = useNavigate();

  // Categories Logic
  const getProductGroup = (product: Product) => {
    return product.category?.trim() || product.collection || 'Blankets';
  };

  const collections = Array.from(new Set(products.map(getProductGroup))).sort() as string[];
  
  // Mobile accordion state
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [isCollectionsExpanded, setIsCollectionsExpanded] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (cartCount > prevCartCount.current) {
      setAnimateCart(true);
      const timer = setTimeout(() => setAnimateCart(false), 800);
      return () => clearTimeout(timer);
    }
    prevCartCount.current = cartCount;
  }, [cartCount]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleMobileLinkClick = () => {
    setIsMobileMenuOpen(false);
    setIsCollectionsExpanded(false);
    setExpandedCollection(null);
  };

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? 'bg-white/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.03)] py-3' : 'bg-transparent py-6'
        }`}
      >
        <div className="container mx-auto px-6 max-w-7xl flex items-center justify-between">
          
          {/* Mobile Toggle */}
          <button 
            className="md:hidden text-gray-800 p-2 -ml-2 hover:text-brand-flamingo transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} strokeWidth={1} />
          </button>

          {/* Desktop Left Links */}
          <div className="hidden md:flex space-x-10 items-center flex-1">
             <Link to="/" className="font-sans text-[10px] tracking-[0.15em] text-gray-500 hover:text-brand-flamingo transition-colors uppercase font-bold">Shop</Link>
             <Link to="/story" className="font-sans text-[10px] tracking-[0.15em] text-gray-500 hover:text-brand-flamingo transition-colors uppercase font-bold">Story</Link>
             
             {/* Desktop Collections Dropdown */}
             <div className="relative group/collections">
               <button className="font-sans text-[10px] tracking-[0.15em] text-gray-500 hover:text-brand-flamingo transition-colors uppercase font-bold flex items-center gap-1">
                 Collections <ChevronDown size={10} />
               </button>
               
               <div className="absolute top-full left-0 pt-4 opacity-0 invisible group-hover/collections:opacity-100 group-hover/collections:visible transition-all duration-300 transform -translate-y-2 group-hover/collections:translate-y-0">
                 <div className="bg-white border border-brand-latte/20 shadow-xl rounded-[2px] py-2 min-w-[200px] flex flex-col">
                   {collections.length > 0 ? (
                     collections.map(collection => (
                       <Link 
                         key={collection}
                         to={`/collections/${encodeURIComponent(collection)}`}
                         className="px-6 py-3 text-xs font-sans text-gray-600 hover:text-brand-flamingo hover:bg-brand-grey/10 text-left transition-colors uppercase tracking-wider"
                       >
                         {collection}
                       </Link>
                     ))
                   ) : (
                     <span className="px-6 py-3 text-xs text-gray-400 italic">No collections yet</span>
                   )}
                 </div>
               </div>
             </div>
          </div>

          {/* Logo */}
          <div className="flex-none text-center group cursor-pointer" onClick={() => navigate('/')}>
            <div className="flex flex-col items-center">
              <span className="font-serif text-2xl md:text-3xl tracking-[0.1em] text-gray-900 font-bold group-hover:text-brand-flamingo transition-colors duration-500">
                ONCE UPON
              </span>
              <span className={`font-script text-xl text-brand-gold -mt-1 transition-all duration-500 ${isScrolled ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
                Kuala Lumpur
              </span>
            </div>
          </div>

          {/* Desktop Right Links / Cart */}
          <div className="hidden md:flex space-x-10 items-center flex-1 justify-end">
             <Link to="/ambassador/login" className="font-sans text-[10px] tracking-[0.15em] text-gray-500 hover:text-brand-flamingo transition-colors uppercase font-bold">Ambassador</Link>
             <Link to="/orders" className="font-sans text-[10px] tracking-[0.15em] text-gray-500 hover:text-brand-flamingo transition-colors uppercase font-bold">Tracking</Link>
             <Link 
                to="/cart"
                className={`relative cursor-pointer group/cart transition-colors duration-300 ${animateCart ? 'text-brand-flamingo animate-cart-alert' : 'text-gray-800 hover:text-brand-flamingo'}`}
             >
                <ShoppingBag size={18} strokeWidth={1.5} className="group-hover/cart:fill-brand-flamingo/10 transition-colors" />
                {cartCount > 0 && (
                  <span className={`absolute -top-1 -right-1 bg-brand-flamingo text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full transition-transform duration-300 ${animateCart ? 'scale-110' : 'scale-100'}`}>
                    {cartCount}
                  </span>
                )}
             </Link>
          </div>

          {/* Mobile Cart */}
          <Link 
            to="/cart"
            className={`md:hidden relative cursor-pointer p-2 -mr-2 transition-colors duration-300 ${animateCart ? 'text-brand-flamingo animate-cart-alert' : 'text-gray-800'}`}
          >
            <ShoppingBag size={22} strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 bg-brand-flamingo text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div 
        className={`fixed inset-0 bg-[#FFFDF9] z-[60] flex flex-col transition-all duration-700 cubic-bezier(0.7, 0, 0.3, 1) md:hidden overflow-y-auto ${
          isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-paper opacity-50 pointer-events-none fixed"></div>
        <div className="absolute inset-0 border-[12px] border-double border-brand-grey pointer-events-none fixed"></div>

        <div className="relative flex items-center justify-between px-6 py-6 flex-shrink-0">
          <span className="font-serif text-xl tracking-widest text-gray-900 font-bold">MENU</span>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 -mr-2 text-gray-800 hover:rotate-90 transition-transform duration-500"
          >
            <X size={28} strokeWidth={1} />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col px-8 pt-8 pb-20 relative">
          <Star className="text-brand-latte/30 w-12 h-12 absolute top-10 right-10 animate-spin-slow pointer-events-none" />
          
          <div className="flex flex-col space-y-8 items-center text-center">
             <Link 
               to="/"
               onClick={handleMobileLinkClick}
               className="font-serif text-3xl text-gray-900 hover:text-brand-flamingo hover:italic transition-all duration-300"
             >
               Shop
             </Link>

             {/* Mobile Collections Accordion */}
             <div className="w-full flex flex-col items-center">
                <button 
                  onClick={() => setIsCollectionsExpanded(!isCollectionsExpanded)}
                  className="font-serif text-3xl text-gray-900 hover:text-brand-flamingo transition-all duration-300 flex items-center gap-2"
                >
                  Collections 
                  {isCollectionsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                <div className={`overflow-hidden transition-all duration-500 ease-in-out w-full ${isCollectionsExpanded ? 'max-h-[1000px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                   <div className="flex flex-col gap-6 items-center border-l border-brand-latte/20 ml-[50%] -translate-x-1/2 pl-6">
                      {collections.map(collection => (
                        <div key={collection} className="flex flex-col items-center w-full">
                           <button 
                             onClick={() => setExpandedCollection(expandedCollection === collection ? null : collection)}
                             className="font-sans text-sm font-bold uppercase tracking-widest text-gray-600 hover:text-brand-flamingo flex items-center gap-2"
                           >
                             {collection}
                             {expandedCollection === collection ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                           </button>
                           
                           {/* Nested Products List for Mobile */}
                           <div className={`overflow-hidden transition-all duration-300 w-full ${expandedCollection === collection ? 'max-h-[500px] mt-4' : 'max-h-0'}`}>
                             <div className="flex flex-col gap-4 items-center">
                               {/* Link to full collection */}
                               <Link 
                                 to={`/collections/${encodeURIComponent(collection)}`}
                                 onClick={handleMobileLinkClick}
                                 className="font-serif italic text-brand-gold text-lg hover:text-brand-flamingo"
                               >
                                 View All
                               </Link>
                               {/* Individual Product Links */}
                               {products
                                 .filter(p => (p.collection || 'Blankets') === collection)
                                 .map(product => (
                                   <Link
                                     key={product.id}
                                     to={`/product/${getProductSlug(product.name)}`}
                                     onClick={handleMobileLinkClick}
                                     className="font-sans text-xs text-gray-400 hover:text-gray-900 uppercase tracking-wider"
                                   >
                                     {product.name}
                                   </Link>
                               ))}
                             </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             <Link 
               to="/story"
               onClick={handleMobileLinkClick}
               className="font-serif text-3xl text-gray-900 hover:text-brand-flamingo hover:italic transition-all duration-300"
             >
               Our Story
             </Link>

             <Link 
               to="/ambassador/login"
               onClick={handleMobileLinkClick}
               className="font-serif text-3xl text-gray-900 hover:text-brand-flamingo hover:italic transition-all duration-300"
             >
               Ambassador
             </Link>

             <Link 
               to="/orders"
               onClick={handleMobileLinkClick}
               className="font-serif text-3xl text-gray-900 hover:text-brand-flamingo hover:italic transition-all duration-300"
             >
               Tracking
             </Link>
          </div>
        </div>
        
        <div className="p-10 text-center flex-shrink-0">
          <p className="font-script text-2xl text-brand-gold">
            With Love, SK
          </p>
        </div>
      </div>
    </>
  );
};
