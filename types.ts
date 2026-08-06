
export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  additionalImages?: string[];
  badge?: string;
  material?: string;
  care?: string;
  collection?: string;
  category?: string;
  size?: string;
  stock?: number;
  hasSizes?: boolean;
  babyPrice?: number;
  babySizeDesc?: string;
  adultPrice?: number;
  adultSizeDesc?: string;
  isCheckoutAddon?: boolean;
  isPosOnly?: boolean;
  isLive?: boolean;
  isCakenicOnly?: boolean;
  addShippingBox?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
  isPreOrder?: boolean;
  baseProductId?: string; // used for stock deduction if id is modified for variants
  sizeOption?: string;
  isPickedUp?: boolean; // POS-specific: customer already collected this item in store
  addShippingBox?: boolean;
}

export interface SiteConfig {
  heroImage: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'pending_transfer' | 'pending_whatsapp' | 'paid' | 'packed' | 'shipped' | 'delivered' | 'failed' | 'cancelled';
  date: string;
  shippingAddress: string;
  isGift?: boolean;
  giftTo?: string;
  giftFrom?: string;
  giftMessage?: string;
  adminNotes?: string;
  statusHistory?: { status: string; timestamp: string }[];
  source?: 'online' | 'pos';
  paymentMethod?: 'bank_transfer' | 'qr' | 'online';
  trackingNumber?: string;
  promoCode?: string;
  discountCode?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  ambassadorCampaign?: string;
}

export interface Subscriber {
  id: string;
  email: string;
  date: string;
}

export interface Ambassador {
  id: string;
  name: string;
  email: string;
  phone: string;
  campaignCode: string;
  commissionRate: number; // e.g. 10 for 10%
  joinedDate: string;
  status: 'active' | 'inactive';
  instagram?: string;
  tiktok?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  notes?: string;
  paidCommission?: number;
  payoutHistory?: {
    id: string;
    amount: number;
    date: string;
    reference?: string;
    notes?: string;
  }[];
}

