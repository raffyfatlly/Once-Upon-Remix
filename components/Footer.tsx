
import React from 'react';
import { Instagram, Heart, Lock, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FooterProps {
  onAdminClick?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onAdminClick }) => {
  return (
    <footer className="bg-white pt-20 pb-12 border-t border-brand-latte/20 relative">
      
      {/* Decorative Center Element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4">
        <Heart size={16} className="text-brand-flamingo fill-brand-flamingo/20" />
      </div>

      <div className="container mx-auto px-6 max-w-6xl flex flex-col items-center">
        
        <div className="mb-8 text-center">
          <div className="font-serif text-3xl font-bold text-gray-900 tracking-wider mb-1">ONCE UPON</div>
          <div className="font-script text-xl text-brand-gold">Kuala Lumpur</div>
        </div>

        {/* Restored Social Icons: Thin & Elegant */}
        <div className="flex items-center justify-center gap-8 mb-10">
           <a 
             href="https://www.instagram.com/onceuponbysyahirahkasim" 
             target="_blank" 
             rel="noopener noreferrer" 
             className="text-brand-gold hover:text-brand-flamingo transition-colors duration-300 transform hover:scale-105"
             aria-label="Instagram"
           >
             <Instagram size={20} strokeWidth={1.2} />
           </a>
           <a 
             href="https://wa.link/ad5hui" 
             target="_blank" 
             rel="noopener noreferrer" 
             className="text-brand-gold hover:text-brand-flamingo transition-colors duration-300 transform hover:scale-105"
             aria-label="WhatsApp"
           >
             <MessageCircle size={20} strokeWidth={1.2} />
           </a>
        </div>
        
        {/* Main Nav Links */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-12 mb-12 items-center">
           <Link to="/" className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-brand-flamingo transition-colors font-bold">Shop</Link>
           <Link to="/story" className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-brand-flamingo transition-colors font-bold">Our Story</Link>
           <Link to="/collections/Blankets" className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-brand-flamingo transition-colors font-bold">Collections</Link>
           <Link to="/orders" className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-brand-flamingo transition-colors font-bold">Track Order</Link>
        </div>

        <div className="text-center relative flex flex-col items-center w-full">
          <p className="font-sans text-[10px] text-gray-400 font-light tracking-wide mb-4">
            &copy; {new Date().getFullYear()} Once Upon. All rights reserved.
          </p>

          {/* Policy Links */}
          <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-2 md:gap-6 mb-8 w-full px-6 max-w-lg md:max-w-none mx-auto">
             <Link to="/policies/refund" className="font-sans text-[7px] md:text-[9px] uppercase tracking-wider md:tracking-[0.15em] text-gray-400 hover:text-brand-flamingo transition-colors whitespace-nowrap">Refund Policy</Link>
             <span className="text-[7px] md:text-[9px] text-gray-300 font-light">|</span>
             
             <Link to="/policies/shipping" className="font-sans text-[7px] md:text-[9px] uppercase tracking-wider md:tracking-[0.15em] text-gray-400 hover:text-brand-flamingo transition-colors whitespace-nowrap">Shipping Info</Link>
             <span className="text-[7px] md:text-[9px] text-gray-300 font-light">|</span>
             
             <Link to="/policies/privacy" className="font-sans text-[7px] md:text-[9px] uppercase tracking-wider md:tracking-[0.15em] text-gray-400 hover:text-brand-flamingo transition-colors whitespace-nowrap">Privacy Policy</Link>
             <span className="text-[7px] md:text-[9px] text-gray-300 font-light">|</span>
             
             <Link to="/policies/terms" className="font-sans text-[7px] md:text-[9px] uppercase tracking-wider md:tracking-[0.15em] text-gray-400 hover:text-brand-flamingo transition-colors whitespace-nowrap">Terms of Service</Link>
             <span className="text-[7px] md:text-[9px] text-gray-300 font-light">|</span>
             
             <Link to="/policies/business-info" className="font-sans text-[7px] md:text-[9px] uppercase tracking-wider md:tracking-[0.15em] text-gray-400 hover:text-brand-flamingo transition-colors whitespace-nowrap">Business Info</Link>
          </div>

          <p className="font-script text-lg text-brand-latte mb-8">
            Designed with Love
          </p>
          
          {/* Subtle Admin Icon */}
          {onAdminClick && (
            <button 
              onClick={onAdminClick}
              className="text-brand-latte/30 hover:text-brand-gold transition-colors p-2"
              aria-label="Admin Access"
            >
              <Lock size={12} />
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
