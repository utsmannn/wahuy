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
      ? 'bg-green-100 text-green-700'
      : providerInfo?.status === 'error' || providerInfo?.status === 'failed'
        ? 'bg-red-100 text-red-700'
        : 'bg-yellow-100 text-yellow-700';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-medium text-gray-800 mb-6">Provider Configuration</h2>

      {/* Current Status */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-500 mb-2">Current Status</label>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              providerInfo?.mode === 'official'
                ? 'bg-green-100 text-green-700'
                : 'bg-indigo-100 text-indigo-700'
            }`}
          >
            {providerInfo?.mode === 'official' ? (
              <Cloud size={12} />
            ) : (
              <Smartphone size={12} />
            )}
            {providerInfo?.mode === 'official' ? 'Official (Cloud API)' : 'Internal (Web.js)'}
          </span>
          {providerInfo?.status && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}
            >
              {providerInfo.status === 'ready' || providerInfo.status === 'connected' ? (
                <CheckCircle size={12} />
              ) : (
                <AlertCircle size={12} />
              )}
              {providerInfo.status}
            </span>
          )}
        </div>
      </div>

      {/* Mode Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-500 mb-3">Select Mode</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Internal Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedMode('internal');
              setError(null);
            }}
            className={`flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-colors ${
              selectedMode === 'internal'
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedMode === 'internal'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <Smartphone size={20} />
            </div>
            <div>
              <p
                className={`font-medium ${
                  selectedMode === 'internal' ? 'text-indigo-900' : 'text-gray-800'
                }`}
              >
                Internal (Web.js)
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Uses whatsapp-web.js with QR pairing. Manage sessions in the Sessions tab.
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
            className={`flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-colors ${
              selectedMode === 'official'
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedMode === 'official'
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <Cloud size={20} />
            </div>
            <div>
              <p
                className={`font-medium ${
                  selectedMode === 'official' ? 'text-indigo-900' : 'text-gray-800'
                }`}
              >
                Official (Cloud API)
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Uses WhatsApp Business API. Requires Meta developer credentials.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Official Config Form */}
      <form onSubmit={handleSave}>
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            selectedMode === 'official'
              ? 'max-h-[800px] opacity-100 mb-6'
              : 'max-h-0 opacity-0'
          }`}
        >
          {/* Show "Already Configured" banner if config exists */}
          {hasSavedConfig && !officialConfig.accessToken && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-green-600" size={20} />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Official Provider Already Configured
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Credentials are saved securely. Enter new credentials below to update.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-medium text-gray-700">
              {hasSavedConfig ? 'Update Official API Credentials' : 'Official API Credentials'}
            </h3>

            {/* Access Token */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Token <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={officialConfig.accessToken}
                onChange={(e) => updateConfig('accessToken', e.target.value)}
                placeholder="Your Meta access token"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>

            {/* App Secret */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App Secret <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={officialConfig.appSecret}
                onChange={(e) => updateConfig('appSecret', e.target.value)}
                placeholder="Your Meta app secret"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>

            {/* Phone Number ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={officialConfig.phoneNumberId}
                onChange={(e) => updateConfig('phoneNumberId', e.target.value)}
                placeholder="e.g. 1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>

            {/* Webhook Verify Token */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook Verify Token <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={officialConfig.webhookVerifyToken}
                onChange={(e) => updateConfig('webhookVerifyToken', e.target.value)}
                placeholder="A custom token for webhook verification"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>

            {/* Base URL (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base URL <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={officialConfig.baseUrl}
                onChange={(e) => updateConfig('baseUrl', e.target.value)}
                placeholder="https://graph.facebook.com/v20.0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>

            {/* Business Account ID (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Account ID <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={officialConfig.businessAccountId}
                onChange={(e) => updateConfig('businessAccountId', e.target.value)}
                placeholder="Your WABA ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${
              testResult.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {testResult.message}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm bg-red-50 text-red-700 border border-red-200">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {selectedMode === 'official' && requiredFieldsFilled && (
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          )}

          {showSaveButton && (
            <button
              type="submit"
              disabled={loading || (selectedMode === 'official' && !requiredFieldsFilled)}
              className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {loading ? 'Saving...' : 'Save & Apply'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
