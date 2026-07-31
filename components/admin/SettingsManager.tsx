
import React, { useState } from 'react';
import { SiteConfig } from '../../types';
import { Upload, Loader2, Database, AlertTriangle, Check } from 'lucide-react';
import { resetOrderSystem, uploadImage } from '../../firebase';

interface SettingsManagerProps {
  siteConfig: SiteConfig;
  onUpdateSiteConfig: (config: SiteConfig) => void;
  installPrompt: any;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({ siteConfig, onUpdateSiteConfig, installPrompt }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'none' | 'success' | 'fail'>('none');
  const [testMessage, setTestMessage] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [installUsed, setInstallUsed] = useState(false);

  const handleConnectionTest = async () => {
    setIsTesting(true);
    setTestResult('none');
    setTestMessage('');
    try {
      const blob = new Blob(["test"], { type: 'text/plain' });
      const testFile = new File([blob], "connection_test.txt", { type: "text/plain" });
      await uploadImage(testFile);
      setTestResult('success');
      setTestMessage("Success! Storage is connected and writable.");
    } catch (error: any) {
      setTestResult('fail');
      setTestMessage(error.message || "Unknown error occurred");
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetOrders = async () => {
    if (!window.confirm("Are you sure? This will DELETE ALL EXISTING ORDERS and reset the order ID counter to 1000. This cannot be undone.")) return;
    setIsResetting(true);
    try {
      await resetOrderSystem();
      alert("System Reset! Order counter is now 1000. All old orders are gone.");
    } catch (error: any) {
      alert("Reset failed: " + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setInstallUsed(true);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-8">
        
        {/* Diagnostics */}
        <div className="bg-white p-6 border border-brand-latte/20 rounded-[2px] shadow-sm">
            <h3 className="font-serif text-xl text-gray-900 mb-4 flex items-center gap-2">
                <Database size={20} className="text-brand-flamingo" /> System Diagnostics
            </h3>
            
            <div className="space-y-4">
                <div>
                    <p className="text-sm text-gray-600 mb-2">Test Storage Connection</p>
                    <button 
                        onClick={handleConnectionTest} 
                        disabled={isTesting}
                        className="bg-brand-grey/10 text-gray-600 hover:bg-brand-flamingo hover:text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-[2px] transition-colors flex items-center gap-2"
                    >
                        {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Test Upload
                    </button>
                    {testResult !== 'none' && (
                        <div className={`mt-2 text-xs p-2 rounded ${testResult === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {testMessage}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 p-6 border border-red-100 rounded-[2px]">
            <h3 className="font-serif text-xl text-red-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={20} /> Danger Zone
            </h3>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-sm font-bold text-red-700">Reset Order System</p>
                        <p className="text-xs text-red-600/70">Deletes all orders and resets ID counter.</p>
                    </div>
                    <button 
                        onClick={handleResetOrders} 
                        disabled={isResetting}
                        className="bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-[2px] transition-colors"
                    >
                       {isResetting ? 'Resetting...' : 'Reset System'}
                    </button>
                </div>
            </div>
        </div>

        {/* PWA Install */}
        {installPrompt && !installUsed && (
            <div className="bg-brand-grey/5 p-6 border border-brand-latte/20 rounded-[2px] flex justify-between items-center">
                <div>
                    <h3 className="font-serif text-lg text-gray-900">Install App</h3>
                    <p className="text-xs text-gray-500">Install admin dashboard on your device.</p>
                </div>
                <button 
                    onClick={handleInstallClick} 
                    className="bg-brand-gold text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-[2px] hover:bg-brand-flamingo transition-colors"
                >
                    Install
                </button>
            </div>
        )}

    </div>
  );
};
