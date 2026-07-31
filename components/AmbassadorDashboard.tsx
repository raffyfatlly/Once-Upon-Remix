import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, Copy, Check, Sparkles, TrendingUp, 
  ShoppingBag, DollarSign, Users, Award, BookOpen, Download, 
  CheckCircle2, Share2, Instagram, MessageCircle, ExternalLink, 
  CreditCard, ArrowUpRight, ArrowRight, Store, Send, CheckCircle, Search, Filter,
  Layers, Package, RefreshCw, Heart, ShieldCheck, HelpCircle
} from 'lucide-react';
import { Ambassador, Order, Product } from '../types';
import { db, saveTrackedLinkInDb, updateAmbassadorInDb } from '../firebase';
import { collection, query, getDocs } from 'firebase/firestore';

interface AmbassadorDashboardProps {
  ambassador: Ambassador;
  products: Product[];
  orders: Order[];
  onLogout: () => void;
}

export const AmbassadorDashboard: React.FC<AmbassadorDashboardProps> = ({
  ambassador,
  products,
  orders,
  onLogout
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'performance' | 'links' | 'guidelines' | 'assets' | 'payout'>('performance');

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Link Builder State
  const [destinationType, setDestinationType] = useState<'homepage' | 'product'>('homepage');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [productCategoryFilter, setProductCategoryFilter] = useState<'all' | 'blanket' | 'swaddle' | 'other'>('all');
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);

  // Target Website Base URL (onceuponmy.com)
  const websiteDomain = 'https://onceuponmy.com';

  // Categorization Helper (Blanket vs Swaddle vs Other)
  const getProductCategoryType = (product: Product): 'blanket' | 'swaddle' | 'other' => {
    const cat = (product.category || product.collection || '').toLowerCase();
    const name = (product.name || '').toLowerCase();
    if (cat.includes('blanket') || name.includes('blanket') || cat.includes('quilt') || name.includes('quilt')) {
      return 'blanket';
    }
    if (cat.includes('swaddle') || name.includes('swaddle')) {
      return 'swaddle';
    }
    return 'other';
  };

  const getCategoryBadgeLabel = (product: Product) => {
    const type = getProductCategoryType(product);
    if (type === 'blanket') return '☁️ BLANKET';
    if (type === 'swaddle') return '🍼 SWADDLE';
    return '✨ APPAREL/OTHER';
  };

  // Bank payout states
  const [bankName, setBankName] = useState(ambassador.bankName || 'Maybank');
  const [accountNumber, setAccountNumber] = useState(ambassador.accountNumber || '');
  const [accountHolder, setAccountHolder] = useState(ambassador.accountHolder || ambassador.name);
  const [payoutSaved, setPayoutSaved] = useState(false);

  // Real-time Traffic Clicks & Analytics Events
  const [totalClicks, setTotalClicks] = useState<number>(0);

  // Referred Orders Filters (designed for non-tech users)
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderDateFilter, setOrderDateFilter] = useState<'all' | 'this_month' | 'last_28_days' | 'last_30_days'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'paid'>('all');
  const [visibleOrderLimit, setVisibleOrderLimit] = useState(10);

  // Calculate Ambassador's Clean Campaign Handles & Tags
  const cleanHandle = (ambassador.campaignCode || ambassador.name || '')
    .toLowerCase()
    .replace(/^amb[-_]?/i, '')
    .replace(/[^a-z0-9]/g, '');
  const rawCode = cleanHandle;
  const campaignTag = `amb-${cleanHandle}`;
  const commissionRate = ambassador.commissionRate || 10; // Default 10%

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getBaseUrl = () => window.location.origin;

  // Fetch real analytics clicks from Firestore matching this ambassador's campaign or source
  useEffect(() => {
    if (!db) return;

    const fetchAnalytics = async () => {
      try {
        const q = query(collection(db, 'analytics_events'));
        const snap = await getDocs(q);
        let clicks = 0;
        const uniqueVisitors = new Set<string>();

        snap.docs.forEach(docSnap => {
          const data = docSnap.data();

          const camp = String(data.current_utm_campaign || data.first_utm_campaign || data.campaign || data.utm_campaign || '').toLowerCase();
          const src = String(data.current_utm_source || data.first_utm_source || data.source || data.utm_source || '').toLowerCase();
          const sc = String(data.shortCode || '').toLowerCase();
          const dest = String(data.destinationUrl || data.url || '').toLowerCase();

          const cleanRaw = rawCode.toLowerCase();
          const cleanCamp = campaignTag.toLowerCase();

          const isMatch = cleanRaw.length >= 2 && (
            camp === cleanCamp ||
            camp === cleanRaw ||
            camp.includes(`amb-${cleanRaw}`) ||
            camp.includes(cleanRaw) ||
            sc === cleanRaw ||
            sc === cleanCamp ||
            sc.includes(cleanRaw) ||
            dest.includes(`utm_campaign=${cleanCamp}`) ||
            dest.includes(`utm_campaign=${cleanRaw}`) ||
            dest.includes(`/l/${cleanRaw}`) ||
            dest.includes(cleanRaw)
          );

          if (isMatch) {
            clicks++;
            if (data.visitorId) {
              uniqueVisitors.add(data.visitorId);
            }
          }
        });

        // Use maximum of unique visitors or click events count so non-zero clicks show immediately
        setTotalClicks(Math.max(uniqueVisitors.size, clicks));
      } catch (err) {
        console.warn("Analytics fetch error for ambassador:", err);
        setTotalClicks(0);
      }
    };

    fetchAnalytics();
  }, [campaignTag, rawCode, ambassador.joinedDate]);

  // Filter Referred Orders linked to this ambassador
  const allReferredOrders = orders.filter(order => {
    if (order.status === 'cancelled' || order.status === 'failed') return false;

    const adminNotes = (order.adminNotes || '').toLowerCase();
    const promo = (order.promoCode || order.discountCode || '').toLowerCase();

    // Match strictly on promo code or admin notes tag (never match on customer name or order JSON stringify)
    return (
      promo === campaignTag ||
      promo === rawCode ||
      promo === `amb-${rawCode}` ||
      adminNotes.includes(campaignTag) ||
      (adminNotes.includes('ambassador') && rawCode.length > 2 && adminNotes.includes(rawCode))
    );
  });

  // Process 28-day confirmation logic for referred orders
  const now = new Date();
  const TWENTY_EIGHT_DAYS_MS = 28 * 24 * 60 * 60 * 1000;

  const processedReferredOrders = allReferredOrders.map(order => {
    const orderDate = new Date(order.date);
    const ageMs = now.getTime() - orderDate.getTime();
    const isConfirmed = ageMs >= TWENTY_EIGHT_DAYS_MS;
    const daysRemaining = isConfirmed ? 0 : Math.max(1, Math.ceil((TWENTY_EIGHT_DAYS_MS - ageMs) / (24 * 60 * 60 * 1000)));
    const comm = ((order.total || 0) * commissionRate) / 100;

    // Detect channel/source
    const notes = (order.adminNotes || '').toLowerCase();
    const promo = (order.promoCode || order.discountCode || '').toLowerCase();
    let channel = 'Direct Link';
    if (notes.includes('-ig') || notes.includes('instagram')) channel = 'Instagram';
    else if (notes.includes('-tt') || notes.includes('tiktok')) channel = 'TikTok';
    else if (notes.includes('-th') || notes.includes('threads')) channel = 'Threads';
    else if (promo) channel = `Code: ${promo.toUpperCase()}`;

    return {
      ...order,
      commissionAmount: comm,
      isConfirmed,
      daysRemaining,
      channel
    };
  });

  // Apply User-Friendly Anonymized Filters
  const filteredReferredOrders = processedReferredOrders.filter(order => {
    // 1. Search term (order id, date, channel)
    if (orderSearchTerm.trim()) {
      const term = orderSearchTerm.toLowerCase();
      const idMatch = (order.id || '').toLowerCase().includes(term);
      const channelMatch = (order.channel || '').toLowerCase().includes(term);
      const dateMatch = new Date(order.date).toLocaleDateString().toLowerCase().includes(term);
      if (!idMatch && !channelMatch && !dateMatch) return false;
    }

    // 2. Status Filter
    if (orderStatusFilter === 'confirmed') {
      if (!order.isConfirmed) return false;
    } else if (orderStatusFilter === 'pending') {
      if (order.isConfirmed) return false;
    }

    // 3. Date Filter
    if (orderDateFilter !== 'all') {
      const orderDate = new Date(order.date);
      if (orderDateFilter === 'this_month') {
        if (orderDate.getMonth() !== now.getMonth() || orderDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (orderDateFilter === 'last_28_days') {
        const twentyEightDaysAgo = new Date();
        twentyEightDaysAgo.setDate(now.getDate() - 28);
        if (orderDate < twentyEightDaysAgo) return false;
      }
    }

    return true;
  });

  // Calculate Commission Totals
  const totalSalesRevenue = processedReferredOrders.reduce((sum, o) => {
    if (o.status !== 'cancelled' && o.status !== 'failed') return sum + (o.total || 0);
    return sum;
  }, 0);

  const totalCommission = (totalSalesRevenue * commissionRate) / 100;

  const confirmedCommission = processedReferredOrders.reduce((sum, o) => {
    if (o.isConfirmed && o.status !== 'cancelled' && o.status !== 'failed') {
      return sum + o.commissionAmount;
    }
    return sum;
  }, 0);

  const pendingCommission = totalCommission - confirmedCommission;
  const paidCommission = ambassador.paidCommission || 0;
  const duePayoutBalance = Math.max(0, confirmedCommission - paidCommission);

  const conversionRate = totalClicks > 0 ? ((allReferredOrders.length / totalClicks) * 100).toFixed(1) : '0.0';

  // Helper for Link Copying & Realtime Firestore Registration
  const handleCopyLink = async (targetUrl: string, channelName: string, destLabel: string, key: string) => {
    navigator.clipboard.writeText(targetUrl);
    setCopiedLinkKey(key);
    showToast(`Copied tracking link!`);
    setTimeout(() => setCopiedLinkKey(null), 2500);

    // Save to Firestore so Admin sees activated link in LinkManager
    await saveTrackedLinkInDb({
      destinationName: destLabel,
      originalUrl: targetUrl,
      shortUrl: '',
      source: 'ambassador',
      medium: channelName.toLowerCase(),
      campaign: campaignTag,
      shortCode: '',
      ambassadorId: ambassador.id,
      ambassadorName: ambassador.name
    });
  };

  // Save Bank Account Details & Sync to Firestore
  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (ambassador.id) {
        await updateAmbassadorInDb(ambassador.id, {
          bankName,
          accountNumber,
          accountHolder
        });
      }
      setPayoutSaved(true);
      showToast("Bank payout account saved and synced with Admin!");
      setTimeout(() => setPayoutSaved(false), 2500);
    } catch (err) {
      console.error("Error saving bank details:", err);
      showToast("Failed to save bank details. Please check internet connection.");
    }
  };

  // Single Universal Ambassador Link Generator (Store Homepage)
  const getSingleReferralLink = () => {
    const path = '/';
    const destLabel = 'Website Homepage (onceuponmy.com)';
    const targetUrl = `${websiteDomain}${path}?utm_source=ambassador&utm_campaign=${campaignTag}`;
    const shortUrl = `${websiteDomain}/l/${rawCode}`;

    return {
      targetUrl,
      shortUrl,
      destLabel
    };
  };

  const mainLink = getSingleReferralLink();

  // Auto-register ambassador's link in Firestore so LinkManager always records it
  useEffect(() => {
    if (!db || !ambassador.id) return;
    saveTrackedLinkInDb({
      destinationName: mainLink.destLabel,
      originalUrl: mainLink.targetUrl,
      shortUrl: mainLink.shortUrl,
      source: 'ambassador',
      medium: 'social',
      campaign: campaignTag,
      shortCode: rawCode,
      ambassadorId: ambassador.id,
      ambassadorName: ambassador.name
    }).catch(e => console.warn("Auto-save link warning:", e));
  }, [mainLink.targetUrl, mainLink.shortUrl, ambassador.id, ambassador.name, campaignTag, rawCode]);

  return (
    <div className="min-h-screen bg-gray-50/80 font-sans pb-28 md:pb-16 select-none sm:select-text">
      
      {/* Toast Notification Floating Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle size={15} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="bg-white border-b border-brand-latte/30 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-pink/20 border border-brand-flamingo/30 flex items-center justify-center text-brand-flamingo font-serif text-lg font-bold shrink-0">
              {ambassador.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-serif text-base font-bold text-stone-900 leading-tight">
                  {ambassador.name}
                </h1>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Active Ambassador" />
              </div>
              <p className="text-[10px] text-stone-500 font-mono tracking-tight">
                Code: <span className="text-brand-flamingo font-bold">{campaignTag}</span> • <span className="text-brand-gold font-bold">{commissionRate}% Comm</span>
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="px-3 py-1.5 text-stone-600 hover:text-brand-flamingo border border-stone-200 hover:border-brand-flamingo/40 rounded-lg transition-colors flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
              title="View Main Store"
            >
              <Store size={14} />
              <span className="hidden sm:inline">Store</span>
            </button>
            <button
              onClick={onLogout}
              className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>

        </div>

        {/* Desktop Navigation Bar (Matching Portal Sign-In Tabs Style) */}
        <div className="hidden md:block bg-white border-t border-brand-latte/20">
          <div className="max-w-4xl mx-auto px-4 flex gap-8 text-xs font-bold uppercase tracking-widest">
            <button
              onClick={() => setActiveTab('performance')}
              className={`py-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'performance'
                  ? 'border-brand-flamingo text-stone-900 font-bold'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              <TrendingUp size={15} /> Earnings & Sales
            </button>
            <button
              onClick={() => setActiveTab('links')}
              className={`py-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'links'
                  ? 'border-brand-flamingo text-stone-900 font-bold'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              <Sparkles size={15} /> Referral Links
            </button>
            <button
              onClick={() => setActiveTab('guidelines')}
              className={`py-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'guidelines'
                  ? 'border-brand-flamingo text-stone-900 font-bold'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              <BookOpen size={15} /> Ambassador Guide
            </button>
            <button
              onClick={() => setActiveTab('payout')}
              className={`py-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'payout'
                  ? 'border-brand-flamingo text-stone-900 font-bold'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              <CreditCard size={15} /> Bank Details
            </button>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="max-w-4xl mx-auto px-4 mt-4 space-y-5">

        {/* 1. EARNINGS & REFERRED ORDERS TAB */}
        {activeTab === 'performance' && (
          <div className="space-y-4 animate-fade-in">
            
            {/* Ambassador Earnings Overview Banner - Clean Modern Typography */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/80 shadow-2xs space-y-5">
              
              {/* Header: Title and Commission Rate Pill */}
              <div className="flex items-center justify-between pb-3.5 border-b border-stone-100">
                <div>
                  <p className="text-xs font-medium text-stone-500">
                    Ambassador Dashboard
                  </p>
                  <h2 className="text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight mt-0.5">
                    Earnings Summary
                  </h2>
                </div>

                <div className="bg-stone-50 px-3 py-1.5 rounded-full border border-stone-200/60 text-xs font-medium text-stone-700 flex items-center gap-1.5">
                  <Award size={14} className="text-stone-500" />
                  <span>{commissionRate}% Commission</span>
                </div>
              </div>

              {/* Primary Stat: Total Lifetime Earnings Hero */}
              <div className="bg-[#FAF9F5] p-5 sm:p-6 rounded-xl border border-stone-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-stone-500">
                    Total Lifetime Earned
                  </span>
                  <p className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight">
                    RM {totalCommission.toFixed(2)}
                  </p>
                </div>

                <div className="pt-3 sm:pt-0 border-t sm:border-t-0 border-stone-200/60 text-xs text-stone-500">
                  <span>Total Sales Generated</span>
                  <p className="text-base font-semibold text-stone-900 mt-0.5">
                    RM {totalSalesRevenue.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Sub-metrics: Pending, Confirmed & Paid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Pending 28d */}
                <div className="p-4 rounded-xl border border-stone-200/70 bg-white space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-stone-500">Pending (28-Day Window)</span>
                    <TrendingUp size={15} className="text-amber-500" />
                  </div>
                  <p className="text-xl font-semibold text-stone-900">
                    RM {pendingCommission.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-stone-400">Awaiting 28d confirmation</p>
                </div>

                {/* Confirmed Balance */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-800">Confirmed (Ready)</span>
                    <CheckCircle2 size={15} className="text-emerald-600" />
                  </div>
                  <p className="text-xl font-semibold text-emerald-900">
                    RM {confirmedCommission.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-emerald-700">Eligible for 15th payout</p>
                </div>

                {/* Paid Out */}
                <div className="p-4 rounded-xl border border-stone-200/70 bg-white space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-stone-500">Completed Payouts</span>
                    <CreditCard size={15} className="text-stone-500" />
                  </div>
                  <p className="text-xl font-semibold text-stone-900">
                    RM {paidCommission.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-stone-400">Transferred to bank</p>
                </div>
              </div>

              {/* Footer Summary Stats Bar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 border-t border-stone-100">
                <div className="flex items-center gap-3">
                  <span>Link Clicks: <strong className="text-stone-900 font-semibold">{totalClicks}</strong></span>
                  <span className="text-stone-300">•</span>
                  <span>Referred Orders: <strong className="text-stone-900 font-semibold">{processedReferredOrders.length}</strong></span>
                </div>

                <div className="flex items-center gap-1.5 text-stone-500 text-xs font-medium">
                  <CreditCard size={13} className="text-stone-400" />
                  <span>Monthly Bank Transfer: <strong>15th of every month</strong></span>
                </div>
              </div>
            </div>

            {/* Sales & Earnings Activity Log (Anonymized) */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="font-serif text-base font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingBag size={18} className="text-brand-flamingo" />
                    Sales & Commission History
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Track your daily earnings and 28-day confirmation status
                  </p>
                </div>

                <span className="text-xs font-bold text-brand-flamingo bg-brand-pink/20 px-3 py-1 rounded-full w-fit">
                  {processedReferredOrders.length} Total Sales
                </span>
              </div>

              {/* Filter Controls */}
              <div className="space-y-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200/60">
                
                {/* Search Bar */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by date, order reference, or channel..."
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                    className="w-full bg-white border border-gray-200 pl-9 pr-3 py-2 text-xs rounded-lg text-gray-800 focus:outline-none focus:border-brand-flamingo"
                  />
                  {orderSearchTerm && (
                    <button
                      onClick={() => setOrderSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  
                  {/* Status Pills */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mr-1 hidden sm:inline">
                      Confirmation:
                    </span>
                    <button
                      onClick={() => setOrderStatusFilter('all')}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                        orderStatusFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setOrderStatusFilter('confirmed')}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                        orderStatusFilter === 'confirmed' ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Confirmed (Ready)
                    </button>
                    <button
                      onClick={() => setOrderStatusFilter('pending')}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                        orderStatusFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Pending (28d)
                    </button>
                  </div>

                  {/* Date Filter Pills */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mr-1 hidden sm:inline">
                      Period:
                    </span>
                    <button
                      onClick={() => setOrderDateFilter('all')}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                        orderDateFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'
                      }`}
                    >
                      All Time
                    </button>
                    <button
                      onClick={() => setOrderDateFilter('this_month')}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                        orderDateFilter === 'this_month' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'
                      }`}
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => setOrderDateFilter('last_28_days')}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                        orderDateFilter === 'last_28_days' ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'
                      }`}
                    >
                      Last 28 Days
                    </button>
                  </div>

                </div>
              </div>

              {/* Order Cards List (Anonymized) */}
              {filteredReferredOrders.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 space-y-2">
                  <ShoppingBag size={28} className="mx-auto text-gray-300" />
                  <p className="text-xs font-bold text-gray-700">No matching sales entries found</p>
                  <p className="text-[11px] text-gray-400">
                    Try adjusting your filters or share your custom link to start referring customers!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredReferredOrders.slice(0, visibleOrderLimit).map(order => {
                    const orderDateStr = new Date(order.date).toLocaleDateString('en-MY', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    });

                    return (
                      <div
                        key={order.id}
                        className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs hover:border-brand-flamingo/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-gray-900 text-xs">
                              Referred Sale #{order.id}
                            </span>
                            
                            {/* Confirmation Status Pill */}
                            {order.isConfirmed ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 size={11} /> Confirmed (Ready)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                🕒 Pending ({order.daysRemaining}d left in 28d window)
                              </span>
                            )}

                            {/* Channel Pill */}
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                              {order.channel}
                            </span>
                          </div>

                          <p className="text-xs text-gray-500 font-medium">
                            Date: <span className="text-gray-800 font-semibold">{orderDateStr}</span>
                          </p>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-gray-100 pt-2 sm:pt-0">
                          <span className="text-[10px] text-gray-400 uppercase font-semibold">Your Commission</span>
                          <span className="font-serif text-base font-bold text-brand-flamingo">
                            +RM {order.commissionAmount.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-gray-400">Order Revenue: RM {(order.total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}

                  <p className="text-[10px] text-stone-400 text-center italic pt-2">
                    🔒 Customer personal details are confidential. Only sales amount, date, and commission are displayed.
                  </p>

                  {/* Load More Button for Long Order Histories */}
                  {filteredReferredOrders.length > visibleOrderLimit && (
                    <button
                      onClick={() => setVisibleOrderLimit(prev => prev + 10)}
                      className="w-full py-2.5 bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 mt-3"
                    >
                      <RefreshCw size={14} />
                      <span>Show More Entries ({filteredReferredOrders.length - visibleOrderLimit} remaining)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* 2. LINKS TAB */}
        {activeTab === 'links' && (
          <div className="space-y-4 animate-fade-in">
            
            {/* Links Header */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-2xs space-y-4">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="font-serif text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-brand-gold" />
                  Your Referral Link
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Copy your unique referral link below and share it wherever you like — in social posts, stories, bio, comments, or direct messages. When followers tap your link and buy, you earn commission!
                </p>
              </div>

              {/* Universal Link Cards */}
              <div className="pt-1 space-y-3">
                {/* Short Link Card */}
                <div className="bg-brand-pink/15 p-4 sm:p-5 rounded-2xl border border-brand-flamingo/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-800">Your Short Referral Link</span>
                        <span className="bg-brand-flamingo text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Recommended
                        </span>
                      </div>
                      <p className="font-mono text-sm font-bold text-brand-flamingo bg-white px-3.5 py-2.5 rounded-xl border border-brand-flamingo/20 shadow-2xs break-all">
                        {mainLink.shortUrl}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        ⚡ Clean, short link that performs a 302 redirect to the homepage with full tracking
                      </p>
                    </div>

                    <button
                      onClick={() => handleCopyLink(mainLink.shortUrl, 'short', mainLink.destLabel, 'short')}
                      className="bg-brand-flamingo text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-flamingo/90 transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
                    >
                      {copiedLinkKey === 'short' ? <Check size={18} className="text-emerald-300" /> : <Copy size={18} />}
                      <span>{copiedLinkKey === 'short' ? 'Copied!' : 'Copy Short Link'}</span>
                    </button>
                  </div>
                </div>

                {/* Full Tagged Link Card */}
                <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <span className="text-xs font-semibold text-gray-600 block">Full Tagged Destination Link:</span>
                      <p className="font-mono text-xs text-gray-700 bg-white px-3.5 py-2 rounded-xl border border-gray-200 break-all">
                        {mainLink.targetUrl}
                      </p>
                    </div>

                    <button
                      onClick={() => handleCopyLink(mainLink.targetUrl, 'full', mainLink.destLabel, 'full')}
                      className="bg-gray-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-900 transition-colors flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {copiedLinkKey === 'full' ? <Check size={16} className="text-emerald-300" /> : <Copy size={16} />}
                      <span>{copiedLinkKey === 'full' ? 'Copied!' : 'Copy Full Link'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Friendly Guided Steps */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/60 space-y-2 text-xs">
                <h4 className="font-bold text-gray-800 flex items-center gap-1.5">
                  <span>💡 How to use your link:</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-gray-600 leading-relaxed">
                  <li>Tap <strong>Copy Link</strong> above.</li>
                  <li>Share it anywhere you connect with people — in posts, stories, bio, comments, group chats, or direct messages.</li>
                  <li>Whenever someone buys through your link, your <strong>{commissionRate}% commission</strong> is automatically saved to your earnings!</li>
                </ol>
              </div>

            </div>

          </div>
        )}

        {/* 3. PROGRAM GUIDE TAB */}
        {activeTab === 'guidelines' && (
          <div className="space-y-5 animate-fade-in text-stone-800">
            
            {/* 1. Landing Page Hero Banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#FAF8F5] via-[#FFFDF9] to-[#F5EFE6] p-6 sm:p-8 rounded-3xl border border-stone-200/80 shadow-xs space-y-3 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 bg-brand-flamingo/10 text-brand-flamingo px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                <Sparkles size={13} />
                <span>Exclusive Invitation-Only Program</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
                Welcome to Once Upon
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-2xl">
                We hand-picked you because you already own, use, and love our premium baby textiles. Being invited means we trust and appreciate your honest voice. Share your real daily moments mother-to-mother, and earn effortlessly.
              </p>
            </div>

            {/* 2. Share It Your Way (No Scripts Philosophy) */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 text-stone-900">
                <Heart size={20} className="text-brand-flamingo fill-brand-flamingo/20 shrink-0" />
                <h3 className="font-serif text-lg font-bold">Share It Your Way (No Scripts Needed)</h3>
              </div>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                We will never force scripts, rigid templates, or sales pitches on you. A real mum describing her real experience in her own words is worth more than any advertisement. Share Once Upon however feels natural to you:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                <div className="bg-[#FAF9F5] p-4 rounded-xl border border-stone-200/60 space-y-1.5">
                  <span className="text-base">📸</span>
                  <p className="font-bold text-stone-900">Your Real Moments</p>
                  <p className="text-stone-600 leading-relaxed">
                    Unboxing snaps, cozy nursery routines, bedtime swaddle cuddles, or stroller strolls.
                  </p>
                </div>

                <div className="bg-[#FAF9F5] p-4 rounded-xl border border-stone-200/60 space-y-1.5">
                  <span className="text-base">💬</span>
                  <p className="font-bold text-stone-900">Your Honest Words</p>
                  <p className="text-stone-600 leading-relaxed">
                    Speak naturally to your mum friends about why you love Once Upon products for your baby.
                  </p>
                </div>

                <div className="bg-[#FAF9F5] p-4 rounded-xl border border-stone-200/60 space-y-1.5">
                  <span className="text-base">🌿</span>
                  <p className="font-bold text-stone-900">Your Favorite Space</p>
                  <p className="text-stone-600 leading-relaxed">
                    Post on Instagram Stories, TikTok vlogs, Threads, or send direct WhatsApp links.
                  </p>
                </div>
              </div>
            </div>

            {/* 3. How Earning Works (Guided 4-Step Flow) */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs space-y-5">
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-brand-flamingo shrink-0" />
                  How Earning Works
                </h3>
                <p className="text-xs text-stone-500">
                  Four simple, transparent steps to share and earn.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold">
                    <span className="w-6 h-6 rounded-full bg-brand-flamingo text-white text-xs flex items-center justify-center shrink-0 font-mono">1</span>
                    <span>Share Your Custom Link or Code</span>
                  </div>
                  <p className="text-stone-600 leading-relaxed pl-8">
                    Copy your personal referral link from the <strong>Referral Links</strong> tab and share it anywhere you like (posts, stories, bio, comments, or direct chats).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold">
                    <span className="w-6 h-6 rounded-full bg-brand-flamingo text-white text-xs flex items-center justify-center shrink-0 font-mono">2</span>
                    <span>Customer Places an Order</span>
                  </div>
                  <p className="text-stone-600 leading-relaxed pl-8">
                    When someone buys through your link, you instantly earn a <strong>{commissionRate}% commission</strong> on that sale.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold">
                    <span className="w-6 h-6 rounded-full bg-brand-flamingo text-white text-xs flex items-center justify-center shrink-0 font-mono">3</span>
                    <span>28-Day Confirmation Period</span>
                  </div>
                  <p className="text-stone-600 leading-relaxed pl-8">
                    Commissions become officially confirmed <strong>28 days after customer payment date</strong> to allow for standard order processing.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/70 space-y-1.5">
                  <div className="flex items-center gap-2 text-stone-900 font-bold">
                    <span className="w-6 h-6 rounded-full bg-brand-flamingo text-white text-xs flex items-center justify-center shrink-0 font-mono">4</span>
                    <span>Monthly Bank Transfer</span>
                  </div>
                  <p className="text-stone-600 leading-relaxed pl-8">
                    Confirmed commissions are transferred automatically to your Malaysian bank account on the <strong>15th of every month</strong>.
                  </p>
                </div>
              </div>

              {/* No Commission Limit & No Minimum Threshold Card */}
              <div className="bg-emerald-50/90 p-4 rounded-xl border border-emerald-200/80 text-xs text-emerald-900 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-950 text-sm">No Commission Limits & No Minimum Threshold</p>
                  <p className="text-emerald-800 leading-relaxed">
                    You are eligible for payouts even if only 1 customer orders through your link! There is no minimum earnings threshold to unlock your money, and no maximum cap on how much you can make.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. A Few Gentle Guidelines */}
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-3 text-xs">
              <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2">
                <ShieldCheck size={18} className="text-stone-600" />
                A Few Gentle Guidelines
              </h3>
              <ul className="space-y-2 text-stone-600 leading-relaxed list-disc list-inside">
                <li><strong>Be Genuine:</strong> Share real experiences and genuine love for our baby swaddles and blankets.</li>
                <li><strong>Keep Information True:</strong> Ensure pricing and product features match what is on onceuponmy.com.</li>
              </ul>
            </div>

            {/* 5. Frequently Asked Questions */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
              <h3 className="font-serif text-base font-bold text-stone-900 flex items-center gap-2">
                <HelpCircle size={18} className="text-stone-600" />
                Frequently Asked Questions
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/60 space-y-1">
                  <p className="font-bold text-stone-900">When do I get paid?</p>
                  <p className="text-stone-600 leading-relaxed">
                    Payments are transferred directly to your Malaysian bank account on the <strong>15th of every month</strong> for all confirmed commissions.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/60 space-y-1">
                  <p className="font-bold text-stone-900">How does the 28-day confirmation window work?</p>
                  <p className="text-stone-600 leading-relaxed">
                    When a customer pays for an order, your commission shows as <em>Pending</em> for 28 days. Once 28 days pass from the customer's payment date, it becomes <em>Confirmed</em> and ready for payout on the 15th!
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/60 space-y-1">
                  <p className="font-bold text-stone-900">Is there a minimum earning amount before payout?</p>
                  <p className="text-stone-600 leading-relaxed">
                    No! Even if you have just 1 referred sale, you will receive your payout on the 15th.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/60 space-y-1">
                  <p className="font-bold text-stone-900">How do I update my bank account details?</p>
                  <p className="text-stone-600 leading-relaxed">
                    Go to the <strong>Bank Details</strong> tab anytime to update your bank name, account number, and account holder name.
                  </p>
                </div>
              </div>
            </div>

            {/* 6. Action Closing Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-stone-900 to-stone-800 text-white text-center space-y-3 shadow-md">
              <h3 className="font-serif text-lg font-bold">Ready to start sharing?</h3>
              <p className="text-xs text-stone-300 max-w-md mx-auto">
                Head over to your Links tab to grab your custom link and share it with fellow mums today.
              </p>
              <button
                onClick={() => setActiveTab('links')}
                className="inline-flex items-center gap-2 bg-brand-flamingo text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-brand-gold transition-colors shadow-sm"
              >
                <span>Get Your Links</span>
                <ArrowRight size={14} />
              </button>
            </div>

          </div>
        )}

        {/* 4. BANK PAYOUT ACCOUNT TAB */}
        {activeTab === 'payout' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-2xs space-y-4">
              <div>
                <h3 className="font-serif text-base font-bold text-gray-900 flex items-center gap-2">
                  <CreditCard size={18} className="text-brand-flamingo" />
                  Payout Bank Details
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Commissions are transferred directly to your bank account on the 15th of every month. Updates sync instantly with Admin!
                </p>
              </div>

              {payoutSaved && (
                <div className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Bank details saved and synced with Admin!</span>
                </div>
              )}

              <form onSubmit={handleSavePayout} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Bank Name
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs font-medium rounded-xl text-gray-900 focus:outline-none focus:border-brand-flamingo"
                  >
                    <option value="Maybank">Maybank (Malayan Banking)</option>
                    <option value="CIMB Bank">CIMB Bank</option>
                    <option value="Public Bank">Public Bank</option>
                    <option value="RHB Bank">RHB Bank</option>
                    <option value="Hong Leong Bank">Hong Leong Bank</option>
                    <option value="Bank Islam">Bank Islam</option>
                    <option value="AmBank">AmBank</option>
                    <option value="Alliance Bank">Alliance Bank</option>
                    <option value="HSBC Bank">HSBC Bank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 114012345678"
                    className="w-full bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs font-medium rounded-xl text-gray-900 focus:outline-none focus:border-brand-flamingo"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    required
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Full name as in bank account"
                    className="w-full bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs font-medium rounded-xl text-gray-900 focus:outline-none focus:border-brand-flamingo"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gray-900 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-flamingo transition-colors mt-2"
                >
                  Save Account Info
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* MOBILE APP FIXED BOTTOM NAVIGATION DOCK */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200/80 py-2 px-2 flex justify-around items-center shadow-lg md:hidden">
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors ${
            activeTab === 'performance' ? 'text-brand-flamingo font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <TrendingUp size={18} />
          <span className="text-[9px] tracking-tight mt-1">Earnings</span>
        </button>

        <button
          onClick={() => setActiveTab('links')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors ${
            activeTab === 'links' ? 'text-brand-flamingo font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <Sparkles size={18} />
          <span className="text-[9px] tracking-tight mt-1">Links</span>
        </button>

        <button
          onClick={() => setActiveTab('guidelines')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors ${
            activeTab === 'guidelines' ? 'text-brand-flamingo font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <BookOpen size={18} />
          <span className="text-[9px] tracking-tight mt-1">Guide</span>
        </button>

        <button
          onClick={() => setActiveTab('payout')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors ${
            activeTab === 'payout' ? 'text-brand-flamingo font-bold' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          <CreditCard size={18} />
          <span className="text-[9px] tracking-tight mt-1">Payout</span>
        </button>
      </nav>

    </div>
  );
};
