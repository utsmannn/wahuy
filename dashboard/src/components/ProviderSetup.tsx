import { useState, useEffect, useCallback } from 'react';
import { Smartphone, Cloud, CheckCircle, AlertCircle, Loader2, Save, Zap, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import type { ProviderInfo, OfficialConfig } from '../types';

interface ProviderSetupProps {
  providerInfo: ProviderInfo | null;
  onSwitch: () => void;
}

const EMPTY_CONFIG: OfficialConfig = {
  accessToken: '',
  appSecret: '',
  phoneNumberId: '',
  webhookVerifyToken: '',
  baseUrl: '',
  businessAccountId: '',
};

export function ProviderSetup({ providerInfo, onSwitch }: ProviderSetupProps) {
  const [selectedMode, setSelectedMode] = useState<'internal' | 'official'>(
    providerInfo?.mode ?? 'internal'
  );
  const [officialConfig, setOfficialConfig] = useState<OfficialConfig>({ ...EMPTY_CONFIG });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if official provider already has saved config
  const hasSavedConfig = providerInfo?.mode === 'official' && providerInfo?.hasConfig === true;

  // Sync selectedMode when providerInfo changes externally
  useEffect(() => {
    if (providerInfo?.mode) {
      setSelectedMode(providerInfo.mode);
    }
  }, [providerInfo?.mode]);

  // Reset test result when config fields change
  useEffect(() => {
    setTestResult(null);
  }, [
    officialConfig.accessToken,
    officialConfig.appSecret,
    officialConfig.phoneNumberId,
    officialConfig.webhookVerifyToken,
    officialConfig.baseUrl,
    officialConfig.businessAccountId,
  ]);

  const updateConfig = useCallback((field: keyof OfficialConfig, value: string) => {
    setOfficialConfig((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  const requiredFieldsFilled =
    officialConfig.accessToken.trim() !== '' &&
    officialConfig.appSecret.trim() !== '' &&
    officialConfig.phoneNumberId.trim() !== '' &&
    officialConfig.webhookVerifyToken.trim() !== '';

  const modeChanged = selectedMode !== (providerInfo?.mode ?? 'internal');
  const configChanged =
    selectedMode === 'official' &&
    (officialConfig.accessToken !== '' ||
      officialConfig.appSecret !== '' ||
      officialConfig.phoneNumberId !== '' ||
      officialConfig.webhookVerifyToken !== '');
  const showSaveButton = modeChanged || configChanged;

  const handleTestConnection = async () => {
    if (!requiredFieldsFilled) return;

    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const cleanConfig: OfficialConfig = {
        accessToken: officialConfig.accessToken.trim(),
        appSecret: officialConfig.appSecret.trim(),
        phoneNumberId: officialConfig.phoneNumberId.trim(),
        webhookVerifyToken: officialConfig.webhookVerifyToken.trim(),
        ...(officialConfig.baseUrl?.trim() ? { baseUrl: officialConfig.baseUrl.trim() } : {}),
        ...(officialConfig.businessAccountId?.trim()
          ? { businessAccountId: officialConfig.businessAccountId.trim() }
          : {}),
      };

      const result = await api.testProvider(cleanConfig);
      setTestResult({
        success: result.success,
        message: result.data?.message || 'Connection successful!',
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: { mode: 'internal' | 'official'; official?: OfficialConfig } = {
        mode: selectedMode,
      };

      if (selectedMode === 'official') {
        if (!requiredFieldsFilled) {
          setError('Please fill in all required fields for Official mode.');
          setLoading(false);
          return;
        }

        payload.official = {
          accessToken: officialConfig.accessToken.trim(),
          appSecret: officialConfig.appSecret.trim(),
          phoneNumberId: officialConfig.phoneNumberId.trim(),
          webhookVerifyToken: officialConfig.webhookVerifyToken.trim(),
          ...(officialConfig.baseUrl?.trim() ? { baseUrl: officialConfig.baseUrl.trim() } : {}),
          ...(officialConfig.businessAccountId?.trim()
            ? { businessAccountId: officialConfig.businessAccountId.trim() }
            : {}),
        };
      }

      await api.switchProvider(payload);
      onSwitch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch provider');
    } finally {
      setLoading(false);
    }
  };

  const statusColor =
    providerInfo?.status === 'ready' || providerInfo?.status === 'connected'
      ? 'bg-green-50 border-green-100 text-green-700 dark:bg-green-950/30 dark:border-green-900 dark:text-green-400'
      : providerInfo?.status === 'error' || providerInfo?.status === 'failed'
        ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400'
        : 'bg-neutral-50 border-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-500';

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 font-sans shadow-sm transition-colors duration-300">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white">Infrastructure</h2>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest mt-1">Core Engine Configuration</p>
        </div>
        
        {/* Current Status */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black tracking-widest uppercase transition-colors ${statusColor} shadow-sm`}>
            <div className={`w-1.5 h-1.5 rounded-full ${providerInfo?.status === 'ready' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
            {providerInfo?.status || 'OFFLINE'}
          </div>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="mb-10">
        <label className="block text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-4 px-1">Active Architecture</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Internal Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedMode('internal');
              setError(null);
            }}
            className={`flex items-start gap-5 p-6 rounded-2xl border-2 text-left transition-all ${
              selectedMode === 'internal'
                ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md'
                : 'border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 text-neutral-500 dark:text-neutral-400'
            }`}
          >
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${
                selectedMode === 'internal'
                  ? 'bg-white/10 dark:bg-neutral-900/10 border-white/20 dark:border-neutral-900/20 text-white dark:text-neutral-900'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500'
              }`}
            >
              <Smartphone size={20} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest">Internal</p>
              <p className={`text-xs mt-1 leading-relaxed ${selectedMode === 'internal' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400 dark:text-neutral-500'}`}>
                Web.js engine with QR pairing. Supports multiple concurrent sessions.
              </p>
            </div>
          </button>

          {/* Official Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedMode('official');
              setError(null);
            }}
            className={`flex items-start gap-5 p-6 rounded-2xl border-2 text-left transition-all ${
              selectedMode === 'official'
                ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md'
                : 'border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 text-neutral-500 dark:text-neutral-400'
            }`}
          >
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${
                selectedMode === 'official'
                  ? 'bg-white/10 dark:bg-neutral-900/10 border-white/20 dark:border-neutral-900/20 text-white dark:text-neutral-900'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500'
              }`}
            >
              <Cloud size={20} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest">Official</p>
              <p className={`text-xs mt-1 leading-relaxed ${selectedMode === 'official' ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400 dark:text-neutral-500'}`}>
                Cloud API integration. Direct Meta connectivity for production scale.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Official Config Form */}
      <form onSubmit={handleSave}>
        <div
          className={`overflow-hidden transition-all duration-300 ${
            selectedMode === 'official'
              ? 'max-h-[1000px] opacity-100 mb-8'
              : 'max-h-0 opacity-0'
          }`}
        >
          {/* Show "Already Configured" banner if config exists */}
          {hasSavedConfig && !officialConfig.accessToken && (
            <div className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl p-6 mb-6 flex items-center gap-4 border border-neutral-800 dark:border-neutral-200 shadow-sm">
              <ShieldCheck className="text-white dark:text-neutral-900" size={24} />
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Vault Protected</p>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium mt-1">
                  Active credentials are encrypted. Enter new keys to overwrite existing configuration.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <h3 className="text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-4 px-1">Meta API Credentials</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Permanent Access Token</label>
                <input
                  type="password"
                  value={officialConfig.accessToken}
                  onChange={(e) => updateConfig('accessToken', e.target.value)}
                  placeholder="EAAB..."
                  className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-mono focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white outline-none text-neutral-900 dark:text-white shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">App Secret Key</label>
                <input
                  type="password"
                  value={officialConfig.appSecret}
                  onChange={(e) => updateConfig('appSecret', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-mono focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white outline-none text-neutral-900 dark:text-white shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Phone Number ID</label>
                <input
                  type="text"
                  value={officialConfig.phoneNumberId}
                  onChange={(e) => updateConfig('phoneNumberId', e.target.value)}
                  placeholder="1234567890"
                  className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-mono focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white outline-none text-neutral-900 dark:text-white shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Webhook Verify Token</label>
                <input
                  type="text"
                  value={officialConfig.webhookVerifyToken}
                  onChange={(e) => updateConfig('webhookVerifyToken', e.target.value)}
                  placeholder="custom_string_here"
                  className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-mono focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white outline-none text-neutral-900 dark:text-white shadow-sm"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-50 dark:border-neutral-800 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Endpoint Base (v20.0)</label>
                <input
                  type="text"
                  value={officialConfig.baseUrl}
                  onChange={(e) => updateConfig('baseUrl', e.target.value)}
                  placeholder="https://graph.facebook.com/v20.0"
                  className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-mono text-neutral-900 dark:text-white shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Business Account ID</label>
                <input
                  type="text"
                  value={officialConfig.businessAccountId}
                  onChange={(e) => updateConfig('businessAccountId', e.target.value)}
                  placeholder="WABA_ID"
                  className="w-full px-5 py-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-mono text-neutral-900 dark:text-white shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Test & Save Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex-1">
            {testResult && (
              <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.success ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                {testResult.message}
              </div>
            )}
            {error && (
              <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-red-600">
                <AlertCircle size={12} />
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {selectedMode === 'official' && requiredFieldsFilled && (
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex items-center gap-2 px-6 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-sm"
              >
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {testing ? 'Probing...' : 'Test Connection'}
              </button>
            )}

            {showSaveButton && (
              <button
                type="submit"
                disabled={loading || (selectedMode === 'official' && !requiredFieldsFilled)}
                className="inline-flex items-center gap-2 px-8 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all shadow-md"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {loading ? 'Applying...' : 'Save Architecture'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
