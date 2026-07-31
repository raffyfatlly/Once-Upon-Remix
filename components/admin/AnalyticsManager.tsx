import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Order } from '../../types';
import { WebAnalyticsView } from './WebAnalyticsView';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { format, parseISO, isValid, startOfMonth, startOfDay } from 'date-fns';
import { Calendar, Filter, Tag, ChevronDown, Check, Search, X, Clock } from 'lucide-react';

interface AnalyticsManagerProps {
  orders: Order[];
}

const ResponsiveContainerAny = ResponsiveContainer as any;
const BarChartAny = BarChart as any;
const BarAny = Bar as any;
const XAxisAny = XAxis as any;
const YAxisAny = YAxis as any;
const CartesianGridAny = CartesianGrid as any;
const TooltipAny = Tooltip as any;
const LineChartAny = LineChart as any;
const LineAny = Line as any;
const LegendAny = Legend as any;

const COMPARISON_COLORS = [
  '#E07A5F', // Flamingo/Terracotta
  '#3D5A80', // Deep Blue/Ocean
  '#81B29A', // Sage Green
  '#E09F3E', // Amber/Yellow
  '#9A7B56', // Muted Bronze
  '#7209B7', // Purple Accent
];

const getNormalizedProductInfo = (item: { name: string; collection?: string; category?: string; isCheckoutAddon?: boolean }) => {
  const collection = item.collection || '';
  const category = item.category || '';
  let name = item.name.trim().replace(/\s*\+\s*Extra\s+Protection\s+Box/gi, '').trim();

  // Determine if it is an Add-on product
  const isAddon = Boolean(item.isCheckoutAddon) || 
                  collection.toLowerCase().includes('add-on') || 
                  collection.toLowerCase().includes('addon') || 
                  category.toLowerCase().includes('add-on') || 
                  category.toLowerCase().includes('addon') ||
                  name.toLowerCase().includes('perfume') || 
                  name.toLowerCase().includes('hair oil') || 
                  name.toLowerCase().includes('oil') ||
                  name.toLowerCase().includes('gift box') ||
                  name.toLowerCase().includes('tote');

  if (isAddon) {
    return {
      key: name,
      displayLabel: name,
      group: 'other'
    };
  }

  // Determine if it is a blanket
  const isBlanket = collection === 'Blankets' || 
                    collection.toLowerCase().includes('blanket') ||
                    category.toLowerCase().includes('blanket') ||
                    (!collection && !category && (name.toLowerCase().includes('blanket') || name.toLowerCase().includes('castle') || name.toLowerCase().includes('flight')));

  if (isBlanket) {
    if (name.includes('(Adult)')) {
      const baseName = name.replace('(Adult)', '').trim();
      return {
        key: `${baseName}|Adult|Blankets`,
        displayLabel: `${baseName} (Adult Blanket)`,
        group: 'blanket'
      };
    } else if (name.includes('(Baby)')) {
      const baseName = name.replace('(Baby)', '').trim();
      return {
        key: `${baseName}|Baby|Blankets`,
        displayLabel: `${baseName} (Baby Blanket)`,
        group: 'blanket'
      };
    } else {
      return {
        key: `${name}|Baby|Blankets`,
        displayLabel: `${name} (Baby Blanket)`,
        group: 'blanket'
      };
    }
  }

  // Determine if it is a swaddle
  const isSwaddle = collection === 'Swaddle' || 
                    collection === 'Swaddles' || 
                    collection.toLowerCase().includes('swaddle') ||
                    category.toLowerCase().includes('swaddle');

  if (isSwaddle) {
    const baseName = name.replace('(Swaddle)', '').trim();
    return {
      key: `${baseName}|Swaddle`,
      displayLabel: `${baseName} (Swaddle)`,
      group: 'swaddle'
    };
  }

  // Fallback
  return {
    key: name,
    displayLabel: name,
    group: 'other'
  };
};

const getKLDateString = (offsetDays: number = 0) => {
   const d = new Date();
   const klTime = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
   klTime.setDate(klTime.getDate() + offsetDays);
   const year = klTime.getFullYear();
   const month = String(klTime.getMonth() + 1).padStart(2, '0');
   const day = String(klTime.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
};

const getKLDateFromIso = (isoString: string) => {
   const klTime = new Date(new Date(isoString).toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
   const year = klTime.getFullYear();
   const month = String(klTime.getMonth() + 1).padStart(2, '0');
   const day = String(klTime.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
};

export const AnalyticsManager: React.FC<AnalyticsManagerProps> = ({ orders }) => {
  const [analyticsTab, setAnalyticsTab] = useState<'sales' | 'traffic'>('sales');
  const [filterYear, setFilterYear] = useState<string>('All');
  const [filterMonth, setFilterMonth] = useState<string>('All');
  const [filterDay, setFilterDay] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('all_valid');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [activeCategoryBreakdown, setActiveCategoryBreakdown] = useState<'babyBlanket' | 'adultBlanket' | 'swaddle' | null>(null);
  const isAllProducts = selectedProducts.length === 0 || selectedProducts.includes('All');

  const setQuickDate = (range: 'today' | 'week' | 'month' | 'clear') => {
    if (range === 'clear') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const endStr = getKLDateString(0);
    let startStr = endStr;

    if (range === 'week') {
      startStr = getKLDateString(-7);
    } else if (range === 'month') {
      startStr = getKLDateString(-30);
    }
    setStartDate(startStr);
    setEndDate(endStr);
    
    // Clear legacy dropdown filters when using custom dates
    setFilterYear('All');
    setFilterMonth('All');
    setFilterDay('All');
  };

  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleProductToggle = (key: string) => {
    setSelectedProducts(prev => {
      if (key === 'All') {
        return [];
      }
      const withoutAll = prev.filter(k => k !== 'All');
      if (withoutAll.includes(key)) {
        const next = withoutAll.filter(k => k !== key);
        return next;
      } else {
        return [...withoutAll, key];
      }
    });
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    orders.forEach(o => {
      if (o.date) {
        years.add(o.date.substring(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [orders]);

  const availableMonths = useMemo(() => {
    if (filterYear === 'All') return [];
    const months = new Set<string>();
    orders.forEach(o => {
      if (o.date && o.date.startsWith(filterYear)) {
        months.add(o.date.substring(5, 7));
      }
    });
    return Array.from(months).sort();
  }, [orders, filterYear]);

  const availableDays = useMemo(() => {
    if (filterYear === 'All' || filterMonth === 'All') return [];
    const days = new Set<string>();
    const prefix = `${filterYear}-${filterMonth}`;
    orders.forEach(o => {
      if (o.date && o.date.startsWith(prefix)) {
        const dayPart = o.date.substring(8, 10);
        if (dayPart && /^\d+$/.test(dayPart)) {
          days.add(dayPart);
        }
      }
    });
    return Array.from(days).sort();
  }, [orders, filterYear, filterMonth]);

  const availableProducts = useMemo(() => {
    const itemsMap = new Map<string, { key: string; displayLabel: string; group: string }>();
    orders.forEach(o => {
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(i => {
          if (i && i.name) {
            const info = getNormalizedProductInfo(i);
            if (!itemsMap.has(info.key)) {
              itemsMap.set(info.key, info);
            }
          }
        });
      }
    });
    return Array.from(itemsMap.values()).sort((a, b) => {
      const weightA = a.group === 'swaddle' ? 1 : a.group === 'blanket' ? 2 : 3;
      const weightB = b.group === 'swaddle' ? 1 : b.group === 'blanket' ? 2 : 3;
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.displayLabel.localeCompare(b.displayLabel);
    });
  }, [orders]);

  const filteredProductsForSelection = useMemo(() => {
    if (!productSearchQuery) return availableProducts;
    const query = productSearchQuery.toLowerCase();
    return availableProducts.filter(p => 
      p.displayLabel.toLowerCase().includes(query) || 
      p.group.toLowerCase().includes(query)
    );
  }, [availableProducts, productSearchQuery]);

  // Reset month and day when year changes
  useEffect(() => {
    setFilterMonth('All');
    setFilterDay('All');
  }, [filterYear]);

  // Reset day when month changes
  useEffect(() => {
    setFilterDay('All');
  }, [filterMonth]);

  const { chartData, chartType, summary } = useMemo(() => {
    // Filter based on selected status
    let validOrders = orders;
    if (filterStatus === 'all_valid') {
      validOrders = orders.filter(o => !['failed', 'cancelled'].includes(o.status));
    } else if (filterStatus !== 'all') {
      validOrders = orders.filter(o => o.status === filterStatus);
    }

    // Filter based on custom date range
    if (startDate || endDate) {
      validOrders = validOrders.filter(o => {
        if (!o.date) return false;
        let orderDate = '';
        try {
          orderDate = getKLDateFromIso(o.date);
        } catch (e) {
          orderDate = o.date.split('T')[0];
        }
        let matches = true;
        if (startDate) matches = matches && orderDate >= startDate;
        if (endDate) matches = matches && orderDate <= endDate;
        return matches;
      });
    } else {
      if (filterYear !== 'All') {
        validOrders = validOrders.filter(o => o.date?.startsWith(filterYear));
      }
  
      if (filterYear !== 'All' && filterMonth !== 'All') {
        validOrders = validOrders.filter(o => o.date?.startsWith(`${filterYear}-${filterMonth}`));
      }
  
      if (filterYear !== 'All' && filterMonth !== 'All' && filterDay !== 'All') {
        validOrders = validOrders.filter(o => o.date?.startsWith(`${filterYear}-${filterMonth}-${filterDay}`));
      }
    }

    let totalSales = 0;
    let totalOrdersCount = 0;
    let totalBabyBlanketQty = 0;
    let totalBabyBlanketRevenue = 0;
    let totalAdultBlanketQty = 0;
    let totalAdultBlanketRevenue = 0;
    let totalSwaddleQty = 0;
    let totalSwaddleRevenue = 0;

    const dateDataMap = new Map<string, { total: number; productSales: Record<string, number> }>();
    const topProductsByDate = new Map<string, Map<string, { name: string, qty: number, revenue: number }>>();
    const overallProducts = new Map<string, { name: string, key: string, qty: number, revenue: number }>();
    const babyBlanketsMap = new Map<string, { name: string; qty: number; revenue: number }>();
    const adultBlanketsMap = new Map<string, { name: string; qty: number; revenue: number }>();
    const swaddlesMap = new Map<string, { name: string; qty: number; revenue: number }>();
    
    const hasCustomRange = !!(startDate || endDate);
    const isHourly = !hasCustomRange && filterYear !== 'All' && filterMonth !== 'All' && filterDay !== 'All';
    const isDaily = hasCustomRange || (filterYear !== 'All' && filterMonth !== 'All' && filterDay === 'All');

    if (isHourly) {
      for (let h = 0; h < 24; h++) {
        const hStr = h.toString().padStart(2, '0') + ':00';
        dateDataMap.set(hStr, { total: 0, productSales: {} });
      }
    }

    validOrders.forEach(order => {
      if (!order.date) return;
      
      try {
        const d = parseISO(order.date);
        if (!isValid(d)) return;

        let orderTotal = 0;
        let hasMatchingProduct = false;
        const productSalesOnThisOrder: Record<string, number> = {};

        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (!item || !item.name) return;
            const info = getNormalizedProductInfo(item);
            
            const isMatched = isAllProducts || selectedProducts.includes(info.key);
            if (!isMatched) return;

            const itemRev = (item.price || 0) * (item.quantity || 0);
            orderTotal += itemRev;
            hasMatchingProduct = true;

            productSalesOnThisOrder[info.key] = (productSalesOnThisOrder[info.key] || 0) + itemRev;
          });
        }

        // If we filter by product and the order doesn't have it, skip
        if (!isAllProducts && !hasMatchingProduct) {
          return;
        }

        // Compute Category Counts for Filtered Orders
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (!item || !item.name) return;
            const info = getNormalizedProductInfo(item);
            const qty = item.quantity || 0;
            const rev = (item.price || 0) * qty;

            if (info.group === 'swaddle') {
              totalSwaddleQty += qty;
              totalSwaddleRevenue += rev;

              const existing = swaddlesMap.get(info.key) || { name: info.displayLabel, qty: 0, revenue: 0 };
              existing.qty += qty;
              existing.revenue += rev;
              swaddlesMap.set(info.key, existing);
            } else if (info.group === 'blanket') {
              if (info.key.includes('|Adult|')) {
                totalAdultBlanketQty += qty;
                totalAdultBlanketRevenue += rev;

                const existing = adultBlanketsMap.get(info.key) || { name: info.displayLabel, qty: 0, revenue: 0 };
                existing.qty += qty;
                existing.revenue += rev;
                adultBlanketsMap.set(info.key, existing);
              } else {
                totalBabyBlanketQty += qty;
                totalBabyBlanketRevenue += rev;

                const existing = babyBlanketsMap.get(info.key) || { name: info.displayLabel, qty: 0, revenue: 0 };
                existing.qty += qty;
                existing.revenue += rev;
                babyBlanketsMap.set(info.key, existing);
              }
            }
          });
        }

        // Use actual order total if 'All' products are selected, else use specific product total
        const finalSalesVal = isAllProducts ? (Number(order.total) || 0) : orderTotal;

        const key = isHourly
          ? format(d, 'HH:00')
          : isDaily 
            ? format(startOfDay(d), 'yyyy-MM-dd') 
            : format(startOfMonth(d), 'yyyy-MM');

        const existingDateData = dateDataMap.get(key) || { total: 0, productSales: {} };
        existingDateData.total += finalSalesVal;
        
        // Accumulate individual product sales for this date
        Object.entries(productSalesOnThisOrder).forEach(([pKey, pRev]) => {
          existingDateData.productSales[pKey] = (existingDateData.productSales[pKey] || 0) + pRev;
        });
        dateDataMap.set(key, existingDateData);
        
        if (!topProductsByDate.has(key)) {
          topProductsByDate.set(key, new Map());
        }
        const dailyProductsMap = topProductsByDate.get(key)!;

        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (!item || !item.name) return;
            const info = getNormalizedProductInfo(item);
            
            const isMatched = isAllProducts || selectedProducts.includes(info.key);
            if (!isMatched) return;
            
            const itemRev = (item.price || 0) * (item.quantity || 0);
            const normalizedName = info.displayLabel;
            
            // Map for the specific date
            const existing = dailyProductsMap.get(normalizedName) || { name: normalizedName, revenue: 0, qty: 0 };
            existing.revenue += itemRev;
            existing.qty += item.quantity || 0;
            dailyProductsMap.set(normalizedName, existing);

            // Map for the overall selected period
            const overallExisting = overallProducts.get(info.key) || { name: normalizedName, key: info.key, revenue: 0, qty: 0 };
            overallExisting.revenue += itemRev;
            overallExisting.qty += item.quantity || 0;
            overallProducts.set(info.key, overallExisting);
          });
        }
        
        totalSales += finalSalesVal;
        totalOrdersCount++;
      } catch (e) {
        // Ignored unparsable dates
      }
    });

    const dataArray = Array.from(dateDataMap.entries())
      .map(([date, val]) => {
        const topProductsMap = topProductsByDate.get(date);
        const topProducts = topProductsMap 
          ? Array.from(topProductsMap.values()).sort((a,b) => b.revenue - a.revenue).slice(0, 3) 
          : [];
        return { 
          date, 
          sales: val.total, 
          topProducts,
          ...val.productSales
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({ 
        ...item, 
        displayDate: isHourly
          ? item.date
          : isDaily 
            ? format(parseISO(item.date), 'MMM dd') 
            : format(parseISO(`${item.date}-01`), 'MMM yyyy') 
      }));

    const topOverallProducts = Array.from(overallProducts.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      chartData: dataArray,
      chartType: isHourly ? 'hourly' : (isDaily ? 'daily' : 'monthly'),
      summary: {
        totalSales,
        totalOrdersCount,
        averageOrderValue: totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0,
        topProducts: topOverallProducts,
        babyBlanket: { 
          qty: totalBabyBlanketQty, 
          revenue: totalBabyBlanketRevenue,
          products: Array.from(babyBlanketsMap.values()).sort((a, b) => b.qty - a.qty)
        },
        adultBlanket: { 
          qty: totalAdultBlanketQty, 
          revenue: totalAdultBlanketRevenue,
          products: Array.from(adultBlanketsMap.values()).sort((a, b) => b.qty - a.qty)
        },
        swaddle: { 
          qty: totalSwaddleQty, 
          revenue: totalSwaddleRevenue,
          products: Array.from(swaddlesMap.values()).sort((a, b) => b.qty - a.qty)
        }
      }
    };
  }, [orders, filterYear, filterMonth, filterDay, selectedProducts, isAllProducts, filterStatus, startDate, endDate]);

  const monthNames: Record<string, string> = {
    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
    '09': 'September', '10': 'October', '11': 'November', '12': 'December'
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const topProd = data.topProducts && data.topProducts.length > 0 ? data.topProducts[0] : null;
      
      return (
        <div className="bg-white p-3 border border-brand-latte/50 rounded-[2px] shadow-sm min-w-[200px] max-w-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
          
          {payload.length > 1 ? (
            <div className="space-y-1.5">
              {payload.map((entry: any, index: number) => (
                <div key={index} className="flex justify-between items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                    <span className="truncate max-w-[150px]" title={entry.name}>{entry.name}</span>
                  </span>
                  <span className="font-bold text-gray-900">RM {entry.value.toLocaleString('en-MY')}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-brand-latte/20 flex justify-between items-center text-xs font-bold text-gray-900">
                <span>Total Combined:</span>
                <span>RM {payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0).toLocaleString('en-MY')}</span>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xl font-serif text-gray-900 mb-1">
                RM {payload[0].value.toLocaleString('en-MY')}
              </p>
              {topProd && (
                <div className="mt-3 pt-2 border-t border-brand-latte/30">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-brand-flamingo mb-1">Top Product</p>
                  <p className="text-xs text-gray-800 font-bold mb-0.5">{topProd.name}</p>
                  <p className="text-[10px] text-gray-500">{topProd.qty} sold &bull; RM {topProd.revenue.toLocaleString('en-MY')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-brand-latte/20 pb-4 gap-4">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-gray-900">Analytics Overview</h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Track store and traffic performance</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setAnalyticsTab('sales')}
            className={`px-4 py-2 text-xs uppercase tracking-widest font-bold border-b-2 transition-all ${analyticsTab === 'sales' ? 'border-brand-flamingo text-brand-flamingo' : 'border-transparent text-gray-400 hover:text-gray-900'}`}
          >
            Sales Analytics
          </button>
          <button 
            onClick={() => setAnalyticsTab('traffic')}
            className={`px-4 py-2 text-xs uppercase tracking-widest font-bold border-b-2 transition-all ${analyticsTab === 'traffic' ? 'border-brand-flamingo text-brand-flamingo' : 'border-transparent text-gray-400 hover:text-gray-900'}`}
          >
            Web Traffic & Funnel
          </button>
        </div>
      </div>

      {analyticsTab === 'traffic' ? (
        <WebAnalyticsView orders={orders} />
      ) : (
        <div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h2 className="font-serif text-2xl md:text-3xl text-gray-900">Sales Overview</h2>
              <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Track sales performance and trends</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {/* Custom Multi-Product Comparison Dropdown */}
              <div ref={dropdownRef} className="relative flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                className="flex justify-between items-center bg-white border border-brand-latte/30 px-4 py-3 rounded-[2px] text-xs font-bold uppercase tracking-widest text-gray-600 w-full sm:w-64 md:w-80 cursor-pointer hover:border-brand-flamingo transition-colors focus:outline-none"
              >
                <span className="truncate mr-2">
                  {isAllProducts 
                    ? "All Products (Total)" 
                    : selectedProducts.length === 1 
                      ? availableProducts.find(p => p.key === selectedProducts[0])?.displayLabel || selectedProducts[0]
                      : `Comparing: ${selectedProducts.length} Products`
                  }
                </span>
                <ChevronDown size={14} className="text-gray-400 shrink-0 transition-transform duration-200" />
              </button>

              {isProductDropdownOpen && (
                <div className="absolute left-0 mt-1 w-full bg-white border border-brand-latte/30 rounded-[2px] shadow-lg z-50 p-4 space-y-3 min-w-[280px]">
                  {/* Search Bar */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search product..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full bg-brand-latte/5 border border-brand-latte/20 rounded-[2px] px-3 py-2 pl-8 text-xs font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:border-brand-flamingo"
                    />
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    {productSearchQuery && (
                      <button 
                        type="button" 
                        onClick={() => setProductSearchQuery('')} 
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Quick Filters */}
                  <div className="flex flex-wrap gap-1.5 pb-2 border-b border-brand-latte/10 text-[9px] font-bold uppercase tracking-wider text-gray-500">
                    <button
                      type="button"
                      onClick={() => setSelectedProducts([])}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-[2px] transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const swaddles = availableProducts.filter(p => p.group === 'swaddle').map(p => p.key);
                        setSelectedProducts(swaddles);
                      }}
                      className="px-2 py-1 bg-brand-latte/10 hover:bg-brand-latte/20 text-brand-flamingo rounded-[2px] transition-colors"
                    >
                      Swaddles
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blankets = availableProducts.filter(p => p.group === 'blanket').map(p => p.key);
                        setSelectedProducts(blankets);
                      }}
                      className="px-2 py-1 bg-brand-latte/10 hover:bg-brand-latte/20 text-brand-flamingo rounded-[2px] transition-colors"
                    >
                      Blankets
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const addons = availableProducts.filter(p => p.group === 'other').map(p => p.key);
                        setSelectedProducts(addons);
                      }}
                      className="px-2 py-1 bg-brand-latte/10 hover:bg-brand-latte/20 text-brand-flamingo rounded-[2px] transition-colors"
                    >
                      Add-ons
                    </button>
                  </div>

                  {/* Scrollable list */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {/* All option */}
                    <label className="flex items-center space-x-2.5 p-1.5 hover:bg-gray-50 rounded-[2px] cursor-pointer text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={isAllProducts}
                        onChange={() => setSelectedProducts([])}
                        className="rounded-[2px] border-gray-300 text-brand-flamingo focus:ring-brand-flamingo/30 w-3.5 h-3.5"
                      />
                      <span>All Products (Total Sales)</span>
                    </label>

                    {filteredProductsForSelection.map(prod => {
                      const isChecked = selectedProducts.includes(prod.key);
                      return (
                        <label 
                          key={prod.key} 
                          className="flex items-center space-x-2.5 p-1.5 hover:bg-gray-50 rounded-[2px] cursor-pointer text-xs font-semibold text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleProductToggle(prod.key)}
                            className="rounded-[2px] border-gray-300 text-brand-flamingo focus:ring-brand-flamingo/30 w-3.5 h-3.5"
                          />
                          <span className="flex-1 truncate">{prod.displayLabel}</span>
                          <span className={`text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-[2px] ${
                            prod.group === 'swaddle' ? 'bg-[#3D5A80]/10 text-[#3D5A80]' :
                            prod.group === 'blanket' ? 'bg-[#E07A5F]/10 text-[#E07A5F]' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {prod.group}
                          </span>
                        </label>
                      );
                    })}

                    {filteredProductsForSelection.length === 0 && (
                      <div className="text-center py-4 text-xs text-gray-400">
                        No products match your search
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white border border-brand-latte/20 p-2 rounded-[2px] self-start w-full md:w-auto overflow-x-auto">
              <div className="flex gap-2 items-center px-2 text-gray-400 shrink-0"><Clock size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">Date Range</span></div>
              <div className="flex gap-1 shrink-0">
                  <button onClick={() => setQuickDate('today')} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-brand-grey/10 hover:bg-brand-flamingo hover:text-white rounded-[2px] transition-colors">Today</button>
                  <button onClick={() => setQuickDate('week')} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-brand-grey/10 hover:bg-brand-flamingo hover:text-white rounded-[2px] transition-colors">7 Days</button>
                  <button onClick={() => setQuickDate('month')} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-brand-grey/10 hover:bg-brand-flamingo hover:text-white rounded-[2px] transition-colors">30 Days</button>
                  {(startDate || endDate) && (<button onClick={() => setQuickDate('clear')} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-50 rounded-[2px] transition-colors">Clear</button>)}
              </div>
              <div className="h-6 w-[1px] bg-brand-latte/20 hidden sm:block shrink-0"></div>
              <div className="flex gap-2 items-center flex-1 w-full sm:w-auto min-w-[200px]">
                  <div className="relative w-full sm:w-auto group">
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-latte group-hover:text-brand-flamingo transition-colors"><Calendar size={14} /></div>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} onClick={(e) => (e.currentTarget as any).showPicker()} className="pl-3 pr-8 py-1.5 bg-brand-grey/5 hover:bg-white border border-transparent hover:border-brand-latte/30 rounded-[2px] text-[10px] font-bold uppercase tracking-widest text-gray-600 focus:outline-none focus:border-brand-flamingo w-full sm:w-auto cursor-pointer transition-all [&::-webkit-calendar-picker-indicator]:hidden" />
                  </div>
                  <span className="text-gray-300">-</span>
                  <div className="relative w-full sm:w-auto group">
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-latte group-hover:text-brand-flamingo transition-colors"><Calendar size={14} /></div>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} onClick={(e) => (e.currentTarget as any).showPicker()} className="pl-3 pr-8 py-1.5 bg-brand-grey/5 hover:bg-white border border-transparent hover:border-brand-latte/30 rounded-[2px] text-[10px] font-bold uppercase tracking-widest text-gray-600 focus:outline-none focus:border-brand-flamingo w-full sm:w-auto cursor-pointer transition-all [&::-webkit-calendar-picker-indicator]:hidden" />
                  </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <select 
                  value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)} 
                className="appearance-none bg-white border border-brand-latte/30 px-4 py-3 pr-10 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo text-gray-600 w-full sm:w-44"
              >
                <option value="all_valid">Valid Sales</option>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="packed">Packed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <Filter size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select 
                value={filterYear} 
                onChange={(e) => setFilterYear(e.target.value)} 
                className="appearance-none bg-white border border-brand-latte/30 px-4 py-3 pr-10 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo text-gray-600 w-full sm:w-32"
              >
                <option value="All">All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <Calendar size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            
            <div className="relative">
              <select 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(e.target.value)} 
                disabled={filterYear === 'All'}
                className="appearance-none bg-white border border-brand-latte/30 px-4 py-3 pr-10 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo disabled:bg-gray-50 disabled:text-gray-400 text-gray-600 w-full sm:w-40"
              >
                <option value="All">All Months</option>
                {availableMonths.map(month => (
                  <option key={month} value={month}>{monthNames[month] || month}</option>
                ))}
              </select>
              <Filter size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select 
                value={filterDay} 
                onChange={(e) => setFilterDay(e.target.value)} 
                disabled={filterMonth === 'All'}
                className="appearance-none bg-white border border-brand-latte/30 px-4 py-3 pr-10 rounded-[2px] text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-flamingo disabled:bg-gray-50 disabled:text-gray-400 text-gray-600 w-full sm:w-32"
              >
                <option value="All">All Days</option>
                {availableDays.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <Filter size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-[2px] shadow-sm border border-brand-latte/20 relative overflow-hidden">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Valid Sales</h3>
            <p className="font-serif text-2xl text-gray-900">RM {summary.totalSales.toLocaleString('en-MY')}</p>
          </div>
          <div className="bg-white p-5 rounded-[2px] shadow-sm border border-brand-latte/20 relative overflow-hidden">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Valid Orders</h3>
            <p className="font-serif text-2xl text-gray-900">{summary.totalOrdersCount}</p>
          </div>
          <div className="bg-white p-5 rounded-[2px] shadow-sm border border-brand-latte/20 relative overflow-hidden">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Average Order Value</h3>
            <p className="font-serif text-2xl text-gray-900">RM {Math.round(summary.averageOrderValue).toLocaleString('en-MY')}</p>
          </div>
          <div className="bg-white p-5 rounded-[2px] shadow-sm border border-brand-latte/20 relative overflow-hidden">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-flamingo mb-1">Top Best Seller</h3>
            {summary.topProducts.length > 0 ? (
              <div>
                <p className="font-serif text-xl sm:text-lg lg:text-xl text-gray-900 line-clamp-1" title={summary.topProducts[0].name}>{summary.topProducts[0].name}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.topProducts[0].qty} sold (RM {summary.topProducts[0].revenue.toLocaleString('en-MY')})</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-1">No products data</p>
            )}
          </div>
        </div>

        {/* Product Category Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div 
            onClick={() => setActiveCategoryBreakdown(activeCategoryBreakdown === 'babyBlanket' ? null : 'babyBlanket')}
            className={`p-5 rounded-[2px] shadow-sm border transition-all duration-200 relative overflow-hidden cursor-pointer select-none ${
              activeCategoryBreakdown === 'babyBlanket'
                ? 'bg-brand-flamingo/5 border-brand-flamingo ring-1 ring-brand-flamingo/25'
                : 'bg-white border-brand-latte/20 hover:border-brand-flamingo/40 hover:shadow-md'
            }`}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Baby Blankets</h3>
            <p className="font-serif text-2xl text-gray-900">{summary.babyBlanket.qty} <span className="text-xs font-sans text-gray-500 font-normal">sold</span></p>
            <p className="text-xs text-gray-500 mt-1">Revenue: RM {summary.babyBlanket.revenue.toLocaleString('en-MY')}</p>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-brand-flamingo flex items-center gap-1">
              <span>{activeCategoryBreakdown === 'babyBlanket' ? 'Hide Details' : 'Click for specifics'}</span>
              <span className="text-xs">→</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveCategoryBreakdown(activeCategoryBreakdown === 'adultBlanket' ? null : 'adultBlanket')}
            className={`p-5 rounded-[2px] shadow-sm border transition-all duration-200 relative overflow-hidden cursor-pointer select-none ${
              activeCategoryBreakdown === 'adultBlanket'
                ? 'bg-brand-flamingo/5 border-brand-flamingo ring-1 ring-brand-flamingo/25'
                : 'bg-white border-brand-latte/20 hover:border-brand-flamingo/40 hover:shadow-md'
            }`}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Adult Blankets</h3>
            <p className="font-serif text-2xl text-gray-900">{summary.adultBlanket.qty} <span className="text-xs font-sans text-gray-500 font-normal">sold</span></p>
            <p className="text-xs text-gray-500 mt-1">Revenue: RM {summary.adultBlanket.revenue.toLocaleString('en-MY')}</p>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-brand-flamingo flex items-center gap-1">
              <span>{activeCategoryBreakdown === 'adultBlanket' ? 'Hide Details' : 'Click for specifics'}</span>
              <span className="text-xs">→</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveCategoryBreakdown(activeCategoryBreakdown === 'swaddle' ? null : 'swaddle')}
            className={`p-5 rounded-[2px] shadow-sm border transition-all duration-200 relative overflow-hidden cursor-pointer select-none ${
              activeCategoryBreakdown === 'swaddle'
                ? 'bg-brand-flamingo/5 border-brand-flamingo ring-1 ring-brand-flamingo/25'
                : 'bg-white border-brand-latte/20 hover:border-brand-flamingo/40 hover:shadow-md'
            }`}
          >
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total Swaddles</h3>
            <p className="font-serif text-2xl text-gray-900">{summary.swaddle.qty} <span className="text-xs font-sans text-gray-500 font-normal">sold</span></p>
            <p className="text-xs text-gray-500 mt-1">Revenue: RM {summary.swaddle.revenue.toLocaleString('en-MY')}</p>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-brand-flamingo flex items-center gap-1">
              <span>{activeCategoryBreakdown === 'swaddle' ? 'Hide Details' : 'Click for specifics'}</span>
              <span className="text-xs">→</span>
            </div>
          </div>
        </div>

        {/* Specifics Products Breakdown List */}
        {activeCategoryBreakdown && summary[activeCategoryBreakdown] && (
          <div className="bg-[#FAF8F5] p-5 rounded-[2px] border border-brand-latte/30 mb-8 transition-all duration-300">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-brand-latte/10">
              <div>
                <h4 className="font-serif text-base text-gray-900">
                  {activeCategoryBreakdown === 'babyBlanket' && 'Baby Blanket Specifics'}
                  {activeCategoryBreakdown === 'adultBlanket' && 'Adult Blanket Specifics'}
                  {activeCategoryBreakdown === 'swaddle' && 'Swaddle Specifics'}
                </h4>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                  Detailed product contribution for this period
                </p>
              </div>
              <button 
                onClick={() => setActiveCategoryBreakdown(null)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600 animate-pulse"
                title="Close specifics"
              >
                <X size={16} />
              </button>
            </div>

            {summary[activeCategoryBreakdown].products && summary[activeCategoryBreakdown].products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {summary[activeCategoryBreakdown].products.map((p: any) => (
                  <div key={p.name} className="bg-white p-3.5 rounded-[2px] border border-brand-latte/10 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="font-sans text-xs font-semibold text-gray-800 line-clamp-2 leading-snug" title={p.name}>
                        {p.name}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                      <p className="text-xs text-gray-500">
                        <strong className="text-gray-900 font-semibold">{p.qty}</strong> sold
                      </p>
                      <p className="text-xs font-bold text-brand-flamingo font-mono">
                        RM {p.revenue.toLocaleString('en-MY')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-400 font-sans">
                No individual product sales found for this category in the selected filter period.
              </div>
            )}
          </div>
        )}

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-[2px] shadow-sm border border-brand-latte/20">
            <h3 className="font-serif text-xl text-gray-900 mb-6">
              {chartType === 'hourly' ? 'Hourly Sales Trend' : (chartType === 'daily' ? 'Daily Sales Trend' : 'Monthly Sales Trend')}
            </h3>
            <div className="w-full h-80">
              {chartData.length > 0 ? (
                <ResponsiveContainerAny width="100%" height="100%">
                  {chartType === 'monthly' ? (
                    <BarChartAny data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGridAny strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxisAny dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <YAxisAny 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                        tickFormatter={(value: number) => `RM ${(value / 1000).toFixed(0)}k`}
                      />
                      <TooltipAny content={<CustomTooltip />} />
                      {!isAllProducts && <LegendAny iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />}
                      {isAllProducts ? (
                        <BarAny dataKey="sales" name="All Sales" fill="#D9C4B8" radius={[2, 2, 0, 0]} />
                      ) : (
                        selectedProducts.map((prodKey, idx) => {
                          const prodInfo = availableProducts.find(p => p.key === prodKey);
                          const color = COMPARISON_COLORS[idx % COMPARISON_COLORS.length];
                          return (
                            <BarAny 
                              key={prodKey} 
                              dataKey={prodKey} 
                              name={prodInfo ? prodInfo.displayLabel : prodKey} 
                              fill={color} 
                              radius={[2, 2, 0, 0]} 
                            />
                          );
                        })
                      )}
                    </BarChartAny>
                  ) : (
                    <LineChartAny data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGridAny strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxisAny dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <YAxisAny 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#6B7280' }}
                        tickFormatter={(value: number) => `RM ${(value / 1000).toFixed(0)}k`}
                      />
                      <TooltipAny content={<CustomTooltip />} />
                      {!isAllProducts && <LegendAny iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />}
                      {isAllProducts ? (
                        <LineAny type="monotone" dataKey="sales" name="All Sales" stroke="#D9C4B8" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                      ) : (
                        selectedProducts.map((prodKey, idx) => {
                          const prodInfo = availableProducts.find(p => p.key === prodKey);
                          const color = COMPARISON_COLORS[idx % COMPARISON_COLORS.length];
                          return (
                            <LineAny 
                              key={prodKey} 
                              type="monotone" 
                              dataKey={prodKey} 
                              name={prodInfo ? prodInfo.displayLabel : prodKey} 
                              stroke={color} 
                              strokeWidth={2} 
                              dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                              activeDot={{ r: 6 }} 
                            />
                          );
                        })
                      )}
                    </LineChartAny>
                  )}
                </ResponsiveContainerAny>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm uppercase tracking-widest font-bold">
                  No data available for selected period
                </div>
              )}
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2px] shadow-sm border border-brand-latte/20">
            <h3 className="font-serif text-xl text-gray-900 mb-6">
              {isAllProducts ? 'Top Performing Products' : 'Product Comparison Table'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-brand-latte/10 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Rank</th>
                    <th className="px-4 py-3 font-medium">Product Name</th>
                    <th className="px-4 py-3 font-medium text-right">Quantity Sold</th>
                    <th className="px-4 py-3 font-medium text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topProducts.map((product, index) => (
                    <tr key={index} className="border-b border-brand-latte/10 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-400">#{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {!isAllProducts && (
                            <span 
                              className="w-2.5 h-2.5 rounded-full inline-block shrink-0 animate-pulse" 
                              style={{ 
                                backgroundColor: (() => {
                                  const idx = selectedProducts.indexOf(product.key || '');
                                  return idx !== -1 ? COMPARISON_COLORS[idx % COMPARISON_COLORS.length] : '#D9C4B8';
                                })()
                              }} 
                            />
                          )}
                          <span>{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{product.qty}</td>
                      <td className="px-4 py-3 text-right">RM {product.revenue.toLocaleString('en-MY')}</td>
                    </tr>
                  ))}
                  {summary.topProducts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                        No product data available for the selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

