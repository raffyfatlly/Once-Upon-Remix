
import React from 'react';
import { Star, Sparkles } from 'lucide-react';

interface HeroProps {
  backgroundImage?: string;
  onEnterShop?: () => void;
}

const CloudSVG = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 500 200" 
    className={className} 
    preserveAspectRatio="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <filter id="elegant-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
        <feOffset dx="0" dy="4" result="offsetblur" />
        <feFlood floodColor="#D9C4B8" floodOpacity="0.15" />
        <feComposite in2="offsetblur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* Smoother, more abstract cloud shape */}
    <path 
      d="M110.5 105.5C110.5 75.5 150.5 60.5 180.5 80.5C200.5 55.5 280.5 45.5 310.5 75.5C330.5 65.5 380.5 75.5 380.5 105.5C380.5 135.5 340.5 145.5 310.5 135.5C290.5 155.5 210.5 155.5 190.5 135.5C160.5 145.5 110.5 135.5 110.5 105.5Z" 
      fill="white" 
      fillOpacity="0.95"
      filter="url(#elegant-shadow)"
    />
  </svg>
);

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

export const Hero: React.FC<HeroProps> = ({ backgroundImage, onEnterShop }) => {
  // Use user provided image or a luxurious default
  const bgImage = backgroundImage || "https://i.postimg.cc/Fz5SrsnY/Gemini-Generated-Image-r4s83qr4s83qr4s8.png";

  return (
    <section className="relative h-[100dvh] min-h-[600px] flex items-center justify-center overflow-hidden bg-white">
      
      {/* Dynamic Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={bgImage} 
          alt="Hero Background" 
          className="w-full h-full object-cover"
        />
        {/* Very subtle overlay to ensure text contrast without muddying the image */}
        <div className="absolute inset-0 bg-black/5"></div>
      </div>

      {/* Content Container */}
      <div className="container mx-auto px-6 relative z-10 flex justify-center animate-slide-up">
        
        <div className="max-w-4xl w-full mx-auto relative group">
          
          {/* 
            Cream Color Transparent Box for Content
            Using brand-cream (#F2DDD0) with low opacity
            Rounded-3xl for extra cuteness
          */}
          <div className="absolute inset-0 bg-[#F2DDD0]/25 rounded-[40px] shadow-xl border border-[#F2DDD0]/40 -z-10"></div>
          
          {/* Inner decorative line for elegance */}
          <div className="absolute inset-2 border border-white/40 rounded-[32px] -z-10 pointer-events-none"></div>
          
          <div className="px-8 py-12 md:px-16 md:py-16 text-center relative">
            <div className="flex justify-center mb-6">
               <div className="p-4 bg-white/60 rounded-full border border-white/60 shadow-sm animate-breathe">
                 {/* Custom Building Icon - Lighter gray for elegance */}
                 <FairyTaleCastle size={36} strokeWidth={1.5} className="text-gray-500" />
               </div>
            </div>

            <span className="block font-sans text-gray-600 tracking-[0.25em] uppercase text-[10px] md:text-xs mb-4 font-bold drop-shadow-sm">
              Little One's
            </span>
            
            {/* Reduced size, switched to sans-serif light for elegance, reverted to gray-700 */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl text-gray-700 mb-8 leading-tight md:leading-snug relative drop-shadow-sm">
              <span className="font-sans font-light tracking-wider">Timeless Comfort</span>
              <br />
              
              {/* Cloud Effect Container */}
              <span className="relative inline-block mt-4 md:ml-4 group-hover:scale-105 transition-transform duration-700 ease-in-out">
                 
                 {/* SVG Cloud Background - Adjusted size relative to text */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160%] h-[240%] z-0 pointer-events-none select-none flex items-center justify-center opacity-95">
                    <CloudSVG className="w-full h-full text-white" />
                 </div>

                 {/* Text - Slightly smaller font, more padding for breathing room */}
                 <span className="font-script text-3xl md:text-5xl lg:text-6xl text-[#D68C94] relative z-10 px-6 md:px-10 py-2 block md:inline-block drop-shadow-sm whitespace-nowrap">
                    for Gentle Dreams
                    <Sparkles size={16} className="inline-block ml-2 mb-4 text-brand-gold animate-pulse drop-shadow-sm" />
                 </span>
              </span>
            </h1>
            
            <p className="font-serif italic text-gray-600 max-w-lg mx-auto mb-10 text-lg md:text-xl font-light leading-relaxed drop-shadow-sm">
              "Wrap your little one in the softness of our signature fabrics."
            </p>
            
            <div className="flex flex-col items-center gap-6">
              <button 
                onClick={onEnterShop}
                className="group relative px-12 py-5 bg-brand-flamingo text-white font-sans tracking-[0.2em] text-[11px] font-bold uppercase transition-all duration-500 hover:bg-brand-gold hover:scale-105 shadow-lg rounded-full"
              >
                 <span className="relative z-10 flex items-center justify-center gap-3">
                  View Collection
                </span>
              </button>
              
              <div className="flex items-center gap-4 text-gray-600/80 font-medium drop-shadow-sm">
                 <div className="h-[1px] w-12 bg-current opacity-50"></div>
                 <span className="font-script text-2xl">Est. 2026</span>
                 <div className="h-[1px] w-12 bg-current opacity-50"></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
