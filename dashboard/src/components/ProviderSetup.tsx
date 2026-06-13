import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, AlertCircle, Zap, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import type { ProviderInfo, OfficialConfig } from '../types';

interface ProviderSetupProps { providerInfo: ProviderInfo | null; onSwitch: () => void; }

const EMPTY: OfficialConfig = { accessToken: '', appSecret: '', phoneNumberId: '', webhookVerifyToken: '', baseUrl: '', businessAccountId: '' };

export function ProviderSetup({ providerInfo, onSwitch }: ProviderSetupProps) {
  const [mode, setMode] = useState<'internal' | 'official'>(providerInfo?.mode ?? 'internal');
  const [cfg, setCfg] = useState<OfficialConfig>({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSaved = providerInfo?.mode === 'official' && providerInfo?.hasConfig === true;

  useEffect(() => { if (providerInfo?.mode) setMode(providerInfo.mode); }, [providerInfo?.mode]);
  useEffect(() => { setTestResult(null); }, [cfg.accessToken, cfg.appSecret, cfg.phoneNumberId, cfg.webhookVerifyToken]);

  const update = useCallback((f: keyof OfficialConfig, v: string) => { setCfg(p => ({ ...p, [f]: v })); setError(null); }, []);

  const filled = cfg.accessToken.trim() && cfg.appSecret.trim() && cfg.phoneNumberId.trim() && cfg.webhookVerifyToken.trim();
  const changed = mode !== (providerInfo?.mode ?? 'internal');

  const test = async () => {
    if (!filled) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await api.testProvider({ accessToken: cfg.accessToken.trim(), appSecret: cfg.appSecret.trim(), phoneNumberId: cfg.phoneNumberId.trim(), webhookVerifyToken: cfg.webhookVerifyToken.trim(), ...(cfg.baseUrl?.trim() ? { baseUrl: cfg.baseUrl.trim() } : {}), ...(cfg.businessAccountId?.trim() ? { businessAccountId: cfg.businessAccountId.trim() } : {}) });
      setTestResult({ success: r.success, message: r.data?.message || 'OK' });
    } catch (err) { setTestResult({ success: false, message: (err as Error).message }); }
    finally { setTesting(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const p: { mode: 'internal' | 'official'; official?: OfficialConfig } = { mode };
      if (mode === 'official') {
        if (!filled) { setError('Fill all required fields.'); setLoading(false); return; }
        p.official = { accessToken: cfg.accessToken.trim(), appSecret: cfg.appSecret.trim(), phoneNumberId: cfg.phoneNumberId.trim(), webhookVerifyToken: cfg.webhookVerifyToken.trim(), ...(cfg.baseUrl?.trim() ? { baseUrl: cfg.baseUrl.trim() } : {}), ...(cfg.businessAccountId?.trim() ? { businessAccountId: cfg.businessAccountId.trim() } : {}) };
      }
      await api.switchProvider(p);
      onSwitch();
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };

  const statusColor = providerInfo?.status === 'ready' || providerInfo?.status === 'connected' ? 'text-green-600' : providerInfo?.status === 'error' ? 'text-red-500' : 'text-gray-400';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold">Provider</h3>
          <p className="text-xs text-gray-400">Mode: <span className={`font-medium ${statusColor}`}>{providerInfo?.status || 'unknown'}</span></p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-6">
        {(['internal', 'official'] as const).map(m => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              mode === m ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}>
            {m}
          </button>
        ))}
      </div>

      <form onSubmit={save}>
        {mode === 'official' && (
          <div className="space-y-3 mb-6">
            {hasSaved && !cfg.accessToken && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-500 border border-gray-200 dark:border-gray-700">
                <ShieldCheck size={14} /> Credentials already configured. Enter new keys to overwrite.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Access Token</label>
                <input type="password" value={cfg.accessToken} onChange={e => update('accessToken', e.target.value)} placeholder="EAAB..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">App Secret</label>
                <input type="password" value={cfg.appSecret} onChange={e => update('appSecret', e.target.value)} placeholder="••••"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number ID</label>
                <input type="text" value={cfg.phoneNumberId} onChange={e => update('phoneNumberId', e.target.value)} placeholder="1234567890"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Verify Token</label>
                <input type="text" value={cfg.webhookVerifyToken} onChange={e => update('webhookVerifyToken', e.target.value)} placeholder="custom_token"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Base URL</label>
                <input type="text" value={cfg.baseUrl} onChange={e => update('baseUrl', e.target.value)} placeholder="https://graph.facebook.com/v20.0"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Business Account ID</label>
                <input type="text" value={cfg.businessAccountId} onChange={e => update('businessAccountId', e.target.value)} placeholder="WABA ID"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
            </div>
          </div>
        )}

        {/* Test/Save bar */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="text-xs">
            {testResult && (
              <span className={`flex items-center gap-1 ${testResult.success ? 'text-green-600' : 'text-red-500'}`}>
                {testResult.success ? <CheckCircle size={12} /> : <AlertCircle size={12} />}{testResult.message}
              </span>
            )}
            {error && <span className="text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</span>}
          </div>
          <div className="flex gap-2">
            {mode === 'official' && filled && (
              <button type="button" onClick={test} disabled={testing}
                className="flex items-center gap-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                {testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}Test
              </button>
            )}
            {(changed || (mode === 'official' && cfg.accessToken)) && (
              <button type="submit" disabled={loading || (mode === 'official' && !filled)}
                className="flex items-center gap-1 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50">
                {loading ? <Loader2 size={12} className="animate-spin" /> : null}Save
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
