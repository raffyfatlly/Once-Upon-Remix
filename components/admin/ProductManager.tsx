
import React, { useState, useRef } from 'react';
import { Product } from '../../types';
import { Trash2, Edit2, Plus, Upload, X, Loader2, Check, Link as LinkIcon, Database, AlertTriangle, Box } from 'lucide-react';
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
  
  // Refs for inputs
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);
  const [newAdditionalUrl, setNewAdditionalUrl] = useState('');

  const isPerfumeOrHairOil = (p: Product) => {
    const name = (p.name || '').toLowerCase();
    return name.includes('perfume') || name.includes('hair oil') || name.includes('oil');
  };
  const isAddonProduct = (p: Product) => {
    if (!p) return false;
    const name = (p.name || '').toLowerCase();
    const collection = (p.collection || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    return Boolean(p.isCheckoutAddon) || 
           name.includes('perfume') || 
           name.includes('hair oil') || 
           name.includes('oil') || 
           collection.includes('add-on') || 
           collection.includes('addon') || 
           category.includes('add-on') || 
           category.includes('addon');
  };
  const isBlanketProduct = (p: Product) => !p.collection || p.collection === 'Blankets' || p.collection.toLowerCase().includes('blanket') || (p.category && p.category.toLowerCase().includes('blanket'));

  const rawProducts = Array.isArray(products) ? products : [];
  const safeProducts = [...rawProducts].sort((a, b) => {
    const aIsPerfumeOrOil = isPerfumeOrHairOil(a);
    const bIsPerfumeOrOil = isPerfumeOrHairOil(b);
    const aIsAddon = isAddonProduct(a);
    const bIsAddon = isAddonProduct(b);
    const aIsBlanket = isBlanketProduct(a);
    const bIsBlanket = isBlanketProduct(b);

    const aGroup = aIsPerfumeOrOil ? 3 : (aIsAddon ? 2 : (aIsBlanket ? 1 : 0));
    const bGroup = bIsPerfumeOrOil ? 3 : (bIsAddon ? 2 : (bIsBlanket ? 1 : 0));

    if (aGroup !== bGroup) {
      return aGroup - bGroup;
    }

    return (a.name || '').localeCompare(b.name || '');
  });
  const existingCollections = Array.from(new Set(safeProducts.map(p => p.collection || 'Blankets'))).sort();
  const existingCategories = Array.from(new Set(safeProducts.map(p => p.category).filter(Boolean))).sort() as string[];

  // Form State
  const [formData, setFormData] = useState<Product>({
    id: '',
    name: '',
    price: 0,
    description: '',
    image: '',
    additionalImages: [],
    badge: '',
    material: '',
    care: '',
    collection: 'Blankets',
    category: '',
    size: '',
    stock: 0,
    hasSizes: false,
    babyPrice: 88,
    adultPrice: 108,
    babySizeDesc: '70 cm x 100 cm',
    adultSizeDesc: '150 cm x 100 cm',
    isCheckoutAddon: false,
    isPosOnly: false,
    isLive: true
  });

  const handleEdit = (product: Product) => {
    setFormData({
        ...product,
        collection: product.collection || 'Blankets',
        category: product.category || '',
        additionalImages: product.additionalImages || [],
        size: product.size || '',
        stock: product.stock !== undefined ? product.stock : 0,
        hasSizes: product.hasSizes || false,
        babyPrice: product.babyPrice !== undefined ? product.babyPrice : 88,
        adultPrice: product.adultPrice !== undefined ? product.adultPrice : 108,
        babySizeDesc: product.babySizeDesc || '70 cm x 100 cm',
        adultSizeDesc: product.adultSizeDesc || '150 cm x 100 cm',
        isCheckoutAddon: product.isCheckoutAddon || false,
        isPosOnly: product.isPosOnly || false,
        isLive: product.isLive !== undefined ? product.isLive : true
    });
    setEditingProduct(product);
    setIsEditing(true);
    setSaveStatus('idle');
    setErrorMessage('');
    setNewAdditionalUrl('');
  };

  const handleCreate = () => {
    setFormData({
      id: '',
      name: '',
      price: 0,
      description: '',
      image: '',
      additionalImages: [],
      badge: '',
      material: '',
      care: '',
      collection: 'Blankets',
      category: '',
      size: '',
      stock: 0,
      hasSizes: false,
      babyPrice: 88,
      adultPrice: 108,
      babySizeDesc: '70 cm x 100 cm',
      adultSizeDesc: '150 cm x 100 cm',
      isCheckoutAddon: false,
      isPosOnly: false,
      isLive: true
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
      {
        name: 'The Dream Castle',
        price: 185,
        description: 'An intricate illustration of a whimsical palace in the clouds. Woven from the finest cashmere, this piece features subtle turret details and starry accents.',
        image: 'https://i.postimg.cc/9QVBP1b5/Gemini-Generated-Image-s2ybu4s2ybu4s2yb.png',
        material: '100% Grade-A Mongolian Cashmere',
        care: 'Dry clean recommended. Hand wash cold with gentle detergent. Lay flat to dry.',
        collection: 'Blankets',
        size: '120cm x 120cm',
        additionalImages: [],
        stock: 50,
        hasSizes: true,
        babyPrice: 185,
        babySizeDesc: '120 cm x 120 cm',
        adultPrice: 225,
        adultSizeDesc: '150 cm x 150 cm'
      },
      {
        name: 'The Parisian Flight',
        price: 145,
        description: 'A majestic voyage begins. Vintage hot air balloons drifting over Parisian rooftops. A delicate blend of organic cotton and silk, finished with a refined latte border.',
        image: 'https://picsum.photos/seed/vintage-balloon/600/800',
        material: '80% Organic Cotton, 20% Mulberry Silk',
        care: 'Machine wash delicate cycle in laundry bag. Tumble dry low.',
        collection: 'Blankets',
        size: '110cm x 110cm',
        additionalImages: [],
        stock: 50,
        hasSizes: true,
        babyPrice: 145,
        babySizeDesc: '110 cm x 110 cm',
        adultPrice: 185,
        adultSizeDesc: '150 cm x 150 cm'
      }
    ];

    try {
      for (const data of SEED_DATA) {
        await addProductToDb(data as any);
      }
      alert("Sample data uploaded successfully! The products should appear shortly.");
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
      if (editingProduct && editingProduct.id) {
        const { id, ...data } = formData;
        await updateProductInDb(id, data);
      } else {
        const { id, ...data } = formData;
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

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h2 className="font-serif text-2xl md:text-3xl text-gray-900">Product Management</h2>
        <button 
          onClick={handleCreate}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-flamingo transition-colors rounded-[2px]"
        >
          <Plus size={14} /> Add Product
        </button>
      </div>

      {isEditing ? (
        <div className="bg-white p-6 md:p-8 border border-brand-latte/20 shadow-sm animate-fade-in max-w-2xl mx-auto rounded-[2px]">
            <h3 className="font-serif text-xl md:text-2xl mb-6">{editingProduct ? 'Edit Product' : 'New Product'}</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 md:gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Product Name</label>
                <input required className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Collection</label>
                <input 
                  list="collection-options"
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" 
                  value={formData.collection || ''} 
                  onChange={e => setFormData({...formData, collection: e.target.value})}
                  placeholder="Select or type a new collection..."
                />
                <datalist id="collection-options">
                  {existingCollections.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Category (Optional)</label>
                <input 
                  list="category-options"
                  className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" 
                  value={formData.category || ''} 
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  placeholder="e.g. Add-on, Gift Box, Apparel"
                />
                <datalist id="category-options">
                  {existingCategories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Price (RM)</label>
                  <input required type="number" className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                  <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Stock Quantity</label>
                  <input required type="number" min="0" className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Badge (Optional)</label>
                  <input className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" placeholder="e.g. New" value={formData.badge} onChange={e => setFormData({...formData, badge: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                <textarea required rows={3} className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Material</label>
                      <input className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" value={formData.material || ''} onChange={e => setFormData({...formData, material: e.target.value})} />
                  </div>
                  <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Default Size / Dimensions</label>
                      <input className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" placeholder="e.g. 120cm x 120cm" value={formData.size || ''} onChange={e => setFormData({...formData, size: e.target.value})} />
                  </div>
              </div>

              {/* Sizing Options Config */}
              <div className="mt-2 p-4 border border-brand-latte/30 bg-white rounded-[2px] flex flex-col gap-4">
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isLive !== false} onChange={e => setFormData({...formData, isLive: e.target.checked})} className="accent-brand-flamingo w-4 h-4" />
                    Product is Live on Website
                  </label>
                  <p className="text-[10px] text-gray-500 mb-2">If disabled, this product will be hidden from online store visitors.</p>
                </div>
                <div className="border-t border-brand-latte/20 pt-4">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isPosOnly} onChange={e => setFormData({...formData, isPosOnly: e.target.checked})} className="accent-brand-flamingo w-4 h-4" />
                    Set as POS Only
                  </label>
                  <p className="text-[10px] text-gray-500 mb-2">If enabled, this product will not be shown in the online store.</p>
                </div>
                <div className="border-t border-brand-latte/20 pt-4">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isCheckoutAddon} onChange={e => setFormData({...formData, isCheckoutAddon: e.target.checked})} className="accent-brand-flamingo w-4 h-4" />
                    Set as Checkout Add-On
                  </label>
                  <p className="text-[10px] text-gray-500 mb-2">If enabled, this product will be recommended during checkout for users to add to their order.</p>
                </div>
                <div className="border-t border-brand-latte/20 pt-4">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-2 cursor-pointer">
                    <input type="checkbox" checked={formData.hasSizes} onChange={e => setFormData({...formData, hasSizes: e.target.checked})} className="accent-brand-flamingo w-4 h-4" />
                    Enable Baby & Adult Sizing
                  </label>
                  <p className="text-[10px] text-gray-500 mb-4">If enabled, customers will choose between baby and adult sizes instead of the default size and price.</p>
                  
                  {formData.hasSizes && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-brand-latte/20">
                    <div className="bg-brand-grey/5 p-4 rounded-[2px] border border-brand-latte/10">
                      <p className="text-xs font-bold mb-3 text-gray-900 border-b border-brand-latte/20 pb-2">Baby Variant</p>
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Price (RM)</label>
                          <input type="number" className="w-full border p-2 text-sm focus:border-brand-flamingo outline-none bg-white" value={formData.babyPrice} onChange={e => setFormData({...formData, babyPrice: Number(e.target.value)})} />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Dimensions</label>
                          <input className="w-full border p-2 text-sm focus:border-brand-flamingo outline-none bg-white" value={formData.babySizeDesc} onChange={e => setFormData({...formData, babySizeDesc: e.target.value})} />
                        </div>
                      </div>
                    </div>
                    <div className="bg-brand-grey/5 p-4 rounded-[2px] border border-brand-latte/10">
                      <p className="text-xs font-bold mb-3 text-gray-900 border-b border-brand-latte/20 pb-2">Adult Variant</p>
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Price (RM)</label>
                          <input type="number" className="w-full border p-2 text-sm focus:border-brand-flamingo outline-none bg-white" value={formData.adultPrice} onChange={e => setFormData({...formData, adultPrice: Number(e.target.value)})} />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Dimensions</label>
                          <input className="w-full border p-2 text-sm focus:border-brand-flamingo outline-none bg-white" value={formData.adultSizeDesc} onChange={e => setFormData({...formData, adultSizeDesc: e.target.value})} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>

              <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Care Instructions</label>
                  <textarea rows={2} className="w-full border p-3 text-sm focus:border-brand-flamingo outline-none bg-brand-grey/5" value={formData.care || ''} onChange={e => setFormData({...formData, care: e.target.value})} />
              </div>
              
              {/* Main Image Upload/URL Section */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Main Product Image</label>
                
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
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
                      
                      <span className="text-[10px] text-gray-400 font-bold uppercase mx-1">OR</span>
                      
                      <button 
                        type="button"
                        onClick={() => productFileInputRef.current?.click()}
                        className="bg-white border border-brand-latte/30 text-gray-600 hover:text-brand-flamingo hover:border-brand-flamingo px-4 py-3 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider min-w-[100px] justify-center"
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
                      <div className="bg-red-50 p-4 rounded border border-red-100 flex flex-col gap-3 mt-2 animate-fade-in">
                        <div className="flex items-center gap-2 text-red-600 font-bold">
                          <AlertTriangle size={18} />
                          <span className="text-xs">Upload Failed</span>
                        </div>
                        <div className="text-xs text-gray-700 space-y-2">
                          <p className="leading-relaxed"><strong>Reason:</strong> {errorMessage}</p>
                        </div>
                      </div>
                  )}

                  <div className="flex items-start gap-4 p-4 border border-dashed border-brand-latte/30 bg-brand-grey/5 rounded-[2px] mt-2">
                      {formData.image ? (
                        <img src={formData.image} alt="Preview" className="w-20 h-28 object-cover border border-brand-latte/30 bg-white" />
                      ) : (
                        <div className="w-20 h-28 bg-brand-latte/10 flex items-center justify-center text-gray-400 text-xs text-center border border-brand-latte/20">No Image</div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Preview & Tips</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed max-w-xs">
                          Recommended Size: <strong className="text-gray-600">600x800 px</strong> (Portrait 3:4 Aspect Ratio).
                        </p>
                      </div>
                  </div>
                </div>
              </div>

              {/* Additional Images Section */}
              <div className="border-t border-brand-latte/20 pt-6 mt-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4">Gallery Images (Optional)</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-4">
                    {formData.additionalImages?.map((img, index) => (
                      <div key={index} className="relative aspect-[3/4] group bg-gray-50 border border-brand-latte/20">
                        <img src={img} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeAdditionalImage(index)} className="absolute top-1 right-1 bg-white rounded-full p-1 text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"><X size={12} /></button>
                      </div>
                    ))}
                    <div className="aspect-[3/4] border border-dashed border-brand-latte/40 bg-brand-grey/5 flex flex-col items-center justify-center gap-2 p-2 text-center hover:bg-brand-grey/10 transition-colors">
                      <button type="button" onClick={() => additionalFileInputRef.current?.click()} disabled={saveStatus === 'uploading'} className="text-gray-500 hover:text-brand-flamingo flex flex-col items-center">
                          {saveStatus === 'uploading' ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />} 
                          <span className="text-[9px] font-bold uppercase mt-1">Upload File</span>
                      </button>
                      <input type="file" accept="image/*" ref={additionalFileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'additional')} />
                    </div>
                </div>

                <div className="flex gap-2 items-center mt-2">
                    <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><LinkIcon size={14} /></div>
                        <input className="w-full border p-2 pl-9 pr-4 text-xs focus:border-brand-flamingo outline-none bg-brand-grey/5 font-mono" placeholder="Or paste URL for additional image..." value={newAdditionalUrl} onChange={e => setNewAdditionalUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrlToAdditional(); } }} />
                    </div>
                    <button type="button" onClick={addUrlToAdditional} disabled={!newAdditionalUrl} className="bg-brand-latte text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-flamingo disabled:opacity-50 disabled:cursor-not-allowed rounded-[2px]">Add</button>
                </div>
              </div>

              <div className="flex flex-col-reverse md:flex-row justify-end gap-3 mt-4 border-t border-brand-latte/20 pt-6">
                <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 border border-transparent hover:border-gray-200" disabled={saveStatus !== 'idle' && saveStatus !== 'error'}>Cancel</button>
                <button type="submit" disabled={saveStatus !== 'idle' && saveStatus !== 'error'} className={`text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest rounded-[2px] flex items-center gap-2 transition-all ${ saveStatus === 'saved' ? 'bg-green-600' : 'bg-brand-flamingo hover:bg-brand-flamingo/80' }`}>
                  {saveStatus === 'saving' ? (<><Loader2 size={14} className="animate-spin" /> Saving...</>) : saveStatus === 'saved' ? (<><Check size={14} /> Saved!</>) : ('Save Product')}
                </button>
              </div>
            </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {safeProducts.length === 0 && (
              <div className="col-span-full text-center p-12 text-gray-400 italic flex flex-col items-center">
                <p className="mb-4">No products found in database.</p>
                <div className="p-6 bg-white border border-dashed border-brand-latte/50 rounded flex flex-col items-center max-w-md">
                  <Database className="text-brand-flamingo mb-3" size={32} strokeWidth={1} />
                  <h4 className="font-serif text-lg text-gray-900 mb-2">Initialize Database?</h4>
                  <p className="text-xs text-gray-500 mb-4 text-center">Your Firebase database is currently empty. Click below to upload the sample products to the database.</p>
                  <button type="button" onClick={handleSeedData} disabled={isSeeding} className="bg-brand-gold text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-flamingo transition-colors rounded-[2px] flex items-center gap-2 cursor-pointer relative z-10">
                    {isSeeding ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />} Load Sample Data
                  </button>
                </div>
              </div>
          )}
          {safeProducts.map(product => {
            const isAddon = isAddonProduct(product);
            const isBlanket = !isAddon && (!product.collection || product.collection === 'Blankets' || product.collection.toLowerCase().includes('blanket') || (product.category && product.category.toLowerCase().includes('blanket')));
            const collectionTag = isAddon ? 'Add-on' : (isBlanket ? 'Blanket' : 'Swaddle');
            return (
              <div key={product.id} className="bg-white border border-brand-latte/20 p-4 flex gap-4 items-center group rounded-[2px] shadow-sm">
                <img src={product.image} alt={product.name} className="w-16 h-16 md:w-20 md:h-20 object-cover bg-gray-100 rounded-[2px]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-serif text-base md:text-lg text-gray-900 leading-tight truncate">{product.name}</h4>
                    <span className={`text-[9px] font-sans font-bold uppercase px-1.5 py-0.5 rounded tracking-wider border ${
                      isAddon 
                        ? 'bg-gray-100 text-gray-500 border-gray-200' 
                        : isBlanket 
                          ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/20' 
                          : 'bg-brand-flamingo/10 text-brand-flamingo border-brand-flamingo/20'
                    }`}>
                      {collectionTag}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-brand-gold font-script text-base md:text-lg">RM {product.price}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Box size={10} className="text-gray-400" />
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${ (product.stock || 0) <= 5 ? 'text-red-500' : 'text-gray-500' }`}>
                          Stock: {product.stock || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${product.isLive !== false ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {product.isLive !== false ? 'Live' : 'Hidden'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleEdit(product)} className="text-gray-400 hover:text-brand-flamingo p-1"><Edit2 size={16} /></button>
                  <button onClick={() => handleDeleteClick(product.id)} disabled={deletingId === product.id} className={`p-1 transition-all rounded ${ deleteConfirmation === product.id ? 'text-red-500 bg-red-50 w-full text-[10px] font-bold uppercase flex items-center justify-center gap-1 p-2' : 'text-gray-400 hover:text-red-400' }`} title={deleteConfirmation === product.id ? "Click to Confirm" : "Delete"}>
                    {deletingId === product.id ? (<Loader2 size={16} className="animate-spin" />) : deleteConfirmation === product.id ? (<>Confirm?</>) : (<Trash2 size={16} />)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
