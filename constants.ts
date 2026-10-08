
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
    stock: 50,
    collection: 'Blankets',
    isLive: true
  },
  {
    id: 'cakenic-ticket-putrajaya',
    name: 'Cakenic Putrajaya',
    price: 68,
    description: 'Join us at Taman Botani Putrajaya (Theme: European Classical) for an unforgettable afternoon of cake sharing, picnic vibes, and sweet memories. Saturday, September 12, 2026.',
    image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80',
    category: 'Event Ticket',
    collection: 'Cakenic Ticket',
    isCakenicOnly: true,
    stock: 45
  },
  {
    id: 'cakenic-ticket-johor',
    name: 'Cakenic JOHOR',
    price: 88,
    description: "An exclusive Southern Cakenic gathering at Eco Spring Garden (Theme: Rocco's Masquerade) featuring curated gift bags, prizes, and a dream botanical picnic setting. Saturday, October 24, 2026.",
    image: 'https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&w=800&q=80',
    category: 'Event Ticket',
    collection: 'Cakenic Ticket',
    isCakenicOnly: true,
    stock: 30
  },
];

export const NAVIGATION_LINKS = [
  { name: 'Shop', href: '#products' },
  { name: 'Our Story', href: '/story' },
  { name: 'Collections', href: '#collections' },
];

export const getProductSlug = (p: Product | string) => {
  if (!p) return '';
  if (typeof p === 'string') {
    return p.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  }
  const nameSlug = (p.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  if (!nameSlug) return p.id || '';

  const isBlanket = (!p.collection || p.collection === 'Blankets' || p.collection.toLowerCase().includes('blanket') || (p.category && p.category.toLowerCase().includes('blanket')));
  const group = isBlanket ? 'blanket' : 'swaddle';

  if (nameSlug.endsWith('-blanket') || nameSlug.endsWith('-swaddle')) {
    return nameSlug;
  }

  return `${nameSlug}-${group}`;
};

export const sortCollectionProducts = (collectionName: string, prods: Product[]): Product[] => {
  const list = [...prods];
  const collLower = (collectionName || '').toLowerCase();

  if (collLower.includes('blanket')) {
    return list.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aIsJubilee = aName.includes('carousel') || aName.includes('jubilee');
      const bIsJubilee = bName.includes('carousel') || bName.includes('jubilee');
      if (aIsJubilee && !bIsJubilee) return -1;
      if (!aIsJubilee && bIsJubilee) return 1;
      return aName.localeCompare(bName);
    });
  }

  if (collLower.includes('swaddle')) {
    return list.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aIsWhimsy = aName.includes('whimsy') || aName.includes('fair');
      const bIsWhimsy = bName.includes('whimsy') || bName.includes('fair');
      const aIsCandy = aName.includes('candy') || aName.includes('house');
      const bIsCandy = bName.includes('candy') || bName.includes('house');

      // Whimsy Fair #1 (matches collection preview card above), Candy House #2
      if (aIsWhimsy && !bIsWhimsy) return -1;
      if (!aIsWhimsy && bIsWhimsy) return 1;
      if (aIsCandy && !bIsCandy) return -1;
      if (!aIsCandy && bIsCandy) return 1;

      return aName.localeCompare(bName);
    });
  }

  return list;
};
