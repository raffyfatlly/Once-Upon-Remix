
import React, { useState, useEffect } from 'react';
import { Subscriber } from '../../types';
import { Mail } from 'lucide-react';
import { subscribeToSubscribers } from '../../firebase';

export const MumsClub: React.FC = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToSubscribers((subs) => {
      setSubscribers(subs);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="animate-fade-in">
        {subscribers.length === 0 ? (
        <div className="text-center py-24 bg-white border border-dashed border-brand-latte/30 rounded-[2px]">
            <Mail size={32} className="mx-auto text-brand-latte mb-3 opacity-50" />
            <p className="text-gray-400 text-sm">No members yet.</p>
        </div>
        ) : (
        <div className="bg-white border border-brand-latte/20 rounded-[2px] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                <tr className="bg-brand-grey/10 border-b border-brand-latte/20">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 w-16">#</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Email Address</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Date Joined</th>
                </tr>
                </thead>
                <tbody>
                {subscribers.map((sub, index) => (
                    <tr key={sub.id} className="border-b border-brand-latte/10 hover:bg-brand-grey/5 transition-colors">
                    <td className="p-4 text-xs text-gray-400 font-mono">{index + 1}</td>
                    <td className="p-4 font-sans text-sm text-gray-800">{sub.email}</td>
                    <td className="p-4 text-right text-xs text-gray-500">{new Date(sub.date).toLocaleDateString()}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        </div>
        )}
    </div>
  );
};
