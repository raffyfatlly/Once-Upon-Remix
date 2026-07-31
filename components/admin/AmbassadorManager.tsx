import React, { useState, useEffect } from 'react';
import { Ambassador, Order } from '../../types';
import { 
  Users, UserPlus, Search, Mail, Phone, Trash2, Edit, Check, CheckCircle2, 
  XCircle, Award, DollarSign, RefreshCw, Sparkles, Copy, ExternalLink 
} from 'lucide-react';
import { subscribeToAmbassadors, addAmbassadorToDb, updateAmbassadorInDb, deleteAmbassadorFromDb } from '../../firebase';

interface AmbassadorManagerProps {
  orders: Order[];
}

export const AmbassadorManager: React.FC<AmbassadorManagerProps> = ({ orders }) => {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add / Edit Modal Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Payout Modal State
  const [payoutAmbassador, setPayoutAmbassador] = useState<Ambassador | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutRef, setPayoutRef] = useState<string>('');
  const [payoutNotes, setPayoutNotes] = useState<string>('');
  const [payoutSuccess, setPayoutSuccess] = useState(false);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formRate, setFormRate] = useState<number>(10);
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formInstagram, setFormInstagram] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Subscribe to Ambassadors in real time
  useEffect(() => {
    const unsubscribe = subscribeToAmbassadors((data) => {
      setAmbassadors(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormCode('');
    setFormRate(10);
    setFormStatus('active');
    setFormInstagram('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (amb: Ambassador) => {
    setEditingId(amb.id);
    setFormName(amb.name);
    setFormEmail(amb.email);
    setFormPhone(amb.phone);
    setFormCode(amb.campaignCode);
    setFormRate(amb.commissionRate || 10);
    setFormStatus(amb.status || 'active');
    setFormInstagram(amb.instagram || '');
    setShowModal(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || !formPhone.trim()) return;

    const rawCode = (formCode || formName).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanCode = rawCode.startsWith('amb-') ? rawCode : `amb-${rawCode}`;

    const payload: Omit<Ambassador, 'id'> = {
      name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      phone: formPhone.trim(),
      campaignCode: cleanCode,
      commissionRate: Number(formRate) || 10,
      joinedDate: new Date().toISOString(),
      status: formStatus,
      instagram: formInstagram.trim() || undefined
    };

    try {
      if (editingId) {
        await updateAmbassadorInDb(editingId, payload);
      } else {
        await addAmbassadorToDb(payload);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setShowModal(false);
        resetForm();
      }, 1200);
    } catch (err) {
      console.error("Error saving ambassador:", err);
    }
  };

  const handleOpenPayout = (amb: Ambassador) => {
    const stats = getAmbassadorStats(amb);
    setPayoutAmbassador(amb);
    setPayoutAmount(Number(stats.dueCommission.toFixed(2)));
    setPayoutRef(`PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
    setPayoutNotes(`Monthly bank transfer payout`);
    setPayoutSuccess(false);
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutAmbassador || payoutAmount <= 0) return;

    const currentPaid = payoutAmbassador.paidCommission || 0;
    const newPaidTotal = currentPaid + Number(payoutAmount);

    const historyItem = {
      id: `payout_${Date.now()}`,
      amount: Number(payoutAmount),
      date: new Date().toISOString(),
      reference: payoutRef.trim() || 'Bank Transfer',
      notes: payoutNotes.trim()
    };

    const currentHistory = payoutAmbassador.payoutHistory || [];
    const updatedHistory = [historyItem, ...currentHistory];

    try {
      await updateAmbassadorInDb(payoutAmbassador.id, {
        paidCommission: newPaidTotal,
        payoutHistory: updatedHistory
      });

      setPayoutSuccess(true);
      setTimeout(() => {
        setPayoutSuccess(false);
        setPayoutAmbassador(null);
      }, 1500);
    } catch (err) {
      console.error("Error recording payout:", err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ambassador "${name}"?`)) {
      try {
        await deleteAmbassadorFromDb(id);
      } catch (err) {
        console.error("Error deleting ambassador:", err);
      }
    }
  };

  // Compute metrics for each ambassador from actual orders
  const getAmbassadorStats = (amb: Ambassador) => {
    const codeTag = (amb.campaignCode || `amb-${amb.name}`).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanTag = codeTag.startsWith('amb-') ? codeTag : `amb-${codeTag}`;
    const rawHandle = cleanTag.replace(/^amb[-_]?/, '');

    let ambJoinedDate: Date | null = null;
    if (amb.joinedDate) {
      const d = new Date(amb.joinedDate);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        ambJoinedDate = d;
      }
    }

    const now = new Date();
    const TWENTY_EIGHT_DAYS_MS = 28 * 24 * 60 * 60 * 1000;

    let totalSales = 0;
    let pendingSales = 0;
    let confirmedSales = 0;
    let orderCount = 0;

    const matchedOrders = orders.filter(o => {
      if (o.status === 'cancelled' || o.status === 'failed') return false;

      // Date check: skip past orders created before ambassador joined date
      if (ambJoinedDate && o.date) {
        const oDate = new Date(o.date);
        if (oDate < ambJoinedDate) return false;
      }

      const notes = (o.adminNotes || '').toLowerCase();
      const promo = (o.promoCode || o.discountCode || '').toLowerCase();

      // Explicit match on promo code or admin notes tag
      const matchesCode = 
        promo === cleanTag || 
        promo === rawHandle || 
        notes.includes(cleanTag) || 
        (notes.includes('ambassador') && rawHandle.length > 2 && notes.includes(rawHandle));

      if (matchesCode) {
        orderCount++;
        const oVal = o.total || 0;
        totalSales += oVal;

        const oDate = new Date(o.date);
        const ageMs = now.getTime() - oDate.getTime();
        if (ageMs < TWENTY_EIGHT_DAYS_MS) {
          pendingSales += oVal;
        } else {
          confirmedSales += oVal;
        }
      }

      return matchesCode;
    });

    const rate = amb.commissionRate || 10;
    const totalCommission = (totalSales * rate) / 100;
    const pendingCommission = (pendingSales * rate) / 100;
    const confirmedCommission = (confirmedSales * rate) / 100;
    const paidCommission = amb.paidCommission || 0;
    const dueCommission = Math.max(0, totalCommission - paidCommission);

    return {
      orderCount,
      totalSales,
      totalCommission,
      pendingCommission,
      confirmedCommission,
      paidCommission,
      dueCommission
    };
  };

  const filteredAmbassadors = ambassadors.filter(a => {
    const term = searchTerm.toLowerCase();
    return (
      a.name.toLowerCase().includes(term) ||
      a.email.toLowerCase().includes(term) ||
      a.phone.toLowerCase().includes(term) ||
      a.campaignCode.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-latte/20 pb-4">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl text-gray-900 flex items-center gap-2">
            <Users className="text-brand-flamingo" size={24} />
            Ambassador Program Management
          </h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
            Manage influencers, custom affiliate links, and commission rates
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-brand-flamingo text-white text-xs font-bold uppercase tracking-widest hover:bg-brand-gold transition-colors flex items-center justify-center gap-1.5 rounded-[2px]"
        >
          <UserPlus size={16} />
          <span>Add New Ambassador</span>
        </button>
      </div>

      {/* Search Bar & Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Total Ambassadors */}
        <div className="bg-white p-4 border border-brand-latte/20 rounded-[2px]">
          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 block">Total Ambassadors</span>
          <p className="font-serif text-2xl font-bold text-gray-900 mt-1">{ambassadors.length}</p>
        </div>

        {/* Search Input */}
        <div className="md:col-span-3 bg-white p-3 border border-brand-latte/20 rounded-[2px] flex items-center gap-2">
          <Search size={16} className="text-gray-400 shrink-0 ml-1" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or campaign handle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs text-gray-800 focus:outline-none"
          />
        </div>

      </div>

      {/* Table of Ambassadors */}
      <div className="bg-white border border-brand-latte/20 rounded-[2px] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading Ambassadors...</span>
          </div>
        ) : filteredAmbassadors.length === 0 ? (
          <div className="p-12 text-center text-gray-400 border-dashed border-2 border-brand-latte/20 m-4">
            <Users size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">No Ambassadors Found</p>
            <p className="text-[11px] text-gray-400 mt-1">Click "Add New Ambassador" to create your first partner profile.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-brand-grey/10 border-b border-brand-latte/20 text-[10px] uppercase font-bold text-gray-500">
                  <th className="p-3">Ambassador Info</th>
                  <th className="p-3">Campaign Tag</th>
                  <th className="p-3">Payout Bank Details</th>
                  <th className="p-3 text-center">Commission</th>
                  <th className="p-3 text-right">Sales</th>
                  <th className="p-3 text-right">Pending (28d)</th>
                  <th className="p-3 text-right">Confirmed</th>
                  <th className="p-3 text-right">Paid Out</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-latte/10">
                {filteredAmbassadors.map((amb) => {
                  const stats = getAmbassadorStats(amb);
                  const handle = (amb.campaignCode || amb.name || '')
                    .toLowerCase()
                    .replace(/^amb[-_]?/i, '')
                    .replace(/[^a-z0-9]/g, '');
                  const tag = `amb-${handle}`;

                  return (
                    <tr key={amb.id} className="hover:bg-brand-grey/5 transition-colors">
                      <td className="p-3">
                        <p className="font-bold text-gray-900">{amb.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{amb.email} • {amb.phone}</p>
                        {amb.instagram && (
                          <span className="text-[9px] text-brand-flamingo font-medium block mt-0.5">{amb.instagram}</span>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="font-mono text-[11px] bg-brand-pink/20 text-brand-flamingo font-bold px-2 py-0.5 rounded-[2px] inline-block">
                          {tag}
                        </span>
                      </td>

                      <td className="p-3">
                        {amb.bankName && amb.accountNumber ? (
                          <div>
                            <p className="font-bold text-gray-900 text-[11px]">{amb.bankName}</p>
                            <p className="font-mono text-[10px] text-gray-600">{amb.accountNumber}</p>
                            <p className="text-[9px] text-gray-400">{amb.accountHolder || amb.name}</p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">Not provided</span>
                        )}
                      </td>

                      <td className="p-3 text-center font-semibold text-gray-800">
                        {amb.commissionRate || 10}%
                      </td>

                      <td className="p-3 text-right font-semibold text-gray-800">
                        RM {stats.totalSales.toFixed(2)}
                        <span className="text-[9px] text-gray-400 block font-normal">{stats.orderCount} orders</span>
                      </td>

                      <td className="p-3 text-right text-amber-700 font-medium">
                        RM {stats.pendingCommission.toFixed(2)}
                      </td>

                      <td className="p-3 text-right font-bold text-emerald-700">
                        RM {stats.confirmedCommission.toFixed(2)}
                      </td>

                      <td className="p-3 text-right text-stone-600 font-medium">
                        RM {stats.paidCommission.toFixed(2)}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenPayout(amb)}
                            className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider rounded hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-2xs"
                            title="Record Bank Payout"
                          >
                            <DollarSign size={12} />
                            <span>Payout</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(amb)}
                            className="p-1.5 text-gray-400 hover:text-brand-flamingo hover:bg-brand-latte/10 rounded transition-colors"
                            title="Edit Ambassador"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(amb.id, amb.name)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete Ambassador"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL FOR ADD / EDIT */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-brand-latte/20 rounded-[4px] shadow-2xl max-w-md w-full p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-brand-latte/20 pb-3">
              <h3 className="font-serif text-lg text-gray-900 font-bold">
                {editingId ? 'Edit Ambassador Profile' : 'Add New Ambassador'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">
                ✕
              </button>
            </div>

            {saveSuccess && (
              <div className="bg-emerald-50 text-emerald-700 text-xs p-2.5 rounded-[2px] flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Ambassador profile saved successfully!
              </div>
            )}

            <form onSubmit={handleSaveSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sarah Tan"
                  className="w-full p-2 bg-brand-grey/5 border border-brand-latte/30 rounded-[2px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. sarah@onceupon.my"
                  className="w-full p-2 bg-brand-grey/5 border border-brand-latte/30 rounded-[2px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. 0123456789"
                  className="w-full p-2 bg-brand-grey/5 border border-brand-latte/30 rounded-[2px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Campaign Handle / Tag</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="e.g. amb-sarahtan"
                  className="w-full p-2 bg-brand-grey/5 border border-brand-latte/30 rounded-[2px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Commission Rate %</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formRate}
                    onChange={(e) => setFormRate(Number(e.target.value))}
                    className="w-full p-2 bg-brand-grey/5 border border-brand-latte/30 rounded-[2px]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full p-2 bg-brand-grey/5 border border-brand-latte/30 rounded-[2px]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-brand-latte/30 text-gray-600 font-bold uppercase rounded-[2px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-flamingo text-white font-bold uppercase rounded-[2px] hover:bg-brand-gold transition-colors"
                >
                  Save Ambassador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FOR RECORDING PAYOUT */}
      {payoutAmbassador && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-fade-in font-sans">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-serif text-base text-stone-900 font-bold flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-600" />
                  Record Monthly Payout
                </h3>
                <p className="text-xs text-stone-500">
                  {payoutAmbassador.name} ({payoutAmbassador.email})
                </p>
              </div>
              <button onClick={() => setPayoutAmbassador(null)} className="text-stone-400 hover:text-stone-700">
                ✕
              </button>
            </div>

            {payoutSuccess && (
              <div className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-lg flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Payout of RM {payoutAmount.toFixed(2)} recorded successfully!
              </div>
            )}

            <form onSubmit={handlePayoutSubmit} className="space-y-3.5 text-xs">
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase text-stone-500 block">Bank Account on File</span>
                <p className="font-bold text-stone-900">{payoutAmbassador.bankName || 'No bank name'}</p>
                <p className="font-mono text-stone-700">{payoutAmbassador.accountNumber || 'No account number'}</p>
                <p className="text-[10px] text-stone-500">{payoutAmbassador.accountHolder || payoutAmbassador.name}</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-600 mb-1">Payout Amount (RM)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-lg text-sm font-bold text-stone-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-600 mb-1">Bank Reference / Tx ID</label>
                <input
                  type="text"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder="e.g. MBB-8839210"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-600 mb-1">Internal Notes</label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. July 15th bank transfer"
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayoutAmbassador(null)}
                  className="px-4 py-2 border border-stone-200 text-stone-600 font-bold uppercase rounded-lg hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-bold uppercase rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <DollarSign size={14} />
                  <span>Confirm Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
