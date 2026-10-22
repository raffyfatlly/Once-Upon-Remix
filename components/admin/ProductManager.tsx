import React, { useState, useRef, useMemo } from 'react';
import { Product } from '../../types';
import { 
  Trash2, Edit2, Plus, Upload, X, Loader2, Check, Link as LinkIcon, 
  Database, AlertTriangle, Box, Search, Filter, ShieldAlert, Sparkles, Tag, Layers
} from 'lucide-react';
import { addProductToDb, updateProductInDb, deleteProductFromDb, uploadImage } from '../../firebase';

interface ProductManagerProps {
  products: Product[];
}

export const ProductManager: React.FC<ProductManagerProps> = ({ products }) => {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'uploading' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  // Filter & Search states
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'hidden'>('all');
  
  // Refs for inputs
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);
  const [newAdditionalUrl, setNewAdditionalUrl] = useState('');

  // Classification Helpers
  const isCakenicProduct = (p: Product) => {
    if (!p) return false;
    const name = (p.name || '').toLowerCase();
    const collection = (p.collection || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    return Boolean(p.isCakenicOnly) || 
           p.productType === 'ticket' ||
           name.includes('cakenic') || 
           name.includes('ticket') || 
           collection.includes('cakenic') || 
           collection.includes('ticket') || 
           category.includes('cakenic') || 
           category.includes('ticket') || 
           id.includes('cakenic');
  };

  const isPerfumeOrHairOil = (p: Product) => {
    const name = (p.name || '').toLowerCase();
    return name.includes('perfume') || /\bhair oil\b|\bbody oil\b|\bessential oil\b|\bperfume oil\b|\boil\b/.test(name);
  };

  const isAddonProduct = (p: Product) => {
    if (!p) return false;
    if (isCakenicProduct(p)) return false;
    const name = (p.name || '').toLowerCase();
    const collection = (p.collection || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    const isOilProduct = isPerfumeOrHairOil(p);
    return Boolean(p.isCheckoutAddon) || 
           p.productType === 'addon' ||
           name.includes('perfume') || 
           name.includes('mirror') ||
           name.includes('signature') ||
           name.includes('card') ||
           name.includes('gift box') ||
           isOilProduct || 
           collection.includes('add-on') || 
           collection.includes('addon') || 
           category.includes('add-on') || 
           category.includes('addon');
  };

  const isLuggageCoverProduct = (p: Product) => {
    if (!p) return false;
    const collection = (p.collection || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    return p.productType === 'luggage-cover' || 
           collection.includes('luggage') || 
           category.includes('luggage');
  };

  const isBlanketProduct = (p: Product) => {
    if (!p || isCakenicProduct(p) || isAddonProduct(p) || isLuggageCoverProduct(p)) return false;
    if (p.productType === 'blanket') return true;
    const col = (p.collection || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    return !p.collection || col === 'blankets' || col.includes('blanket') || cat.includes('blanket');
  };

  const isSwaddleProduct = (p: Product) => {
    if (!p || isCakenicProduct(p) || isAddonProduct(p) || isLuggageCoverProduct(p) || isBlanketProduct(p)) return false;
    if (p.productType === 'swaddle') return true;
    const col = (p.collection || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    return col.includes('swaddle') || cat.includes('swaddle');
  };

  const getCollectionBadge = (p: Product) => {
    if (isCakenicProduct(p)) {
      return { label: 'Event Ticket', icon: '🎟️', style: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    if (isLuggageCoverProduct(p)) {
      return { label: 'Luggage Cover', icon: '🧳', style: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold' };
    }
    if (isAddonProduct(p)) {
      return { label: 'Add-on', icon: '💝', style: 'bg-purple-100 text-purple-700 border-purple-200' };
    }
    if (isBlanketProduct(p)) {
      return { label: 'Blanket', icon: '🧸', style: 'bg-brand-gold/15 text-brand-gold border-brand-gold/30' };
    }
    return { label: 'Swaddle', icon: '🌸', style: 'bg-brand-flamingo/15 text-brand-flamingo border-brand-flamingo/30' };
  };

  const getCategoryDefaultImage = (p: Product): string => {
    const name = (p.name || '').toLowerCase();
    if (isLuggageCoverProduct(p)) {
      if (name.includes('parisian')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1792298424226_The_Parisian_Flight_luggage_artwork.png?alt=media&token=407936c3-559b-4c6a-9dd3-ad356979f1da';
      if (name.includes('carousel') || name.includes('jubilee')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1792298687550_The_Carousel_luggage_artwork.png?alt=media&token=48bb2fc3-6d53-4a74-9c06-91c029544e54';
      if (name.includes('castle') || name.includes('dream')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1792298304514_The_Castle_luggage_artwork.png?alt=media&token=e78ee638-eeef-47bc-9e7a-4d2567bbb16e';
      if (name.includes('balloon')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1792477951374_45219.jpg?alt=media&token=db8f7b6f-e0f1-4171-8353-ceb73e157262';
      return '/luggage_cover_preview.jpg';
    }
    if (isCakenicProduct(p)) {
      if (name.includes('johor')) return 'https://i.postimg.cc/k4nQz3k2/IMG-20260805-WA0016.jpg';
      if (name.includes('putrajaya')) return 'https://i.postimg.cc/vTK541Dh/IMG-20260805-WA0017.jpg';
      return 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80';
    }
    if (isAddonProduct(p)) {
      if (name.includes('mirror') || name.includes('signature')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1782501093124_1000177117.png?alt=media&token=6fb4e66f-dcc5-47e2-961f-e3f366a51d5f';
      if (name.includes('3rd') || name.includes('box')) return 'https://i.postimg.cc/y8rptDBL/3rd-Edition-Box.png';
      return 'https://i.postimg.cc/Znyb8SXx/IMG-20260528-204109.png';
    }
    if (isSwaddleProduct(p)) {
      if (name.includes('express') || name.includes('dreamland')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1782497520663_hf_20260625_070121_893f9b35-d892-42e1-8d4f-3f0451c860b7.png?alt=media&token=c222a62f-8d73-423a-ad53-085cbf2f63a4';
      if (name.includes('bloomfield') || name.includes('park')) return 'https://i.postimg.cc/wTsY9b4m/Town-Park-Website.png';
      if (name.includes('parisian')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1782489173096_hf_20260625_080454_48a7c933-68ad-4fb8-b1e4-5ba7504e7851.png?alt=media&token=a8605cf5-7a5e-4e45-91ec-9b379985b6f4';
      if (name.includes('toy') || name.includes('waltz')) return 'https://i.postimg.cc/HsZ1m8g3/Music-Box-Website-(1).png';
      if (name.includes('town') || name.includes('square')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1782498941313_hf_20260625_055732_4a78d75b-bd29-49c3-86f3-854f01767ddc.png?alt=media&token=fed62418-4f2b-4c71-8878-fd5eff2b0702';
      if (name.includes('balloon')) return 'https://i.postimg.cc/44D3gtNX/Ballon-in-Sky-Website.png';
      if (name.includes('cottage')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1782498658074_hf_20260625_071405_b12cb5e6-0a25-4f68-9cca-dc33b34762b9.png?alt=media&token=c9cdb95e-6624-43f8-9b11-8dc3f2aa865a';
      if (name.includes('clock')) return 'https://i.postimg.cc/LhKpcrfJ/Clock-tower-Website-(1).png';
      if (name.includes('candy')) return 'https://i.postimg.cc/9QXv1m1V/the-Candy-house-website-swaddle.png';
      if (name.includes('tailor')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1782497718085_hf_20260625_095127_40469671-2d46-4f9e-9cf2-50f2b5b082a1.png?alt=media&token=ed460bc5-240c-4db4-a5ed-798944e3ef96';
      if (name.includes('whimsy')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1785771771027_hf_20260803_094530_88ef0a04-a0a6-442a-876c-e96b3dc415c1__2_.png?alt=media&token=9b563149-1531-4ed3-9dcf-12376f3f814c';
      if (name.includes('dresser')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1782498300761_hf_20260625_080138_916e14ee-d7b3-445b-8502-f68cf9db23e2.png?alt=media&token=2349406b-d0e3-4474-a959-3f15394f4d30';
      return 'https://i.postimg.cc/HsZ1m8g3/Music-Box-Website-(1).png';
    }
    // Blanket category
    if (name.includes('castle')) return 'https://i.postimg.cc/NGZkTM36/0ekjb3nj55rmt0cw35dbhcxvym.png';
    if (name.includes('balloon')) return 'https://i.postimg.cc/RFC4ch9D/The-Balloon-Ride-Blanket-(website).png';
    if (name.includes('marshmallow')) return 'https://i.postimg.cc/8ztbGWWj/the-marshmellwo-factory-website-blanket.jpg';
    if (name.includes('voyage')) return 'https://i.postimg.cc/yNjxt8Cf/the-little-voyage-blanket-website.jpg';
    if (name.includes('storybook')) return 'https://i.postimg.cc/BbLnkJNn/hf-20260630-143117-375e8d98-d52e-498d-bec6-fef11e091f6b.png';
    if (name.includes('carousel') || name.includes('jubilee')) return 'https://i.postimg.cc/xCdvjk4J/hf-20260621-132500-877d6234-2046-4040-be9d-df84527273c7.png';
    if (name.includes('dresser')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1780996824874_1000173648.png?alt=media&token=3d907de4-25b9-49bb-95b1-2bc0f1294a40';
    if (name.includes('whimsy')) return 'https://i.postimg.cc/k4wMZ8wp/The-Whimsy-Fair-Blanket-(Website).png';
    if (name.includes('playroom') || name.includes('pink')) return 'https://i.postimg.cc/x1cXkbhc/the-pink-playroom-blanket-website.jpg';
    if (name.includes('boutique')) return 'https://i.postimg.cc/J4XLMtNz/wmremove-transformed.png';
    if (name.includes('express') || name.includes('dreamland')) return 'https://i.postimg.cc/cHGKfK5p/Gemini-Generated-Image-hmi8hlhmi8hlhmi8.png';
    if (name.includes('parisian')) return 'https://i.postimg.cc/sDtHVKfx/1ekds8naxhrmt0cw35g9rc005r.png';
    if (name.includes('tailor')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1782497718085_hf_20260625_095127_40469671-2d46-4f9e-9cf2-50f2b5b082a1.png?alt=media&token=ed460bc5-240c-4db4-a5ed-798944e3ef96';
    if (name.includes('town') || name.includes('square')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1782498941313_hf_20260625_055732_4a78d75b-bd29-49c3-86f3-854f01767ddc.png?alt=media&token=fed62418-4f2b-4c71-8878-fd5eff2b0702';
    if (name.includes('train')) return 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1782497520663_hf_20260625_070121_893f9b35-d892-42e1-8d4f-3f0451c860b7.png?alt=media&token=c222a62f-8d73-423a-ad53-085cbf2f63a4';
    return 'https://i.postimg.cc/9QVBP1b5/Gemini-Generated-Image-s2ybu4s2ybu4s2yb.png';
  };

  const rawProducts = Array.isArray(products) ? products : [];
  
  // Priority ordering by group: Blankets (0), Swaddles (1), Luggage Cover (2), Add-ons (3), Events (4)
  const safeProducts = useMemo(() => {
    return [...rawProducts].sort((a, b) => {
      const getScore = (p: Product) => {
        if (isBlanketProduct(p)) return 0;
        if (isSwaddleProduct(p)) return 1;
        if (isLuggageCoverProduct(p)) return 2;
        if (isAddonProduct(p)) return 3;
        if (isCakenicProduct(p)) return 4;
        return 5;
      };
      const diff = getScore(a) - getScore(b);
      if (diff !== 0) return diff;

      // Luggage cover custom order: Parisian, Jubilee Carousel, Dream Castle, Balloon Ride
      if (isLuggageCoverProduct(a) && isLuggageCoverProduct(b)) {
        const getLuggagePriority = (name: string) => {
          const lower = (name || '').toLowerCase();
          if (lower.includes('parisian') || lower.includes('flight')) return 0;
          if (lower.includes('carousel') || lower.includes('jubilee')) return 1;
          if (lower.includes('castle') || lower.includes('dream')) return 2;
          if (lower.includes('balloon') || lower.includes('whimsy')) return 3;
          return 4;
        };
        const lpA = getLuggagePriority(a.name || '');
        const lpB = getLuggagePriority(b.name || '');
        if (lpA !== lpB) return lpA - lpB;
      }

      return (a.name || '').localeCompare(b.name || '');
    });
  }, [rawProducts]);

  // Dynamic collections from existing products
  const existingCollections = useMemo(() => {
    const set = new Set<string>();
    // Canonical default collections
    set.add('Luggage Cover');
    set.add('Blankets');
    set.add('Swaddle');
    set.add('Add-ons');
    set.add('Cakenic 2026');
    safeProducts.forEach(p => {
      if (p.collection && p.collection.trim()) {
        set.add(p.collection.trim());
      }
    });
    return Array.from(set).sort();
  }, [safeProducts]);

  const existingCategories = useMemo(() => {
    const set = new Set<string>(['Luggage Cover', 'Blankets', 'Swaddle', 'Add-on', 'Event Ticket']);
    safeProducts.forEach(p => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [safeProducts]);

  // Counts for each collection tab
  const counts = useMemo(() => {
    return {
      all: safeProducts.length,
      luggage: safeProducts.filter(isLuggageCoverProduct).length,
      blankets: safeProducts.filter(isBlanketProduct).length,
      swaddles: safeProducts.filter(isSwaddleProduct).length,
      addons: safeProducts.filter(isAddonProduct).length,
      events: safeProducts.filter(isCakenicProduct).length,
    };
  }, [safeProducts]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return safeProducts.filter(product => {
      // 1. Collection Filter
      if (selectedCollectionFilter !== 'all') {
        const sel = selectedCollectionFilter.toLowerCase();
        if (sel === 'luggage cover' || sel === 'luggage-cover') {
          if (!isLuggageCoverProduct(product)) return false;
        } else if (sel === 'blankets' || sel === 'blanket') {
          if (!isBlanketProduct(product)) return false;
        } else if (sel === 'swaddle' || sel === 'swaddles') {
          if (!isSwaddleProduct(product)) return false;
        } else if (sel === 'add-ons' || sel === 'addon' || sel === 'add-on') {
          if (!isAddonProduct(product)) return false;
        } else if (sel.includes('cakenic') || sel === 'events') {
          if (!isCakenicProduct(product)) return false;
        } else {
          // Exact collection match fallback
          if ((product.collection || '').toLowerCase() !== sel) return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === 'live' && product.isLive === false) return false;
      if (statusFilter === 'hidden' && product.isLive !== false) return false;

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (product.name || '').toLowerCase().includes(q);
        const skuMatch = (product.sku || '').toLowerCase().includes(q);
        const designMatch = (product.designName || '').toLowerCase().includes(q);
        const colMatch = (product.collection || '').toLowerCase().includes(q);
        const catMatch = (product.category || '').toLowerCase().includes(q);
        if (!nameMatch && !skuMatch && !designMatch && !colMatch && !catMatch) {
          return false;
        }
      }

      return true;
    });
  }, [safeProducts, selectedCollectionFilter, statusFilter, searchQuery]);

  // Form State
  const [formData, setFormData] = useState<Product>({
    id: '',
    name: '',
    price: 98,
    description: '',
    image: '',
    additionalImages: [],
    badge: 'Pre-Order',
    material: '',
    care: '',
    collection: 'Luggage Cover',
    category: 'Luggage Cover',
    size: 'Size M: 22"–26" / Size L: 28"–32"',
    stock: 0,
    hasSizes: true,
    babyPrice: 98,
    adultPrice: 118,
    babySizeDesc: 'Size M: 22" – 26" Luggage',
    adultSizeDesc: 'Size L: 28" – 32" Luggage',
    isCheckoutAddon: false,
    isPosOnly: false,
    isCakenicOnly: false,
    isLive: true,
    sku: '',
    designName: '',
    productType: 'luggage-cover',
    noSizeReplacement: true,
  });

  const applyCollectionPreset = (type: 'luggage' | 'blanket' | 'swaddle' | 'addon' | 'cakenic') => {
    if (type === 'luggage') {
      setFormData(prev => ({
        ...prev,
        collection: 'Luggage Cover',
        category: 'Luggage Cover',
        productType: 'luggage-cover',
        hasSizes: true,
        price: 98,
        babyPrice: 98,
        adultPrice: 118,
        babySizeDesc: 'Size M: 22" – 26" Luggage',
        adultSizeDesc: 'Size L: 28" – 32" Luggage',
        size: 'Size M: 22"–26" / Size L: 28"–32"',
        badge: 'Pre-Order',
        noSizeReplacement: true,
        material: 'High-Elasticity Spandex & Polyester Blend. Heavy-duty, tear-resistant, dust-proof & scratch-resistant travel cover with dual-top handle openings, side handle access, and secure bottom zipper with buckle strap.',
        care: 'Machine wash in laundry wash bag on delicate/cold cycle. Hang flat to dry. Do not bleach or iron directly over printed artwork.',
        sku: prev.sku || (prev.name ? `LC-${prev.name.toUpperCase().replace(/\s+/g, '-')}` : 'LC-')
      }));
    } else if (type === 'blanket') {
      setFormData(prev => ({
        ...prev,
        collection: 'Blankets',
        category: 'Blankets',
        productType: 'blanket',
        hasSizes: true,
        price: 185,
        babyPrice: 185,
        adultPrice: 225,
        babySizeDesc: '120 cm x 120 cm',
        adultSizeDesc: '150 cm x 150 cm',
        size: '120cm x 120cm',
        noSizeReplacement: false,
        material: '100% Grade-A Mongolian Cashmere',
        care: 'Dry clean recommended. Hand wash cold with gentle detergent. Lay flat to dry.',
        sku: prev.sku || (prev.name ? `BL-${prev.name.toUpperCase().replace(/\s+/g, '-')}` : 'BL-')
      }));
    } else if (type === 'swaddle') {
      setFormData(prev => ({
        ...prev,
        collection: 'Swaddle',
        category: 'Swaddle',
        productType: 'swaddle',
        hasSizes: false,
        price: 88,
        size: '120cm x 120cm',
        noSizeReplacement: false,
        material: '70% Bamboo, 30% Organic Cotton',
        care: 'Machine wash delicate cycle in laundry bag. Tumble dry low.',
        sku: prev.sku || (prev.name ? `SW-${prev.name.toUpperCase().replace(/\s+/g, '-')}` : 'SW-')
      }));
    } else if (type === 'addon') {
      setFormData(prev => ({
        ...prev,
        collection: 'Add-ons',
        category: 'Add-on',
        productType: 'addon',
        hasSizes: false,
        isCheckoutAddon: true,
        noSizeReplacement: false,
        sku: prev.sku || (prev.name ? `ADD-${prev.name.toUpperCase().replace(/\s+/g, '-')}` : 'ADD-')
      }));
    } else if (type === 'cakenic') {
      setFormData(prev => ({
        ...prev,
        collection: 'Cakenic 2026',
        category: 'Event Ticket',
        productType: 'ticket',
        hasSizes: false,
        isCakenicOnly: true,
        noSizeReplacement: false,
        sku: prev.sku || (prev.name ? `TIK-${prev.name.toUpperCase().replace(/\s+/g, '-')}` : 'TIK-')
      }));
    }
  };

  const handleEdit = (product: Product) => {
    const isLuggage = isLuggageCoverProduct(product);
    setFormData({
      ...product,
      collection: product.collection || (isLuggage ? 'Luggage Cover' : 'Blankets'),
      category: product.category || (isLuggage ? 'Luggage Cover' : ''),
      additionalImages: product.additionalImages || [],
      size: product.size || (isLuggage ? 'Size M: 22"–26" / Size L: 28"–32"' : ''),
      stock: product.stock !== undefined ? product.stock : 0,
      hasSizes: product.hasSizes !== undefined ? product.hasSizes : isLuggage,
      babyPrice: product.babyPrice !== undefined ? product.babyPrice : (isLuggage ? 88 : 88),
      adultPrice: product.adultPrice !== undefined ? product.adultPrice : (isLuggage ? 108 : 108),
      babySizeDesc: product.babySizeDesc || (isLuggage ? 'Size M: 22" – 26" Luggage' : '70 cm x 100 cm'),
      adultSizeDesc: product.adultSizeDesc || (isLuggage ? 'Size L: 28" – 32" Luggage' : '150 cm x 100 cm'),
      isCheckoutAddon: product.isCheckoutAddon || false,
      isPosOnly: product.isPosOnly || false,
      isCakenicOnly: product.isCakenicOnly || false,
      isLive: product.isLive !== undefined ? product.isLive : true,
      sku: product.sku || '',
      designName: product.designName || product.name || '',
      productType: product.productType || (isLuggage ? 'luggage-cover' : isBlanketProduct(product) ? 'blanket' : isSwaddleProduct(product) ? 'swaddle' : isAddonProduct(product) ? 'addon' : 'other'),
      noSizeReplacement: product.noSizeReplacement !== undefined ? product.noSizeReplacement : isLuggage
    });
    setEditingProduct(product);
    setIsEditing(true);
    setSaveStatus('idle');
    setErrorMessage('');
    setNewAdditionalUrl('');
  };

  const handleCreate = (defaultCollection: string = 'Luggage Cover') => {
    const isLuggage = defaultCollection.toLowerCase().includes('luggage');
    setFormData({
      id: '',
      name: '',
      price: isLuggage ? 98 : 185,
      description: '',
      image: '',
      additionalImages: [],
      badge: isLuggage ? 'Pre-Order' : '',
      material: isLuggage 
        ? 'High-Elasticity Spandex & Polyester Blend. Heavy-duty, tear-resistant, dust-proof & scratch-resistant travel cover with dual-top handle openings, side handle access, and secure bottom zipper with buckle strap.' 
        : '',
      care: isLuggage 
        ? 'Machine wash in laundry wash bag on delicate/cold cycle. Hang flat to dry. Do not bleach or iron directly over printed artwork.' 
        : '',
      collection: defaultCollection,
      category: defaultCollection,
      size: isLuggage ? 'Size M: 22"–26" / Size L: 28"–32"' : '',
      stock: 0,
      hasSizes: isLuggage,
      babyPrice: isLuggage ? 98 : 185,
      adultPrice: isLuggage ? 118 : 225,
      babySizeDesc: isLuggage ? 'Size M: 22" – 26" Luggage' : '70 cm x 100 cm',
      adultSizeDesc: isLuggage ? 'Size L: 28" – 32" Luggage' : '150 cm x 100 cm',
      isCheckoutAddon: false,
      isPosOnly: false,
      isCakenicOnly: false,
      isLive: true,
      sku: '',
      designName: '',
      productType: isLuggage ? 'luggage-cover' : 'blanket',
      noSizeReplacement: isLuggage
    });
    setEditingProduct(null);
    setIsEditing(true);
    setSaveStatus('idle');
    setErrorMessage('');
    setNewAdditionalUrl('');
  };

  const handleDeleteClick = (id: string) => {
    if (deleteConfirmation === id) {
      handleDelete(id);
    } else {
      setDeleteConfirmation(id);
      setTimeout(() => {
        setDeleteConfirmation(prev => prev === id ? null : prev);
      }, 3000);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteConfirmation(null);
    try {
      await deleteProductFromDb(id);
    } catch (error: any) {
      console.error("Delete Error:", error);
      const msg = error.message || "Unknown error";
      alert("Failed to delete product: " + msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    const SEED_DATA = [
      // 4 Luggage Covers (Sorted: Parisian Flight, Jubilee Carousel, Dream Castle, Balloon Ride)
      {
        name: 'The Parisian Flight',
        designName: 'The Parisian Flight',
        sku: 'LC-THE-PARISIAN-FLIGHT',
        productType: 'luggage-cover',
        collection: 'Luggage Cover',
        category: 'Luggage Cover',
        price: 98,
        stock: 50,
        badge: 'Pre-Order',
        hasSizes: true,
        babyPrice: 98,
        adultPrice: 118,
        babySizeDesc: 'Size M: 22" – 26" Luggage',
        adultSizeDesc: 'Size L: 28" – 32" Luggage',
        size: 'Size M: 22"–26" / Size L: 28"–32"',
        noSizeReplacement: true,
        description: 'A majestic voyage begins. Drift into new adventures with vintage hot-air balloons soaring over Parisian rooftops. Once Upon a Traveller — New places, same dreams, together.',
        material: 'High-Elasticity Spandex & Polyester Blend. Heavy-duty, tear-resistant, dust-proof & scratch-resistant travel cover with dual-top handle openings, side handle access, and secure bottom zipper with buckle strap.',
        care: 'Machine wash in laundry wash bag on delicate/cold cycle. Hang flat to dry. Do not bleach or iron directly over printed artwork.',
        image: 'https://firebasestorage.googleapis.com/v0/b/once-upon-24709.firebasestorage.app/o/images%2F1792298424226_The_Parisian_Flight_luggage_artwork.png?alt=media&token=407936c3-559b-4c6a-9dd3-ad356979f1da',
        isLive: true
      },
      {
        name: 'The Jubilee Carousel',
        designName: 'The Jubilee Carousel',
        sku: 'LC-THE-JUBILEE-CAROUSEL',
        productType: 'luggage-cover',
        collection: 'Luggage Cover',
        category: 'Luggage Cover',
        price: 98,
        stock: 50,
        badge: 'Pre-Order',
        hasSizes: true,
        babyPrice: 98,
        adultPrice: 118,
        babySizeDesc: 'Size M: 22" – 26" Luggage',
        adultSizeDesc: 'Size L: 28" – 32" Luggage',
        size: 'Size M: 22"–26" / Size L: 28"–32"',
        noSizeReplacement: true,
        description: 'A timeless celebration in motion. Beneath an elegantly adorned canopy, The Bear leads his companions on a joyous carnival ride, bringing nostalgic charm and storybook wonder to every airport terminal.',
        material: 'High-Elasticity Spandex & Polyester Blend. Heavy-duty, tear-resistant, dust-proof & scratch-resistant travel cover with dual-top handle openings, side handle access, and secure bottom zipper with buckle strap.',
        care: 'Machine wash in laundry wash bag on delicate/cold cycle. Hang flat to dry. Do not bleach or iron directly over printed artwork.',
        image: 'https://i.postimg.cc/xCdvjk4J/hf-20260621-132500-877d6234-2046-4040-be9d-df84527273c7.png',
        isLive: true
      },
      {
        name: 'The Dream Castle',
        designName: 'The Dream Castle',
        sku: 'LC-THE-DREAM-CASTLE',
        productType: 'luggage-cover',
        collection: 'Luggage Cover',
        category: 'Luggage Cover',
        price: 98,
        stock: 50,
        badge: 'Pre-Order',
        hasSizes: true,
        babyPrice: 98,
        adultPrice: 118,
        babySizeDesc: 'Size M: 22" – 26" Luggage',
        adultSizeDesc: 'Size L: 28" – 32" Luggage',
        size: 'Size M: 22"–26" / Size L: 28"–32"',
        noSizeReplacement: true,
        description: 'A royal kingdom of imagination floating in the clouds. Subtle turret details and starry accents shield your luggage in fairytale elegance on every expedition.',
        material: 'High-Elasticity Spandex & Polyester Blend. Heavy-duty, tear-resistant, dust-proof & scratch-resistant travel cover with dual-top handle openings, side handle access, and secure bottom zipper with buckle strap.',
        care: 'Machine wash in laundry wash bag on delicate/cold cycle. Hang flat to dry. Do not bleach or iron directly over printed artwork.',
        image: 'https://i.postimg.cc/NGZkTM36/0ekjb3nj55rmt0cw35dbhcxvym.png',
        isLive: true
      },
      {
        name: 'The Balloon Ride',
        designName: 'The Balloon Ride',
        sku: 'LC-THE-BALLOON-RIDE',
        productType: 'luggage-cover',
        collection: 'Luggage Cover',
        category: 'Luggage Cover',
        price: 98,
        stock: 50,
        badge: 'Pre-Order',
        hasSizes: true,
        babyPrice: 98,
        adultPrice: 118,
        babySizeDesc: 'Size M: 22" – 26" Luggage',
        adultSizeDesc: 'Size L: 28" – 32" Luggage',
        size: 'Size M: 22"–26" / Size L: 28"–32"',
        noSizeReplacement: true,
        description: 'Rising gently above the sleeping rooftops. Holding fast to silken ropes, The Bear and companions drift past chimney tops and morning clouds, watching the town grow small and golden below.',
        material: 'High-Elasticity Spandex & Polyester Blend. Heavy-duty, tear-resistant, dust-proof & scratch-resistant travel cover with dual-top handle openings, side handle access, and secure bottom zipper with buckle strap.',
        care: 'Machine wash in laundry wash bag on delicate/cold cycle. Hang flat to dry. Do not bleach or iron directly over printed artwork.',
        image: 'https://i.postimg.cc/k4wMZ8wp/The-Whimsy-Fair-Blanket-(Website).png',
        isLive: true
      },
      // Blankets
      {
        name: 'The Dream Castle',
        designName: 'The Dream Castle',
        sku: 'BL-THE-DREAM-CASTLE',
        productType: 'blanket',
        price: 185,
        description: 'An intricate illustration of a whimsical palace in the clouds. Woven from the finest cashmere, this piece features subtle turret details and starry accents.',
        image: 'https://i.postimg.cc/9QVBP1b5/Gemini-Generated-Image-s2ybu4s2ybu4s2yb.png',
        material: '100% Grade-A Mongolian Cashmere',
        care: 'Dry clean recommended. Hand wash cold with gentle detergent. Lay flat to dry.',
        collection: 'Blankets',
        category: 'Blankets',
        size: '120cm x 120cm',
        stock: 50,
        hasSizes: true,
        babyPrice: 185,
        babySizeDesc: '120 cm x 120 cm',
        adultPrice: 225,
        adultSizeDesc: '150 cm x 150 cm',
        isLive: true
      },
      {
        name: 'The Parisian Flight',
        designName: 'The Parisian Flight',
        sku: 'BL-THE-PARISIAN-FLIGHT',
        productType: 'blanket',
        price: 145,
        description: 'A majestic voyage begins. Vintage hot air balloons drifting over Parisian rooftops. A delicate blend of organic cotton and silk, finished with a refined latte border.',
        image: 'https://picsum.photos/seed/vintage-balloon/600/800',
        material: '80% Organic Cotton, 20% Mulberry Silk',
        care: 'Machine wash delicate cycle in laundry bag. Tumble dry low.',
        collection: 'Blankets',
        category: 'Blankets',
        size: '110cm x 110cm',
        stock: 50,
        hasSizes: true,
        babyPrice: 145,
        babySizeDesc: '110 cm x 110 cm',
        adultPrice: 185,
        adultSizeDesc: '150 cm x 150 cm',
        isLive: true
      },
      // Tickets
      {
        id: 'cakenic-ticket-putrajaya',
        name: 'Cakenic Putrajaya',
        price: 68,
        description: 'Join us at Taman Botani Putrajaya (Theme: European Classical) for an unforgettable afternoon of cake sharing, picnic vibes, and sweet memories. Saturday, September 12, 2026.',
        image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80',
        category: 'Event Ticket',
        collection: 'Cakenic Ticket',
        productType: 'ticket',
        isCakenicOnly: true,
        stock: 45,
        isLive: true
      },
      {
        id: 'cakenic-ticket-johor',
        name: 'Cakenic JOHOR',
        price: 88,
        description: "An exclusive Southern Cakenic gathering at Eco Spring Garden (Theme: Rocco's Masquerade) featuring curated gift bags, prizes, and a dream botanical picnic setting. Saturday, October 24, 2026.",
        image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
        category: 'Event Ticket',
        collection: 'Cakenic Ticket',
        productType: 'ticket',
        isCakenicOnly: true,
        stock: 30,
        isLive: true
      }
    ];

    try {
      for (const data of SEED_DATA) {
        await addProductToDb(data as any);
      }
      alert("Sample catalog uploaded successfully! Products will appear shortly.");
    } catch (error: any) {
      console.error("Seed Error:", error);
      alert(`Error uploading data: ${error.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setErrorMessage('');
    
    try {
      const isLuggage = formData.collection?.toLowerCase().includes('luggage') || formData.productType === 'luggage-cover';
      const cleanData: any = {
        ...formData,
        collection: formData.collection?.trim() || 'Blankets',
        category: formData.category?.trim() || (isLuggage ? 'Luggage Cover' : ''),
        designName: formData.designName?.trim() || formData.name?.trim(),
        productType: formData.productType || (isLuggage ? 'luggage-cover' : 'blanket'),
        noSizeReplacement: Boolean(formData.noSizeReplacement || isLuggage),
      };

      if (editingProduct && editingProduct.id) {
        const { id, ...data } = cleanData;
        await updateProductInDb(id, data);
      } else {
        const { id, ...data } = cleanData;
        await addProductToDb(data);
      }
      setSaveStatus('saved');
      setTimeout(() => {
        setIsEditing(false);
        setSaveStatus('idle');
      }, 1000);
    } catch (error: any) {
      console.error(error);
      setSaveStatus('error');
      setErrorMessage(error.message || "Unknown error");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'additional') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File too large. Please select an image under 5MB.");
        return;
      }
      setSaveStatus('uploading');
      setErrorMessage('');
      
      try {
        const downloadURL = await uploadImage(file);
        if (type === 'product') {
          setFormData(prev => ({ ...prev, image: downloadURL }));
        } else if (type === 'additional') {
          setFormData(prev => ({ 
            ...prev, 
            additionalImages: [...(prev.additionalImages || []), downloadURL] 
          }));
        }
        setSaveStatus('idle');
      } catch (error: any) {
        console.error("Upload failed details:", error);
        setSaveStatus('error');
        setErrorMessage(error.message || "Upload Failed");
      }
    }
  };

  const addUrlToAdditional = () => {
    if (!newAdditionalUrl) return;
    setFormData(prev => ({
      ...prev,
      additionalImages: [...(prev.additionalImages || []), newAdditionalUrl]
    }));
    setNewAdditionalUrl('');
  };

  const removeAdditionalImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additionalImages: prev.additionalImages?.filter((_, i) => i !== index) || []
    }));
  };

  const isCurrentFormLuggage = formData.collection?.toLowerCase().includes('luggage') || formData.productType === 'luggage-cover';

  return (
    <div className="w-full max-w-full min-w-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 w-full min-w-0">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-gray-900">Product Management</h2>
          <p className="text-xs text-gray-500 mt-1">
            Organize catalog, distinguish blankets & luggage cover design collections, manage sizes and stock.
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button 
            onClick={() => handleCreate(selectedCollectionFilter === 'all' ? 'Luggage Cover' : selectedCollectionFilter)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-flamingo transition-colors rounded-[2px] shadow-sm"
          >
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      {isEditing ? (
        /* Edit / Create Form View */
        <div className="bg-white p-4 sm:p-6 md:p-8 border border-brand-latte/20 shadow-sm animate-fade-in max-w-3xl mx-auto rounded-[2px] w-full min-w-0">
          <div className="flex items-center justify-between border-b border-brand-latte/20 pb-4 mb-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">Product Editor</span>
              <h3 className="font-serif text-xl md:text-2xl text-gray-900">
                {editingProduct ? `Edit: ${editingProduct.name}` : 'Create New Product'}
              </h3>
            </div>
            <button 
              type="button" 
              onClick={() => setIsEditing(false)}
              className="text-gray-400 hover:text-gray-700 p-1"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Collection Preset Buttons */}
          <div className="mb-6 bg-brand-grey/5 p-4 rounded border border-brand-latte/20">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              ⚡ Quick Collection Presets (Auto-fills pricing, specs & sizing):
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyCollectionPreset('luggage')}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                  isCurrentFormLuggage 
                    ? 'bg-amber-100 text-amber-800 border-amber-400 ring-2 ring-amber-300' 
                    : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400 hover:bg-amber-50'
                }`}
              >
                <span>🧳</span> Luggage Cover (Pre-Order)
              </button>
              <button
                type="button"
                onClick={() => applyCollectionPreset('blanket')}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                  formData.collection?.toLowerCase().includes('blanket')
                    ? 'bg-brand-gold/15 text-brand-gold border-brand-gold ring-2 ring-brand-gold/30'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-brand-gold hover:bg-brand-gold/5'
                }`}
              >
                <span>🧸</span> Blankets
              </button>
              <button
                type="button"
                onClick={() => applyCollectionPreset('swaddle')}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                  formData.collection?.toLowerCase().includes('swaddle')
                    ? 'bg-brand-flamingo/15 text-brand-flamingo border-brand-flamingo ring-2 ring-brand-flamingo/30'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-brand-flamingo hover:bg-brand-flamingo/5'
                }`}
              >
                <span>🌸</span> Swaddle
              </button>
              <button
                type="button"
                onClick={() => applyCollectionPreset('addon')}
                className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border bg-white text-gray-700 border-gray-300 hover:border-purple-300 hover:bg-purple-50"
              >
                <span>💝</span> Add-on
              </button>
              <button
                type="button"
                onClick={() => applyCollectionPreset('cakenic')}
                className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border bg-white text-gray-700 border-gray-300 hover:border-rose-300 hover:bg-rose-50"
              >
                <span>🎟️</span> Cakenic Ticket
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5 md:gap-6">
            {/* Name & Design Name distinction */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Product Display Name <span className="text-red-500">*</span>
                </label>
                <input 
                  required 
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" 
                  value={formData.name} 
                  onChange={e => {
                    const name = e.target.value;
                    setFormData(prev => ({
                      ...prev, 
                      name,
                      designName: prev.designName || name
                    }));
                  }} 
                  placeholder="e.g. The Dream Castle"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <span>Design Artwork Name (For DB Distinction)</span>
                  <span className="text-gray-400 font-normal text-[9px] lowercase">(e.g. shared artwork)</span>
                </label>
                <input 
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" 
                  value={formData.designName || ''} 
                  onChange={e => setFormData({...formData, designName: e.target.value})}
                  placeholder="e.g. The Dream Castle"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Keeps blankets and luggage covers distinguished cleanly in Firestore even if they share the same title.
                </p>
              </div>
            </div>

            {/* Collection & SKU */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Collection <span className="text-red-500">*</span>
                </label>
                <input 
                  required
                  list="collection-options"
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5 font-medium" 
                  value={formData.collection || ''} 
                  onChange={e => setFormData({...formData, collection: e.target.value})}
                  placeholder="e.g. Luggage Cover"
                />
                <datalist id="collection-options">
                  {existingCollections.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                  Product Type
                </label>
                <select
                  value={formData.productType || 'luggage-cover'}
                  onChange={e => setFormData({...formData, productType: e.target.value as any})}
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5 font-medium"
                >
                  <option value="luggage-cover">Luggage Cover</option>
                  <option value="blanket">Blanket</option>
                  <option value="swaddle">Swaddle</option>
                  <option value="addon">Add-on Item</option>
                  <option value="ticket">Event Ticket</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                  SKU (Unique Identifier)
                </label>
                <input 
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5 font-mono text-xs uppercase" 
                  value={formData.sku || ''} 
                  onChange={e => setFormData({...formData, sku: e.target.value.toUpperCase()})}
                  placeholder="e.g. LC-THE-DREAM-CASTLE"
                />
              </div>
            </div>

            {/* Pricing, Stock, Badge */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Base Price (RM) <span className="text-red-500">*</span>
                </label>
                <input 
                  required 
                  type="number" 
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5 font-mono" 
                  value={formData.price} 
                  onChange={e => setFormData({...formData, price: Number(e.target.value)})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Stock Quantity</label>
                <input 
                  required 
                  type="number" 
                  min="0" 
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5 font-mono" 
                  value={formData.stock} 
                  onChange={e => setFormData({...formData, stock: Number(e.target.value)})} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Badge</label>
                <input 
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" 
                  placeholder="e.g. Pre-Order, New, Bestseller" 
                  value={formData.badge || ''} 
                  onChange={e => setFormData({...formData, badge: e.target.value})} 
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
              <textarea 
                required 
                rows={3} 
                className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5 leading-relaxed" 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
              />
            </div>
            
            {/* Material & Size */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Material</label>
                <input 
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5 text-xs" 
                  value={formData.material || ''} 
                  onChange={e => setFormData({...formData, material: e.target.value})} 
                  placeholder="e.g. High-Elasticity Spandex & Polyester Blend"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Default Size / Dimensions Label</label>
                <input 
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5 text-xs" 
                  placeholder="e.g. Size M: 22''–26'' / Size L: 28''–32''" 
                  value={formData.size || ''} 
                  onChange={e => setFormData({...formData, size: e.target.value})} 
                />
              </div>
            </div>

            {/* STRICT NO SIZE REPLACEMENT POLICY CONFIG (Key feature for Luggage Covers) */}
            <div className={`p-4 rounded border transition-all ${
              formData.noSizeReplacement 
                ? 'bg-amber-50/80 border-amber-300' 
                : 'bg-brand-grey/5 border-brand-latte/20'
            }`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={Boolean(formData.noSizeReplacement)} 
                  onChange={e => setFormData({...formData, noSizeReplacement: e.target.checked})} 
                  className="accent-brand-flamingo w-4 h-4 mt-0.5" 
                />
                <div>
                  <span className="text-xs font-bold text-gray-900 block flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-amber-600" />
                    Strictly No Size Replacement Policy (Luggage Covers & Custom Sized Items)
                  </span>
                  <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                    When checked, customers are explicitly reminded to measure their suitcase (height, width, depth) before purchasing, and warnings are clearly shown in the size picker, product page, cart, and checkout confirming that size replacements are not accepted.
                  </p>
                </div>
              </label>
            </div>

            {/* Sizing Options Config */}
            <div className="p-4 border border-brand-latte/30 bg-white rounded flex flex-col gap-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-900 uppercase tracking-wider mb-1 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.hasSizes || false} 
                    onChange={e => setFormData({...formData, hasSizes: e.target.checked})} 
                    className="accent-brand-flamingo w-4 h-4" 
                  />
                  Enable Two-Tier Sizing Variants ({isCurrentFormLuggage ? 'Size M & Size L' : 'Baby & Adult'})
                </label>
                <p className="text-[10px] text-gray-500">
                  {isCurrentFormLuggage 
                    ? 'Allows customers to select between Size M (22"-26" luggage) and Size L (28"-32" luggage).'
                    : 'Allows customers to choose between baby and adult blanket sizes.'}
                </p>
              </div>

              {formData.hasSizes && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-brand-latte/20">
                  {/* Variant 1 */}
                  <div className="bg-brand-grey/5 p-4 rounded border border-brand-latte/20">
                    <p className="text-xs font-bold mb-3 text-gray-900 border-b border-brand-latte/20 pb-2 flex items-center justify-between">
                      <span>{isCurrentFormLuggage ? '🧳 Size M Variant (22" – 26")' : '👶 Baby Variant'}</span>
                      <span className="text-[10px] text-gray-400 font-mono">babyPrice</span>
                    </p>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Price (RM)</label>
                        <input 
                          type="number" 
                          className="w-full border p-2 text-sm focus:border-brand-flamingo outline-none bg-white font-mono" 
                          value={formData.babyPrice} 
                          onChange={e => setFormData({...formData, babyPrice: Number(e.target.value)})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Dimensions / Description</label>
                        <input 
                          className="w-full border p-2 text-sm focus:border-brand-flamingo outline-none bg-white" 
                          value={formData.babySizeDesc || ''} 
                          onChange={e => setFormData({...formData, babySizeDesc: e.target.value})} 
                          placeholder={isCurrentFormLuggage ? 'Size M: 22" – 26" Luggage' : '70 cm x 100 cm'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Variant 2 */}
                  <div className="bg-brand-grey/5 p-4 rounded border border-brand-latte/20">
                    <p className="text-xs font-bold mb-3 text-gray-900 border-b border-brand-latte/20 pb-2 flex items-center justify-between">
                      <span>{isCurrentFormLuggage ? '🧳 Size L Variant (28" – 32")' : '🧑 Adult Variant'}</span>
                      <span className="text-[10px] text-gray-400 font-mono">adultPrice</span>
                    </p>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Price (RM)</label>
                        <input 
                          type="number" 
                          className="w-full border p-2 text-sm focus:border-brand-flamingo outline-none bg-white font-mono" 
                          value={formData.adultPrice} 
                          onChange={e => setFormData({...formData, adultPrice: Number(e.target.value)})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Dimensions / Description</label>
                        <input 
                          className="w-full border p-2 text-sm focus:border-brand-flamingo outline-none bg-white" 
                          value={formData.adultSizeDesc || ''} 
                          onChange={e => setFormData({...formData, adultSizeDesc: e.target.value})} 
                          placeholder={isCurrentFormLuggage ? 'Size L: 28" – 32" Luggage' : '150 cm x 100 cm'}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Store Visibility Controls */}
            <div className="p-4 border border-brand-latte/20 bg-brand-grey/5 rounded flex flex-col gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-900 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.isLive !== false} 
                  onChange={e => setFormData({...formData, isLive: e.target.checked})} 
                  className="accent-brand-flamingo w-4 h-4" 
                />
                Product is Live on Website (Visible to Public)
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-gray-900 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={Boolean(formData.isPosOnly)} 
                  onChange={e => setFormData({...formData, isPosOnly: e.target.checked})} 
                  className="accent-brand-flamingo w-4 h-4" 
                />
                Set as POS Only (Hidden from Online Store, Cashier Register Only)
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-gray-900 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={Boolean(formData.isCheckoutAddon)} 
                  onChange={e => setFormData({...formData, isCheckoutAddon: e.target.checked})} 
                  className="accent-brand-flamingo w-4 h-4" 
                />
                Offer as Recommended Checkout Add-On
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-gray-900 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={Boolean(formData.isCakenicOnly)} 
                  onChange={e => setFormData({...formData, isCakenicOnly: e.target.checked})} 
                  className="accent-brand-flamingo w-4 h-4" 
                />
                Cakenic Event Ticket Only (Exclude from Main Catalog)
              </label>
            </div>

            {/* Care instructions */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Care Instructions</label>
              <textarea 
                rows={2} 
                className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5 leading-relaxed" 
                value={formData.care || ''} 
                onChange={e => setFormData({...formData, care: e.target.value})} 
              />
            </div>
            
            {/* Main Image Upload/URL Section */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Main Product Image</label>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full min-w-0">
                  <div className="relative flex-1 min-w-0">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <LinkIcon size={14} />
                    </div>
                    <input 
                      className="w-full border p-3 pl-9 pr-8 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5 font-mono text-xs" 
                      placeholder="Paste Image URL here..."
                      value={formData.image} 
                      onChange={e => setFormData({...formData, image: e.target.value})} 
                    />
                    {formData.image && (
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, image: ''})}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  
                  <span className="text-[10px] text-gray-400 font-bold uppercase text-center sm:mx-1">OR</span>
                  
                  <button 
                    type="button"
                    onClick={() => productFileInputRef.current?.click()}
                    className="bg-white border border-brand-latte/30 text-gray-600 hover:text-brand-flamingo hover:border-brand-flamingo px-4 py-3 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider justify-center w-full sm:w-auto sm:min-w-[100px]"
                    title="Upload Photo"
                    disabled={saveStatus === 'uploading'}
                  >
                    {saveStatus === 'uploading' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 
                    Upload
                  </button>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={productFileInputRef}
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'product')}
                  />
                </div>
                
                {saveStatus === 'error' && (
                  <div className="bg-red-50 p-4 rounded border border-red-100 flex flex-col gap-2 animate-fade-in">
                    <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                      <AlertTriangle size={16} />
                      <span>Upload Failed</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{errorMessage}</p>
                  </div>
                )}

                <div className="flex items-start gap-4 p-4 border border-dashed border-brand-latte/30 bg-brand-grey/5 rounded mt-2">
                  {formData.image ? (
                    <img src={formData.image} alt="Preview" className="w-20 h-28 object-cover border border-brand-latte/30 bg-white rounded" />
                  ) : (
                    <div className="w-20 h-28 bg-brand-latte/10 flex items-center justify-center text-gray-400 text-xs text-center border border-brand-latte/20 rounded">No Image</div>
                  )}
                  <div>
                    <p className="text-xs text-gray-700 font-bold uppercase tracking-wider mb-1">Image Preview</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed max-w-xs">
                      Supports PNG, JPG, or WebP. Portrait 3:4 aspect ratio recommended (600x800px).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Images Section */}
            <div className="border-t border-brand-latte/20 pt-6">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Gallery Images (Optional)</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-4">
                {formData.additionalImages?.map((img, index) => (
                  <div key={index} className="relative aspect-[3/4] group bg-gray-50 border border-brand-latte/20 rounded overflow-hidden">
                    <img src={img} className="w-full h-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => removeAdditionalImage(index)} 
                      className="absolute top-1 right-1 bg-white rounded-full p-1 text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="aspect-[3/4] border border-dashed border-brand-latte/40 bg-brand-grey/5 flex flex-col items-center justify-center gap-2 p-2 text-center hover:bg-brand-grey/10 transition-colors rounded">
                  <button 
                    type="button" 
                    onClick={() => additionalFileInputRef.current?.click()} 
                    disabled={saveStatus === 'uploading'} 
                    className="text-gray-500 hover:text-brand-flamingo flex flex-col items-center"
                  >
                    {saveStatus === 'uploading' ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />} 
                    <span className="text-[9px] font-bold uppercase mt-1">Upload File</span>
                  </button>
                  <input type="file" accept="image/*" ref={additionalFileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'additional')} />
                </div>
              </div>

              <div className="flex gap-2 items-center w-full min-w-0">
                <div className="relative flex-1 min-w-0">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><LinkIcon size={14} /></div>
                  <input 
                    className="w-full border p-2 pl-9 pr-4 text-xs focus:border-brand-flamingo outline-none bg-brand-grey/5 font-mono" 
                    placeholder="Or paste URL for additional gallery photo..." 
                    value={newAdditionalUrl} 
                    onChange={e => setNewAdditionalUrl(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrlToAdditional(); } }} 
                  />
                </div>
                <button 
                  type="button" 
                  onClick={addUrlToAdditional} 
                  disabled={!newAdditionalUrl} 
                  className="bg-brand-latte text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-flamingo disabled:opacity-50 disabled:cursor-not-allowed rounded"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col-reverse md:flex-row justify-end gap-3 mt-4 border-t border-brand-latte/20 pt-6">
              <button 
                type="button" 
                onClick={() => setIsEditing(false)} 
                className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 border border-transparent hover:border-gray-200" 
                disabled={saveStatus !== 'idle' && saveStatus !== 'error'}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saveStatus !== 'idle' && saveStatus !== 'error'} 
                className={`text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-2 transition-all ${ 
                  saveStatus === 'saved' ? 'bg-green-600' : 'bg-brand-flamingo hover:bg-brand-flamingo/90' 
                }`}
              >
                {saveStatus === 'saving' ? (<><Loader2 size={14} className="animate-spin" /> Saving...</>) : saveStatus === 'saved' ? (<><Check size={14} /> Saved!</>) : ('Save Product')}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Main Catalog View with Filters */
        <div className="space-y-6 w-full max-w-full min-w-0">
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white p-3.5 sm:p-5 border border-brand-latte/20 rounded shadow-sm space-y-4 w-full max-w-full min-w-0 overflow-hidden">
            {/* Top row: Search & Status Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by product name, design, or SKU (e.g. Dream Castle, LC-...)"
                  className="w-full border border-brand-latte/30 rounded pl-10 pr-9 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-brand-flamingo bg-brand-grey/5"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between sm:justify-start gap-1 bg-brand-grey/10 p-1 rounded border border-brand-latte/20 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors text-center ${
                    statusFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  All Status
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('live')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1 ${
                    statusFilter === 'live' ? 'bg-green-600 text-white shadow-xs' : 'text-gray-500 hover:text-green-700'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('hidden')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors text-center ${
                    statusFilter === 'hidden' ? 'bg-gray-800 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Hidden
                </button>
              </div>
            </div>

            {/* Bottom row: Collection Filter Pills */}
            <div className="border-t border-brand-latte/15 pt-3 w-full max-w-full min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Filter size={12} className="text-brand-gold" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Filter By Collection:</span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1.5 w-full max-w-full min-w-0 touch-pan-x">
                {/* All Collections */}
                <button
                  type="button"
                  onClick={() => setSelectedCollectionFilter('all')}
                  className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 border ${
                    selectedCollectionFilter === 'all'
                      ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                      : 'bg-white text-gray-700 border-brand-latte/30 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <span>✨ All Products</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedCollectionFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {counts.all}
                  </span>
                </button>

                {/* Luggage Cover (The New Collection) */}
                <button
                  type="button"
                  onClick={() => setSelectedCollectionFilter('Luggage Cover')}
                  className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 border ${
                    selectedCollectionFilter === 'Luggage Cover'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-300'
                      : 'bg-amber-50 text-amber-900 border-amber-300 hover:border-amber-500 hover:bg-amber-100/60'
                  }`}
                >
                  <span>🧳 Luggage Cover</span>
                  <span className="text-[9px] font-extrabold bg-amber-400 text-amber-950 px-1 rounded uppercase tracking-wider">
                    NEW
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedCollectionFilter === 'Luggage Cover' ? 'bg-white/20 text-white' : 'bg-amber-200/70 text-amber-900'
                  }`}>
                    {counts.luggage}
                  </span>
                </button>

                {/* Blankets */}
                <button
                  type="button"
                  onClick={() => setSelectedCollectionFilter('Blankets')}
                  className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 border ${
                    selectedCollectionFilter === 'Blankets'
                      ? 'bg-brand-gold text-white border-brand-gold shadow-sm'
                      : 'bg-white text-gray-700 border-brand-latte/30 hover:border-brand-gold/50 hover:bg-brand-gold/5'
                  }`}
                >
                  <span>🧸 Blankets</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedCollectionFilter === 'Blankets' ? 'bg-white/20 text-white' : 'bg-brand-gold/10 text-brand-gold'
                  }`}>
                    {counts.blankets}
                  </span>
                </button>

                {/* Swaddles */}
                <button
                  type="button"
                  onClick={() => setSelectedCollectionFilter('Swaddle')}
                  className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 border ${
                    selectedCollectionFilter === 'Swaddle'
                      ? 'bg-brand-flamingo text-white border-brand-flamingo shadow-sm'
                      : 'bg-white text-gray-700 border-brand-latte/30 hover:border-brand-flamingo/50 hover:bg-brand-flamingo/5'
                  }`}
                >
                  <span>🌸 Swaddle</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedCollectionFilter === 'Swaddle' ? 'bg-white/20 text-white' : 'bg-brand-flamingo/10 text-brand-flamingo'
                  }`}>
                    {counts.swaddles}
                  </span>
                </button>

                {/* Add-ons */}
                <button
                  type="button"
                  onClick={() => setSelectedCollectionFilter('Add-ons')}
                  className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 border ${
                    selectedCollectionFilter === 'Add-ons'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-gray-700 border-brand-latte/30 hover:border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  <span>💝 Add-ons</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedCollectionFilter === 'Add-ons' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {counts.addons}
                  </span>
                </button>

                {/* Events / Cakenic */}
                <button
                  type="button"
                  onClick={() => setSelectedCollectionFilter('Cakenic 2026')}
                  className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 border ${
                    selectedCollectionFilter === 'Cakenic 2026'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-white text-gray-700 border-brand-latte/30 hover:border-rose-300 hover:bg-rose-50'
                  }`}
                >
                  <span>🎟️ Events</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedCollectionFilter === 'Cakenic 2026' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {counts.events}
                  </span>
                </button>
              </div>
            </div>

            {/* Active Filter Summary Bar */}
            {(selectedCollectionFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
              <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-brand-latte/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">
                    Showing {filteredProducts.length} of {safeProducts.length} products
                  </span>
                  {selectedCollectionFilter !== 'all' && (
                    <span className="bg-brand-latte/20 text-gray-800 px-2 py-0.5 rounded text-[10px] font-bold">
                      Collection: {selectedCollectionFilter}
                    </span>
                  )}
                  {statusFilter !== 'all' && (
                    <span className="bg-brand-latte/20 text-gray-800 px-2 py-0.5 rounded text-[10px] font-bold">
                      Status: {statusFilter}
                    </span>
                  )}
                  {searchQuery && (
                    <span className="bg-brand-latte/20 text-gray-800 px-2 py-0.5 rounded text-[10px] font-bold">
                      Search: &ldquo;{searchQuery}&rdquo;
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCollectionFilter('all');
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                  className="text-xs text-brand-flamingo font-bold hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              </div>
            )}
          </div>

          {/* PRODUCTS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 md:gap-6 w-full min-w-0">
            {safeProducts.length === 0 && (
              <div className="col-span-full text-center p-8 sm:p-12 text-gray-400 italic flex flex-col items-center w-full min-w-0">
                <p className="mb-4">No products found in database.</p>
                <div className="p-6 bg-white border border-dashed border-brand-latte/50 rounded flex flex-col items-center max-w-md w-full">
                  <Database className="text-brand-flamingo mb-3" size={32} strokeWidth={1} />
                  <h4 className="font-serif text-lg text-gray-900 mb-2">Initialize Database?</h4>
                  <p className="text-xs text-gray-500 mb-4 text-center">
                    Your Firebase database is currently empty. Click below to upload the complete sample catalog (Luggage Covers, Blankets, and Cakenic Tickets).
                  </p>
                  <button 
                    type="button" 
                    onClick={handleSeedData} 
                    disabled={isSeeding} 
                    className="bg-brand-gold text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-flamingo transition-colors rounded flex items-center gap-2 cursor-pointer"
                  >
                    {isSeeding ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />} Load Sample Catalog
                  </button>
                </div>
              </div>
            )}

            {safeProducts.length > 0 && filteredProducts.length === 0 && (
              <div className="col-span-full bg-white border border-dashed border-brand-latte/40 p-8 sm:p-12 text-center rounded flex flex-col items-center justify-center w-full min-w-0">
                <Layers size={36} className="text-gray-300 mb-3" />
                <h4 className="font-serif text-lg text-gray-900 mb-1">No products found</h4>
                <p className="text-xs text-gray-500 mb-4 max-w-sm">
                  No products matched your selected collection &ldquo;{selectedCollectionFilter}&rdquo; or search query.
                </p>
                <div className="flex gap-3 flex-wrap justify-center">
                  <button
                    onClick={() => {
                      setSelectedCollectionFilter('all');
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded"
                  >
                    Show All Products
                  </button>
                  <button
                    onClick={() => handleCreate(selectedCollectionFilter === 'all' ? 'Luggage Cover' : selectedCollectionFilter)}
                    className="bg-brand-flamingo text-white hover:bg-brand-flamingo/90 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded"
                  >
                    + Add New Product
                  </button>
                </div>
              </div>
            )}

            {filteredProducts.map(product => {
              const badge = getCollectionBadge(product);
              const isLuggage = isLuggageCoverProduct(product);
              const hasNoReplacement = product.noSizeReplacement || isLuggage;

              return (
                <div 
                  key={product.id} 
                  className={`bg-white border rounded shadow-xs p-3.5 sm:p-4 flex gap-3 sm:gap-4 items-start group transition-all duration-200 hover:shadow-md w-full min-w-0 ${
                    isLuggage ? 'border-amber-200/80 hover:border-amber-400' : 'border-brand-latte/20 hover:border-brand-latte/50'
                  }`}
                >
                  {/* Thumbnail */}
                  {(() => {
                    const categoryDefault = getCategoryDefaultImage(product);
                    const isCurrentLuggage = isLuggageCoverProduct(product);
                    const hasValidCustomImg = Boolean(product.image && product.image.trim() && (isCurrentLuggage || (!product.image.includes('luggage') && !product.image.includes('45219') && product.image !== '/luggage_cover_preview.jpg')));
                    const finalSrc = hasValidCustomImg ? product.image : categoryDefault;

                    return (
                      <div className="relative w-16 sm:w-20 h-24 shrink-0 rounded overflow-hidden bg-gray-100 border border-brand-latte/20">
                        <img 
                          src={finalSrc} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          onError={(e) => {
                            (e.target as HTMLElement).setAttribute('src', categoryDefault);
                          }}
                        />
                        {product.badge && (
                          <span className="absolute top-1 left-1 bg-gray-900/90 text-white text-[8px] font-bold uppercase px-1 py-0.5 rounded tracking-wider shadow-xs">
                            {product.badge}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Info */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {/* Collection badge & Status */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className={`text-[9px] font-sans font-bold uppercase px-2 py-0.5 rounded tracking-wider border flex items-center gap-1 ${badge.style}`}>
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>

                      {product.isPosOnly && (
                        <span className="bg-gray-800 text-white text-[8px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider">
                          POS ONLY
                        </span>
                      )}

                      {hasNoReplacement && (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider" title="Strictly No Size Replacements Policy Applies">
                          ⚠️ No Size Exch.
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="font-serif text-sm sm:text-base text-gray-900 font-semibold leading-snug truncate" title={product.name}>
                      {product.name}
                    </h4>

                    {/* Artwork Design distinction */}
                    {product.designName && (
                      <p className="text-[10px] text-gray-500 font-sans truncate">
                        <span className="text-gray-400 font-semibold">Design:</span> {product.designName}
                      </p>
                    )}

                    {/* SKU */}
                    {product.sku && (
                      <p className="text-[9px] font-mono text-gray-400 mt-0.5 truncate">
                        SKU: {product.sku}
                      </p>
                    )}

                    {/* Pricing & Sizing summary */}
                    <div className="mt-2 pt-2 border-t border-brand-latte/15 flex flex-col w-full min-w-0">
                      <div className="flex items-baseline justify-between gap-1 flex-wrap">
                        {product.hasSizes ? (
                          <div className="text-xs">
                            <span className="font-script text-base sm:text-lg text-brand-gold font-bold">
                              RM {product.babyPrice || (isLuggage ? 98 : product.price)} – RM {product.adultPrice || (isLuggage ? 118 : 108)}
                            </span>
                            <span className="text-[9px] text-gray-500 ml-1 font-sans">
                              ({isLuggage ? 'M & L' : 'Baby & Adult'})
                            </span>
                          </div>
                        ) : (
                          <span className="font-script text-base sm:text-lg text-brand-gold font-bold">
                            RM {product.price}
                          </span>
                        )}
                      </div>

                      {/* Stock & Live Indicator */}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Box size={11} className="text-gray-400" />
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${
                            (product.stock || 0) <= 0 
                              ? 'text-red-500 font-extrabold' 
                              : (product.stock || 0) <= 5 
                              ? 'text-amber-600' 
                              : 'text-gray-500'
                          }`}>
                            {(product.stock || 0) <= 0 ? 'Out of Stock' : `Stock: ${product.stock}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${product.isLive !== false ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
                            {product.isLive !== false ? 'Live' : 'Hidden'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button 
                      onClick={() => handleEdit(product)} 
                      className="p-1.5 text-gray-400 hover:text-brand-flamingo hover:bg-brand-flamingo/5 rounded transition-colors"
                      title="Edit Product"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(product.id)} 
                      disabled={deletingId === product.id} 
                      className={`p-1.5 transition-all rounded ${
                        deleteConfirmation === product.id 
                          ? 'text-red-600 bg-red-100 text-[9px] font-bold uppercase px-2 py-1' 
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      }`} 
                      title={deleteConfirmation === product.id ? "Click again to confirm delete" : "Delete Product"}
                    >
                      {deletingId === product.id ? (
                        <Loader2 size={15} className="animate-spin text-red-500" />
                      ) : deleteConfirmation === product.id ? (
                        <span>Confirm?</span>
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
