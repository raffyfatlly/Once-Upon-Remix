import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';
import { Loader2, AlertCircle } from 'lucide-react';

export const LinkRedirector: React.FC = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const resolveLink = async () => {
      if (!shortCode) {
        navigate('/', { replace: true });
        return;
      }

      try {
        let destinationUrl = '';
        let campaignName = '';
        let sourceName = '';

        if (db) {
          const q = query(
            collection(db, 'tracked_links'),
            where('shortCode', '==', shortCode),
            limit(1)
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            destinationUrl = data.originalUrl || '';
            campaignName = data.campaign || '';
            sourceName = data.source || 'ambassador';
          } else {
            // Check by ID
            const docRef = await getDocs(query(collection(db, 'tracked_links'), where('id', '==', shortCode), limit(1)));
            if (!docRef.empty) {
              const data = docRef.docs[0].data();
              destinationUrl = data.originalUrl || '';
              campaignName = data.campaign || '';
              sourceName = data.source || 'ambassador';
            }
          }
        }

        // Smart dynamic resolution fallback for all ambassador codes and shortcodes
        if (!destinationUrl) {
          const lowerCode = shortCode.toLowerCase();
          const parts = lowerCode.split('-');
          const lastPart = parts[parts.length - 1];
          
          const isChannel = ['ig', 'tt', 'th', 'instagram', 'tiktok', 'threads'].includes(lastPart);

          // Determine referrer platform
          const ref = (document.referrer || '').toLowerCase();
          let platform = '';
          if (ref.includes('tiktok') || ref.includes('vt.tiktok') || ref.includes('vm.tiktok')) {
            platform = 'tiktok';
          } else if (ref.includes('instagram') || ref.includes('l.instagram')) {
            platform = 'instagram';
          } else if (ref.includes('threads')) {
            platform = 'threads';
          } else if (ref.includes('facebook') || ref.includes('fb.me')) {
            platform = 'facebook';
          } else if (ref.includes('youtube') || ref.includes('youtu.be')) {
            platform = 'youtube';
          }

          if (!platform) {
            if (isChannel) {
              platform = (lastPart === 'ig' || lastPart === 'instagram') ? 'instagram' : (lastPart === 'tt' || lastPart === 'tiktok') ? 'tiktok' : 'threads';
            } else {
              platform = 'instagram'; // Default for ambassador social sharing
            }
          }

          // Extract ambassador handle
          let ambHandle = parts[0].replace(/^amb[-_]?/i, '');
          if (!ambHandle) ambHandle = lowerCode.replace(/^amb[-_]?/i, '');

          const campaignCode = `amb-${ambHandle}`;
          const websiteDomain = window.location.origin;

          let productPath = '';
          if (parts.length > 1 && !isChannel) {
            const itemPart = parts.slice(1).join('-');
            if (itemPart === 'blanket' || itemPart.includes('blanket')) {
              productPath = '/collections/Blankets';
            } else if (itemPart === 'swaddle' || itemPart.includes('swaddle')) {
              productPath = '/collections/Swaddle';
            } else if (itemPart.length > 2) {
              productPath = `/product/${itemPart}`;
            }
          } else if (parts.length > 2 && isChannel) {
            const itemPart = parts.slice(1, parts.length - 1).join('-');
            productPath = `/product/${itemPart}`;
          }

          destinationUrl = `${websiteDomain}${productPath}?utm_source=ambassador&utm_medium=${platform}&utm_campaign=${campaignCode}`;
          campaignName = campaignCode;
          sourceName = 'ambassador';
        }

        if (destinationUrl) {
          // Construct target URL and MERGE incoming query parameters from active request
          let targetUrlObj: URL;
          try {
            targetUrlObj = new URL(destinationUrl, window.location.origin);
          } catch (e) {
            targetUrlObj = new URL(`https://onceuponmy.com/?utm_source=ambassador&utm_campaign=amb-${shortCode}`, window.location.origin);
          }

          // Merge query parameters from current incoming URL
          const currentSearchParams = new URLSearchParams(window.location.search);
          currentSearchParams.forEach((value, key) => {
            targetUrlObj.searchParams.set(key, value);
          });

          const targetUrl = targetUrlObj.toString();

          // Log click event in Firestore with complete UTM & visitor tracking
          if (db) {
            try {
              let visitorId = localStorage.getItem('ou_visitor_id') || localStorage.getItem('analytics_visitor_id');
              if (!visitorId) {
                visitorId = `v_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
              }
              localStorage.setItem('ou_visitor_id', visitorId);
              localStorage.setItem('analytics_visitor_id', visitorId);

              let sessionId = sessionStorage.getItem('ou_session_id');
              if (!sessionId) {
                sessionId = `s_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
              }
              sessionStorage.setItem('ou_session_id', sessionId);

              // Get platform medium and campaign from targetUrl
              const mediumParam = targetUrlObj.searchParams.get('utm_medium') || 'instagram';
              const sourceParam = targetUrlObj.searchParams.get('utm_source') || sourceName || 'ambassador';
              const campaignParam = targetUrlObj.searchParams.get('utm_campaign') || campaignName || `amb-${shortCode}`;

              // Store persistent first touch attribution into localStorage
              localStorage.setItem('ou_first_utm_source', sourceParam);
              localStorage.setItem('ou_first_utm_medium', mediumParam);
              localStorage.setItem('ou_first_utm_campaign', campaignParam);

              sessionStorage.setItem('ou_session_utm_source', sourceParam);
              sessionStorage.setItem('ou_session_utm_medium', mediumParam);
              sessionStorage.setItem('ou_session_utm_campaign', campaignParam);

              await addDoc(collection(db, 'analytics_events'), {
                event: 'short_link_click',
                type: 'session_start',
                shortCode,
                visitorId,
                sessionId,
                first_utm_source: sourceParam,
                first_utm_medium: mediumParam,
                first_utm_campaign: campaignParam,
                current_utm_source: sourceParam,
                current_utm_medium: mediumParam,
                current_utm_campaign: campaignParam,
                campaign: campaignParam,
                source: sourceParam,
                destinationUrl: targetUrl,
                timestamp: new Date().toISOString(),
                isReturning: false
              });
            } catch (e) {
              console.warn("Analytics event write error:", e);
            }
          }
          window.location.replace(targetUrl);
        } else {
          setError("The shortened link you are trying to reach was not found or has expired.");
        }
      } catch (err: any) {
        console.error("Error resolving short link:", err);
        setError("Failed to redirect: " + (err.message || "An unexpected database connectivity issue occurred."));
      }
    };

    resolveLink();
  }, [shortCode, navigate]);


  if (error) {
    return (
      <div className="min-h-screen bg-brand-grey/5 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="bg-white p-8 border border-brand-latte/20 rounded-[2px] max-w-sm shadow-sm">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
          <h2 className="font-serif text-xl text-gray-900 mb-2">Redirect Failed</h2>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">{error}</p>
          <button 
            id="btn-error-redirect-home"
            onClick={() => window.location.replace('/')}
            className="w-full bg-brand-flamingo text-white py-2.5 text-xs font-bold uppercase tracking-widest rounded-[2px]"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-grey/5 flex flex-col items-center justify-center p-6 text-center font-sans">
      <Loader2 size={32} className="text-brand-flamingo animate-spin mb-4" />
      <h2 className="font-serif text-lg text-gray-800">Redirecting you...</h2>
      <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Preparing your premium story</p>
    </div>
  );
};
