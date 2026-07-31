import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findAmbassadorByCredentials } from '../firebase';
import { Ambassador } from '../types';

interface AmbassadorLoginProps {
  onLogin: (ambassador: Ambassador) => void;
}

export const AmbassadorLogin: React.FC<AmbassadorLoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login State
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default Ambassador for demo credentials (sarah@onceupon.my or 0123456789)
  const DEMO_AMBASSADOR: Ambassador = {
    id: 'demo-sarah',
    name: 'Sarah Tan',
    email: 'sarah@onceupon.my',
    phone: '0123456789',
    campaignCode: 'amb-sarahtan',
    commissionRate: 10,
    joinedDate: new Date().toISOString(),
    status: 'active',
    instagram: '@sarahtan_kl',
    bankName: 'Maybank',
    accountNumber: '114012345678',
    accountHolder: 'Sarah Tan',
    notes: 'Featured Ambassador'
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !phone.trim()) {
      setError('Please enter both your registered email address and phone number.');
      return;
    }

    setLoading(true);
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim().replace(/[^0-9+]/g, '');

    try {
      // Check demo credentials
      if (
        cleanEmail === 'sarah@onceupon.my' || 
        cleanEmail === 'demo@onceupon.my' || 
        cleanPhone === '0123456789'
      ) {
        onLogin(DEMO_AMBASSADOR);
        navigate('/ambassador/dashboard');
        return;
      }

      // Query Firestore
      const found = await findAmbassadorByCredentials(cleanEmail, cleanPhone);

      if (found) {
        onLogin(found);
        navigate('/ambassador/dashboard');
      } else {
        setError('Ambassador account not found. Please verify your registered email and phone number.');
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError('Unable to authenticate at this time. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-grey/10 relative animate-fade-in font-sans py-12 px-4">
      
      {/* Top Navigation */}
      <div className="absolute top-8 left-8">
        <button 
          onClick={() => navigate('/')} 
          className="text-xs uppercase tracking-widest font-bold text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Back to Store
        </button>
      </div>

      <div className="bg-white p-10 md:p-12 shadow-xl border border-brand-latte/20 max-w-md w-full relative">
        
        {/* Professional Header matching Admin Login */}
        <div className="text-center mb-8">
          <span className="font-serif text-2xl font-bold text-gray-900 tracking-wider block">
            ONCE UPON
          </span>
          <span className="font-script text-xl text-brand-gold">
            Ambassador Portal
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-brand-latte/30 mb-8 text-xs font-bold uppercase tracking-widest text-center">
          <button
            type="button"
            id="tab-ambassador-login"
            onClick={() => { setActiveTab('login'); setError(null); }}
            className={`flex-1 py-3 transition-colors ${
              activeTab === 'login'
                ? 'border-b-2 border-brand-flamingo text-gray-900 font-bold'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            id="tab-ambassador-register"
            onClick={() => { setActiveTab('register'); setError(null); }}
            className={`flex-1 py-3 transition-colors ${
              activeTab === 'register'
                ? 'border-b-2 border-brand-flamingo text-gray-900 font-bold'
                : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            Apply / Join
          </button>
        </div>

        {/* SIGN IN FORM */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Registered Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-brand-grey/5 border-b border-brand-latte/50 px-4 py-3 font-sans text-gray-800 focus:outline-none focus:border-brand-flamingo transition-colors text-sm"
                placeholder="Enter your registered email"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Phone Number
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-brand-grey/5 border-b border-brand-latte/50 px-4 py-3 font-sans text-gray-800 focus:outline-none focus:border-brand-flamingo transition-colors text-sm"
                placeholder="Enter your phone number"
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs text-center font-medium leading-relaxed">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-gray-900 text-white px-8 py-3.5 font-sans uppercase tracking-[0.2em] text-[10px] font-bold hover:bg-brand-flamingo transition-colors w-full disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* APPLY / JOIN - COMING SOON VIEW */
          <div className="py-6 text-center space-y-4 animate-fade-in">
            <div className="w-10 h-10 mx-auto rounded-full bg-brand-grey/10 border border-brand-latte/30 flex items-center justify-center text-brand-gold">
              <span className="font-serif text-sm font-bold">✨</span>
            </div>
            
            <h3 className="font-serif text-base font-bold text-gray-900">
              Applications Coming Soon
            </h3>
            
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
              Our brand ambassador program is currently by invitation only. Public applications will open soon.
            </p>

            <div className="pt-4 border-t border-brand-latte/20">
              <p className="text-[11px] text-gray-400 italic mb-3">
                Already an authorized ambassador?
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="bg-brand-grey/10 hover:bg-brand-grey/20 text-gray-800 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest border border-brand-latte/30 transition-colors w-full"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};


