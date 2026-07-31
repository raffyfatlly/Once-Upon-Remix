
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface AdminLoginProps {
  onLogin: (email: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple mock authentication
    if (email === 'user@admin.com' || email === 'cashier@admin.com') {
      onLogin(email);
      navigate('/admin/dashboard');
    } else {
      setError('Invalid email or password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-grey/10 relative animate-fade-in">
      <div className="absolute top-8 left-8">
        <button onClick={() => navigate('/')} className="text-xs uppercase tracking-widest font-bold text-gray-500 hover:text-gray-900">
          ← Back to Store
        </button>
      </div>
      
      <div className="bg-white p-12 shadow-xl border border-brand-latte/20 max-w-md w-full relative">
        <div className="text-center mb-8">
          <span className="font-serif text-2xl font-bold text-gray-900 tracking-wider block">ONCE UPON</span>
          <span className="font-script text-xl text-brand-gold">Admin Portal</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-brand-grey/5 border-b border-brand-latte/50 px-4 py-3 font-sans text-gray-800 focus:outline-none focus:border-brand-flamingo transition-colors"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-brand-grey/5 border-b border-brand-latte/50 px-4 py-3 font-sans text-gray-800 focus:outline-none focus:border-brand-flamingo transition-colors"
              placeholder="Enter your password"
            />
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <button 
            type="submit"
            className="mt-2 bg-gray-900 text-white px-8 py-3.5 font-sans uppercase tracking-[0.2em] text-[10px] font-bold hover:bg-brand-flamingo transition-colors w-full"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};
