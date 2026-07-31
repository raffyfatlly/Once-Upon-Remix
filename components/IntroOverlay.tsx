
import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

interface IntroOverlayProps {
  onComplete: () => void;
  coverImage?: string; // Optional prop for the background image
}

const FairyTaleCastle = ({ size = 24, className, strokeWidth = 1.5 }: { size?: number, className?: string, strokeWidth?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 800 500" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    stroke="currentColor"
    strokeLinecap="round" 
    strokeLinejoin="round" 
    strokeMiterlimit="10"
  >
    <g strokeWidth={strokeWidth * 12}>
        <line x1="50" y1="450" x2="750" y2="450"/>
        <rect x="80" y="200" width="640" height="250"/>
        <polygon points="80,200 120,120 680,120 720,200 "/>
        <line x1="120" y1="120" x2="680" y2="120"/>
        <rect x="150" y="80" width="30" height="40"/>
        <rect x="145" y="75" width="40" height="5"/> 
        <rect x="620" y="80" width="30" height="40"/>
        <rect x="200" y="90" width="20" height="30"/>
        <rect x="580" y="90" width="20" height="30"/>
        <path d="M390,60 c5-5,15-5,20,0 c-5-10-15-10-20,0z"/>
        <rect x="70" y="180" width="660" height="20"/>
        <rect x="350" y="200" width="100" height="250"/>
        <rect x="360" y="260" width="80" height="190"/>
        <line x1="400" y1="260" x2="400" y2="450"/>
        <path d="M360,260c0-20,10-40,40-40s40,20,40,40"/>
        <path d="M100,450V250c0-30,20-50,110-50s110,20,110,50v200H100z"/>
        <line x1="210" y1="200" x2="210" y2="450"/>
        <line x1="100" y1="350" x2="320" y2="350"/>
        <path d="M480,450V250c0-30,20-50,110-50s110,20,110,50v200H480z"/>
        <line x1="590" y1="200" x2="590" y2="450"/>
        <line x1="480" y1="350" x2="700" y2="350"/>
        <rect x="20" y="220" width="40" height="60"/>
        <line x1="60" y1="230" x2="80" y2="230"/>
        <rect x="740" y="220" width="40" height="60"/>
        <line x1="740" y1="230" x2="720" y2="230"/>
    </g>
  </svg>
);

export const IntroOverlay: React.FC<IntroOverlayProps> = ({ 
  onComplete,
  // Default luxury texture if no image is provided
  coverImage = "https://i.postimg.cc/vmfxp5XF/Gemini-Generated-Image-6xc5k56xc5k56xc5-(1).png"
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Lock body scroll when component mounts
    document.body.style.overflow = 'hidden';
    
    // Re-enable scroll when component unmounts
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleEnter = () => {
    setIsOpen(true);
    // Wait for animation to finish before unmounting (1.5s duration)
    setTimeout(onComplete, 1500); 
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-brand-latte/20`}>
        
        {/* 
           LEFT PANEL (Book Cover Left) 
           Width: 50vw
        */}
        <div className={`absolute left-0 top-0 bottom-0 w-1/2 bg-[#F2DDD0] border-r border-[#E5C0A8] transition-transform duration-[1500ms] cubic-bezier(0.6, 0.05, 0.01, 0.99) origin-left pointer-events-auto overflow-hidden
            ${isOpen ? '-translate-x-full' : 'translate-x-0'}
        `}>
            {/* The Background Image - Left Half */}
            <div className="absolute inset-0 w-full h-full">
                <img 
                  src={coverImage} 
                  alt="" 
                  // Changed md:object-left to lg:object-left so tablet uses object-center (mobile behavior)
                  className="absolute top-0 left-0 h-full w-[200%] max-w-none object-cover opacity-90 object-center lg:object-left"
                />
                {/* Overlay to ensure text readability */}
                <div className="absolute inset-0 bg-[#F2DDD0]/40 mix-blend-multiply"></div>
                <div className="absolute inset-0 bg-black/5"></div>
            </div>

            {/* Spine Shadow / Depth */}
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/10 to-transparent pointer-events-none z-10"></div>
            
            {/* Corner Decoration */}
            <div className="absolute bottom-8 left-8 text-brand-gold/60 z-20">
               <Star size={24} className="animate-spin-slow" />
            </div>
        </div>

        {/* 
           RIGHT PANEL (Book Cover Right)
           Width: 50vw
        */}
        <div className={`absolute right-0 top-0 bottom-0 w-1/2 bg-[#F2DDD0] border-l border-white/20 transition-transform duration-[1500ms] cubic-bezier(0.6, 0.05, 0.01, 0.99) origin-right pointer-events-auto overflow-hidden
            ${isOpen ? 'translate-x-full' : 'translate-x-0'}
        `}>
            {/* The Background Image - Right Half */}
            <div className="absolute inset-0 w-full h-full">
                <img 
                   src={coverImage} 
                   alt="" 
                   // Changed md:object-right to lg:object-right so tablet uses object-center (mobile behavior)
                   className="absolute top-0 right-0 h-full w-[200%] max-w-none object-cover opacity-90 object-center lg:object-right"
                />
                 {/* Overlay to ensure text readability */}
                 <div className="absolute inset-0 bg-[#F2DDD0]/40 mix-blend-multiply"></div>
                 <div className="absolute inset-0 bg-black/5"></div>
            </div>

            {/* Spine Highlight */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-white/40 to-transparent pointer-events-none z-10"></div>

            {/* Corner Decoration */}
            <div className="absolute bottom-8 right-8 text-brand-gold/60 z-20">
               <Star size={24} className="animate-spin-slow" />
            </div>
        </div>

        {/* Center Content (Floating above panels, simulating the book Title) */}
         <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-700 pointer-events-auto
            ${isOpen ? 'opacity-0 scale-110 pointer-events-none blur-sm' : 'opacity-100 scale-100 blur-0'}
         `}>
             {/* Decorative Border Box - "Gold Embossing" look */}
             <div className="absolute inset-[-40px] md:inset-[-60px] border border-white/60 rounded-[2px] pointer-events-none mix-blend-overlay"></div>
             <div className="absolute inset-[-34px] md:inset-[-54px] border border-white/40 rounded-[2px] pointer-events-none mix-blend-overlay"></div>

             <div className="mb-8 p-4 bg-white/80 backdrop-blur-md rounded-full shadow-lg border border-white/50">
                {/* Lighter color usage here */}
                <FairyTaleCastle size={36} strokeWidth={1.5} className="text-gray-600" />
             </div>

             <h1 className="font-serif text-4xl md:text-5xl lg:text-7xl text-gray-900 mb-2 tracking-widest text-center drop-shadow-lg text-white mix-blend-hard-light">
                ONCE UPON
             </h1>
             <p className="font-script text-3xl md:text-4xl lg:text-5xl text-white mb-12 drop-shadow-md transform -rotate-2">
                Kuala Lumpur
             </p>

             <button
                onClick={handleEnter}
                className="group relative px-12 py-5 bg-white/90 backdrop-blur text-gray-900 font-sans tracking-[0.25em] text-[10px] md:text-xs font-bold uppercase transition-all duration-500 hover:bg-brand-gold hover:text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 rounded-[2px] overflow-hidden"
             >
                <span className="relative z-10">Enter The Shop</span>
             </button>
             
             <p className="mt-8 font-serif italic text-white/80 text-sm drop-shadow">
                Est. 2026
             </p>
         </div>
    </div>
  );
};
