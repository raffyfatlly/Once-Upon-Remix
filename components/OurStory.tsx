
import React, { useState, useEffect, useRef } from 'react';
import { Star, Sparkles, Feather, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';

const PARAGRAPHS = [
  "For as long as I can remember I have been captivated by the world of make-believe. There is a special kind of magic that happens when you open a vintage storybook and for a moment the real world simply fades away. I have always wanted to take that feeling of wonder and turn it into something tangible something you can actually hold in your arms.",
  "In 2026 that dream finally found its home in Once Upon. We are beginning our journey with the baby blanket but to me it is so much more than just a piece of cloth. I wanted to create a collection where each design tells a story. Our little bear is the main character and he invites you to follow him on his painted adventures. Whether he is floating in a hot air balloon or discovering a hidden castle he is there to spark the imagination before your little one even falls asleep.",
  "As a mother of three I created this because I wanted to wrap my own children in that sense of whimsy. I love art that feels timeless and dreamy. Looking at these designs brings me a sense of peace and nostalgia and I wanted to share that quiet joy with you. It is a way to make the everyday moments of motherhood feel a little more like a fairy tale.",
  "Of course I know that a story is only good if it feels right. I was obsessive about finding a fabric that matches the softness of the art. I chose a material that truly breathes and feels airy and smooth against delicate skin because nothing matters more than the comfort of the babies we love so much.",
  "We do this for the wonder of childhood and the little dreamers who inspire us every day. I invite you to join us on this adventure and let our stories become a part of yours."
];

export const OurStory: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  
  // Typewriter state
  const [displayedText, setDisplayedText] = useState('');
  const typingTimeoutRef = useRef<number | null>(null);

  const totalPages = PARAGRAPHS.length;
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === totalPages - 1;

  // Determine full text for current page (handling drop cap separately for page 0)
  const fullText = isFirstPage ? PARAGRAPHS[currentPage].slice(1) : PARAGRAPHS[currentPage];

  useEffect(() => {
    // If exiting, do not update text (let it fade out with current content)
    if (isExiting) return;

    // Reset displayed text
    setDisplayedText('');
    
    // Clear any pending timeouts
    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    }

    let charIndex = 0;
    
    const type = () => {
        if (charIndex <= fullText.length) {
            setDisplayedText(fullText.slice(0, charIndex));
            charIndex++;
            // Typing speed: 15ms
            typingTimeoutRef.current = setTimeout(type, 15) as unknown as number;
        }
    };

    // Start typing
    type();

    return () => {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [currentPage, isExiting, fullText]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages) return;
    
    setIsExiting(true);
    setTimeout(() => {
      setCurrentPage(newPage);
      setIsExiting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 500); // 500ms fade out duration
  };

  return (
    <section className="min-h-screen pt-28 pb-10 md:py-32 bg-[#FFFDF9] relative overflow-hidden flex flex-col items-center justify-start md:justify-center">
       {/* Background decorative elements */}
       <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-white to-transparent opacity-50"></div>
       <div className="absolute inset-0 bg-paper opacity-40 pointer-events-none"></div>
       
       <div className="container mx-auto px-4 md:px-6 max-w-2xl relative z-10 flex-grow flex flex-col justify-start md:justify-center">
         
         {/* Book Container */}
         <div className="relative bg-white shadow-[0_20px_60px_rgba(217,196,184,0.3)] border border-brand-latte/30 rounded-[2px] md:rounded-[4px] h-[80vh] md:h-auto md:aspect-[4/5] md:min-h-[600px] flex flex-col overflow-hidden">
            
            {/* Book Texture / Spine Shadow */}
            <div className="absolute left-0 top-0 bottom-0 w-4 md:w-8 bg-gradient-to-r from-black/5 to-transparent pointer-events-none z-10"></div>
            <div className="absolute right-0 top-0 bottom-0 w-1 md:w-2 bg-gradient-to-l from-black/5 to-transparent pointer-events-none z-10"></div>
            
            {/* Content Area */}
            <div className="flex-1 p-6 md:p-12 lg:p-16 flex flex-col relative h-full overflow-hidden">
                
                {/* Decorative Header (Consistent) */}
                <div className="text-center mb-4 md:mb-8 opacity-80 flex-shrink-0">
                   <div className="flex justify-center text-brand-gold/60 mb-2">
                     <Feather size={20} />
                   </div>
                   <span className="font-sans text-[10px] tracking-[0.3em] uppercase text-gray-400">
                     Chapter {['I', 'II', 'III', 'IV', 'V'][currentPage]}
                   </span>
                </div>

                {/* Animated Text Container - Scrollable on mobile */}
                <div className={`flex-1 overflow-y-auto hide-scrollbar flex flex-col justify-start md:justify-center transition-all duration-500 ease-in-out transform ${
                    isExiting ? 'opacity-0 translate-x-4 blur-sm' : 'opacity-100 translate-x-0 blur-0'
                }`}>
                    {/* Inner wrapper ensures vertical centering if text is short, but allows scroll if long */}
                    <div className="my-auto">
                        {/* First Page Title Special */}
                        {isFirstPage && (
                           <h2 className="font-serif text-3xl md:text-4xl text-gray-900 mb-6 md:mb-8 text-center leading-tight">
                             Once Upon a <br/> <span className="italic text-brand-gold">Dream</span>
                           </h2>
                        )}

                        <div className="font-serif text-base md:text-lg lg:text-xl leading-loose md:leading-loose text-gray-700 text-justify relative min-h-[100px] md:min-h-[200px]">
                           {/* Drop Cap */}
                           {isFirstPage && (
                             <span className="float-left text-4xl md:text-6xl font-script text-brand-flamingo pr-2 md:pr-3 pt-2 leading-[0.8] animate-fade-in">F</span>
                           )}
                           
                           {/* Typed Text */}
                           {displayedText}
                        </div>

                        {/* Signature on Last Page */}
                        {isLastPage && displayedText.length >= fullText.length && (
                           <div className="mt-8 md:mt-12 text-center animate-fade-in pb-4">
                              <div className="w-16 h-[1px] bg-brand-latte/40 mx-auto mb-6"></div>
                              <p className="font-script text-3xl md:text-4xl text-gray-900 relative inline-block">
                                Syahirah Kasim
                                <Sparkles size={14} className="absolute -top-2 -right-6 text-brand-gold animate-pulse" />
                              </p>
                              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 mt-2">Founder & Creative Director</p>
                           </div>
                        )}
                    </div>
                </div>

                {/* Navigation Footer */}
                <div className="mt-4 md:mt-12 flex items-center justify-between border-t border-brand-latte/20 pt-4 md:pt-6 relative z-30 flex-shrink-0 w-full bg-white">
                   
                   {/* Previous Button */}
                   <div className="flex-1 flex justify-start">
                     <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={isFirstPage || isExiting}
                        className={`flex items-center gap-2 group transition-all duration-500 ${
                           isFirstPage ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:text-brand-flamingo'
                        }`}
                     >
                        <div className="w-8 h-8 rounded-full border border-brand-latte/40 flex items-center justify-center group-hover:border-brand-flamingo group-hover:bg-brand-flamingo group-hover:text-white transition-all">
                          <ChevronLeft size={14} />
                        </div>
                        <span className="font-sans text-[10px] uppercase tracking-widest font-bold text-gray-400 group-hover:text-brand-flamingo block">Back</span>
                     </button>
                   </div>

                   {/* Page Indicator */}
                   <div className="flex-none px-2">
                      <span className="font-script text-lg md:text-xl text-brand-gold/80">
                        Page {currentPage + 1}
                      </span>
                   </div>

                   {/* Next Button - "Cuter" Style */}
                   <div className="flex-1 flex justify-end">
                     <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={isLastPage || isExiting}
                        className={`flex items-center gap-2 md:gap-3 group transition-all duration-500 ${
                           isLastPage ? 'opacity-0 pointer-events-none' : 'opacity-100'
                        }`}
                     >
                        <span className="font-script text-xl md:text-2xl text-gray-900 group-hover:text-brand-flamingo transition-colors block">Next</span>
                        <div className="w-10 h-10 rounded-full bg-brand-pink/20 text-brand-flamingo flex items-center justify-center group-hover:bg-brand-flamingo group-hover:text-white group-hover:scale-110 transition-all duration-300 shadow-sm border border-brand-flamingo/20">
                          <ArrowRight size={16} />
                        </div>
                     </button>
                   </div>
                </div>

                {/* Corner decorations */}
                <Star size={10} className="absolute top-6 right-6 text-brand-latte/40" />
                <Star size={10} className="absolute bottom-6 left-6 text-brand-latte/40" />
            </div>
         </div>

       </div>
    </section>
  );
};
