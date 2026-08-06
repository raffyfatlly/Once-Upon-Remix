import React, { useState } from 'react';
import { Ticket, CheckCircle, Calendar, MapPin, Copy, Check, Share2, Download, XCircle, ArrowLeft, AlertCircle, Sparkles } from 'lucide-react';
import { Order } from '../types';

interface CakenicTicketViewProps {
  order: Order;
  onClose?: () => void;
  isCancel?: boolean;
}

export const CakenicTicketView: React.FC<CakenicTicketViewProps> = ({ order, onClose, isCancel = false }) => {
  const [copiedId, setCopiedId] = useState(false);

  const ticketItem = order.items.find(i => 
    i.collection === 'Cakenic Ticket' || 
    i.category === 'Event Ticket' || 
    i.name.toLowerCase().includes('cakenic')
  ) || order.items[0];

  const handleCopyOrderNo = () => {
    navigator.clipboard.writeText(order.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const handleDownload = () => {
    window.print();
  };

  // If this is a payment cancellation state
  if (isCancel || order.status === 'cancelled' || order.status === 'failed') {
    return (
      <div className="bg-[#FBF6F1] rounded-[36px] max-w-lg w-full p-6 sm:p-8 border border-[#332524]/10 shadow-[0_24px_60px_rgba(150,110,100,0.25)] relative text-[#332524] my-4 mx-auto animate-in fade-in zoom-in-95">
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 text-[#6B5450] hover:text-[#332524] bg-[#F1E8E2] hover:bg-[#e8ddd5] w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        )}

        <div className="text-center space-y-4 pt-2">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
            <XCircle size={36} />
          </div>

          <div>
            <span className="text-[11px] text-[#E3A099] font-bold uppercase tracking-[0.2em]">
              Reservation Status
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#332524] mt-1">
              Payment Cancelled
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-[#6B5450] max-w-xs mx-auto leading-relaxed">
            Your ticket transaction for Order <strong className="text-[#332524]">#{order.id}</strong> was not completed. No charges were made, and your reserved ticket stock has been released.
          </p>

          <div className="bg-white/80 border border-[#332524]/10 rounded-2xl p-4 text-xs text-[#6B5450] text-left space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Ticket:</span>
              <span className="font-bold text-[#332524]">{ticketItem?.name || 'Cakenic Ticket'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Guest:</span>
              <span className="font-bold text-[#332524]">{order.customerName}</span>
            </div>
          </div>

          <div className="pt-2 space-y-2.5">
            <a 
              href="/#/cakenic" 
              onClick={(e) => {
                if (onClose) {
                  e.preventDefault();
                  onClose();
                  window.location.hash = '/cakenic';
                }
              }}
              className="w-full bg-[#E3A099] hover:bg-[#d99088] text-white py-3.5 px-6 rounded-full font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-[0_6px_20px_rgba(227,160,153,0.35)] flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              <span>Return to Cakenic Page</span>
            </a>

            <p className="text-[10px] text-[#6B5450]/70 font-medium">
              Need assistance? Contact us anytime on WhatsApp.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FBF6F1] rounded-[36px] max-w-lg w-full p-6 sm:p-8 border border-[#332524]/15 shadow-[0_24px_60px_rgba(150,110,100,0.25)] relative text-[#332524] my-4 mx-auto animate-in fade-in zoom-in-95 font-sans print:shadow-none print:border-none">
      
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-[#6B5450] hover:text-[#332524] bg-[#F1E8E2] hover:bg-[#e8ddd5] w-9 h-9 rounded-full flex items-center justify-center transition-colors print:hidden"
        >
          ✕
        </button>
      )}

      {/* --- TICKET HEADER --- */}
      <div className="text-center space-y-1.5 pb-4 border-b border-dashed border-[#332524]/15">
        <div className="inline-flex items-center gap-1.5 bg-[#E3A099]/15 text-[#E3A099] border border-[#E3A099]/30 px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]">
          <Sparkles size={12} />
          <span>Official Cakenic E-Pass 2026</span>
        </div>

        <h2 className="font-serif text-3xl sm:text-4xl text-[#332524] font-normal tracking-tight pt-1">
          {ticketItem?.name?.replace('TICKET: ', '') || 'Cakenic Event Ticket'}
        </h2>

        <div className="flex items-center justify-center gap-2 pt-1">
          <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
            order.status === 'paid' 
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
              : 'bg-amber-100 text-amber-800 border-amber-300'
          }`}>
            <CheckCircle size={13} />
            <span>{order.status === 'paid' ? 'Confirmed & Reserved' : 'Pending Transfer'}</span>
          </span>
        </div>
      </div>

      {/* --- ORDER NO HIGHLIGHT & CHIP RECEIPT NOTE --- */}
      <div className="my-5 bg-[#E3A099]/10 border border-[#E3A099]/30 rounded-2xl p-4 text-center space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-widest text-[#E3A099]">
          Your Unique Order Number
        </div>

        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-2xl sm:text-3xl font-extrabold text-[#332524] tracking-wider">
            #{order.id}
          </span>
          <button
            onClick={handleCopyOrderNo}
            className="bg-white border border-[#332524]/15 hover:bg-[#F1E8E2] text-[#332524] p-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 print:hidden"
            title="Copy Order Number"
          >
            {copiedId ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span className="text-[11px]">{copiedId ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="bg-white/90 border border-[#332524]/10 rounded-xl p-3 text-[11px] text-[#6B5450] leading-snug text-left flex items-start gap-2.5">
          <span className="text-base leading-none">📩</span>
          <div>
            <strong className="text-[#332524] font-semibold block mb-0.5">Please Keep Your Order Number:</strong>
            You will receive an official receipt email from <strong>CHIP</strong> containing your Order No. (<strong>#{order.id}</strong>). You can also use your order number or phone/email to look up your ticket on our website anytime!
          </div>
        </div>
      </div>

      {/* --- VINTAGE TICKET STUB CARDS --- */}
      <div className="bg-white border border-[#332524]/10 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden">
        {/* Ticket Cutout Circles */}
        <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 bg-[#FBF6F1] rounded-full border-r border-[#332524]/10" />
        <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 bg-[#FBF6F1] rounded-full border-l border-[#332524]/10" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-dashed border-[#332524]/15 pb-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-[#6B5450] uppercase tracking-wider block">Attendee Name</span>
            <span className="font-bold text-sm text-[#332524]">{order.customerName}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-[#6B5450] uppercase tracking-wider block">Contact Phone</span>
            <span className="font-bold text-xs text-[#332524]">{order.customerPhone}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-[#6B5450] uppercase tracking-wider block">Email Address</span>
            <span className="font-bold text-xs text-[#332524] truncate block">{order.customerEmail}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-[#6B5450] uppercase tracking-wider block">Ticket Quantity</span>
            <span className="font-bold text-xs text-[#E3A099]">
              {order.items.reduce((acc, i) => acc + i.quantity, 0)} Ticket Pass(es)
            </span>
          </div>
        </div>

        {/* Event Schedule & Location */}
        <div className="space-y-2.5 text-xs text-[#6B5450]">
          <div className="flex items-start gap-2">
            <Calendar size={15} className="text-[#E3A099] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#332524] block font-semibold">Event Date & Time:</strong>
              <span>
                {ticketItem?.name?.toLowerCase().includes('putrajaya') ? 'Saturday, 12 September 2026 • 4:00 PM – 7:00 PM' : 'Saturday, 24 October 2026 • 4:00 PM – 7:00 PM'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin size={15} className="text-[#E3A099] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#332524] block font-semibold">Venue Location:</strong>
              <span>
                {ticketItem?.name?.toLowerCase().includes('putrajaya') 
                  ? 'Taman Botani Putrajaya, Presint 1, 62000 Putrajaya' 
                  : 'Eco Spring Garden, Jalan Ekoflora 1, Taman Ekoflora, 81100 Johor Bahru, Johor'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Sparkles size={15} className="text-[#E3A099] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#332524] block font-semibold">Event Theme:</strong>
              <span className="font-semibold text-[#8C5247]">
                {ticketItem?.name?.toLowerCase().includes('putrajaya') ? 'European Classical' : 'Rocco Garden'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* --- QUICK CHECKLIST / RULES REMINDER --- */}
      <div className="mt-4 bg-[#F1E8E2] rounded-2xl p-4 text-xs text-[#6B5450] space-y-2">
        <div className="font-bold text-[#332524] text-[11px] uppercase tracking-wider flex items-center gap-1.5">
          <AlertCircle size={14} className="text-[#E3A099]" />
          <span>Quick Entry Checklist:</span>
        </div>
        <ul className="space-y-1 text-[11px] pl-5 list-disc">
          <li>Bring 1 whole cake (minimum 8 inches, 100% Halal & Non-Alcoholic).</li>
          <li>Bring your picnic mat & cushions for comfortable outdoor seating.</li>
          <li>Present this Order No. (<strong>#{order.id}</strong>) or email at check-in counter.</li>
          <li>Tickets are non-refundable and valid only for your booked session.</li>
        </ul>
      </div>

      {/* --- ACTION BUTTONS --- */}
      <div className="mt-6 space-y-2.5 print:hidden">
        <button
          onClick={handleDownload}
          className="w-full bg-[#E3A099] hover:bg-[#d99088] text-white py-3.5 px-6 rounded-full font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <Download size={16} />
          <span>Download E Ticket</span>
        </button>

        {onClose ? (
          <button
            onClick={onClose}
            className="w-full bg-[#332524] hover:bg-[#4a3635] text-white py-3 px-6 rounded-full font-bold text-xs uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Close Ticket Window</span>
          </button>
        ) : (
          <a
            href="/#/cakenic"
            className="w-full bg-[#332524] hover:bg-[#4a3635] text-white py-3 px-6 rounded-full font-bold text-xs uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            <span>Back to Cakenic Landing Page</span>
          </a>
        )}
      </div>

    </div>
  );
};
