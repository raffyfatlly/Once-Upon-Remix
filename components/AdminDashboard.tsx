
import React, { useState } from 'react';
import { Product, SiteConfig, Order } from '../types';
import { LogOut } from 'lucide-react';
import { ProductManager } from './admin/ProductManager';
import { SalesManager } from './admin/SalesManager';
import { PackingManager } from './admin/PackingManager';
import { MumsClub } from './admin/MumsClub';
import { SettingsManager } from './admin/SettingsManager';
import { AnalyticsManager } from './admin/AnalyticsManager';

import { POSSystem } from './admin/POSSystem';

interface AdminDashboardProps {
  products: Product[];
  orders: Order[];
  siteConfig: SiteConfig;
  onUpdateProducts: (products: Product[]) => void;
  onUpdateSiteConfig: (config: SiteConfig) => void;
  onUpdateOrders: (orders: Order[]) => void;
  onLogout: () => void;
  installPrompt: any;
  adminEmail?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, 
  orders,
  siteConfig, 
  onUpdateProducts, 
  onUpdateSiteConfig,
  onUpdateOrders,
  onLogout,
  installPrompt,
  adminEmail = ''
}) => {
  const isCashier = adminEmail === 'cashier@admin.com';
  const [activeTab, setActiveTab] = useState<'products' | 'sales' | 'pos' | 'packing' | 'club' | 'analytics' | 'settings'>('pos');
  const currentTab = isCashier ? 'pos' : activeTab;

  return (
    <div className="min-h-screen bg-brand-grey/10 font-sans pb-20 w-full max-w-full overflow-x-hidden">
      <nav className="bg-white border-b border-brand-latte/20 sticky top-0 z-40 w-full max-w-full">
        <div className="px-3 sm:px-4 md:px-6 py-3.5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 max-w-6xl mx-auto w-full">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <span className="font-serif text-lg md:text-xl font-bold tracking-wider">ONCE UPON</span>
              <span className="bg-brand-grey px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-gray-500 rounded">
                {isCashier ? 'Cashier' : 'Admin'}
              </span>
            </div>
            <button onClick={onLogout} className="md:hidden text-gray-400 p-1 hover:text-gray-900 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4 md:gap-6 overflow-x-auto hide-scrollbar pb-2 md:pb-0 -mx-3 px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0 border-t md:border-t-0 border-brand-latte/10 pt-2.5 md:pt-0 w-full md:w-auto max-w-full min-w-0">
            {!isCashier && (
              <>
                <button 
                  onClick={() => setActiveTab('products')}
                  className={`text-xs uppercase tracking-widest font-bold transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 'products' ? 'text-brand-flamingo' : 'text-gray-400'}`}
                >
                  Products
                </button>
                <button 
                  onClick={() => setActiveTab('sales')}
                  className={`text-xs uppercase tracking-widest font-bold transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 'sales' ? 'text-brand-flamingo' : 'text-gray-400'}`}
                >
                  Sales & Customers
                </button>
              </>
            )}
            <button 
              onClick={() => setActiveTab('pos')}
              className={`text-xs uppercase tracking-widest font-bold transition-colors whitespace-nowrap flex-shrink-0 ${currentTab === 'pos' ? 'text-brand-flamingo' : 'text-gray-400'}`}
            >
              POS System
            </button>
            {!isCashier && (
              <>
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`text-xs uppercase tracking-widest font-bold transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 'analytics' ? 'text-brand-flamingo' : 'text-gray-400'}`}
                >
                  Analytics
                </button>
                <button 
                  onClick={() => setActiveTab('packing')}
                  className={`text-xs uppercase tracking-widest font-bold transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 'packing' ? 'text-brand-flamingo' : 'text-gray-400'}`}
                >
                  Packing
                </button>
                 <button 
                  onClick={() => setActiveTab('club')}
                  className={`text-xs uppercase tracking-widest font-bold transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 'club' ? 'text-brand-flamingo' : 'text-gray-400'}`}
                >
                  Mum's Club
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`text-xs uppercase tracking-widest font-bold transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 'settings' ? 'text-brand-flamingo' : 'text-gray-400'}`}
                >
                  Settings & Fixes
                </button>
              </>
            )}
            <button onClick={onLogout} className="hidden md:block text-gray-400 hover:text-gray-900 ml-4 border-l border-brand-latte/20 pl-6">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-12 max-w-6xl w-full min-w-0">
        {currentTab === 'pos' && <POSSystem products={products} />}
        {currentTab === 'products' && <ProductManager products={products} />}
        {currentTab === 'sales' && <SalesManager orders={orders} products={products} />}
        {currentTab === 'analytics' && <AnalyticsManager orders={orders} />}
        {currentTab === 'packing' && <PackingManager orders={orders} />}
        {currentTab === 'club' && <MumsClub />}
        {currentTab === 'settings' && <SettingsManager siteConfig={siteConfig} onUpdateSiteConfig={onUpdateSiteConfig} installPrompt={installPrompt} />}
      </div>
    </div>
  );
};
