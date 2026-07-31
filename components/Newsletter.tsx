
import React, { useState } from 'react';
import { Loader2, Check, Mail, Heart } from 'lucide-react';
import { addSubscriberToDb } from '../firebase';

export const Newsletter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    
    try {
      await addSubscriberToDb(email);
      setStatus('success');
      setEmail('');
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  return (
    <section id="newsletter-section" className="py-24 bg-white relative">
      <div className="container mx-auto px-6 max-w-2xl">
        {/* Invitation Card Look */}
        <div className="relative p-8 md:p-12 border border-brand-latte/30 bg-brand-grey/5 text-center overflow-hidden transition-all duration-500 rounded-[2px]">
           {/* Inner Border */}
           <div className="absolute inset-2 border border-dashed border-brand-latte/30 pointer-events-none"></div>
           
           <div className="relative z-10 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2">
                 <Heart size={14} className="text-brand-flamingo fill-brand-flamingo/30" />
                 <h3 className="font-script text-4xl text-brand-gold">Mum's Club</h3>
                 <Heart size={14} className="text-brand-flamingo fill-brand-flamingo/30" />
              </div>
              
              <h4 className="font-serif text-2xl md:text-3xl text-gray-900 mb-6">Join Our World</h4>
              
              {status === 'success' ? (
                <div className="animate-fade-in flex flex-col items-center py-8">
                  <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center mb-4 text-brand-green">
                    <Check size={32} />
                  </div>
                  <p className="font-serif text-xl text-gray-900 mb-2">Welcome to the club!</p>
                  <p className="font-sans text-gray-500 font-light text-sm max-w-xs mx-auto text-center leading-relaxed">
                    You have been added to our guest list. Keep an eye on your inbox for something special.
                  </p>
                  <button 
                    onClick={() => setStatus('idle')}
                    className="mt-8 text-xs font-bold uppercase tracking-widest text-brand-flamingo hover:text-brand-gold transition-colors"
                  >
                    Add another email
                  </button>
                </div>
              ) : (
                <>
                  <p className="font-sans text-gray-500 mb-8 font-light text-sm leading-relaxed px-4">
                    Be the first to receive whimsical stories, new collection drops, and exclusive gifts from our studio.
                  </p>
                  
                  <form className="flex flex-col gap-4 max-w-md mx-auto w-full relative" onSubmit={handleSubmit}>
                    <div className="relative w-full">
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Your Email Address"
                        disabled={status === 'loading'}
                        className="w-full bg-white border-b border-brand-latte/50 pl-10 pr-4 py-3 font-serif text-center text-gray-800 focus:outline-none focus:border-brand-flamingo transition-colors placeholder:text-gray-300 placeholder:italic placeholder:font-serif text-lg disabled:opacity-50"
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4 pointer-events-none" />
                    </div>
                    
                    {status === 'error' && (
                      <p className="text-xs text-red-500">Something went wrong. Please try again.</p>
                    )}

                    <button 
                      type="submit"
                      disabled={status === 'loading'}
                      className="mt-4 bg-gray-900 text-white px-8 py-3.5 font-sans uppercase tracking-[0.2em] text-[10px] font-bold hover:bg-brand-flamingo transition-colors w-full rounded-[2px] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                    >
                      {status === 'loading' ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Subscribing...
                        </>
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                  </form>
                </>
              )}
           </div>
        </div>
      </div>
    </section>
  );
};
