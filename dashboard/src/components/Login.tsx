import { useState } from 'react';
import { Key, LogIn } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Key size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">WASimple</h1>
          <p className="text-gray-500 mt-1">WhatsApp Multi-Session Dashboard</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setError('');
              }}
              placeholder="Enter your API key"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
          >
            <LogIn size={20} />
            Login
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Default: development-api-key
        </p>
      </div>
    </div>
  );
}
