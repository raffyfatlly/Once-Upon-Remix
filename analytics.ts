import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

// Generate a compact unique ID
const generateId = (prefix: string): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  for (let i = 0; i < 12; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${Date.now()}_${rand}`;
};

// Check if the visitor is a search bot or crawler
export const isBot = (): boolean => {
  if (typeof window === 'undefined' || !navigator.userAgent) return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const bots = [
    'googlebot', 'bingbot', 'yandexbot', 'baiduspider', 'facebookexternalhit',
    'twitterbot', 'rogerbot', 'linkedinbot', 'embedly', 'quora link preview',
    'showyoubot', 'outbrain', 'pinterest/0.', 'developers.google.com/+/web/snippet',
    'slackbot', 'vkshare', 'w3c_validator', 'redditbot', 'applebot', 'whatsapp',
    'flipboard', 'tumblr', 'bitlybot', 'skypeuripreview', 'nuzzel', 'discordbot',
    'google-keyword-association', 'parser', 'python', 'curl', 'wget', 'crawler',
    'spider', 'robot', 'archiver'
  ];
  return bots.some(bot => userAgent.includes(bot));
};

// Extract domain from URL
const getDomain = (url: string): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return null;
  }
};

// Get current URL search parameters
const getUrlParams = () => {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
  };
};

export interface AnalyticsEvent {
  visitorId: string;
  sessionId: string;
  timestamp: string; // ISO String
  type: 'session_start' | 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase';
  
  // First-touch attribution (persistent)
  first_utm_source: string;
  first_utm_medium: string;
  first_utm_campaign: string;
  first_referrer: string;
  
  // Current session parameters
  current_utm_source?: string | null;
  current_utm_medium?: string | null;
  current_utm_campaign?: string | null;
  
  // Event-specific details
  productId?: string;
  productName?: string;
  price?: number;
  quantity?: number;
  value?: number; // Cart total value, checkout value, purchase revenue
  orderId?: string;
  
  // Browser info (no names/emails for privacy)
  userAgent?: string;
  isReturning: boolean;
}

// Global interface for tracking module
export const getAnalyticsSession = () => {
  if (typeof window === 'undefined') return { visitorId: '', sessionId: '', isReturning: false, isNewSession: false };

  // Session ID (Stored in sessionStorage, expires on tab close)
  let sessionId = sessionStorage.getItem('ou_session_id');
  let isNewSession = false;
  if (!sessionId) {
    sessionId = generateId('s');
    sessionStorage.setItem('ou_session_id', sessionId);
    isNewSession = true;
  }

  // Visitor ID (Stored persistently in localStorage)
  let visitorId = localStorage.getItem('ou_visitor_id');
  if (!visitorId) {
    visitorId = generateId('v');
    localStorage.setItem('ou_visitor_id', visitorId);
    // New visitor ID created during this session -> New visitor session
    sessionStorage.setItem('ou_visitor_is_returning', 'false');
  } else if (isNewSession) {
    // Visitor ID existed prior to this new session starting -> Returning visitor session
    sessionStorage.setItem('ou_visitor_is_returning', 'true');
  }

  const isReturning = sessionStorage.getItem('ou_visitor_is_returning') === 'true';

  return { visitorId, sessionId, isReturning, isNewSession };
};

// Get first touch attribution information
export const getAttribution = () => {
  if (typeof window === 'undefined') {
    return { first_utm_source: 'direct', first_utm_medium: 'none', first_utm_campaign: 'none', first_referrer: 'none' };
  }

  const params = getUrlParams();
  const referrer = document.referrer;
  const referrerDomain = getDomain(referrer);
  const currentDomain = getDomain(window.location.href);

  // Try to load existing attribution from localStorage
  let first_utm_source = localStorage.getItem('ou_first_utm_source');
  let first_utm_medium = localStorage.getItem('ou_first_utm_medium');
  let first_utm_campaign = localStorage.getItem('ou_first_utm_campaign');
  let first_referrer = localStorage.getItem('ou_first_referrer');

  // If new campaign or source arrives in URL parameters, prioritize & update active attribution
  if (params.utm_source || params.utm_campaign) {
    const refDomain = referrerDomain || '';
    let detectedPlatform = '';
    if (refDomain.includes('tiktok') || refDomain.includes('vt.tiktok') || refDomain.includes('vm.tiktok')) detectedPlatform = 'tiktok';
    else if (refDomain.includes('instagram') || refDomain.includes('l.instagram')) detectedPlatform = 'instagram';
    else if (refDomain.includes('threads')) detectedPlatform = 'threads';
    else if (refDomain.includes('facebook') || refDomain.includes('fb.me')) detectedPlatform = 'facebook';
    else if (refDomain.includes('youtube') || refDomain.includes('youtu.be')) detectedPlatform = 'youtube';

    first_utm_source = params.utm_source || 'ambassador';
    first_utm_medium = detectedPlatform || params.utm_medium || 'social';
    first_utm_campaign = params.utm_campaign || 'unspecified';
    first_referrer = referrer || 'direct';

    localStorage.setItem('ou_first_utm_source', first_utm_source);
    localStorage.setItem('ou_first_utm_medium', first_utm_medium);
    localStorage.setItem('ou_first_utm_campaign', first_utm_campaign);
    localStorage.setItem('ou_first_referrer', first_referrer);
  } else if (!first_utm_source || first_utm_source === 'direct' || !first_utm_campaign || first_utm_campaign === 'none') {
    // Only infer organic referral if there is no existing valid campaign (and specifically not an ambassador campaign)
    const isExistingAmbassador = (first_utm_source === 'ambassador') || (first_utm_campaign && first_utm_campaign.startsWith('amb-'));

    if (!isExistingAmbassador) {
      if (referrerDomain && referrerDomain !== currentDomain) {
        // External referral
        first_utm_source = referrerDomain;
        if (['instagram.com', 'facebook.com', 'l.instagram.com', 'm.facebook.com', 't.co', 'pinterest.com'].some(d => referrerDomain.includes(d))) {
          first_utm_medium = 'social';
        } else if (['google.com', 'bing.com', 'yahoo.com'].some(d => referrerDomain.includes(d))) {
          first_utm_medium = 'organic';
        } else {
          first_utm_medium = 'referral';
        }
        first_utm_campaign = 'organic_referral';
      } else if (!first_utm_source) {
        // Direct entry
        first_utm_source = 'direct';
        first_utm_medium = 'none';
        first_utm_campaign = 'none';
      }

      first_referrer = referrer || 'direct';

      localStorage.setItem('ou_first_utm_source', first_utm_source);
      localStorage.setItem('ou_first_utm_medium', first_utm_medium || 'none');
      localStorage.setItem('ou_first_utm_campaign', first_utm_campaign || 'none');
      localStorage.setItem('ou_first_referrer', first_referrer);
    }
  }

  return {
    first_utm_source: first_utm_source || 'direct',
    first_utm_medium: first_utm_medium || 'none',
    first_utm_campaign: first_utm_campaign || 'none',
    first_referrer: first_referrer || 'direct',
  };
};

// Generic tracker function
export const trackEvent = async (
  type: AnalyticsEvent['type'],
  details?: Omit<Partial<AnalyticsEvent>, 'visitorId' | 'sessionId' | 'timestamp' | 'type' | 'first_utm_source' | 'first_utm_medium' | 'first_utm_campaign' | 'first_referrer'>
) => {
  // Prevent tracking search engine bots/crawlers
  if (isBot()) return;

  // Never block the user experience or throw an error to the user if tracking fails
  try {
    if (!db) {
      console.warn("Analytics: Firestore is not connected. Skipping trackEvent.");
      return;
    }

    const { visitorId, sessionId, isReturning } = getAnalyticsSession();
    const attribution = getAttribution();
    const currentParams = getUrlParams();

    const refDomain = typeof document !== 'undefined' && document.referrer ? getDomain(document.referrer) : null;
    let detectedCurrentMedium = currentParams.utm_medium;
    if (refDomain) {
      if (refDomain.includes('tiktok') || refDomain.includes('vt.tiktok') || refDomain.includes('vm.tiktok')) detectedCurrentMedium = 'tiktok';
      else if (refDomain.includes('instagram') || refDomain.includes('l.instagram')) detectedCurrentMedium = 'instagram';
      else if (refDomain.includes('threads')) detectedCurrentMedium = 'threads';
      else if (refDomain.includes('facebook') || refDomain.includes('fb.me')) detectedCurrentMedium = 'facebook';
      else if (refDomain.includes('youtube') || refDomain.includes('youtu.be')) detectedCurrentMedium = 'youtube';
    }

    const eventPayload: AnalyticsEvent = {
      visitorId,
      sessionId,
      timestamp: new Date().toISOString(),
      type,
      ...attribution,
      current_utm_source: currentParams.utm_source || attribution.first_utm_source,
      current_utm_medium: detectedCurrentMedium || currentParams.utm_medium || attribution.first_utm_medium,
      current_utm_campaign: currentParams.utm_campaign || attribution.first_utm_campaign,
      userAgent: navigator.userAgent,
      isReturning,
      ...details,
    };

    // Async write to firestore
    addDoc(collection(db, 'analytics_events'), eventPayload).catch((e) => {
      console.warn("Analytics track error (silent):", e);
    });

    // Console debugging (only in dev server/preview)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Analytics Event: ${type}]`, eventPayload);
    }
  } catch (err) {
    // Completely silent catch block to guarantee zero impact on the shop
    console.warn("Analytics tracked error (silent):", err);
  }
};

// SPECIFIC TRACKING ACTIONS

// 1. Initialize Analytics (handles session starts)
export const initializeAnalytics = () => {
  try {
    const session = getAnalyticsSession();
    const params = getUrlParams();
    
    // Always update first touch attribution if not set, or update current session attribution if UTM params are present
    const attribution = getAttribution();

    // If landing with campaign or ambassador UTM parameters, ensure we log the click/visit event
    if (params.utm_source || params.utm_campaign || params.utm_medium) {
      if (typeof localStorage !== 'undefined' && params.utm_campaign) {
        localStorage.setItem('ou_first_utm_campaign', params.utm_campaign);
        if (params.utm_source) localStorage.setItem('ou_first_utm_source', params.utm_source);
        if (params.utm_medium) localStorage.setItem('ou_first_utm_medium', params.utm_medium);
      }

      trackEvent('session_start', {
        current_utm_source: params.utm_source || attribution.first_utm_source,
        current_utm_medium: params.utm_medium || attribution.first_utm_medium,
        current_utm_campaign: params.utm_campaign || attribution.first_utm_campaign,
      });
    } else if (session.isNewSession) {
      trackEvent('session_start');
    }
  } catch (err) {
    console.warn("Analytics initialization failed (silent):", err);
  }
};

// 2. Track Item View
export const trackViewItem = (productId: string, productName: string, price: number) => {
  trackEvent('view_item', { productId, productName, price });
};

// 3. Track Add To Cart
export const trackAddToCart = (productId: string, productName: string, price: number, quantity: number = 1) => {
  trackEvent('add_to_cart', { productId, productName, price, quantity });
};

// 4. Track Begin Checkout
export const trackBeginCheckout = (totalValue: number, quantity: number) => {
  trackEvent('begin_checkout', { value: totalValue, quantity });
};

// 5. Track Purchase
export const trackPurchase = (orderId: string, totalValue: number) => {
  trackEvent('purchase', { orderId, value: totalValue });
};
