import { useState } from 'react';
import { Zap, Key, ArrowRight, Globe, MessageCircle } from 'lucide-react';
import { setApiKey } from '../lib/api';

interface LoginProps {
  onLogin: (apiKey: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [apiKey, setApiKeyInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }
    setApiKey(apiKey);
    onLogin(apiKey);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-6 font-sans transition-colors duration-300">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Side - Branding */}
        <div className="hidden lg:block space-y-10 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-neutral-900 dark:bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <Zap className="text-white dark:text-neutral-900" size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-neutral-900 dark:text-white">
                Wahuy
              </h1>
              <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em] -mt-1">WhatsApp API</p>
            </div>
          </div>

          <p className="text-lg text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed max-w-sm">
            The minimal, high-performance interface for managing your multi-session WhatsApp infrastructure.
          </p>

          <div className="grid grid-cols-1 gap-4 max-w-xs">
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-100 dark:border-neutral-700">
                <MessageCircle className="text-neutral-900 dark:text-neutral-100" size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-none">Messaging</p>
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-1">Bi-directional</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-100 dark:border-neutral-700">
                <Globe className="text-neutral-900 dark:text-neutral-100" size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-none">Webhooks</p>
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-1">Real-time sync</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-10 lg:p-12 border border-neutral-200 dark:border-neutral-800 shadow-xl dark:shadow-none animate-in fade-in zoom-in-95 duration-500">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center justify-center gap-4 mb-10">
            <div className="w-14 h-14 bg-neutral-900 dark:bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <Zap className="text-white dark:text-neutral-900" size={28} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-neutral-900 dark:text-white">
              Wahuy
            </h1>
          </div>

          <div className="text-center lg:text-left mb-10">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">Welcome back</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">Secure your session with your API access key.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-3 px-1">
                API Master Key
              </label>
              <div className="relative group">
                <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-300 group-focus-within:text-neutral-900 dark:group-focus-within:text-white transition-colors" size={18} />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••••••••••"
                  className="w-full pl-14 pr-6 py-4.5 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:border-neutral-900 dark:focus:border-white focus:bg-white dark:focus:bg-neutral-800 transition-all text-sm font-mono placeholder-neutral-200 dark:placeholder-neutral-700 text-neutral-900 dark:text-white"
                />
              </div>
              {error && (
                <p className="text-red-600 dark:text-red-400 text-[11px] font-bold mt-3 flex items-center gap-2 px-1">
                  <span className="w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full" />
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 py-4.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl font-bold text-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all group shadow-lg"
            >
              Enter Dashboard
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-neutral-100 dark:border-neutral-800">
            <p className="text-[10px] text-neutral-400 font-medium text-center leading-relaxed">
              Proprietary software. Authorized access only.
              <br />
              Encryption: AES-256 + HMAC verification active.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
