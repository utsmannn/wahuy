import { useState } from 'react';
import { Activity, ArrowRight, Key } from 'lucide-react';
import { setApiKey } from '../lib/api';

interface LoginProps { onLogin: (apiKey: string) => void; }

export function Login({ onLogin }: LoginProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) { setError('API key required'); return; }
    setApiKey(key);
    onLogin(key);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
              <Activity className="text-white dark:text-gray-900" size={16} />
            </div>
            <h1 className="text-lg font-bold">Wahuy</h1>
          </div>

          <h2 className="text-sm font-semibold mb-1">Sign in</h2>
          <p className="text-xs text-gray-400 mb-6">Enter your API key to access the dashboard.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input type="password" value={key} onChange={e => { setKey(e.target.value); setError(''); }}
                  placeholder="API key" className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-colors" />
              </div>
              {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
            </div>
            <button type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">
              Enter Dashboard <ArrowRight size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
