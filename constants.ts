
import { Product } from './types';

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'The Dream Castle',
    price: 185,
    description: 'An intricate illustration of a whimsical palace in the clouds. Woven from the finest cashmere, this piece features subtle turret details and starry accents.',
    image: 'https://i.postimg.cc/9QVBP1b5/Gemini-Generated-Image-s2ybu4s2ybu4s2yb.png',
    material: '100% Grade-A Mongolian Cashmere',
    care: 'Dry clean recommended. Hand wash cold with gentle detergent. Lay flat to dry.',
    stock: 50
  },
  {
    id: '2',
    name: 'The Parisian Flight',
    price: 145,
    description: 'A majestic voyage begins. Vintage hot air balloons drifting over Parisian rooftops. A delicate blend of organic cotton and silk, finished with a refined latte border.',
    image: 'https://picsum.photos/seed/vintage-balloon/600/800',
    material: '80% Organic Cotton, 20% Mulberry Silk',
    care: 'Machine wash delicate cycle in laundry bag. Tumble dry low.',
    stock: 50
  },
  {
    id: 'cakenic-ticket-putrajaya',
    name: 'Cakenic Putrajaya',
    price: 68,
    description: 'Join us under the lush trees of Putrajaya for an unforgettable afternoon of cake sharing, picnic vibes, and sweet memories. Secret Garden Park, Putrajaya.',
    image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80',
    category: 'Event Ticket',
    collection: 'Cakenic 2026',
    isCakenicOnly: true,
    stock: 45
  },
  {
    id: 'cakenic-ticket-johor',
    name: 'Cakenic Johor Bahru',
    price: 88,
    description: 'An exclusive Southern Cakenic gathering featuring curated gift bags, prizes, and a dream botanical picnic setting. Eco Spring Botanic Garden, JB.',
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
    category: 'Event Ticket',
    collection: 'Cakenic 2026',
    isCakenicOnly: true,
    stock: 30
  },
];

export const NAVIGATION_LINKS = [
  { name: 'Shop', href: '#products' },
  { name: 'Our Story', href: '/story' },
  { name: 'Collections', href: '#collections' },
];
