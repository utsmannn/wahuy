import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, MessageSquare, Webhook, Settings, Plus, RefreshCw, LogOut, Moon, Sun, Smartphone, Wifi, Activity } from 'lucide-react';
import { Login } from './components/Login';
import { SessionCard } from './components/SessionCard';
import { CreateSessionModal } from './components/CreateSessionModal';
import { WebhookList } from './components/WebhookList';
import { WebhookForm } from './components/WebhookForm';
import { WebhookMonitor } from './components/WebhookMonitor';
import { MessageViewer } from './components/MessageViewer';
import { SendMessageModal } from './components/SendMessageModal';
import { ProviderSetup } from './components/ProviderSetup';
import { useWebSocket } from './hooks/useWebSocket';
import { api } from './lib/api';
import type { Session, Webhook as WebhookType, Message, ProviderInfo } from './types';

type Tab = 'sessions' | 'messages' | 'webhooks' | 'settings';

function App() {
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem('apiKey') || '');
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [showWebhookMonitor, setShowWebhookMonitor] = useState(false);
  const [qrModal, setQrModal] = useState<{ sessionId: string; qr: string } | null>(null);
  const [selectedSession, setSelectedSession] = useState('');
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | undefined>();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, connected: 0, messages: 0 });
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleQR = useCallback((sessionId: string, qr: string) => {
    setQrCodes(prev => ({ ...prev, [sessionId]: qr }));
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, status: 'scan_qr' } : s
    ));
    setQrModal(prev => prev?.sessionId === sessionId ? { ...prev, qr } : prev);
  }, []);

  const handleStatus = useCallback((sessionId: string, status: string, phone?: string) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, status: status as Session['status'], phone: phone || s.phone } : s
    ));
    if (['ready', 'disconnected', 'stopped', 'failed'].includes(status)) {
      setQrCodes(prev => { const { [sessionId]: _, ...rest } = prev; void _; return rest; });
      setQrModal(prev => prev?.sessionId === sessionId ? null : prev);
    }
    loadStats();
  }, []);

  const handleMessage = useCallback((sessionId: string, message: unknown) => {
    setMessages(prev => [{ ...(message as Message), sessionId, receivedAt: new Date().toISOString() }, ...prev].slice(0, 100));
    setStats(prev => ({ ...prev, messages: prev.messages + 1 }));
  }, []);

  const { connected, sessions: wsSessions, refreshSessions } = useWebSocket({
    apiKey,
    onQR: handleQR,
    onStatus: handleStatus,
    onMessage: handleMessage,
  });

  useEffect(() => {
    if (wsSessions.length > 0) { setSessions(wsSessions); loadStats(); }
  }, [wsSessions]);

  useEffect(() => { if (apiKey) loadData(); }, [apiKey]);

  const loadStats = async () => {
    try {
      const h = await api.getHealth();
      const s = h.data?.sessions || h.sessions;
      if (s) setStats(prev => ({ ...prev, total: s.total, connected: s.connected }));
    } catch { /* ignore */ }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, wRes, hRes, mRes, pRes] = await Promise.all([
        api.getSessions(), api.getWebhooks(), api.getHealth(),
        api.getMessageHistory({ limit: 100 }), api.getProviderInfo().catch(() => null),
      ]);
      setSessions(sRes.data);
      setWebhooks(wRes.data);
      if (mRes.data?.messages) {
        setMessages(mRes.data.messages.map(m => ({ ...m, receivedAt: m.receivedAt || new Date().toISOString() })));
        setStats(prev => ({ ...prev, messages: mRes.data.total || mRes.data.messages.length }));
      }
      if (pRes?.data) setProviderInfo(pRes.data);
      const s = hRes.data?.sessions || hRes.sessions;
      if (s) setStats(prev => ({ ...prev, total: s.total, connected: s.connected }));

      // Fetch QR codes for sessions that are waiting for scan
      for (const sess of sRes.data) {
        if (sess.status === 'scan_qr') {
          try {
            const qrRes = await api.getQR(sess.id);
            if (qrRes.data?.qr) setQrCodes(prev => ({ ...prev, [sess.id]: qrRes.data.qr }));
          } catch { /* QR may not be available yet */ }
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleLogin = (key: string) => setApiKeyState(key);
  const handleLogout = () => {
    localStorage.removeItem('apiKey');
    setApiKeyState('');
  };

  const handleCreateSession = async (id: string, name: string) => {
    try { await api.createSession({ id, name }); await api.startSession(id); loadData(); refreshSessions(); }
    catch (err) { console.error(err); }
  };

  const handleStartSession = async (id: string) => { try { await api.startSession(id); refreshSessions(); } catch {} };
  const handleStopSession = async (id: string) => { try { await api.stopSession(id); refreshSessions(); } catch {} };
  const handleDeleteSession = async (id: string) => {
    if (!confirm(`Delete session "${id}"?`)) return;
    try { await api.deleteSession(id); setSessions(prev => prev.filter(s => s.id !== id)); } catch {}
  };
  const handleLogoutSession = async (id: string) => { try { await api.logoutSession(id); refreshSessions(); } catch {} };

  const handleSaveWebhook = async (data: Partial<WebhookType>) => {
    try {
      if (editingWebhook) await api.updateWebhook(editingWebhook.id, data);
      else await api.createWebhook(data);
      loadData(); setEditingWebhook(undefined);
    } catch {}
  };
  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try { await api.deleteWebhook(id); setWebhooks(prev => prev.filter(w => w.id !== id)); } catch {}
  };
  const handleTestWebhook = async (id: string) => {
    try { const r = await api.testWebhook(id); alert(`Test: ${r.data.statusCode} (${r.data.responseTime}ms)`); } catch (e) { alert(`Failed: ${(e as Error).message}`); }
  };
  const clearMessages = async () => {
    if (!confirm('Clear all messages?')) return;
    try { await api.clearMessageHistory(); setMessages([]); setStats(prev => ({ ...prev, messages: 0 })); } catch {}
  };

  if (!apiKey) return <Login onLogin={handleLogin} />;

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'sessions', label: 'Sessions', icon: LayoutDashboard },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Top Nav */}
      <nav className="sticky top-0 z-30 h-14 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center px-4 sm:px-6 gap-1">
        <div className="flex items-center gap-2.5 mr-4">
          <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
            <Activity className="text-white dark:text-gray-900" size={14} />
          </div>
          <span className="font-bold text-sm hidden sm:inline">Wahuy</span>
        </div>
        <div className="flex items-center gap-0.5">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === t.id ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                <Icon size={15} /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5">
          <button onClick={() => { loadData(); refreshSessions(); }} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setDark(!dark)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="Toggle theme">
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400 hidden sm:inline">{connected ? 'Online' : 'Offline'}</span>
          </div>
          <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 ml-1" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Sessions', value: stats.total, sub: `${stats.connected} active`, icon: Smartphone },
            { label: 'Live', value: stats.connected, sub: 'Connected', icon: Wifi },
            { label: 'Messages', value: stats.messages.toLocaleString(), sub: 'Processed', icon: MessageSquare },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs font-medium mb-1"><Icon size={14} />{s.label}</div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-gray-400">{s.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sessions</h2>
              <button onClick={() => setShowCreateSession(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">
                <Plus size={15} /> Add Session
              </button>
            </div>
            {sessions.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-16 text-center">
                <Smartphone size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 font-medium mb-4">No sessions yet</p>
                <button onClick={() => setShowCreateSession(true)}
                  className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100">
                  Create your first session
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map(session => (
                  <SessionCard key={session.id} session={session} qrCode={qrCodes[session.id]}
                    onStart={() => handleStartSession(session.id)} onStop={() => handleStopSession(session.id)}
                    onDelete={() => handleDeleteSession(session.id)} onLogout={() => handleLogoutSession(session.id)}
                    onSendMessage={() => { setSelectedSession(session.id); setShowSendMessage(true); }}
                    onShowQr={(qr) => setQrModal({ sessionId: session.id, qr })} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Messages</h2>
              {providerInfo?.mode === 'official' && (
                <button onClick={() => { setSelectedSession(''); setShowSendMessage(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100">
                  <MessageSquare size={15} /> New Message
                </button>
              )}
            </div>
            <MessageViewer messages={messages} onClear={clearMessages} sessions={sessions} />
          </div>
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Webhooks</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowWebhookMonitor(true)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <Activity size={15} /> Logs
                </button>
                <button onClick={() => { setEditingWebhook(undefined); setShowWebhookForm(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100">
                  <Plus size={15} /> Add Webhook
                </button>
              </div>
            </div>
            <WebhookList webhooks={webhooks}
              onEdit={(w) => { setEditingWebhook(w); setShowWebhookForm(true); }}
              onDelete={handleDeleteWebhook} onTest={handleTestWebhook} />
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <ProviderSetup providerInfo={providerInfo} onSwitch={loadData} />
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="font-semibold mb-4">API Key</h3>
              <div className="flex gap-2">
                <input type="password" value={apiKey} readOnly
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono outline-none" />
                <button onClick={() => { navigator.clipboard.writeText(apiKey); alert('Copied!'); }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700">
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Send in <code className="font-mono font-semibold text-gray-600 dark:text-gray-300">X-API-Key</code> header.</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="font-semibold mb-4">Quick Reference</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['POST', '/api/sessions', 'Create session'],
                  ['POST', '/api/sessions/:id/start', 'Start session'],
                  ['POST', '/api/sessions/:id/messages/send', 'Send message'],
                  ['POST', '/v1/messages', 'Official API send'],
                  ['GET', '/api/health', 'Health check'],
                ].map(([method, path, desc], i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${method === 'GET' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>{method}</span>
                    <code className="text-xs font-mono flex-1">{path}</code>
                    <span className="text-xs text-gray-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <CreateSessionModal isOpen={showCreateSession} onClose={() => setShowCreateSession(false)} onCreate={handleCreateSession} />
      <WebhookForm webhook={editingWebhook} isOpen={showWebhookForm}
        onClose={() => { setShowWebhookForm(false); setEditingWebhook(undefined); }} onSave={handleSaveWebhook} />
      <WebhookMonitor isOpen={showWebhookMonitor} onClose={() => setShowWebhookMonitor(false)} />
      <SendMessageModal isOpen={showSendMessage} onClose={() => setShowSendMessage(false)}
        sessionId={selectedSession} sessions={sessions} providerInfo={providerInfo} />

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setQrModal(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Scan QR Code</h3>
              <button onClick={() => setQrModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Open WhatsApp on your phone, go to <strong>Linked Devices</strong>, and scan this code.</p>
            <div className="bg-white rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-center">
              <img src={qrModal.qr} alt="WhatsApp QR" className="w-72 h-72 dark:invert" />
            </div>
            <p className="text-[10px] text-gray-400 mt-3 text-center">Session: {qrModal.sessionId}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
