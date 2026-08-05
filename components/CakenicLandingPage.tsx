import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Play, Pause, Volume2, VolumeX, Calendar, Clock, MapPin, Sparkles, 
  Check, Ticket, ChevronDown, ShieldCheck, Heart, ArrowRight, X, 
  Coffee, Music, Camera, Gift, AlertCircle, Loader2, Info, Share2, Copy
} from 'lucide-react';
import { CartItem, Product } from '../types';
import { createOrderInDb } from '../firebase';
import { getAttribution } from '../analytics';

interface CakenicLandingPageProps {
  onAddToCart?: (product: Product, quantity: number) => void;
  products?: Product[];
}

export interface CakenicTicketPackage {
  id: string;
  name: string;
  tagline: string;
  price: number;
  originalPrice?: number;
  badge?: string;
  popular?: boolean;
  image: string;
  inclusions: string[];
  availableSlots: number;
}

const DEFAULT_TICKETS: CakenicTicketPackage[] = [
  {
    id: 'cakenic-ticket-solo',
    name: 'Solo Sweet Pass',
    tagline: 'Single Admission + Signature Cake Tasting Box',
    price: 88,
    originalPrice: 108,
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
    inclusions: [
      '1x Event Entry Ticket',
      '1x Artisanal Cake Tasting Box (3 Flavors)',
      'Unlimited Specialty Tea & Lemonade',
      'Aesthetic Photo Session Access',
      'Exclusive Cakenic Door Gift'
    ],
    availableSlots: 24
  },
  {
    id: 'cakenic-ticket-duo',
    name: 'Picnic Duo Pass',
    tagline: '2x Admissions + Full Picnic Set for Two',
    price: 168,
    originalPrice: 198,
    badge: 'Most Popular',
    popular: true,
    image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80',
    inclusions: [
      '2x Event Entry Tickets',
      '2x Artisanal Cake Boxes',
      '1x Gourmet Savory Picnic Platter',
      'Complimentary Picnic Blanket Rental',
      'DIY Cake Decorating Kit for 2',
      '2x Deluxe Cakenic Door Gifts'
    ],
    availableSlots: 15
  },
  {
    id: 'cakenic-ticket-vip',
    name: 'VIP Blanket & Cake Bundle',
    tagline: '2x Admissions + Take-Home Once Upon Blanket',
    price: 288,
    originalPrice: 348,
    badge: 'Limited VIP Edition',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    inclusions: [
      '2x VIP Event Entry Tickets',
      '1x Signature Once Upon Organic Blanket (Keep forever!)',
      '2x Premium Artisanal Cake Boxes',
      '1x Deluxe Charcuterie & Sparkling Drinks Set',
      'Reserved Front-Row Picnic Spot',
      'VIP Door Gift Set + Photo Prints'
    ],
    availableSlots: 8
  }
];

const SCHEDULE_ITEMS = [
  { time: '03:00 PM', title: 'Welcome & Afternoon Tea', desc: 'Step into our magical garden setup, receive your door gift and custom tea infusion.' },
  { time: '03:45 PM', title: 'Artisanal Cake Tasting', desc: 'Sample our seasonal cake collection paired with curated botanical drinks.' },
  { time: '04:30 PM', title: 'DIY Mini Cake Workshop', desc: 'Decorate your own miniature cake guided by master pastry chef.' },
  { time: '05:30 PM', title: 'Live Acoustic Session', desc: 'Relax on cozy blankets as sunset melodies fill the picnic grounds.' },
  { time: '06:30 PM', title: 'Photo Keepsakes & Farewell', desc: 'Collect instant polaroid prints and golden hour souvenir gift bags.' },
];

const FAQS = [
  {
    q: "Can payment be completed directly on this page?",
    a: "Yes! Clicking 'Book Ticket Now' opens our instant embedded checkout powered by CHIP payment gateway. You can securely pay via FPX Online Banking, Credit/Debit Card, or E-Wallets without navigating away."
  },
  {
    q: "Can I replace the hero video with my own video file?",
    a: "Absolutely. You can link any high-definition MP4 file or video URL. We provide easy configuration inputs and guide asset requirements."
  },
  {
    q: "What is the recommended dress code?",
    a: "We recommend vintage picnic chic, pastel tones, floral dresses, soft linen, or earthy neutrals to match our dreamscape aesthetic!"
  },
  {
    q: "What if the weather is rainy on event day?",
    a: "We have an equally enchanting indoor glasshouse venue option on stand-by at the same location to ensure a seamless experience regardless of rain!"
  },
  {
    q: "Are tickets refundable or transferable?",
    a: "Tickets are non-refundable but 100% transferable. You may pass your ticket confirmation QR/code to a friend if you cannot attend."
  }
];

export const CakenicLandingPage: React.FC<CakenicLandingPageProps> = ({ onAddToCart, products }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Video control states
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  // Custom Video URL state (Defaults to atmospheric picnic video, can be swapped easily)
  const [heroVideoUrl, setHeroVideoUrl] = useState(
    'https://assets.mixkit.co/videos/preview/mixkit-picnic-in-a-park-on-a-sunny-day-43288-large.mp4'
  );
  const [showVideoConfig, setShowVideoConfig] = useState(false);
  const [customInputVideo, setCustomInputVideo] = useState('');

  // Selected Ticket & Checkout Modal State
  const [selectedTicket, setSelectedTicket] = useState<CakenicTicketPackage | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // Embedded Payment Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Auto handle video playback
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => setIsPlaying(false));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, heroVideoUrl]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleOpenCheckout = (ticket: CakenicTicketPackage) => {
    setSelectedTicket(ticket);
    setTicketQuantity(1);
    setCheckoutError('');
    setShowCheckoutModal(true);
  };

  const handleApplyCustomVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInputVideo.trim()) {
      setHeroVideoUrl(customInputVideo.trim());
      setIsPlaying(true);
      setShowVideoConfig(false);
    }
  };

  // Direct Embedded Payment Gateway Handler (CHIP Integration)
  const handleEmbeddedPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (!customerName || !customerEmail || !customerPhone) {
      setCheckoutError('Please enter your full name, email address, and phone number.');
      return;
    }

    setIsProcessing(true);
    setCheckoutError('');

    const env = (import.meta as any).env;
    const brandId = env.VITE_CHIP_ID || env.CHIP_ID;
    const apiKey = env.VITE_CHIP_API || env.CHIP_API;

    // Construct Cart Item representation for Database & Payment Gateway
    const ticketCartItem: CartItem = {
      id: selectedTicket.id,
      name: `CAKENIC TICKET: ${selectedTicket.name}`,
      price: selectedTicket.price,
      quantity: ticketQuantity,
      description: `${selectedTicket.tagline} | Customer: ${customerName}`,
      image: selectedTicket.image,
      category: 'Event Ticket',
      collection: 'Cakenic 2026'
    };

    const totalAmount = selectedTicket.price * ticketQuantity;

    try {
      const attribution = getAttribution();

      // 1. Record Order in Firebase
      const orderRef = await createOrderInDb({
        customerName: customerName,
        customerEmail: customerEmail,
        customerPhone: customerPhone,
        items: [ticketCartItem],
        total: totalAmount,
        status: 'pending',
        date: new Date().toISOString(),
        shippingAddress: `CAKENIC EVENT TICKET E-DELIVERY (No physical shipping) | Dietary: ${dietaryNotes || 'None'}`,
        adminNotes: `CAKENIC EVENT TICKET ORDER. Quantity: ${ticketQuantity}. Dietary Notes: ${dietaryNotes || 'N/A'}`,
        utm_source: 'cakenic_landing_page',
        utm_medium: attribution.first_utm_medium || 'direct',
        utm_campaign: 'cakenic_event_2026'
      });

      // 2. Prepare CHIP Payment Gateway Payload if keys exist
      if (brandId && apiKey) {
        const payload = {
          brand_id: brandId,
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

        const response = await fetch('/api/chip/purchases/', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        let data;
        try { data = await response.json(); } catch (err) { throw new Error('Payment gateway response invalid.'); }

        if (!response.ok) {
          throw new Error(data.message || 'Payment initialization failed.');
        }

        if (data.checkout_url) {
          window.location.href = data.checkout_url;
          return;
        }
      }

      // Fallback if CHIP environment keys are not configured in dev environment:
      alert(`[Demo Mode] Order #${orderRef.id} created successfully! Payment gateway redirect initiated.`);
      setShowCheckoutModal(false);
      setIsProcessing(false);
      navigate(`/payment/callback?result=success&order=${orderRef.id}`);

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
    <div className="min-h-screen bg-[#FAF7F2] text-[#4A3E3D] selection:bg-[#E8A29A]/30 selection:text-[#4A3E3D] font-sans">
      
      {/* --- HERO VIDEO SECTION WITH ATMOSPHERIC SCROLL --- */}
      <section className="relative h-screen min-h-[650px] w-full flex items-center justify-center overflow-hidden">
        
        {/* Background Video Player */}
        <div className="absolute inset-0 z-0 bg-black">
          <video
            ref={videoRef}
            src={heroVideoUrl}
            className="w-full h-full object-cover opacity-80 transition-opacity duration-1000 scale-105"
            autoPlay
            loop
            muted={isMuted}
            playsInline
          />
          {/* Subtle Aesthetic Overlay Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#FAF7F2] via-black/40 to-black/60 z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-10" />
        </div>

        {/* Top Floating Bar */}
        <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center max-w-7xl mx-auto">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs md:text-sm font-medium px-4 py-2 rounded-full border border-white/30 transition-all shadow-sm"
          >
            ← Main Store
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVideoConfig(!showVideoConfig)}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full border border-white/30 transition-all flex items-center gap-1.5"
              title="Configure Hero Video Asset"
            >
              <Camera size={13} />
              <span>Change Video Asset</span>
            </button>
            <button
              onClick={toggleMute}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-2 rounded-full border border-white/30 transition-all"
              aria-label={isMuted ? "Unmute sound" : "Mute sound"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              onClick={togglePlay}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-2 rounded-full border border-white/30 transition-all"
              aria-label={isPlaying ? "Pause video" : "Play video"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
          </div>
        </div>

        {/* Hero Video Asset Changer Drawer */}
        {showVideoConfig && (
          <div className="absolute top-20 right-6 z-30 w-80 md:w-96 bg-white/95 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-white/60 text-xs animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-serif text-sm font-semibold text-[#4A3E3D] flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#E8A29A]" />
                Video Asset Settings
              </h4>
              <button onClick={() => setShowVideoConfig(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <p className="text-gray-600 mb-3 leading-relaxed">
              Paste your direct MP4 video link below to preview your exact custom hero footage live on this page!
            </p>
            <form onSubmit={handleApplyCustomVideo} className="space-y-2">
              <input 
                type="url" 
                value={customInputVideo}
                onChange={(e) => setCustomInputVideo(e.target.value)}
                placeholder="https://yourdomain.com/cakenic-hero.mp4"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8A29A]"
              />
              <button 
                type="submit"
                className="w-full bg-[#4A3E3D] text-white py-2 rounded-lg font-medium hover:bg-[#382F2E] transition-colors"
              >
                Apply Video Link
              </button>
            </form>
          </div>
        )}

        {/* Hero Center Content */}
        <div className="relative z-20 text-center text-white px-4 max-w-4xl mx-auto flex flex-col items-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/30 mb-6 tracking-widest text-xs uppercase text-white/90">
            <Sparkles size={13} className="text-[#F2C4CE]" />
            <span>Once Upon Presents • Annual Garden Soirée</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[1.05] mb-6 font-normal drop-shadow-md">
            Once Upon A <span className="italic font-light text-[#F7D6DB]">Cakenic</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-white/90 max-w-2xl font-light mb-8 leading-relaxed">
            An enchanting afternoon of boutique cake tastings, cozy vintage blankets, organic tea elixirs, and sunset acoustic sounds.
          </p>

          {/* Quick Details Pill */}
          <div className="flex flex-wrap justify-center gap-4 text-xs sm:text-sm text-white/90 bg-black/30 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 mb-8">
            <span className="flex items-center gap-1.5">
              <Calendar size={15} className="text-[#E8A29A]" />
              Saturday, September 19, 2026
            </span>
            <span className="hidden sm:inline text-white/40">•</span>
            <span className="flex items-center gap-1.5">
              <Clock size={15} className="text-[#E8A29A]" />
              3:00 PM – 7:00 PM
            </span>
            <span className="hidden sm:inline text-white/40">•</span>
            <span className="flex items-center gap-1.5">
              <MapPin size={15} className="text-[#E8A29A]" />
              The Glasshouse Garden, KL
            </span>
          </div>

          {/* Primary Action Button */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <a 
              href="#tickets"
              className="bg-[#E8A29A] hover:bg-[#df9088] text-white px-8 py-4 rounded-full font-medium shadow-xl hover:shadow-2xl transition-all flex items-center gap-2 group transform hover:-translate-y-0.5"
            >
              <Ticket size={18} />
              <span>Purchase Event Pass</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>

            <button 
              onClick={copyPageLink}
              className="bg-white/10 hover:bg-white/20 text-white px-5 py-4 rounded-full font-medium border border-white/30 backdrop-blur-md transition-all flex items-center gap-2 text-xs sm:text-sm"
            >
              <Share2 size={16} />
              <span>{copiedLink ? 'Link Copied!' : 'Share Event'}</span>
            </button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <a 
          href="#experience"
          className="absolute bottom-6 z-20 text-white/70 hover:text-white flex flex-col items-center gap-1 transition-colors group"
        >
          <span className="text-[10px] uppercase tracking-widest font-medium">Discover More</span>
          <ChevronDown size={18} className="animate-bounce text-[#E8A29A]" />
        </a>
      </section>

      {/* --- EVENT CONCEPT & STORY SECTION --- */}
      <section id="experience" className="py-20 md:py-32 px-6 relative max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#9C7561] font-medium">
              <Coffee size={14} />
              <span>The Afternoon Experience</span>
            </div>

            <h2 className="font-serif text-3xl md:text-5xl font-normal leading-tight">
              A whimsical garden picnic, crafted for lovers of cake & dreamy aesthetics.
            </h2>

            <p className="text-gray-600 leading-relaxed">
              Step onto plush Once Upon signature blankets laid out under golden sunlit canopy. Enjoy a curated tasting journey of artisanal cakes baked by celebrated pastry artists, paired with iced botanical infusions and sparkling teas.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#E6D7C3]/60">
              <div className="space-y-1">
                <div className="font-serif text-2xl font-semibold text-[#9C7561]">5+</div>
                <div className="text-xs text-gray-500">Artisanal Cake Varieties</div>
              </div>
              <div className="space-y-1">
                <div className="font-serif text-2xl font-semibold text-[#9C7561]">100%</div>
                <div className="text-xs text-gray-500">Organic & Natural Ingredients</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
              <img 
                src="https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=1000&q=80" 
                alt="Cakenic Picnic Setting"
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
              />
            </div>
            
            {/* Floating Quote Card */}
            <div className="absolute -bottom-6 -left-6 bg-white p-5 rounded-2xl shadow-xl max-w-xs border border-[#FAF7F2] hidden sm:block">
              <div className="flex items-center gap-1 text-[#E8A29A] mb-2">
                <Sparkles size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">Dream Atmosphere</span>
              </div>
              <p className="text-xs text-gray-600 italic">
                "Where sweet indulgence meets sunset serenity and vintage elegance."
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* --- TICKET PACKAGES SECTION (EMBEDDED CHECKOUT ENABLED) --- */}
      <section id="tickets" className="py-20 md:py-28 px-6 bg-[#F4EDE2]/80 relative">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <span className="text-xs uppercase tracking-widest text-[#9C7561] font-semibold">Reserve Your Spot</span>
            <h2 className="font-serif text-3xl md:text-5xl font-normal">Choose Your Cakenic Pass</h2>
            <p className="text-sm md:text-base text-gray-600">
              Select your preferred ticket package below. All purchases are processed directly through our secure checkout with instant e-ticket confirmation.
            </p>
          </div>

          {/* Ticket Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {DEFAULT_TICKETS.map((ticket) => (
              <div 
                key={ticket.id}
                className={`bg-white rounded-3xl overflow-hidden border transition-all duration-300 flex flex-col relative shadow-md hover:shadow-xl ${
                  ticket.popular ? 'border-[#E8A29A] ring-2 ring-[#E8A29A]/30 scale-[1.02]' : 'border-gray-100'
                }`}
              >
                {ticket.badge && (
                  <div className="absolute top-4 right-4 z-10 bg-[#E8A29A] text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    {ticket.badge}
                  </div>
                )}

                <div className="h-48 overflow-hidden relative">
                  <img 
                    src={ticket.image} 
                    alt={ticket.name} 
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 text-white">
                    <span className="text-xs font-light text-white/80">Remaining Slots: {ticket.availableSlots}</span>
                  </div>
                </div>

                <div className="p-6 flex-grow flex flex-col justify-between space-y-6">
                  <div>
                    <h3 className="font-serif text-2xl font-semibold mb-1 text-[#4A3E3D]">{ticket.name}</h3>
                    <p className="text-xs text-gray-500 mb-4">{ticket.tagline}</p>

                    <div className="flex items-baseline gap-2 mb-6">
                      <span className="font-serif text-3xl font-bold text-[#9C7561]">RM {ticket.price}</span>
                      {ticket.originalPrice && (
                        <span className="text-sm text-gray-400 line-through">RM {ticket.originalPrice}</span>
                      )}
                      <span className="text-xs text-gray-500 ml-auto">per pass</span>
                    </div>

                    <div className="space-y-2.5">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-2">Package Inclusions:</span>
                      {ticket.inclusions.map((inc, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <Check size={14} className="text-[#A3B19B] shrink-0 mt-0.5" />
                          <span>{inc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-2">
                    {/* Primary Embedded Instant Purchase Button */}
                    <button
                      onClick={() => handleOpenCheckout(ticket)}
                      className="w-full bg-[#4A3E3D] hover:bg-[#2A2322] text-white py-3.5 rounded-2xl font-medium text-sm transition-colors shadow-md flex items-center justify-center gap-2"
                    >
                      <Ticket size={16} />
                      <span>Book Pass Now (Direct Checkout)</span>
                    </button>

                    {/* Optional Add to Shopping Cart Button */}
                    {onAddToCart && (
                      <button
                        onClick={() => {
                          onAddToCart({
                            id: ticket.id,
                            name: `CAKENIC TICKET: ${ticket.name}`,
                            price: ticket.price,
                            description: ticket.tagline,
                            image: ticket.image,
                            category: 'Event Ticket'
                          }, 1);
                          alert(`Added "${ticket.name}" to your shopping bag!`);
                        }}
                        className="w-full bg-white hover:bg-gray-50 text-[#4A3E3D] py-2 rounded-xl text-xs font-medium border border-gray-200 transition-colors"
                      >
                        Add to Store Bag
                      </button>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-[#E6D7C3] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#A3B19B]" />
              <span>Direct Checkout uses official CHIP Payment Gateway with instant SSL Encryption.</span>
            </div>
            <div className="flex items-center gap-4 text-gray-500">
              <span>💳 FPX Online Banking</span>
              <span>•</span>
              <span>Visa / Mastercard</span>
              <span>•</span>
              <span>E-Wallets</span>
            </div>
          </div>

        </div>
      </section>

      {/* --- EVENT SCHEDULE / AGENDA TIMELINE --- */}
      <section className="py-20 md:py-28 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-16 space-y-3">
          <span className="text-xs uppercase tracking-widest text-[#9C7561] font-semibold">Itinerary</span>
          <h2 className="font-serif text-3xl md:text-5xl font-normal">Event Afternoon Schedule</h2>
        </div>

        <div className="relative border-l-2 border-[#E8A29A]/40 pl-6 md:pl-8 space-y-10 ml-4 md:ml-12">
          {SCHEDULE_ITEMS.map((item, index) => (
            <div key={index} className="relative group">
              <div className="absolute -left-[31px] md:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-[#E8A29A] ring-4 ring-[#FAF7F2]" />
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <span className="inline-block text-xs font-bold text-[#9C7561] bg-[#FAF7F2] px-3 py-1 rounded-full mb-2">
                  {item.time}
                </span>
                <h3 className="font-serif text-xl font-semibold text-[#4A3E3D] mb-1">{item.title}</h3>
                <p className="text-xs md:text-sm text-gray-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section className="py-20 px-6 bg-white/80 border-t border-[#E6D7C3]/50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <span className="text-xs uppercase tracking-widest text-[#9C7561] font-semibold">Need Help?</span>
            <h2 className="font-serif text-3xl md:text-4xl">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index} 
                  className="border border-gray-200 rounded-2xl overflow-hidden transition-all bg-white"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full text-left p-5 flex justify-between items-center gap-4 font-serif text-base font-medium text-[#4A3E3D]"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown size={18} className={`transition-transform duration-300 text-[#9C7561] ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs md:text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* --- EMBEDDED DIRECT CHECKOUT MODAL --- */}
      {showCheckoutModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/40 p-6 md:p-8 relative">
            
            <button 
              onClick={() => setShowCheckoutModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-xs text-[#9C7561] font-bold uppercase tracking-wider mb-2">
              <Ticket size={14} />
              <span>Direct Event Checkout</span>
            </div>

            <h3 className="font-serif text-2xl font-semibold text-[#4A3E3D] mb-1">
              {selectedTicket.name}
            </h3>
            <p className="text-xs text-gray-500 mb-6">{selectedTicket.tagline}</p>

            {/* Ticket Order Summary */}
            <div className="bg-[#FAF7F2] p-4 rounded-2xl mb-6 space-y-3 text-xs border border-[#E6D7C3]/60">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">Ticket Price:</span>
                <span className="font-bold">RM {selectedTicket.price}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">Quantity:</span>
                <div className="flex items-center gap-3 bg-white px-3 py-1 rounded-xl border border-gray-200">
                  <button 
                    type="button" 
                    onClick={() => setTicketQuantity(Math.max(1, ticketQuantity - 1))}
                    className="font-bold px-1 hover:text-[#E8A29A]"
                  >
                    -
                  </button>
                  <span className="font-semibold">{ticketQuantity}</span>
                  <button 
                    type="button" 
                    onClick={() => setTicketQuantity(ticketQuantity + 1)}
                    className="font-bold px-1 hover:text-[#E8A29A]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm font-bold text-[#9C7561]">
                <span>Total Payable:</span>
                <span className="font-serif text-lg">RM {selectedTicket.price * ticketQuantity}</span>
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleEmbeddedPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
                <input 
                  type="text" 
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Amanda Lee"
                  className="w-full px-4 py-2.5 text-xs md:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E8A29A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                  <input 
                    type="email" 
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="amanda@example.com"
                    className="w-full px-4 py-2.5 text-xs md:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E8A29A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number (WhatsApp) *</label>
                  <input 
                    type="tel" 
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+60123456789"
                    className="w-full px-4 py-2.5 text-xs md:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E8A29A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Dietary Requirements / Special Notes</label>
                <input 
                  type="text" 
                  value={dietaryNotes}
                  onChange={(e) => setDietaryNotes(e.target.value)}
                  placeholder="e.g. Vegetarian, Nut Allergy, Gluten-Free"
                  className="w-full px-4 py-2.5 text-xs md:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E8A29A]"
                />
              </div>

              {checkoutError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-[#E8A29A] hover:bg-[#df9088] text-white py-3.5 rounded-2xl font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Connecting Payment Gateway...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Proceed to Payment (RM {selectedTicket.price * ticketQuantity})</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-center text-gray-400">
                Secured by CHIP Payment Gateway. Instant e-ticket delivery will be sent to your email.
              </p>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
