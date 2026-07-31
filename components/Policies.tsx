
import React from 'react';
import { ArrowLeft, ShieldAlert, Truck, Lock, FileText, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PolicyLayout: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-white pt-24 pb-20 animate-fade-in">
      <div className="container mx-auto px-6 max-w-3xl">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-gray-400 hover:text-brand-flamingo mb-8 transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-sans text-[10px] uppercase tracking-widest font-bold">Back to Shop</span>
        </button>

        <div className="bg-brand-grey/5 p-8 md:p-12 border border-brand-latte/20 rounded-[2px]">
          <div className="flex items-center gap-3 mb-8 border-b border-brand-latte/10 pb-6">
            <div className="text-brand-gold">
              {icon}
            </div>
            <h1 className="font-serif text-3xl text-gray-900">{title}</h1>
          </div>
          
          <div className="font-serif text-gray-600 leading-relaxed space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export const RefundPolicy: React.FC = () => (
  <PolicyLayout title="Refund & Return Policy" icon={<ShieldAlert size={28} />}>
    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Strictly No Returns</h3>
      <p>
        To keep our baby products hygienic and safe for every little dreamer, <strong>we do not accept returns or exchanges</strong> unless the item arrives damaged. We take great care in inspecting every piece before it leaves our studio.
      </p>
    </section>

    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Damaged Items</h3>
      <p>
        If your item arrives damaged, please contact us within <strong>7 days</strong> of delivery. Please include clear photos of the damage and your order number. We will assess the issue and arrange a replacement immediately if the fault is ours.
      </p>
    </section>

    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Complimentary Box</h3>
      <p>
        For orders that include a complimentary box, please note that the box is a free promotional inclusion, we cannot offer refunds, returns, or replacements if the box is damaged during shipping. Our return policy applies exclusively to the actual purchased products nestled inside.
      </p>
    </section>

    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Custom Orders</h3>
      <p>
        Custom or personalized items (such as those with specific embroidery requests) are <strong>final sale</strong>. We cannot offer returns or refunds on these pieces as they are made uniquely for you.
      </p>
    </section>
  </PolicyLayout>
);

export const ShippingPolicy: React.FC = () => (
  <PolicyLayout title="Shipping & Delivery Policy" icon={<Truck size={28} />}>
    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Processing Time</h3>
      <p>
        We are a small studio dedicated to quality. In-stock items typically ship within <strong>7–10 business days</strong>. During peak seasons or new collection drops, please allow a few extra days for us to prepare your order with care.
      </p>
    </section>

    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Delivery Responsibility (Please Read!)</h3>
      <p>
        We ship to the exact address you provide at checkout. Please double-check your details before confirming your order.
      </p>
      <ul className="list-disc pl-5 mt-4 space-y-2 marker:text-brand-gold">
        <li>
          <strong>Once delivered:</strong> We are not responsible for packages that are stolen or misplaced by the courier (e.g., J&T leaving it at the wrong gate or outside your premises).
        </li>
        <li>
          <strong>No Refunds:</strong> We cannot refund or replace items in these specific cases where proof of delivery exists but the package is missing from your property.
        </li>
        <li>
          <strong>We Will Help:</strong> However, we will do our absolute best to assist you in filing a claim with the courier service to recover your funds from them.
        </li>
      </ul>
    </section>
    
    <section>
       <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Shipping Rates</h3>
       <div className="space-y-4 text-gray-600">
         <div>
           <strong>West Malaysia:</strong><br/>
           <ul className="list-disc pl-5 mt-1 space-y-1">
             <li>1 item: RM 8.00</li>
             <li>2-3 items: RM 10.00</li>
             <li>4-6 items: RM 12.00</li>
             <li className="text-gray-500 italic">Additional items: +RM 2.00 per every 3 items</li>
           </ul>
         </div>
         <div>
           <strong>East Malaysia (Sabah & Sarawak):</strong><br/>
           <ul className="list-disc pl-5 mt-1 space-y-1">
             <li>1 item: RM 15.00</li>
             <li>2-3 items: RM 18.00</li>
             <li>4-6 items: RM 20.00</li>
             <li className="text-gray-500 italic">Additional items: +RM 5.00 per every 3 items</li>
           </ul>
         </div>
         <div>
           <strong>Singapore:</strong><br/>
           <ul className="list-disc pl-5 mt-1 space-y-1">
             <li>1 item: RM 40.00</li>
             <li>2-3 items: RM 55.00</li>
             <li>4-6 items: RM 75.00</li>
             <li className="text-gray-500 italic">Additional items: +RM 15.00 per every 3 items</li>
           </ul>
         </div>
       </div>
       <p className="mt-4 text-sm text-gray-500 italic">
         For international orders, any customs duties or local taxes (like GST) incurred upon delivery are the responsibility of the buyer.
       </p>
    </section>
  </PolicyLayout>
);

export const PrivacyPolicy: React.FC = () => (
  <PolicyLayout title="Privacy Policy" icon={<Lock size={28} />}>
    <p className="italic text-sm text-gray-500 mb-6">Last Updated: January 2026</p>
    
    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Information We Collect</h3>
      <p>
        When you make a purchase from Once Upon, we collect personal information you give us such as your name, address, phone number, and email address. This is strictly used to process your order, arrange delivery, and send you updates regarding your purchase.
      </p>
    </section>

    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Payment Security</h3>
      <p>
        We do not store your credit card details. All payments are processed securely through our payment partner, CHIP. Your payment data is encrypted through the Payment Card Industry Data Security Standard (PCI-DSS).
      </p>
    </section>

    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Third-Party Services</h3>
      <p>
        We may share your details with essential third parties only, such as:
      </p>
      <ul className="list-disc pl-5 mt-2 space-y-1 marker:text-brand-gold">
        <li>Courier services (to deliver your package).</li>
        <li>Payment gateways (to process your transaction).</li>
      </ul>
      <p className="mt-2">We will never sell your personal data to marketing agencies.</p>
    </section>
  </PolicyLayout>
);

export const TermsPolicy: React.FC = () => (
  <PolicyLayout title="Terms of Service" icon={<FileText size={28} />}>
    <p className="italic text-sm text-gray-500 mb-6">Welcome to Once Upon.</p>

    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">General</h3>
      <p>
        By visiting our site and/or purchasing something from us, you engage in our “Service” and agree to be bound by the following terms and conditions. We reserve the right to update these terms at any time.
      </p>
    </section>

    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Products & Colors</h3>
      <p>
        We have made every effort to display as accurately as possible the colors and images of our products. However, we cannot guarantee that your computer monitor's display of any color will be accurate. Slight variations in fabric texture or print placement are part of the handmade charm.
      </p>
    </section>

    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Intellectual Property</h3>
      <p>
        All content on this site, including designs, text, graphics, and logos, is the property of <strong>Once Upon</strong>. You may not reproduce, duplicate, copy, sell, or exploit any portion of the Service or our designs without express written permission from us.
      </p>
    </section>

    <section>
      <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Governing Law</h3>
      <p>
        These Terms of Service and any separate agreements whereby we provide you Services shall be governed by and construed in accordance with the laws of Malaysia.
      </p>
    </section>
  </PolicyLayout>
);

export const BusinessInfoPolicy: React.FC = () => (
  <PolicyLayout title="Business Information" icon={<Building2 size={28} />}>
    <section>
       <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Registered Entity</h3>
       <div className="bg-brand-grey/10 p-6 rounded-[2px] border border-brand-latte/10">
         <p className="font-serif text-lg text-gray-900 mb-1">Vanillicious Enterprise</p>
         <p className="font-mono text-xs text-gray-500 tracking-wide">202303157333 (003504071-D)</p>
       </div>
    </section>

    <section>
       <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Office Address</h3>
       <p className="text-sm">
         A-G-01, PV2 Platinum Hill,<br/>
         Jalan Taman Melati 1,<br/>
         53100 Kuala Lumpur.
       </p>
    </section>

    <section>
       <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-gray-900 mb-3">Contact Us</h3>
       <p className="text-sm mb-1">
         <span className="font-bold text-gray-600">Office:</span> 03-41622187
       </p>
       <p className="text-sm mb-1">
         <span className="font-bold text-gray-600">Email:</span> vanilliciousbysyahirah@gmail.com
       </p>
    </section>
  </PolicyLayout>
);
