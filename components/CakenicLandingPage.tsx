import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, Calendar, Clock, MapPin, Sparkles, 
  Check, Ticket, ChevronDown, ShieldCheck, Heart, ArrowRight, X, 
  Coffee, Gift, AlertCircle, Loader2, Info, Share2, HelpCircle,
  AlertTriangle, Sun, Award, Users, Camera, Home, FileText, ShoppingBag,
  CheckCircle2
} from 'lucide-react';
import { CartItem, Product } from '../types';
import { createOrderInDb } from '../firebase';
import { getAttribution } from '../analytics';

interface CakenicLandingPageProps {
  onAddToCart?: (product: Product, quantity: number) => void;
  products?: Product[];
}

export interface CakenicLocationTicket {
  id: string;
  location: string;
  city: string;
  venue: string;
  date: string;
  time: string;
  price: number;
  badge?: string;
  popular?: boolean;
  image: string;
  availableSlots: number;
  description: string;
}

const CAKENIC_LOCATIONS: CakenicLocationTicket[] = [
  {
    id: 'cakenic-ticket-putrajaya',
    location: 'Cakenic Putrajaya',
    city: 'Putrajaya',
    venue: 'Secret Garden Park, Putrajaya',
    date: 'Saturday, October 17, 2026',
    time: '3:00 PM – 6:30 PM',
    price: 68,
    badge: 'Popular Location',
    image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80',
    availableSlots: 45,
    description: 'Join us under the lush trees of Putrajaya for an unforgettable afternoon of cake sharing, picnic vibes, and sweet memories.'
  },
  {
    id: 'cakenic-ticket-johor',
    location: 'Cakenic Johor Bahru',
    city: 'Johor Bahru',
    venue: 'Eco Spring Botanic Garden, JB',
    date: 'Saturday, October 24, 2026',
    time: '3:00 PM – 6:30 PM',
    price: 88,
    badge: 'Limited Spots',
    popular: true,
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
    availableSlots: 30,
    description: 'An exclusive Southern Cakenic gathering featuring curated gift bags, prizes, and a dream botanical picnic setting.'
  }
];

export const CakenicLandingPage: React.FC<CakenicLandingPageProps> = ({ onAddToCart }) => {
  const navigate = useNavigate();

  // Selected Ticket & Checkout Drawer State
  const [selectedTicket, setSelectedTicket] = useState<CakenicLocationTicket | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);

  // Form Inputs
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cakeFlavor, setCakeFlavor] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Active Tab for Must-Read Guidelines
  const [activeGuidelineTab, setActiveGuidelineTab] = useState<'venue' | 'cake' | 'setup' | 'weather' | 'attire' | null>(null);

  const handleOpenCheckout = (ticket: CakenicLocationTicket) => {
    setSelectedTicket(ticket);
    setTicketQuantity(1);
    setCheckoutError('');
    setShowCheckoutModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (!customerName || !customerEmail || !customerPhone) {
      setCheckoutError('Please fill in your full name, email, and phone number.');
      return;
    }

    if (!agreedToTerms) {
      setCheckoutError('Please acknowledge that you have read and agreed to the Cakenic guidelines.');
      return;
    }

    setIsProcessing(true);
    setCheckoutError('');

    const env = (import.meta as any).env || {};
    const brandId = env.VITE_CHIP_ID || env.CHIP_ID || 'a8861126-311a-465d-a7c2-1d5b43c05e7f';
    const apiKey = env.VITE_CHIP_API || env.CHIP_API;

    const ticketCartItem: CartItem = {
      id: selectedTicket.id,
      name: `TICKET: ${selectedTicket.location}`,
      price: selectedTicket.price,
      quantity: ticketQuantity,
      description: `${selectedTicket.date} @ ${selectedTicket.venue} | Guest: ${customerName} (IG: ${instagramHandle || 'N/A'})`,
      image: selectedTicket.image,
      category: 'Event Ticket',
      collection: 'Cakenic 2026'
    };

    const totalAmount = selectedTicket.price * ticketQuantity;

    try {
      const attribution = getAttribution();

      // 1. Create order in Firestore
      const orderRef = await createOrderInDb({
        customerName,
        customerEmail,
        customerPhone,
        items: [ticketCartItem],
        total: totalAmount,
        status: 'pending',
        date: new Date().toISOString(),
        shippingAddress: `CAKENIC TICKET E-DELIVERY | Event Location: ${selectedTicket.location} | IG: ${instagramHandle || 'N/A'} | Cake Info: ${cakeFlavor || 'To be decided'}`,
        adminNotes: `CAKENIC PASS ORDER (CHIP). Qty: ${ticketQuantity}. IG: ${instagramHandle}. Cake: ${cakeFlavor}`,
        utm_source: 'cakenic_landing_page',
        utm_medium: attribution.first_utm_medium || 'direct',
        utm_campaign: 'cakenic_event_2026'
      });

      // 2. CHIP Gateway Call
      const payload: any = {
        client: {
          email: customerEmail,
          phone: customerPhone,
          full_name: customerName.substring(0, 30),
        },
        purchase: {
          currency: 'MYR',
          products: [
            {
              name: ticketCartItem.name.substring(0, 256),
              quantity: ticketQuantity,
              price: Math.round(selectedTicket.price * 100)
            }
          ]
        },
        reference: orderRef.id,
        force_redirect: true,
        success_redirect: `${window.location.origin}/#/payment/callback?result=success&order=${orderRef.id}`,
        failure_redirect: `${window.location.origin}/#/payment/callback?result=failed&order=${orderRef.id}`,
        cancel_redirect: `${window.location.origin}/#/payment/callback?result=cancelled&order=${orderRef.id}`,
      };

      if (brandId && brandId !== 'CHIP_BRAND_ID') {
        payload.brand_id = brandId;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiKey && apiKey !== 'CHIP_API' && apiKey !== 'undefined') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch('/api/chip/purchases/', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Payment gateway connection failed.');
      }

      if (data.checkout_url) {
        // Redirect user straight to CHIP payment gateway page (FPX / Online Banking)
        window.location.href = data.checkout_url;
        return;
      }

      throw new Error(data.message || 'Payment gateway did not return a checkout URL.');

    } catch (err: any) {
      console.error('Cakenic Ticket Payment Error:', err);
      setCheckoutError(err.message || 'Payment processing failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const copyPageLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#F1E8E2] text-[#332524] font-sans relative overflow-x-hidden selection:bg-[#E3A099]/30 pb-32">
      
      {/* --- HERO SECTION WITH 9:16 FULL BLEED BACKGROUND ASSET --- */}
      <section id="hero" className="relative w-full min-h-screen flex flex-col justify-between pt-10 sm:pt-16 pb-16 sm:pb-20 overflow-hidden">
        
        {/* --- DESKTOP NAVIGATION ISLAND AT TOP LEFT (STAYS IN INITIAL SPOT, NON-STICKY) --- */}
        <div className="hidden md:flex absolute top-6 left-6 z-30">
          <div className="bg-[#FBF6F1]/95 backdrop-blur-xl px-4 py-2 rounded-full shadow-[0_8px_24px_rgba(150,110,100,0.2)] border border-white/80 flex items-center gap-1 sm:gap-2 text-xs text-[#332524] font-serif">
            <button 
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
              className="px-2.5 py-1 text-[#6B5450] hover:text-[#332524] transition-colors font-sans text-[11px] font-semibold flex items-center gap-1 border-r border-[#332524]/10 pr-3 mr-1"
            >
              <Home size={13} />
              <span>Home</span>
            </button>
            <button 
              type="button"
              onClick={() => document.getElementById('locations')?.scrollIntoView({ behavior: 'smooth' })} 
              className="px-2.5 py-1 hover:text-[#8C5247] transition-colors font-medium text-xs"
            >
              Tickets
            </button>
            <button 
              type="button"
              onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} 
              className="px-2.5 py-1 hover:text-[#8C5247] transition-colors font-medium text-xs"
            >
              FAQ
            </button>
            <button 
              type="button"
              onClick={() => document.getElementById('guidelines')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-3.5 py-1.5 bg-[#E3A099] hover:bg-[#8C5247] text-white rounded-full font-sans font-medium text-[11px] transition-colors shadow-sm ml-1"
            >
              Guidelines
            </button>
          </div>
        </div>

        {/* Full-bleed background image with minimal overlay so art is crystal clear & vibrant */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://i.postimg.cc/NFwWGNmR/hf-20260805-151006-65ca08b0-8649-4393-94a4-b9b802c63afa.png"
            alt="Cakenic by Vanillicious"
            className="w-full h-full object-cover object-center"
          />
          {/* Light, ultra-clean gradient overlay so background image remains bright and clear */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#F1E8E2]/70" />
        </div>

        {/* TOP HERO TYPOGRAPHY: Big "Cakenic", cursive "by Vanillicious" */}
        <div className="relative z-20 max-w-xl mx-auto w-full px-4 text-center pt-6 flex flex-col items-center">
          <h1 className="font-serif text-5xl sm:text-7xl md:text-8xl text-white font-medium tracking-wide drop-shadow-md">
            Cakenic
          </h1>
          <span className="font-cursive text-2xl sm:text-4xl text-[#FFF5ED] -mt-1 sm:-mt-2 drop-shadow-sm font-normal">
            by Vanillicious
          </span>
        </div>

        {/* LARGE EMPTY MIDDLE AREA: Allows the 3D background artwork to shine completely! */}
        <div className="flex-1 min-h-[300px] sm:min-h-[440px] md:min-h-[500px]" />

        {/* BOTTOM HERO: PUTRAJAYA & JOHOR CARDS - SOFT CLAY STYLE WITH OUTER WHITE GLOW */}
        <div id="locations" className="relative z-20 max-w-md sm:max-w-lg mx-auto w-full px-3 sm:px-4 pb-4">
          {/* Soft white ambient glow coming from behind the cards */}
          <div className="absolute -inset-4 bg-white/70 blur-2xl rounded-[40px] pointer-events-none -z-10" />

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 relative z-10">
            {CAKENIC_LOCATIONS.map((loc) => (
              <div
                key={loc.id}
                onClick={() => handleOpenCheckout(loc)}
                className="group bg-gradient-to-b from-[#FFFDFB] via-[#FBF5EE] to-[#F1E5DA] rounded-3xl p-3 sm:p-4 shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.95),inset_0_-3.5px_0_0_rgba(200,165,150,0.45),0_14px_32px_rgba(95,50,35,0.13)] hover:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,1),inset_0_-4px_0_0_rgba(180,140,120,0.55),0_18px_40px_rgba(95,50,35,0.18)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center justify-between text-center gap-2 sm:gap-2.5"
              >
                {/* 1. TOP ELEMENT: CUTE CLEAN DATE BADGE */}
                <span className="bg-[#FAF0EC]/90 text-[#8C5247] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8),inset_0_-1px_0_0_rgba(215,180,165,0.25)] text-[10px] sm:text-[11px] font-sans font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar size={10} className="text-[#E3A099]" />
                  <span>{loc.city === 'Putrajaya' ? '17 Oct 2026' : '24 Oct 2026'}</span>
                </span>

                {/* 2. CITY TITLE IN ALL CAPS */}
                <h2 className="font-serif text-base sm:text-xl font-normal text-[#2C1D1C] group-hover:text-[#8C5247] transition-colors tracking-widest leading-tight uppercase">
                  {loc.city}
                </h2>

                {/* 3. PRICE TAG */}
                <div className="font-sans text-xs sm:text-sm font-bold text-[#8C5247] tracking-tight">
                  RM {loc.price}
                </div>

                {/* 4. BUTTON WITH LIGHT SAGE GREEN HOVER rgb(197, 221, 216) */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCheckout(loc);
                  }}
                  className="w-full bg-[#E3A099] group-hover:bg-[#C5DDD8] group-hover:text-[#332524] text-white py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-sans font-medium transition-all duration-300 shadow-[0_3px_10px_rgba(227,160,153,0.35)] flex items-center justify-center gap-1"
                >
                  <span>Get Ticket</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ))}
          </div>

          {/* --- MOBILE NAVIGATION ISLAND PLACED RIGHT UNDER THE TICKETS (NON-STICKY) --- */}
          <div className="mt-4 flex md:hidden justify-center w-full relative z-30">
            <div className="bg-[#FBF6F1]/95 backdrop-blur-xl px-4 py-2 rounded-full shadow-[0_8px_24px_rgba(150,110,100,0.2)] border border-white/80 flex items-center gap-1 text-xs text-[#332524] font-serif">
              <button 
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
                className="px-2.5 py-1 text-[#6B5450] hover:text-[#332524] transition-colors font-sans text-[11px] font-semibold flex items-center gap-1 border-r border-[#332524]/10 pr-2.5 mr-1"
              >
                <Home size={13} />
                <span>Home</span>
              </button>
              <button 
                type="button"
                onClick={() => document.getElementById('locations')?.scrollIntoView({ behavior: 'smooth' })} 
                className="px-2 py-1 hover:text-[#8C5247] transition-colors font-medium text-xs"
              >
                Tickets
              </button>
              <button 
                type="button"
                onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} 
                className="px-2 py-1 hover:text-[#8C5247] transition-colors font-medium text-xs"
              >
                FAQ
              </button>
              <button 
                type="button"
                onClick={() => document.getElementById('guidelines')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-3 py-1.5 bg-[#E3A099] hover:bg-[#8C5247] text-white rounded-full font-sans font-medium text-[11px] transition-colors shadow-sm ml-1"
              >
                Guidelines
              </button>
            </div>
          </div>
        </div>

      </section>

      {/* --- CAKENIC GUIDELINES SECTION WITH 9:16 ASPECT RATIO FRAME --- */}
      <section id="guidelines" className="py-12 px-3 sm:px-4 flex flex-col items-center justify-center relative z-20">
        
        {/* Frame container holding the background artwork cleanly with 9:16 ASPECT RATIO */}
        <div className="relative w-full max-w-[350px] sm:max-w-[400px] aspect-[9/16] rounded-[36px] sm:rounded-[44px] overflow-hidden shadow-[0_20px_50px_rgba(70,40,30,0.18)] border border-white/80 flex flex-col justify-between p-4 sm:p-5">
          
          {/* Background image asset inside 9:16 frame */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://i.postimg.cc/8PXpb6vd/hf-20260805-164506-56dffe43-2e58-4305-87ab-f275496577e8.png"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://i.postimg.cc/NFwWGNmR/hf-20260805-151006-65ca08b0-8649-4393-94a4-b9b802c63afa.png";
              }}
              alt="Cakenic Guidelines"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-black/50" />
          </div>

          {/* GUIDELINES CONTENT CONTAINER */}
          <div className="relative z-20 w-full h-full flex flex-col justify-between space-y-2">
            
            {/* GUIDELINES HEADER */}
            <div className="text-center space-y-0.5 shrink-0">
              <h2 className="font-serif text-2xl sm:text-3xl text-white font-semibold tracking-wide drop-shadow-md">
                Cakenic Guidelines
              </h2>
              <p className="font-serif text-[11px] sm:text-xs text-[#FFF5ED] italic drop-shadow-sm">
                Everything you need to know for the big day
              </p>
            </div>

            {/* ACCORDION CARDS - SCROLLS CLEANLY INSIDE 9:16 FRAME WITH BETTER TABS SPACING */}
            <div className="flex-1 overflow-y-auto my-2 pr-0.5 space-y-3 sm:space-y-3.5 scrollbar-thin scrollbar-thumb-white/40">
              
              {/* Card 1: Attire & Dress Code */}
              <div 
                onClick={() => setActiveGuidelineTab(activeGuidelineTab === 'attire' ? null : 'attire')}
                className="bg-[#E09990]/95 hover:bg-[#D8887E] rounded-2xl p-3 sm:p-3.5 text-white shadow-md border border-white/40 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-[#E09990] flex items-center justify-center shrink-0 shadow-sm">
                      <Sparkles size={14} className="stroke-[2.2]" />
                    </div>
                    <div>
                      <h3 className="font-serif text-xs font-semibold leading-tight text-white">
                        Attire & Dress Code
                      </h3>
                      <p className="text-[10px] text-white/90 font-sans line-clamp-1">
                        Pastel dresses, floral prints & picnic wear
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={15} className={`shrink-0 transition-transform duration-300 text-white/90 ${activeGuidelineTab === 'attire' ? 'rotate-180' : ''}`} />
                </div>

                {activeGuidelineTab === 'attire' && (
                  <div className="pt-2.5 mt-2 border-t border-white/25 text-[10px] sm:text-[11px] space-y-1.5 text-white/95 animate-fadeIn">
                    <div className="flex items-start gap-1.5">
                      <span>👗</span>
                      <div><strong>Dress Code:</strong> Soft pastels, floral prints, or cottagecore.</div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>🌸</span>
                      <div><strong>Accessories:</strong> Ribbons, sun hats, cute baskets.</div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>✨</span>
                      <div><strong>Best Dressed Award:</strong> Special prizes for chic outfits!</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Ticket & Access */}
              <div 
                onClick={() => setActiveGuidelineTab(activeGuidelineTab === 'venue' ? null : 'venue')}
                className="bg-[#F7EFE9]/95 hover:bg-[#F2E7DF] rounded-2xl p-3 sm:p-3.5 text-[#332524] shadow-md border border-white/90 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#E09990]/20 text-[#8C5247] flex items-center justify-center shrink-0">
                      <Ticket size={14} className="stroke-[2.2]" />
                    </div>
                    <div>
                      <h3 className="font-serif text-xs font-semibold leading-tight text-[#332524]">
                        Ticket & Access
                      </h3>
                      <p className="text-[10px] text-[#6B5450] font-sans line-clamp-1">
                        Private zone entry, wristbands & perks
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={15} className={`shrink-0 transition-transform duration-300 text-[#8C5247] ${activeGuidelineTab === 'venue' ? 'rotate-180' : ''}`} />
                </div>

                {activeGuidelineTab === 'venue' && (
                  <div className="pt-2.5 mt-2 border-t border-[#8C5247]/15 text-[10px] sm:text-[11px] space-y-1.5 text-[#6B5450] animate-fadeIn">
                    <div className="flex items-start gap-1.5">
                      <span>🎀</span>
                      <div><strong>Private Zone:</strong> Entry into decorated Cakenic Zone.</div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>💗</span>
                      <div><strong>Included Perks:</strong> Covers setup, permits & gift bag.</div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>🎟️</span>
                      <div><strong>1 Ticket = 1 Entry:</strong> Wristband required for entry.</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Cake Rules */}
              <div 
                onClick={() => setActiveGuidelineTab(activeGuidelineTab === 'cake' ? null : 'cake')}
                className="bg-[#E09990]/95 hover:bg-[#D8887E] rounded-2xl p-3 sm:p-3.5 text-white shadow-md border border-white/40 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-[#E09990] flex items-center justify-center shrink-0 shadow-sm">
                      <Coffee size={14} className="stroke-[2.2]" />
                    </div>
                    <div>
                      <h3 className="font-serif text-xs font-semibold leading-tight text-white">
                        Cake Rules
                      </h3>
                      <p className="text-[10px] text-white/90 font-sans line-clamp-1">
                        Whole cakes only, Halal & weather tips
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={15} className={`shrink-0 transition-transform duration-300 text-white/90 ${activeGuidelineTab === 'cake' ? 'rotate-180' : ''}`} />
                </div>

                {activeGuidelineTab === 'cake' && (
                  <div className="pt-2.5 mt-2 border-t border-white/25 text-[10px] sm:text-[11px] space-y-1.5 text-white/95 animate-fadeIn">
                    <div className="flex items-start gap-1.5">
                      <span>🎂</span>
                      <div><strong>Whole Cakes Only:</strong> Bring 1 whole cake (min 8 inches).</div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>✨</span>
                      <div><strong>Halal & Alcohol-Free:</strong> 100% halal for all guests.</div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>☀️</span>
                      <div><strong>No Ice Cream Cakes:</strong> Avoid cakes that melt outdoors.</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 4: Picnic Setup & Contests */}
              <div 
                onClick={() => setActiveGuidelineTab(activeGuidelineTab === 'setup' ? null : 'setup')}
                className="bg-[#F7EFE9]/95 hover:bg-[#F2E7DF] rounded-2xl p-3 sm:p-3.5 text-[#332524] shadow-md border border-white/90 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#E09990]/20 text-[#8C5247] flex items-center justify-center shrink-0">
                      <Award size={14} className="stroke-[2.2]" />
                    </div>
                    <div>
                      <h3 className="font-serif text-xs font-semibold leading-tight text-[#332524]">
                        Picnic Setup & Contests
                      </h3>
                      <p className="text-[10px] text-[#6B5450] font-sans line-clamp-1">
                        Mat & cushions, Cake Dash & awards
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={15} className={`shrink-0 transition-transform duration-300 text-[#8C5247] ${activeGuidelineTab === 'setup' ? 'rotate-180' : ''}`} />
                </div>

                {activeGuidelineTab === 'setup' && (
                  <div className="pt-2.5 mt-2 border-t border-[#8C5247]/15 text-[10px] sm:text-[11px] space-y-1.5 text-[#6B5450] animate-fadeIn">
                    <div className="flex items-start gap-1.5">
                      <span>🌷</span>
                      <div><strong>Setup:</strong> Bring your mat & cushions. Cakes share tables.</div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>🍰</span>
                      <div><strong>Cake Dash:</strong> Sample delicious slices during our Cake Dash!</div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>👗</span>
                      <div><strong>Awards:</strong> Prizes for <em>Prettiest Cake</em> & <em>Best Outfit</em>!</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 5: Weather & Ticket Policy */}
              <div 
                onClick={() => setActiveGuidelineTab(activeGuidelineTab === 'weather' ? null : 'weather')}
                className="bg-[#E09990]/95 hover:bg-[#D8887E] rounded-2xl p-3 sm:p-3.5 text-white shadow-md border border-white/40 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white text-[#E09990] flex items-center justify-center shrink-0 shadow-sm">
                      <Sun size={14} className="stroke-[2.2]" />
                    </div>
                    <div>
                      <h3 className="font-serif text-xs font-semibold leading-tight text-white">
                        Weather & Policy
                      </h3>
                      <p className="text-[10px] text-white/90 font-sans line-clamp-1">
                        Rain shelter plan & booking terms
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={15} className={`shrink-0 transition-transform duration-300 text-white/90 ${activeGuidelineTab === 'weather' ? 'rotate-180' : ''}`} />
                </div>

                {activeGuidelineTab === 'weather' && (
                  <div className="pt-2.5 mt-2 border-t border-white/25 text-[10px] sm:text-[11px] space-y-1.5 text-white/95 animate-fadeIn">
                    <div className="flex items-start gap-1.5">
                      <span>☔</span>
                      <div><strong>Rain Plan:</strong> Pause in sheltered park pavilions until clear.</div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>💕</span>
                      <div><strong>Policy:</strong> Tickets are non-refundable due to venue permits.</div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* BOTTOM RIBBON NOTE INSIDE 9:16 FRAME */}
            <div className="shrink-0 pt-0.5 text-center">
              <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-white font-sans font-medium border border-white/30 inline-flex items-center gap-1 shadow-sm">
                <Sparkles size={11} className="text-[#FFF5ED]" />
                <span>Tap cards for details • See you at Cakenic!</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* --- REDESIGNED FAQ SECTION WITH FULL-BLEED BACKGROUND COVER --- */}
      <section id="faq" className="relative w-full py-12 px-4 flex flex-col items-center justify-start overflow-hidden">
        
        {/* Full-bleed background image asset covering left to right (no shadow or blur) */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://i.postimg.cc/T1zpC5ys/hf-20260805-164202-c1a64baf-cc26-419d-bf01-56bf09112682.png"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://i.postimg.cc/NFwWGNmR/hf-20260805-151006-65ca08b0-8649-4393-94a4-b9b802c63afa.png";
            }}
            alt="Cakenic FAQ"
            className="w-full h-full object-cover object-center"
          />
        </div>

        {/* FAQ CONTENT CONTAINER */}
        <div className="relative z-20 max-w-md mx-auto w-full space-y-4 pb-12">
          
          {/* FAQ HEADER */}
          <div className="text-center space-y-0.5">
            <h2 className="font-serif text-3xl sm:text-4xl text-white font-semibold tracking-wide drop-shadow-md">
              FAQ
            </h2>
            <p className="font-serif text-xs sm:text-sm text-[#FFF5ED] italic drop-shadow-sm">
              Frequently Asked Questions
            </p>
          </div>

          {/* FAQ COMPACT NEAT CARDS */}
          <div className="space-y-2.5 pt-1">
            
            <div className="bg-[#F7EFE9]/95 hover:bg-[#F2E7DF] rounded-2xl p-3.5 sm:p-4 text-[#332524] shadow-md border border-white/90 space-y-1 transition-all duration-300">
              <h4 className="font-serif font-semibold text-[#332524] text-sm sm:text-base flex items-center gap-1.5">
                <span>🌸</span>
                <span>How do I receive my ticket after booking?</span>
              </h4>
              <p className="text-[#6B5450] text-xs pl-5 leading-snug">
                Upon successful checkout, your official E-Ticket details and QR confirmation are sent instantly via email and WhatsApp.
              </p>
            </div>

            <div className="bg-[#E09990]/95 hover:bg-[#D8887E] rounded-2xl p-3.5 sm:p-4 text-white shadow-md border border-white/40 space-y-1 transition-all duration-300">
              <h4 className="font-serif font-semibold text-white text-sm sm:text-base flex items-center gap-1.5">
                <span>🌸</span>
                <span>Can I bring non-ticketed friends or kids?</span>
              </h4>
              <p className="text-white/95 text-xs pl-5 leading-snug">
                1 ticket = 1 entry into our decorated Cakenic Zone (ages 12+). Friends can enjoy the surrounding public park area.
              </p>
            </div>

            <div className="bg-[#F7EFE9]/95 hover:bg-[#F2E7DF] rounded-2xl p-3.5 sm:p-4 text-[#332524] shadow-md border border-white/90 space-y-1 transition-all duration-300">
              <h4 className="font-serif font-semibold text-[#332524] text-sm sm:text-base flex items-center gap-1.5">
                <span>🌸</span>
                <span>What size and type of cake should I bring?</span>
              </h4>
              <p className="text-[#6B5450] text-xs pl-5 leading-snug">
                Bring 1 whole cake (minimum 8 inches). Ingredients must be 100% Halal, non-alcoholic, and non-ice cream.
              </p>
            </div>

            <div className="bg-[#E09990]/95 hover:bg-[#D8887E] rounded-2xl p-3.5 sm:p-4 text-white shadow-md border border-white/40 space-y-1 transition-all duration-300">
              <h4 className="font-serif font-semibold text-white text-sm sm:text-base flex items-center gap-1.5">
                <span>🌸</span>
                <span>What happens if it rains?</span>
              </h4>
              <p className="text-white/95 text-xs pl-5 leading-snug">
                In case of rain, we pause in sheltered park pavilions until clear, then resume the outdoor fun!
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* --- DIRECT EMBEDDED PAYMENT CHECKOUT MODAL --- */}
      {showCheckoutModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#FBF6F1] rounded-[44px] max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_24px_60px_rgba(150,110,100,0.25)] p-8 md:p-10 relative text-[#332524]">
            
            <button 
              onClick={() => setShowCheckoutModal(false)}
              className="absolute top-6 right-6 text-[#6B5450] hover:text-[#332524] bg-[#F1E8E2] w-9 h-9 rounded-full flex items-center justify-center"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-xs text-[#E3A099] font-bold uppercase tracking-wider mb-2">
              <Ticket size={16} />
              <span>Ticket Purchase</span>
            </div>

            <h3 className="font-sans text-3xl font-extrabold text-[#332524] mb-1">
              {selectedTicket.location}
            </h3>
            <p className="text-xs text-[#6B5450] mb-6">{selectedTicket.date} • {selectedTicket.venue}</p>

            {/* Price Summary */}
            <div className="bg-[#F1E8E2]/70 p-5 rounded-[28px] mb-6 space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center">
                <span className="font-medium text-[#6B5450]">Ticket Rate:</span>
                <span className="font-bold">RM {selectedTicket.price} / person</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium text-[#6B5450]">Number of Passes:</span>
                <div className="flex items-center gap-3 bg-[#FBF6F1] px-4 py-1.5 rounded-full">
                  <button 
                    type="button" 
                    onClick={() => setTicketQuantity(Math.max(1, ticketQuantity - 1))}
                    className="font-bold px-1 text-[#E3A099]"
                  >
                    -
                  </button>
                  <span className="font-bold text-[#332524]">{ticketQuantity}</span>
                  <button 
                    type="button" 
                    onClick={() => setTicketQuantity(ticketQuantity + 1)}
                    className="font-bold px-1 text-[#E3A099]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-[#332524]/10 flex justify-between items-center text-base font-bold text-[#E3A099]">
                <span>Total Amount:</span>
                <span className="font-sans text-xl font-extrabold">RM {selectedTicket.price * ticketQuantity}</span>
              </div>
            </div>

            {/* Registration Form */}
            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-[#332524] mb-1">Full Name *</label>
                <input 
                  type="text" 
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Siti Sarah"
                  className="w-full px-4 py-3 bg-white/90 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#E3A099]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#332524] mb-1">Email *</label>
                  <input 
                    type="email" 
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    className="w-full px-4 py-3 bg-white/90 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#E3A099]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#332524] mb-1">Phone (WhatsApp) *</label>
                  <input 
                    type="tel" 
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+60123456789"
                    className="w-full px-4 py-3 bg-white/90 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#E3A099]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#332524] mb-1">Instagram Handle (Optional)</label>
                <input 
                  type="text" 
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  placeholder="@yourhandle (Optional)"
                  className="w-full px-4 py-3 bg-white/90 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#E3A099]"
                />
              </div>

              <div className="pt-2 flex items-start gap-2.5">
                <input 
                  type="checkbox" 
                  id="cakenic-terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#E3A099] rounded cursor-pointer"
                />
                <label htmlFor="cakenic-terms" className="text-xs text-[#6B5450] leading-snug cursor-pointer">
                  I confirm that I have read the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowCheckoutModal(false);
                      setTimeout(() => {
                        document.getElementById('guidelines')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    className="underline text-[#E3A099] font-bold hover:text-[#8C5247] transition-colors"
                  >
                    Cakenic Guidelines
                  </button>
                </label>
              </div>

              {checkoutError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-2xl flex items-start gap-2.5">
                  <AlertCircle size={18} className="shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Payment Gateway Error</span>
                    <span className="text-[11px] leading-relaxed block">{checkoutError}</span>
                  </div>
                </div>
              )}

              <div className="pt-3 space-y-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-[#E3A099] hover:bg-[#F0BDB5] text-white py-4 px-4 rounded-full font-bold text-sm sm:text-base transition-all duration-300 shadow-[0_6px_18px_rgba(200,130,120,0.28)] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Connecting CHIP Payment Gateway...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={20} />
                      <span>Proceed to Payment</span>
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-[#6B5450] font-medium tracking-wide">
                  secure payment powered by CHIP
                </p>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
