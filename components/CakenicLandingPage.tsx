import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, Calendar, Clock, MapPin, Sparkles, 
  Check, Ticket, ChevronDown, ShieldCheck, Heart, ArrowRight, X, 
  Coffee, Gift, AlertCircle, Loader2, Info, Share2, HelpCircle,
  AlertTriangle, Sun, Award, Users, Camera, Home, FileText, ShoppingBag,
  CheckCircle2, Search, Mail, Phone, KeyRound
} from 'lucide-react';
import { CartItem, Product, Order } from '../types';
import { createOrderInDb, searchCakenicOrder } from '../firebase';
import { getAttribution } from '../analytics';
import { CakenicTicketView } from './CakenicTicketView';

interface CakenicLandingPageProps {
  onAddToCart?: (product: Product, quantity: number) => void;
  products?: Product[];
}

export interface CakenicLocationTicket {
  id: string;
  location: string;
  city: string;
  venue: string;
  fullAddress?: string;
  theme?: string;
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
    venue: 'Taman Botani, Putrajaya',
    fullAddress: 'Taman Botani Putrajaya, Presint 1, 62000 Putrajaya',
    theme: 'European Classical',
    date: 'Saturday, September 12, 2026',
    time: '4:00 PM – 7:00 PM',
    price: 68,
    badge: 'Popular Location',
    image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80',
    availableSlots: 0,
    description: 'Join us at Taman Botani Putrajaya for an elegant European Classical themed afternoon of cake sharing, picnic vibes, and sweet memories.'
  },
  {
    id: 'cakenic-ticket-johor',
    location: 'Cakenic JOHOR',
    city: 'JOHOR',
    venue: 'Eco Spring Garden, Johor',
    fullAddress: 'Eco Spring Garden, Jalan Ekoflora 1, Taman Ekoflora, 81100 Johor Bahru, Johor',
    theme: 'Rocco Garden',
    date: 'Saturday, October 24, 2026',
    time: '4:00 PM – 7:00 PM',
    price: 88,
    badge: 'Limited Spots',
    popular: true,
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
    availableSlots: 0,
    description: 'An exclusive Southern Cakenic gathering at Eco Spring Garden with a grand Rocco Garden theme, featuring curated gift bags, prizes, and a dream botanical picnic setting.'
  }
];

export const CakenicLandingPage: React.FC<CakenicLandingPageProps> = ({ onAddToCart, products = [] }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Dynamically map ticket prices and details from products in Admin
  const locations = React.useMemo(() => {
    return CAKENIC_LOCATIONS.map(loc => {
      const matched = products.find(p => {
        if (p.id === loc.id) return true;
        const nameLower = (p.name || '').toLowerCase();
        if (loc.id.includes('putrajaya') && nameLower.includes('putrajaya')) return true;
        if (loc.id.includes('johor') && (nameLower.includes('johor') || nameLower.includes('jb'))) return true;
        return false;
      });
      if (matched) {
        return {
          ...loc,
          price: typeof matched.price === 'number' ? matched.price : loc.price,
          availableSlots: matched.stock !== undefined ? Number(matched.stock) : loc.availableSlots,
          description: matched.description || loc.description
        };
      }
      return loc;
    });
  }, [products]);

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

  // Ticket Lookup State
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupOrderId, setLookupOrderId] = useState('');
  const [isSearchingTicket, setIsSearchingTicket] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [foundOrders, setFoundOrders] = useState<Order[]>([]);
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Auto-search ticket if order param exists in URL (e.g. ?ticket=1042)
  useEffect(() => {
    const ticketParam = searchParams.get('ticket') || searchParams.get('order');
    if (ticketParam) {
      setLookupOrderId(ticketParam);
      setIsSearchingTicket(true);
      searchCakenicOrder(undefined, undefined, ticketParam).then(orders => {
        setIsSearchingTicket(false);
        if (orders.length > 0) {
          setFoundOrders(orders);
          setSelectedOrderForView(orders[0]);
          setShowTicketModal(true);
        }
      }).catch(err => {
        setIsSearchingTicket(false);
      });
    }
  }, [searchParams]);

  const handleLookupTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    setFoundOrders([]);
    setSelectedOrderForView(null);

    const trimmedEmail = lookupEmail.trim();
    const trimmedPhone = lookupPhone.trim();
    const trimmedOrderId = lookupOrderId.trim();

    if (!trimmedEmail && !trimmedPhone && !trimmedOrderId) {
      setLookupError('Please enter your Email Address or Phone Number to find your ticket.');
      return;
    }

    setIsSearchingTicket(true);

    try {
      const results = await searchCakenicOrder(trimmedEmail, trimmedPhone, trimmedOrderId);
      setIsSearchingTicket(false);

      if (results.length === 0) {
        setLookupError('No Cakenic ticket found for those details. Please check your email address or phone number.');
      } else if (results.length === 1) {
        setFoundOrders(results);
        setSelectedOrderForView(results[0]);
        setShowTicketModal(true);
      } else {
        setFoundOrders(results);
      }
    } catch (err: any) {
      setIsSearchingTicket(false);
      setLookupError('Failed to search tickets. Please try again.');
    }
  };

  // Active Tab for Navigation Style Guidelines
  const [activeGuidelineTab, setActiveGuidelineTab] = useState<'essentials' | 'flow' | 'cake' | 'picnic' | 'policy'>('essentials');

  const handleOpenCheckout = (ticket: CakenicLocationTicket) => {
    if (ticket.availableSlots <= 0) return;
    setSelectedTicket(ticket);
    setTicketQuantity(1);
    setCheckoutError('');
    setShowCheckoutModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (selectedTicket.availableSlots <= 0) {
      setCheckoutError('Sorry, this location ticket is currently sold out.');
      return;
    }

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
      collection: 'Cakenic Ticket'
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
        shippingAddress: 'Cakenic',
        adminNotes: '',
        source: 'cakenic',
        channel: 'Cakenic Sales',
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
            {locations.map((loc) => (
              <div
                key={loc.id}
                onClick={() => {
                  if (loc.availableSlots > 0) {
                    handleOpenCheckout(loc);
                  }
                }}
                className="group bg-gradient-to-b from-[#FFFDFB] via-[#FBF5EE] to-[#F1E5DA] rounded-3xl p-3 sm:p-4 shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.95),inset_0_-3.5px_0_0_rgba(200,165,150,0.45),0_14px_32px_rgba(95,50,35,0.13)] hover:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,1),inset_0_-4px_0_0_rgba(180,140,120,0.55),0_18px_40px_rgba(95,50,35,0.18)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-center justify-between text-center gap-2 sm:gap-2.5"
              >
                {/* 1. TOP ELEMENT: CUTE CLEAN DATE BADGE */}
                <span className="bg-[#FAF0EC]/90 text-[#8C5247] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8),inset_0_-1px_0_0_rgba(215,180,165,0.25)] text-[10px] sm:text-[11px] font-sans font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar size={10} className="text-[#E3A099]" />
                  <span>{loc.city === 'Putrajaya' ? '12 Sep 2026' : '24 Oct 2026'}</span>
                </span>

                {/* 2. CITY TITLE IN ALL CAPS & THEME */}
                <div className="space-y-0.5">
                  <h2 className="font-display font-extrabold text-base sm:text-xl text-[#2C1D1C] group-hover:text-[#8C5247] transition-colors tracking-[0.18em] leading-tight uppercase">
                    {loc.city}
                  </h2>
                  <p className="font-serif italic text-[11px] sm:text-xs text-[#8C5247] font-medium tracking-wide">
                    {loc.theme}
                  </p>
                </div>

                {/* 3. PRICE TAG & REMAINING STOCK */}
                <div className="flex flex-col items-center gap-1">
                  <div className="font-sans text-xs sm:text-sm font-bold text-[#8C5247] tracking-tight">
                    RM {loc.price}
                  </div>
                  {loc.availableSlots <= 0 ? (
                    <div className="bg-red-100 text-red-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] text-[10px] sm:text-[11px] font-sans font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-red-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      <span>Sold Out</span>
                    </div>
                  ) : (
                    <div className="bg-[#8C5247]/10 text-[#8C5247] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] text-[10px] sm:text-[11px] font-sans font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border border-[#8C5247]/15">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E3A099] animate-pulse shrink-0" />
                      <span>{loc.availableSlots} tickets left</span>
                    </div>
                  )}
                </div>

                {/* 4. BUTTON */}
                <button 
                  disabled={loc.availableSlots <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (loc.availableSlots > 0) {
                      handleOpenCheckout(loc);
                    }
                  }}
                  className={`w-full py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-sans font-medium transition-all duration-300 flex items-center justify-center gap-1 ${
                    loc.availableSlots <= 0
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed shadow-none'
                      : 'bg-[#E3A099] group-hover:bg-[#C5DDD8] group-hover:text-[#332524] text-white shadow-[0_3px_10px_rgba(227,160,153,0.35)]'
                  }`}
                >
                  <span>{loc.availableSlots <= 0 ? 'Sold Out' : 'Get Ticket'}</span>
                  {loc.availableSlots > 0 && (
                    <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                  )}
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

      {/* --- CAKENIC GUIDELINES & EVENT FLOW SECTION WITH TALLER FRAME & GLASS PILL NAVIGATION --- */}
      <section id="guidelines" className="py-12 px-3 sm:px-4 flex flex-col items-center justify-center relative z-20">
        
        {/* Longer frame container holding the background artwork cleanly */}
        <div className="relative w-full max-w-[420px] sm:max-w-[480px] min-h-[680px] sm:min-h-[740px] aspect-[9/17.5] rounded-[36px] sm:rounded-[44px] overflow-hidden shadow-[0_22px_55px_rgba(70,40,30,0.25)] border border-white/80 flex flex-col justify-between p-4 sm:p-6">
          
          {/* Background image asset inside taller frame */}
          <div className="absolute inset-0 z-0">
            <img 
              src="https://i.postimg.cc/8PXpb6vd/hf-20260805-164506-56dffe43-2e58-4305-87ab-f275496577e8.png"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://i.postimg.cc/NFwWGNmR/hf-20260805-151006-65ca08b0-8649-4393-94a4-b9b802c63afa.png";
              }}
              alt="Cakenic Guidelines"
              className="w-full h-full object-cover object-center"
            />
          </div>

          {/* GUIDELINES CONTENT CONTAINER */}
          <div className="relative z-20 w-full h-full flex flex-col justify-between overflow-hidden gap-3">
            
            {/* HERO-STYLE HEADER */}
            <div className="text-center shrink-0 pt-1 pb-1">
              <h2 className="font-serif text-3xl sm:text-4xl text-white font-medium tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                Cakenic
              </h2>
              <p className="font-cursive text-xl sm:text-2xl text-[#FFF5ED] -mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] font-normal">
                Guidelines & Schedule
              </p>
            </div>

            {/* NAVIGATION TABS IN TRANSPARENT GLASS PILL STYLE */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 px-0.5 w-full shrink-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveGuidelineTab('essentials')}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                  activeGuidelineTab === 'essentials'
                    ? 'bg-white text-[#332524] shadow-md font-bold scale-[1.02]'
                    : 'bg-white/30 backdrop-blur-md text-white hover:bg-white/40 border border-white/50 shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                }`}
              >
                <span>✨</span>
                <span>Event Essentials</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuidelineTab('cake')}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                  activeGuidelineTab === 'cake'
                    ? 'bg-white text-[#332524] shadow-md font-bold scale-[1.02]'
                    : 'bg-white/30 backdrop-blur-md text-white hover:bg-white/40 border border-white/50 shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                }`}
              >
                <span>🎂</span>
                <span>Cake Rules</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuidelineTab('flow')}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                  activeGuidelineTab === 'flow'
                    ? 'bg-white text-[#332524] shadow-md font-bold scale-[1.02]'
                    : 'bg-white/30 backdrop-blur-md text-white hover:bg-white/40 border border-white/50 shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                }`}
              >
                <span>⏰</span>
                <span>Event Flow</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuidelineTab('picnic')}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                  activeGuidelineTab === 'picnic'
                    ? 'bg-white text-[#332524] shadow-md font-bold scale-[1.02]'
                    : 'bg-white/30 backdrop-blur-md text-white hover:bg-white/40 border border-white/50 shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                }`}
              >
                <span>🌷</span>
                <span>Setup & Prizes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuidelineTab('policy')}
                className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 shrink-0 ${
                  activeGuidelineTab === 'policy'
                    ? 'bg-white text-[#332524] shadow-md font-bold scale-[1.02]'
                    : 'bg-white/30 backdrop-blur-md text-white hover:bg-white/40 border border-white/50 shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                }`}
              >
                <span>☔</span>
                <span>Ticket Policy</span>
              </button>
            </div>

            {/* TAB CONTENT AREA WITH TRANSPARENT GLASS BACKGROUND */}
            <div className="flex-1 overflow-y-auto my-1 bg-white/45 backdrop-blur-xl rounded-2xl p-4 sm:p-5 text-[#332524] shadow-xl border border-white/70 scrollbar-thin scrollbar-thumb-white/40 flex flex-col justify-between">
              
              {/* TAB 1: EVENT ESSENTIALS (MOST CRITICAL DECISION INFO FIRST - FRIENDLY & INVITATORY!) */}
              {activeGuidelineTab === 'essentials' && (
                <div className="space-y-3 text-xs animate-fadeIn">
                  <div className="border-b border-[#332524]/15 pb-2">
                    <h3 className="font-serif text-base font-bold text-[#332524] flex items-center gap-1.5">
                      <span>✨</span> Good to Know Before You Join
                    </h3>
                    <p className="text-[10px] text-[#7A3E34] font-bold mt-0.5">
                      Everything you need for a wonderful Cake Day!
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="bg-white/50 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-white/60 shadow-sm flex items-start gap-2.5">
                      <span className="text-base shrink-0">🎟️</span>
                      <div>
                        <strong className="block text-[#332524] font-bold text-[11.5px]">1 Ticket = 1 Entry (Age 12+)</strong>
                        <span className="text-[#523A36] text-[10.5px] leading-relaxed block font-medium">
                          Every participant needs a ticket to enter. Minimum age is <strong>12 years old</strong>.
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/50 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-white/60 shadow-sm flex items-start gap-2.5">
                      <span className="text-base shrink-0">🎂</span>
                      <div>
                        <strong className="block text-[#332524] font-bold text-[11.5px]">1 Whole Uncut Cake Required</strong>
                        <span className="text-[#523A36] text-[10.5px] leading-relaxed block font-medium">
                          Each participant brings <strong>1 whole uncut cake</strong> (min. 8 inches, 100% halal) to place on the cake display table!
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/50 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-white/60 shadow-sm flex items-start gap-2.5">
                      <span className="text-base shrink-0">🎀</span>
                      <div>
                        <strong className="block text-[#332524] font-bold text-[11.5px]">Check-In & Wristband</strong>
                        <span className="text-[#523A36] text-[10.5px] leading-relaxed block font-medium">
                          Present your <strong>Order No.</strong> or confirmation email at registration to collect your event wristband.
                        </span>
                      </div>
                    </div>

                    <div className="bg-white/50 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-white/60 shadow-sm flex items-start gap-2.5">
                      <span className="text-base shrink-0">💌</span>
                      <div>
                        <strong className="block text-[#332524] font-bold text-[11.5px]">Ticket Terms & Transfers</strong>
                        <span className="text-[#523A36] text-[10.5px] leading-relaxed block font-medium">
                          Tickets are non-refundable and valid only for your booked session.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CAKE RULES */}
              {activeGuidelineTab === 'cake' && (
                <div className="space-y-2.5 text-xs animate-fadeIn">
                  <div className="border-b border-[#332524]/15 pb-2">
                    <h3 className="font-serif text-base font-bold text-[#332524] flex items-center gap-1.5">
                      <span>🎂</span> Cake Rules & Guidelines
                    </h3>
                  </div>

                  <ul className="space-y-2 text-[10.5px] text-[#332524]">
                    <li className="flex items-start gap-2 bg-white/50 backdrop-blur-md p-2 rounded-xl border border-white/60 shadow-sm">
                      <span className="text-sm shrink-0">🎂</span>
                      <div><strong>1 Whole Cake (Uncut):</strong> Minimum 8 inches so there's plenty to share.</div>
                    </li>
                    <li className="flex items-start gap-2 bg-white/50 backdrop-blur-md p-2 rounded-xl border border-white/60 shadow-sm">
                      <span className="text-sm shrink-0">✨</span>
                      <div><strong>100% Halal:</strong> Strictly no alcohol, rum, or non-halal ingredients.</div>
                    </li>
                    <li className="flex items-start gap-2 bg-white/50 backdrop-blur-md p-2 rounded-xl border border-white/60 shadow-sm">
                      <span className="text-sm shrink-0">💗</span>
                      <div><strong>Any Flavor:</strong> Home-baked or store-bought! Simple or fancy, all cakes are welcome.</div>
                    </li>
                    <li className="flex items-start gap-2 bg-white/50 backdrop-blur-md p-2 rounded-xl border border-white/60 shadow-sm">
                      <span className="text-sm shrink-0">☀️</span>
                      <div><strong>Outdoor Friendly:</strong> Avoid ice cream cakes or delicate toppings that melt quickly outdoors.</div>
                    </li>
                    <li className="flex items-start gap-2 bg-white/65 backdrop-blur-md p-2.5 rounded-xl border border-[#E3A099]/40 text-[#8C5247] shadow-sm">
                      <span className="text-sm shrink-0">📦</span>
                      <div><strong>Cake Box Provided:</strong> Each participant receives a cake box to fill with your favorite cake slices during the Cake Dash!</div>
                    </li>
                  </ul>
                </div>
              )}

              {/* TAB 3: FLOW OF EVENT (4:00 PM - 7:00 PM) */}
              {activeGuidelineTab === 'flow' && (
                <div className="space-y-3 text-xs animate-fadeIn">
                  <div className="border-b border-[#332524]/15 pb-2 flex items-center justify-between">
                    <h3 className="font-serif text-base font-bold text-[#332524] flex items-center gap-1.5">
                      <span>⏰</span> Flow of Event
                    </h3>
                    <span className="bg-[#E3A099] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                      4:00 – 7:00 PM
                    </span>
                  </div>

                  <div className="relative pl-4 space-y-2 text-[11px] border-l-2 border-[#E3A099] my-1">
                    {/* Step 1 */}
                    <div className="relative bg-white/40 backdrop-blur-md p-2 rounded-xl border border-white/50">
                      <div className="absolute -left-[21px] top-2.5 w-3.5 h-3.5 rounded-full bg-[#E3A099] text-white flex items-center justify-center text-[8px] font-bold shadow-sm">
                        1
                      </div>
                      <div className="font-bold text-[#332524] flex items-center gap-1 text-[11px]">
                        <span>📩</span> 4:00 PM – 5:00 PM — Arrival & Registration
                      </div>
                      <p className="text-[#523A36] text-[10px] leading-relaxed mt-0.5 font-medium">
                        Check in, collect your entry wristband, and settle into the picnic zone.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className="relative bg-white/40 backdrop-blur-md p-2 rounded-xl border border-white/50">
                      <div className="absolute -left-[21px] top-2.5 w-3.5 h-3.5 rounded-full bg-[#E3A099] text-white flex items-center justify-center text-[8px] font-bold shadow-sm">
                        2
                      </div>
                      <div className="font-bold text-[#332524] flex items-center gap-1 text-[11px]">
                        <span>🧁</span> 5:00 PM — Cake Display & Setup (Event Start)
                      </div>
                      <p className="text-[#523A36] text-[10px] leading-relaxed mt-0.5 font-medium">
                        Set up your picnic spot and place your cake on the cake display table!
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="relative bg-white/40 backdrop-blur-md p-2 rounded-xl border border-white/50">
                      <div className="absolute -left-[21px] top-2.5 w-3.5 h-3.5 rounded-full bg-[#E3A099] text-white flex items-center justify-center text-[8px] font-bold shadow-sm">
                        3
                      </div>
                      <div className="font-bold text-[#332524] flex items-center gap-1 text-[11px]">
                        <span>📸</span> 5:15 PM — Cake Viewing & Group Photo
                      </div>
                      <p className="text-[#523A36] text-[10px] leading-relaxed mt-0.5 font-medium">
                        Admire all the wonderful cakes and snap group photos with new friends!
                      </p>
                    </div>

                    {/* Step 4 */}
                    <div className="relative bg-white/40 backdrop-blur-md p-2 rounded-xl border border-white/50">
                      <div className="absolute -left-[21px] top-2.5 w-3.5 h-3.5 rounded-full bg-[#E3A099] text-white flex items-center justify-center text-[8px] font-bold shadow-sm">
                        4
                      </div>
                      <div className="font-bold text-[#332524] flex items-center gap-1 text-[11px]">
                        <span>🎂</span> 5:25 PM — Cake Dash (4-6 rounds)
                      </div>
                      <p className="text-[#523A36] text-[10px] leading-relaxed mt-0.5 font-medium">
                        Bring your cake box to the table and pick your favorite cake slices!
                      </p>
                    </div>

                    {/* Step 5 */}
                    <div className="relative bg-white/40 backdrop-blur-md p-2 rounded-xl border border-white/50">
                      <div className="absolute -left-[21px] top-2.5 w-3.5 h-3.5 rounded-full bg-[#E3A099] text-white flex items-center justify-center text-[8px] font-bold shadow-sm">
                        5
                      </div>
                      <div className="font-bold text-[#332524] flex items-center gap-1 text-[11px]">
                        <span>🩷</span> 6:00 PM — Games and Free Time
                      </div>
                      <p className="text-[#523A36] text-[10px] leading-relaxed mt-0.5 font-medium">
                        Enjoy your cake slices, chat with friends, and join in fun picnic mini games!
                      </p>
                    </div>

                    {/* Step 6 */}
                    <div className="relative bg-white/40 backdrop-blur-md p-2 rounded-xl border border-white/50">
                      <div className="absolute -left-[21px] top-2.5 w-3.5 h-3.5 rounded-full bg-[#E3A099] text-white flex items-center justify-center text-[8px] font-bold shadow-sm">
                        6
                      </div>
                      <div className="font-bold text-[#332524] flex items-center gap-1 text-[11px]">
                        <span>🏆</span> 6:30 PM — Awards: Best Outfit • Prettiest Cake • Cutest Picnic Setup
                      </div>
                      <p className="text-[#523A36] text-[10px] leading-relaxed mt-0.5 font-medium">
                        Celebrating our winners for Best Outfit, Prettiest Cake, and Cutest Picnic Setup!
                      </p>
                    </div>

                    {/* Step 7 */}
                    <div className="relative bg-white/40 backdrop-blur-md p-2 rounded-xl border border-white/50">
                      <div className="absolute -left-[21px] top-2.5 w-3.5 h-3.5 rounded-full bg-[#E3A099] text-white flex items-center justify-center text-[8px] font-bold shadow-sm">
                        7
                      </div>
                      <div className="font-bold text-[#332524] flex items-center gap-1 text-[11px]">
                        <span>🎁</span> 6:50 PM — Gift Moments & Last Snaps
                      </div>
                      <p className="text-[#523A36] text-[10px] leading-relaxed mt-0.5 font-medium">
                        Enjoy special gift moments and capture final memories before sunset!
                      </p>
                    </div>

                    {/* Step 8 */}
                    <div className="relative bg-white/40 backdrop-blur-md p-2 rounded-xl border border-white/50">
                      <div className="absolute -left-[21px] top-2.5 w-3.5 h-3.5 rounded-full bg-[#E3A099] text-white flex items-center justify-center text-[8px] font-bold shadow-sm">
                        8
                      </div>
                      <div className="font-bold text-[#332524] flex items-center gap-1 text-[11px]">
                        <span>🌷</span> 7:00 PM — End of Event
                      </div>
                      <p className="text-[#523A36] text-[10px] leading-relaxed mt-0.5 font-medium">
                        Wrap up a sweet and lovely afternoon together!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SETUP & 3 PRIZE CATEGORIES */}
              {activeGuidelineTab === 'picnic' && (
                <div className="space-y-2.5 text-xs animate-fadeIn">
                  <div className="border-b border-[#332524]/15 pb-2">
                    <h3 className="font-serif text-base font-bold text-[#332524] flex items-center gap-1.5">
                      <span>🌷</span> Picnic Setup & Prizes
                    </h3>
                  </div>

                  <div className="space-y-2.5 text-[10.5px] text-[#332524]">
                    <div className="bg-white/50 backdrop-blur-md p-2.5 rounded-xl border border-white/60 shadow-sm space-y-1">
                      <div className="font-bold text-[#332524] flex items-center gap-1.5">
                        <span>👗</span> Dress Code & Themes
                      </div>
                      <p className="text-[#523A36] leading-relaxed font-medium">
                        Dress up in your prettiest outfit! Soft pastels, florals, cottagecore, ribbons, or sun hats are all welcome.
                      </p>
                      <div className="pt-1.5 space-y-1 text-[10.5px] text-[#7A3E34] bg-white/40 p-2 rounded-lg border border-white/50">
                        <div>🌸 <strong>Putrajaya:</strong> European Classical Theme</div>
                        <div>🌿 <strong>Johor:</strong> Rocco Garden Theme</div>
                      </div>
                    </div>

                    <div className="bg-white/50 backdrop-blur-md p-2.5 rounded-xl border border-white/60 shadow-sm space-y-1">
                      <div className="font-bold text-[#332524] flex items-center gap-1.5">
                        <span>🧺</span> Picnic Setup & Best Setup Award
                      </div>
                      <p className="text-[#523A36] leading-relaxed font-medium">
                        Bring your favorite picnic mat, cushions, and cute decorations to create a cozy spot. Feel free to use your creativity—the best setup will win a special prize! 🏆
                      </p>
                    </div>

                    <div className="bg-white/60 backdrop-blur-md p-3 rounded-xl border border-white/70 shadow-sm space-y-1.5">
                      <div className="font-bold text-[#8C5247] flex items-center gap-1.5 text-[11.5px]">
                        <span>🏆</span> 3 Prize Categories
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-[#523A36] text-[10.5px]">
                        <div className="flex items-center gap-1.5 bg-white/75 p-1.5 rounded-lg border border-white/60 shadow-xs">
                          <span>👗</span> <span><strong>1. Best Outfit Award:</strong> Prettiest picnic outfit</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/75 p-1.5 rounded-lg border border-white/60 shadow-xs">
                          <span>🎂</span> <span><strong>2. Prettiest Cake Award:</strong> Most beautiful cake decoration</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/75 p-1.5 rounded-lg border border-white/60 shadow-xs">
                          <span>🧺</span> <span><strong>3. Cutest Picnic Setup Award:</strong> Most creative and cozy picnic spot</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: RAIN PLAN & TICKET POLICY */}
              {activeGuidelineTab === 'policy' && (
                <div className="space-y-2.5 text-xs animate-fadeIn">
                  <div className="border-b border-[#332524]/15 pb-2">
                    <h3 className="font-serif text-base font-bold text-[#332524] flex items-center gap-1.5">
                      <span>☔</span> Weather Plan & Ticket Policy
                    </h3>
                  </div>

                  <div className="space-y-2 text-[10.5px] text-[#332524]">
                    <div className="bg-white/50 backdrop-blur-md p-2.5 rounded-xl border border-white/60 shadow-sm space-y-1">
                      <div className="font-bold text-[#332524] flex items-center gap-1.5">
                        <span>☔</span> Weather Plan
                      </div>
                      <p className="text-[#523A36] leading-relaxed font-medium">
                        In case of light rain, activities will pause until the weather clears so we can safely resume our fun together!
                      </p>
                    </div>

                    <div className="bg-white/50 backdrop-blur-md p-2.5 rounded-xl border border-white/60 shadow-sm space-y-1">
                      <div className="font-bold text-[#332524] flex items-center gap-1.5">
                        <span>🌧️</span> Refund & Cancellation Policy
                      </div>
                      <p className="text-[#523A36] leading-relaxed font-medium">
                        If heavy rain continues throughout the event, tickets remain non-refundable as venue permits, table setups, custom decor, and goodie bags are prepared in advance. Thank you so much for your kind understanding and warm support!
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* BOTTOM RIBBON NOTE INSIDE TALL 9:17 FRAME */}
            <div className="shrink-0 pt-1 text-center">
              <div className="bg-white/25 backdrop-blur-md px-3.5 py-1.5 rounded-full text-[10.5px] text-white font-sans font-medium border border-white/40 inline-flex items-center gap-1.5 shadow-sm">
                <Sparkles size={12} className="text-[#FFF5ED]" />
                <span>See you at Cakenic! • 4:00 PM to 7:00 PM</span>
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
                After checkout, you will receive a CHIP confirmation email with your Order No. Simply present your details or Order No. during event registration to collect your colored entry wristband!
              </p>
            </div>

            <div className="bg-[#E09990]/95 hover:bg-[#D8887E] rounded-2xl p-3.5 sm:p-4 text-white shadow-md border border-white/40 space-y-1 transition-all duration-300">
              <h4 className="font-serif font-semibold text-white text-sm sm:text-base flex items-center gap-1.5">
                <span>🌸</span>
                <span>Can I bring non-ticketed friends or kids?</span>
              </h4>
              <p className="text-white/95 text-xs pl-5 leading-snug">
                Only participants with a valid ticket can enter the designated Cakenic zone area (ages 12+). Non-ticketed friends or family members are welcome to enjoy the surrounding public park area, but only ticket holders can enter the Cakenic picnic zone.
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
                In case of rain, we will pause temporarily until the weather clears, then resume our outdoor fun!
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* --- BEAUTIFUL E-TICKET LOOKUP SECTION (AFTER FAQ) --- */}
      <section id="lookup-ticket" className="py-12 px-4 max-w-xl mx-auto w-full relative z-20">
        <div className="bg-[#FBF6F1] border border-[#332524]/15 rounded-[32px] p-6 sm:p-8 shadow-[0_16px_40px_rgba(150,110,100,0.15)] text-[#332524] relative overflow-hidden">
          
          <div className="text-center space-y-1.5 mb-6">
            <div className="inline-flex items-center gap-1.5 bg-[#E3A099]/15 text-[#E3A099] border border-[#E3A099]/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]">
              <Ticket size={13} />
              <span>E-Pass Retrieval</span>
            </div>

            <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-[#332524]">
              Access Your E-Ticket
            </h3>

            <p className="text-xs text-[#6B5450] max-w-sm mx-auto leading-relaxed">
              Already reserved your Cakenic ticket? Enter your Email or Phone number below to view and print your ticket details.
            </p>
          </div>

          <form onSubmit={handleLookupTicket} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#332524]/80 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B5450]" />
                  <input
                    type="email"
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#332524]/15 rounded-xl text-xs text-[#332524] placeholder-[#332524]/40 focus:outline-none focus:border-[#E3A099] focus:ring-2 focus:ring-[#E3A099]/20 transition-all shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#332524]/80 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B5450]" />
                  <input
                    type="tel"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    placeholder="e.g. 0123456789"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#332524]/15 rounded-xl text-xs text-[#332524] placeholder-[#332524]/40 focus:outline-none focus:border-[#E3A099] focus:ring-2 focus:ring-[#E3A099]/20 transition-all shadow-sm"
                  />
                </div>
              </div>
            </div>

            {lookupError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">{lookupError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSearchingTicket}
              className="w-full bg-[#E3A099] hover:bg-[#d99088] text-white py-3.5 px-6 rounded-full font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-[0_6px_20px_rgba(227,160,153,0.35)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSearchingTicket ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Searching E-Pass Database...</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>Find My Ticket</span>
                </>
              )}
            </button>
          </form>

          {/* List of found orders */}
          {foundOrders.length > 0 && (
            <div className="mt-5 pt-5 border-t border-dashed border-[#332524]/15 space-y-2.5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#332524] text-center">
                Found {foundOrders.length} Ticket Record(s):
              </h4>
              <div className="space-y-2">
                {foundOrders.map(ord => (
                  <div 
                    key={ord.id}
                    onClick={() => {
                      setSelectedOrderForView(ord);
                      setShowTicketModal(true);
                    }}
                    className="bg-white border border-[#332524]/15 hover:border-[#E3A099] rounded-2xl p-3.5 cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#332524]">Order #{ord.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          ord.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ord.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B5450] mt-0.5 font-medium">
                        {ord.items[0]?.name?.replace('TICKET: ', '')} • {ord.customerName}
                      </p>
                    </div>

                    <button className="bg-[#E3A099]/15 text-[#E3A099] font-bold text-[11px] px-3 py-1 rounded-full hover:bg-[#E3A099] hover:text-white transition-colors">
                      View E-Pass
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3.5 text-center">
            <p className="text-[10px] text-[#6B5450]/80 italic">
              📩 Note: An official receipt email containing your Order No. is sent via CHIP after payment.
            </p>
          </div>
        </div>
      </section>

      {/* --- DIRECT EMBEDDED PAYMENT CHECKOUT MODAL --- */}
      {showCheckoutModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#FBF6F1] rounded-[36px] max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_24px_60px_rgba(150,110,100,0.25)] border border-[#332524]/10 p-7 md:p-9 relative text-[#332524]">
            
            <button 
              onClick={() => setShowCheckoutModal(false)}
              className="absolute top-6 right-6 text-[#6B5450] hover:text-[#332524] bg-[#F1E8E2] hover:bg-[#e8ddd5] w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-[11px] text-[#E3A099] font-bold uppercase tracking-[0.2em] mb-2">
              <Ticket size={16} />
              <span>Ticket Reservation</span>
            </div>

            <h3 className="font-display font-black text-2xl sm:text-3xl text-[#332524] tracking-[0.12em] uppercase mb-1">
              {selectedTicket.location}
            </h3>
            <p className="text-xs text-[#6B5450] mb-6 font-medium">{selectedTicket.date} • {selectedTicket.venue}</p>

            {/* Price Summary */}
            <div className="bg-white/80 border border-[#332524]/10 p-5 rounded-[24px] mb-6 space-y-3.5 shadow-sm text-xs sm:text-sm">
              <div className="flex justify-between items-center">
                <span className="font-medium text-[#6B5450]">Ticket Rate:</span>
                <span className="font-bold text-[#332524]">RM {selectedTicket.price} / person</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium text-[#6B5450]">Tickets Remaining:</span>
                {selectedTicket.availableSlots <= 0 ? (
                  <span className="font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1 border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>Sold Out</span>
                  </span>
                ) : (
                  <span className="font-bold text-[#8C5247] bg-[#8C5247]/10 px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1 border border-[#8C5247]/15">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E3A099] animate-pulse" />
                    <span>{selectedTicket.availableSlots} left</span>
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium text-[#6B5450]">Number of Passes:</span>
                <div className="flex items-center gap-3 bg-[#FBF6F1] border border-[#332524]/10 px-4 py-1.5 rounded-full">
                  <button 
                    type="button" 
                    onClick={() => setTicketQuantity(Math.max(1, ticketQuantity - 1))}
                    className="font-bold px-1 text-[#E3A099] hover:text-[#332524] transition-colors"
                  >
                    -
                  </button>
                  <span className="font-bold text-[#332524]">{ticketQuantity}</span>
                  <button 
                    type="button" 
                    onClick={() => setTicketQuantity(Math.min(selectedTicket.availableSlots || 99, ticketQuantity + 1))}
                    className="font-bold px-1 text-[#E3A099] hover:text-[#332524] transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-[#332524]/10 flex justify-between items-center text-sm font-bold text-[#E3A099]">
                <span>Total Amount:</span>
                <span className="font-serif text-2xl font-bold text-[#E3A099]">RM {selectedTicket.price * ticketQuantity}</span>
              </div>
            </div>

            {/* Registration Form */}
            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-sans text-[11px] uppercase tracking-wider font-bold text-[#332524]/80 mb-1.5">Full Name *</label>
                <input 
                  type="text" 
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Siti Sarah"
                  className="w-full px-5 py-3 bg-white border border-[#332524]/15 rounded-full text-xs sm:text-sm text-[#332524] placeholder-[#332524]/40 focus:outline-none focus:border-[#E3A099] focus:ring-2 focus:ring-[#E3A099]/20 shadow-sm transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-sans text-[11px] uppercase tracking-wider font-bold text-[#332524]/80 mb-1.5">Email *</label>
                  <input 
                    type="email" 
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    className="w-full px-5 py-3 bg-white border border-[#332524]/15 rounded-full text-xs sm:text-sm text-[#332524] placeholder-[#332524]/40 focus:outline-none focus:border-[#E3A099] focus:ring-2 focus:ring-[#E3A099]/20 shadow-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block font-sans text-[11px] uppercase tracking-wider font-bold text-[#332524]/80 mb-1.5">Phone (WhatsApp) *</label>
                  <input 
                    type="tel" 
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+60123456789"
                    className="w-full px-5 py-3 bg-white border border-[#332524]/15 rounded-full text-xs sm:text-sm text-[#332524] placeholder-[#332524]/40 focus:outline-none focus:border-[#E3A099] focus:ring-2 focus:ring-[#E3A099]/20 shadow-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block font-sans text-[11px] uppercase tracking-wider font-bold text-[#332524]/80 mb-1.5">Instagram Handle (Optional)</label>
                <input 
                  type="text" 
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  placeholder="@yourhandle (Optional)"
                  className="w-full px-5 py-3 bg-white border border-[#332524]/15 rounded-full text-xs sm:text-sm text-[#332524] placeholder-[#332524]/40 focus:outline-none focus:border-[#E3A099] focus:ring-2 focus:ring-[#E3A099]/20 shadow-sm transition-all"
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

              {/* Order Receipt / Order No Info Box */}
              <div className="bg-[#E3A099]/10 border border-[#E3A099]/30 rounded-2xl p-3 text.xs text-[#6B5450] flex items-start gap-2.5">
                <Mail size={16} className="text-[#E3A099] shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="text-[#332524] font-bold block mb-0.5">CHIP Receipt & Order No. Notice:</strong>
                  After completing payment, you will receive a CHIP receipt email containing your unique <strong>Order No.</strong> Keep this Order No. to view your E-Pass ticket anytime on our site!
                </div>
              </div>

              <div className="pt-3 space-y-2.5">
                <button
                  type="submit"
                  disabled={isProcessing || selectedTicket.availableSlots <= 0}
                  className="w-full bg-[#E3A099] hover:bg-[#d99088] text-white py-4 px-6 rounded-full font-bold text-xs sm:text-sm tracking-widest uppercase transition-all duration-300 shadow-[0_8px_24px_rgba(227,160,153,0.35)] flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Connecting CHIP Payment Gateway...</span>
                    </>
                  ) : selectedTicket.availableSlots <= 0 ? (
                    <span>Sold Out</span>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Proceed to Payment</span>
                    </>
                  )}
                </button>

                <p className="text-center text-[10px] sm:text-[11px] text-[#6B5450] font-bold uppercase tracking-widest opacity-70">
                  secure payment powered by CHIP
                </p>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* --- E-TICKET VIEW MODAL OVERLAY --- */}
      {showTicketModal && selectedOrderForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="my-auto max-w-xl w-full relative">
            <CakenicTicketView 
              order={selectedOrderForView} 
              onClose={() => setShowTicketModal(false)} 
            />
          </div>
        </div>
      )}

    </div>
  );
};
