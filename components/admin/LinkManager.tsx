import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { db } from '../../firebase';
import { 
  collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, limit 
} from 'firebase/firestore';
import { 
  Link as LinkIcon, Copy, Check, Trash2, PlusCircle, RefreshCw, 
  ExternalLink, Calendar, HelpCircle, FileText, ArrowRight, Sparkles 
} from 'lucide-react';

interface LinkManagerProps {
  products: Product[];
}

interface TrackedLink {
  id: string;
  destinationName: string;
  originalUrl: string;
  shortUrl: string;
  source: string;
  medium: string;
  campaign: string;
  shortCode: string;
  createdAt: string;
}

export const LinkManager: React.FC<LinkManagerProps> = ({ products }) => {
  const [destination, setDestination] = useState<string>('homepage');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [source, setSource] = useState<string>('instagram');
  const [medium, setMedium] = useState<string>('bio');
  const [campaign, setCampaign] = useState<string>('');

  // Ambassador Campaign States
  const [isAmbassador, setIsAmbassador] = useState<boolean>(false);
  const [ambassadorName, setAmbassadorName] = useState<string>('');
  const [ambassadorPlatform, setAmbassadorPlatform] = useState<string>('instagram');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<TrackedLink[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load link history in real-time
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'tracked_links'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const links = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          destinationName: data.destinationName || '',
          originalUrl: data.originalUrl || '',
          shortUrl: data.shortUrl || '',
          source: data.source || '',
          medium: data.medium || '',
          campaign: data.campaign || '',
          shortCode: data.shortCode || '',
          createdAt: data.createdAt || ''
        } as TrackedLink;
      });
      setHistory(links);
      setLoading(false);
    }, (error) => {
      console.error("Error loading tracked links:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Compute clean URLs
  const getProductSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  const getBaseUrl = () => {
    return window.location.origin;
  };

  const getDestinationPath = () => {
    if (destination === 'homepage') {
      return '/';
    } else {
      const prod = products.find(p => p.id === selectedProductId);
      return prod ? `/product/${getProductSlug(prod.name)}` : '/';
    }
  };

  const getDestinationLabel = () => {
    if (destination === 'homepage') {
      return 'Homepage';
    } else {
      const prod = products.find(p => p.id === selectedProductId);
      return prod ? prod.name : 'Unknown Product';
    }
  };

  const cleanCampaign = (val: string) => {
    // lowercase and replace spaces/special chars with hyphens
    return val
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const websiteDomain = 'https://onceuponmy.com';

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

  // Generate original URL with UTM params targeting website (onceuponmy.com)
  const generatedOriginalUrl = () => {
    const base = websiteDomain;
    const path = getDestinationPath();
    
    let finalSource = source;
    let finalMedium = medium;
    let finalCampaign = cleanCampaign(campaign);

    if (isAmbassador) {
      finalSource = 'ambassador';
      finalMedium = ambassadorPlatform;
      finalCampaign = 'amb-' + cleanCampaign(ambassadorName);
    }
    
    if (!finalCampaign) return '';
    
    const separator = path.includes('?') ? '&' : '?';
    const utmParams = `utm_source=${finalSource}&utm_medium=${finalMedium}&utm_campaign=${finalCampaign}`;
    
    return `${base}${path}${separator}${utmParams}`;
  };

  const generatedShortCode = () => {
    if (isAmbassador) {
      return cleanCampaign(ambassadorName);
    }
    return cleanCampaign(campaign);
  };

  const generatedShortUrl = () => {
    const code = generatedShortCode();
    return code ? `${websiteDomain}/l/${code}` : '';
  };

  const handleCopy = (url: string, type: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(`${type}-${url}`);
    setTimeout(() => {
      setCopiedLink(null);
    }, 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const originalUrl = generatedOriginalUrl();
    const rawCmp = isAmbassador ? 'amb-' + cleanCampaign(ambassadorName) : cleanCampaign(campaign);
    const shortCode = generatedShortCode();
    if (!originalUrl || !rawCmp) return;

    const shortUrl = shortCode ? `${websiteDomain}/l/${shortCode}` : `${websiteDomain}/l/${rawCmp}`;

    try {
      await addDoc(collection(db, 'tracked_links'), {
        destinationName: getDestinationLabel(),
        originalUrl: originalUrl,
        shortUrl: shortUrl,
        source: isAmbassador ? 'ambassador' : source,
        medium: isAmbassador ? ambassadorPlatform : medium,
        campaign: rawCmp,
        shortCode: shortCode || rawCmp,
        createdAt: new Date().toISOString()
      });

      setSaveSuccess(true);
      if (isAmbassador) {
        setAmbassadorName('');
      } else {
        setCampaign('');
      }
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Error saving tracked link to history:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tracked_links', id));
      setDeletingId(null);
    } catch (err) {
      console.error("Error deleting tracked link:", err);
    }
  };

  const handleClearAllHistory = async () => {
    if (history.length === 0) return;
    try {
      setLoading(true);
      for (const link of history) {
        await deleteDoc(doc(db, 'tracked_links', link.id));
      }
      setConfirmClearAll(false);
    } catch (err) {
      console.error("Error clearing link history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReuse = (link: TrackedLink) => {
    // Try matching destination
    if (link.originalUrl.includes('/product/')) {
      setDestination('product');
      const parts = link.originalUrl.split('/product/');
      if (parts.length > 1) {
        const slugAndParams = parts[1];
        const slug = slugAndParams.split('?')[0];
        const foundProd = products.find(p => getProductSlug(p.name) === slug);
        if (foundProd) {
          setSelectedProductId(foundProd.id);
        }
      }
    } else {
      setDestination('homepage');
    }

    if (link.source === 'ambassador') {
      setIsAmbassador(true);
      setAmbassadorPlatform(link.medium);
      const namePart = link.campaign.startsWith('amb-') ? link.campaign.substring(4) : link.campaign;
      setAmbassadorName(namePart);
    } else {
      setIsAmbassador(false);
      setSource(link.source);
      setMedium(link.medium);
      setCampaign(link.campaign);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="border-b border-brand-latte/20 pb-4">
        <h2 className="font-serif text-2xl md:text-3xl text-gray-900 flex items-center gap-2">
          <LinkIcon className="text-brand-flamingo" size={24} />
          UTM Link Builder
        </h2>
        <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
          Create consistent tracking URLs to measure campaign conversions accurately
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Builder Form */}
        <div className="lg:col-span-5 bg-white p-6 border border-brand-latte/20 rounded-[2px] shadow-sm space-y-6">
          <h3 className="font-serif text-lg text-gray-900 border-b border-brand-latte/10 pb-2 flex items-center gap-2">
            <Sparkles size={16} className="text-brand-gold" />
            Configure UTM Parameters
          </h3>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Destination Selection */}
            <div>
              <label htmlFor="destination-select" className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
                Destination Page
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  id="btn-dest-homepage"
                  onClick={() => setDestination('homepage')}
                  className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider border rounded-[2px] text-center transition-colors ${
                    destination === 'homepage' 
                      ? 'border-brand-flamingo bg-brand-flamingo/5 text-brand-flamingo' 
                      : 'border-brand-latte/20 text-gray-500 hover:border-brand-flamingo'
                  }`}
                >
                  Homepage (/)
                </button>
                <button
                  type="button"
                  id="btn-dest-product"
                  onClick={() => {
                    setDestination('product');
                    if (products.length > 0 && !selectedProductId) {
                      setSelectedProductId(products[0].id);
                    }
                  }}
                  className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider border rounded-[2px] text-center transition-colors ${
                    destination === 'product' 
                      ? 'border-brand-flamingo bg-brand-flamingo/5 text-brand-flamingo' 
                      : 'border-brand-latte/20 text-gray-500 hover:border-brand-flamingo'
                  }`}
                >
                  Product Page
                </button>
              </div>

              {destination === 'product' && (
                <select
                  id="destination-select"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-brand-grey/5 border border-brand-latte/20 rounded-[2px] p-2.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-brand-flamingo font-sans"
                >
                  <optgroup label="☁️ BAMBOO BLANKETS & QUILTS">
                    {products
                      .filter(p => getProductCategoryType(p) === 'blanket')
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          [BLANKET] {p.name} - RM{p.price}
                        </option>
                      ))}
                  </optgroup>

                  <optgroup label="🍼 BABY SWADDLES & WRAPS">
                    {products
                      .filter(p => getProductCategoryType(p) === 'swaddle')
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          [SWADDLE] {p.name} - RM{p.price}
                        </option>
                      ))}
                  </optgroup>

                  <optgroup label="✨ SLEEPWEAR & APPAREL">
                    {products
                      .filter(p => getProductCategoryType(p) === 'other')
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          [APPAREL] {p.name} - RM{p.price}
                        </option>
                      ))}
                  </optgroup>
                </select>
              )}
            </div>

            {/* Link Category Selection */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
                Link Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-category-standard"
                  onClick={() => setIsAmbassador(false)}
                  className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider border rounded-[2px] text-center transition-colors ${
                    !isAmbassador 
                      ? 'border-brand-flamingo bg-brand-flamingo/5 text-brand-flamingo' 
                      : 'border-brand-latte/20 text-gray-500 hover:border-brand-flamingo'
                  }`}
                >
                  Standard Link
                </button>
                <button
                  type="button"
                  id="btn-category-ambassador"
                  onClick={() => {
                    setIsAmbassador(true);
                    setDestination('homepage');
                  }}
                  className={`py-2 px-3 text-xs font-semibold uppercase tracking-wider border rounded-[2px] text-center transition-colors ${
                    isAmbassador 
                      ? 'border-brand-flamingo bg-brand-flamingo/5 text-brand-flamingo' 
                      : 'border-brand-latte/20 text-gray-500 hover:border-brand-flamingo'
                  }`}
                >
                  Ambassador Link
                </button>
              </div>
            </div>

            {!isAmbassador ? (
              <>
                {/* Source Selection */}
                <div>
                  <label htmlFor="source-select" className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">
                    Campaign Source (utm_source)
                  </label>
                  <select
                    id="source-select"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-brand-grey/5 border border-brand-latte/20 rounded-[2px] p-2.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-brand-flamingo"
                  >
                    <option value="instagram">instagram</option>
                    <option value="threads">threads</option>
                    <option value="tiktok">tiktok</option>
                    <option value="whatsapp">whatsapp</option>
                    <option value="google">google</option>
                    <option value="facebook">facebook</option>
                  </select>
                </div>

                {/* Medium Selection */}
                <div>
                  <label htmlFor="medium-select" className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">
                    Campaign Medium (utm_medium)
                  </label>
                  <select
                    id="medium-select"
                    value={medium}
                    onChange={(e) => setMedium(e.target.value)}
                    className="w-full bg-brand-grey/5 border border-brand-latte/20 rounded-[2px] p-2.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-brand-flamingo"
                  >
                    <option value="bio">bio</option>
                    <option value="story">story</option>
                    <option value="reel">reel</option>
                    <option value="post">post</option>
                    <option value="broadcast">broadcast</option>
                    <option value="ad">ad</option>
                  </select>
                </div>

                {/* Campaign Name */}
                <div>
                  <label htmlFor="campaign-input" className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">
                    Campaign Name (utm_campaign)
                  </label>
                  <input
                    id="campaign-input"
                    type="text"
                    placeholder="e.g. july20-swaddle"
                    value={campaign}
                    onChange={(e) => setCampaign(e.target.value)}
                    className="w-full bg-brand-grey/5 border border-brand-latte/20 rounded-[2px] p-2.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-brand-flamingo"
                  />
                  <p className="text-[10px] text-gray-400 italic mt-1.5 leading-relaxed bg-brand-latte/5 p-2 border border-dashed border-brand-latte/20 rounded-[1px]">
                    💡 <strong>Consistency Tip:</strong> Use a standardized format of <strong>date + topic</strong> (e.g., <em>july20-swaddle</em> or <em>fall24-blankets</em>) to make reports clean.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Ambassador Platform Select */}
                <div>
                  <label htmlFor="ambassador-platform-select" className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">
                    Ambassador Platform / Channel
                  </label>
                  <select
                    id="ambassador-platform-select"
                    value={ambassadorPlatform}
                    onChange={(e) => setAmbassadorPlatform(e.target.value)}
                    className="w-full bg-brand-grey/5 border border-brand-latte/20 rounded-[2px] p-2.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-brand-flamingo"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="threads">Threads</option>
                  </select>
                </div>

                {/* Ambassador Name / Handle */}
                <div>
                  <label htmlFor="ambassador-name-input" className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">
                    Ambassador Name or Handle
                  </label>
                  <input
                    id="ambassador-name-input"
                    type="text"
                    placeholder="e.g. Sarah Tan or @sarahtan"
                    value={ambassadorName}
                    onChange={(e) => setAmbassadorName(e.target.value)}
                    className="w-full bg-brand-grey/5 border border-brand-latte/20 rounded-[2px] p-2.5 text-xs text-gray-700 font-medium focus:outline-none focus:border-brand-flamingo"
                  />
                  <p className="text-[10px] text-gray-400 italic mt-1.5 leading-relaxed bg-brand-latte/5 p-2 border border-dashed border-brand-latte/20 rounded-[1px]">
                    💡 This will automatically generate a clean tracking campaign tagged <strong>amb-{cleanCampaign(ambassadorName || 'name')}</strong> with source set to <strong>ambassador</strong>.
                  </p>
                </div>
              </>
            )}

            {/* Generated Link Result Section */}
            {((isAmbassador ? ambassadorName.trim() !== '' : campaign.trim() !== '')) && (
              <div className="bg-brand-latte/5 border border-brand-latte/20 p-4 space-y-4 rounded-[2px] animate-fade-in">
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-brand-flamingo block mb-1">Short Link (Auto 302 Redirect)</span>
                  <div className="flex gap-2 mb-3">
                    <input
                      id="short-url-output"
                      type="text"
                      readOnly
                      value={generatedShortUrl()}
                      className="w-full bg-white border border-brand-latte/20 p-1.5 text-[10px] font-mono text-gray-800 font-bold select-all rounded-[1px] focus:outline-none"
                    />
                    <button
                      type="button"
                      id="btn-copy-short"
                      onClick={() => handleCopy(generatedShortUrl(), 'short')}
                      className="px-2.5 py-1 bg-brand-flamingo text-white hover:bg-brand-gold transition-all rounded-[1px] font-sans text-[10px] uppercase font-bold flex items-center gap-1 shrink-0"
                    >
                      {copiedLink === `short-${generatedShortUrl()}` ? (
                        <>
                          <Check size={12} /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy
                        </>
                      )}
                    </button>
                  </div>

                  <span className="text-[9px] uppercase tracking-wider font-bold text-gray-500 block mb-1">Full Tagged Destination URL</span>
                  <div className="flex gap-2">
                    <input
                      id="full-url-output"
                      type="text"
                      readOnly
                      value={generatedOriginalUrl()}
                      className="w-full bg-white border border-brand-latte/20 p-1.5 text-[10px] font-mono text-gray-600 select-all rounded-[1px] focus:outline-none"
                    />
                    <button
                      type="button"
                      id="btn-copy-full"
                      onClick={() => handleCopy(generatedOriginalUrl(), 'full')}
                      className="px-2.5 py-1 bg-white border border-brand-latte/20 text-gray-600 hover:text-brand-flamingo hover:border-brand-flamingo transition-all rounded-[1px]"
                    >
                      {copiedLink === `full-${generatedOriginalUrl()}` ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-save-link"
                  className="w-full bg-brand-flamingo text-white py-2 text-xs font-bold uppercase tracking-widest hover:bg-brand-gold transition-colors flex items-center justify-center gap-1.5 rounded-[2px]"
                >
                  {saveSuccess ? (
                    <>
                      <Check size={14} />
                      Saved to History!
                    </>
                  ) : (
                    <>
                      <PlusCircle size={14} />
                      Save Link to History
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Link History Log */}
        <div className="lg:col-span-7 bg-white p-6 border border-brand-latte/20 rounded-[2px] shadow-sm flex flex-col min-h-[450px]">
          <h3 className="font-serif text-lg text-gray-900 border-b border-brand-latte/10 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar size={16} className="text-brand-flamingo" />
              Link Registry & History
            </span>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                confirmClearAll ? (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                    <span className="text-[10px] text-red-700 font-bold">Clear {history.length} links?</span>
                    <button
                      type="button"
                      onClick={handleClearAllHistory}
                      className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded hover:bg-red-700 transition-colors"
                    >
                      Yes, Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="text-[10px] bg-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-sans transition-colors flex items-center gap-1"
                    title="Clear all recorded links in registry"
                  >
                    <Trash2 size={11} /> Clear All History
                  </button>
                )
              )}
              <span className="text-[10px] bg-brand-latte/10 text-brand-flamingo px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans">
                {history.length} Links Saved
              </span>
            </div>
          </h3>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-400">
              <RefreshCw size={24} className="animate-spin mb-2" />
              <p className="text-xs uppercase tracking-wider font-bold">Retrieving saved links...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-400 border border-dashed border-brand-latte/10 rounded-[2px] mt-4 p-8">
              <FileText size={32} className="text-gray-300 mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider">No Links Found</p>
              <p className="text-[11px] text-center text-gray-400 mt-1 max-w-xs leading-relaxed font-light">
                Generate and save tracked links to log them in the persistent registry for reuse and analytics.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-brand-latte/10 text-[10px] uppercase tracking-wider font-bold text-gray-400">
                    <th className="pb-2.5 font-medium">Link Details</th>
                    <th className="pb-2.5 font-medium text-center">UTM Tags</th>
                    <th className="pb-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-latte/5">
                  {history.map((link) => (
                    <tr key={link.id} className="hover:bg-brand-latte/5 transition-colors">
                      <td className="py-3 pr-2 max-w-[220px]">
                        <p className="font-bold text-gray-800 truncate">{link.destinationName}</p>
                        {(link.shortCode || link.shortUrl) && (
                          <p className="text-[10px] text-brand-flamingo font-mono font-bold truncate mt-0.5" title={link.shortUrl || `https://onceuponmy.com/l/${link.shortCode}`}>
                            {link.shortUrl || `https://onceuponmy.com/l/${link.shortCode}`}
                          </p>
                        )}
                        <p className="text-[9px] text-gray-400 font-mono truncate mt-0.5" title={link.originalUrl}>
                          {link.originalUrl}
                        </p>
                      </td>
                      <td className="py-3 text-center">
                        <div className="inline-flex flex-wrap gap-1 justify-center max-w-[180px]">
                          <span className="text-[9px] bg-brand-latte/15 text-gray-600 px-1.5 py-0.5 rounded-[1px] font-semibold">
                            src: {link.source}
                          </span>
                          <span className="text-[9px] bg-brand-latte/15 text-gray-600 px-1.5 py-0.5 rounded-[1px] font-semibold">
                            med: {link.medium}
                          </span>
                          <span className="text-[9px] bg-brand-flamingo/10 text-brand-flamingo px-1.5 py-0.5 rounded-[1px] font-semibold">
                            camp: {link.campaign}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Reuse Button */}
                          <button
                            id={`btn-reuse-${link.id}`}
                            onClick={() => handleReuse(link)}
                            title="Load into builder"
                            className="p-1 text-gray-400 hover:text-brand-gold hover:bg-brand-latte/10 rounded transition-colors"
                          >
                            <RefreshCw size={14} />
                          </button>

                          {/* Copy Short Link */}
                          {(link.shortCode || link.shortUrl) && (
                            <button
                              id={`btn-copy-history-short-${link.id}`}
                              onClick={() => handleCopy(link.shortUrl || `https://onceuponmy.com/l/${link.shortCode}`, `histshort-${link.id}`)}
                              title="Copy Short Link"
                              className="px-1.5 py-1 text-[9px] font-bold uppercase tracking-wider bg-brand-flamingo/10 text-brand-flamingo hover:bg-brand-flamingo hover:text-white rounded transition-colors"
                            >
                              {copiedLink === `histshort-${link.id}-${link.shortUrl || `https://onceuponmy.com/l/${link.shortCode}`}` ? 'Copied' : 'Short'}
                            </button>
                          )}

                          {/* Copy Full */}
                          <button
                            id={`btn-copy-history-full-${link.id}`}
                            onClick={() => handleCopy(link.originalUrl, `histfull-${link.id}`)}
                            title="Copy Original Tagged Link"
                            className="p-1 text-gray-400 hover:text-brand-flamingo hover:bg-brand-latte/10 rounded transition-colors"
                          >
                            {copiedLink === `histfull-${link.id}-${link.originalUrl}` ? (
                              <Check size={14} className="text-green-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>

                          {/* Delete */}
                          {deletingId === link.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(link.id)}
                                className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded hover:bg-red-700 transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                className="text-[10px] bg-gray-200 text-gray-700 font-bold px-1.5 py-0.5 rounded hover:bg-gray-300 transition-colors"
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <button
                              id={`btn-delete-${link.id}`}
                              type="button"
                              onClick={() => setDeletingId(link.id)}
                              title="Delete link"
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
