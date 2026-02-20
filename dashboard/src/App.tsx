import { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Webhook,
  MessageSquare,
  Settings,
  Plus,
  RefreshCw,
  LogOut,
  Menu,
  X,
  Wifi,
  CheckCircle,
  AlertCircle,
  Activity
} from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [showWebhookMonitor, setShowWebhookMonitor] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | undefined>();
  const [loading, setLoading] = useState(false);
  const [serverStats, setServerStats] = useState({ total: 0, connected: 0, messages: 0 });
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);

  const handleQR = useCallback((sessionId: string, qr: string) => {
    setQrCodes(prev => ({ ...prev, [sessionId]: qr }));
  }, []);

  const handleStatus = useCallback((sessionId: string, status: string, phone?: string) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, status: status as Session['status'], phone: phone || s.phone } : s
    ));
    if (status === 'ready' || status === 'disconnected') {
      setQrCodes(prev => {
        const { [sessionId]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      });
    }
    loadStats();
  }, []);

  const handleMessage = useCallback((sessionId: string, message: unknown) => {
    setMessages(prev => [{ ...(message as Message), sessionId, receivedAt: new Date().toISOString() }, ...prev].slice(0, 100));
    setServerStats(prev => ({ ...prev, messages: prev.messages + 1 }));
  }, []);

  const { connected, sessions: wsSessions, refreshSessions } = useWebSocket({
    apiKey,
    onQR: handleQR,
    onStatus: handleStatus,
    onMessage: handleMessage,
  });

  useEffect(() => {
    if (wsSessions.length > 0) {
      setSessions(wsSessions);
      loadStats();
    }
  }, [wsSessions]);

  useEffect(() => {
    if (apiKey) {
      loadData();
    }
  }, [apiKey]);

  const loadStats = async () => {
    try {
      const health = await api.getHealth();
      const sessionsData = health.data?.sessions || health.sessions;
      if (sessionsData) {
        setServerStats(prev => ({
          ...prev,
          total: sessionsData.total,
          connected: sessionsData.connected
        }));
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, webhooksRes, health, messagesRes, providerRes] = await Promise.all([
        api.getSessions(),
        api.getWebhooks(),
        api.getHealth(),
        api.getMessageHistory({ limit: 100 }),
        api.getProviderInfo().catch(() => null),
      ]);
      setSessions(sessionsRes.data);
      setWebhooks(webhooksRes.data);
      // Load persisted messages
      if (messagesRes.data?.messages) {
        setMessages(messagesRes.data.messages.map(m => ({
          ...m,
          receivedAt: m.receivedAt || new Date().toISOString(),
        })));
        setServerStats(prev => ({
          ...prev,
          messages: messagesRes.data.total || messagesRes.data.messages.length,
        }));
      }
      if (providerRes?.data) {
        setProviderInfo(providerRes.data);
      }
      const sessionsData = health.data?.sessions || health.sessions;
      if (sessionsData) {
        setServerStats(prev => ({
          ...prev,
          total: sessionsData.total,
          connected: sessionsData.connected,
        }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (key: string) => {
    setApiKeyState(key);
  };

  const handleLogout = () => {
    localStorage.removeItem('apiKey');
    setApiKeyState('');
    setSessions([]);
    setWebhooks([]);
    setMessages([]);
  };

  const handleCreateSession = async (id: string, name: string) => {
    try {
      await api.createSession({ id, name });
      await api.startSession(id);
      loadData();
      refreshSessions();
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleStartSession = async (id: string) => {
    try {
      await api.startSession(id);
      refreshSessions();
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  };

  const handleStopSession = async (id: string) => {
    try {
      await api.stopSession(id);
      refreshSessions();
    } catch (err) {
      console.error('Failed to stop session:', err);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm(`Delete session "${id}"?`)) return;
    try {
      await api.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleLogoutSession = async (id: string) => {
    try {
      await api.logoutSession(id);
      refreshSessions();
    } catch (err) {
      console.error('Failed to logout session:', err);
    }
  };

  const handleSaveWebhook = async (data: Partial<WebhookType>) => {
    try {
      if (editingWebhook) {
        await api.updateWebhook(editingWebhook.id, data);
      } else {
        await api.createWebhook(data);
      }
      loadData();
      setEditingWebhook(undefined);
    } catch (err) {
      console.error('Failed to save webhook:', err);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      await api.deleteWebhook(id);
      setWebhooks(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      const result = await api.testWebhook(id);
      alert(`Test result: ${result.data.statusCode} (${result.data.responseTime}ms)`);
    } catch (err) {
      alert(`Test failed: ${(err as Error).message}`);
    }
  };

  const handleSendMessage = (sessionId: string) => {
    setSelectedSession(sessionId);
    setShowSendMessage(true);
  };

  const clearMessages = async () => {
    if (confirm('Clear all message history?')) {
      try {
        await api.clearMessageHistory();
        setMessages([]);
        setServerStats(prev => ({ ...prev, messages: 0 }));
      } catch (err) {
        console.error('Failed to clear messages:', err);
        alert('Failed to clear messages');
      }
    }
  };

  if (!apiKey) {
    return <Login onLogin={handleLogin} />;
  }

  const isOfficialMode = providerInfo?.mode === 'official';

  const navItems = [
    { id: 'sessions' as Tab, label: 'Sessions', icon: Smartphone },
    { id: 'messages' as Tab, label: 'Messages', icon: MessageSquare, badge: messages.length },
    { id: 'webhooks' as Tab, label: 'Webhooks', icon: Webhook },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen && <h1 className="text-xl font-bold text-indigo-600">WASimple</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  activeTab === item.id
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Connection Status */}
        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center gap-2 ${connected ? 'text-green-600' : 'text-red-500'}`}>
            {connected ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {sidebarOpen && <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800 capitalize">{activeTab}</h2>
            {loading && <RefreshCw size={16} className="animate-spin text-gray-400" />}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Sessions</p>
                  <p className="text-2xl font-bold text-gray-800">{serverStats.total}</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <Smartphone className="text-indigo-600" size={24} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Connected</p>
                  <p className="text-2xl font-bold text-green-600">{serverStats.connected}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <Wifi className="text-green-600" size={24} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Messages Received</p>
                  <p className="text-2xl font-bold text-blue-600">{serverStats.messages}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <MessageSquare className="text-blue-600" size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-800">WhatsApp Sessions</h3>
                <button
                  onClick={() => setShowCreateSession(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus size={18} />
                  New Session
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
                  <Smartphone size={48} className="mx-auto text-gray-300 mb-4" />
                  <h4 className="text-lg font-medium text-gray-600 mb-2">No Sessions</h4>
                  <p className="text-gray-500 mb-4">Create a new session to connect WhatsApp</p>
                  <button
                    onClick={() => setShowCreateSession(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Create Session
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {sessions.map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      qrCode={qrCodes[session.id]}
                      onStart={() => handleStartSession(session.id)}
                      onStop={() => handleStopSession(session.id)}
                      onDelete={() => handleDeleteSession(session.id)}
                      onLogout={() => handleLogoutSession(session.id)}
                      onSendMessage={() => handleSendMessage(session.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              {isOfficialMode && (
                <div className="flex justify-end">
                  <button
                    onClick={() => { setSelectedSession(''); setShowSendMessage(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <MessageSquare size={18} />
                    Send Message
                  </button>
                </div>
              )}
              <MessageViewer
                messages={messages}
                onClear={clearMessages}
                sessions={sessions}
              />
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-800">Webhook Endpoints</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Configure webhooks to receive real-time events
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowWebhookMonitor(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <Activity size={18} />
                    Monitor
                  </button>
                  <button
                    onClick={() => {
                      setEditingWebhook(undefined);
                      setShowWebhookForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    <Plus size={18} />
                    Add Webhook
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <WebhookList
                  webhooks={webhooks}
                  onEdit={(webhook) => {
                    setEditingWebhook(webhook);
                    setShowWebhookForm(true);
                  }}
                  onDelete={handleDeleteWebhook}
                  onTest={handleTestWebhook}
                />
              </div>

              {/* Webhook Guide */}
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                <h4 className="text-lg font-medium text-blue-800 mb-3">Webhook Integration Guide</h4>
                <div className="space-y-3 text-sm text-blue-700">
                  <p>
                    Webhooks allow your application to receive real-time events from WASimple.
                    When an event occurs (e.g., message received), WASimple will POST to your URL.
                  </p>
                  <div>
                    <strong>Available Events:</strong>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      <li><code>message:received</code> - Incoming message</li>
                      <li><code>message:sent</code> - Outgoing message</li>
                      <li><code>message:ack</code> - Message delivery status</li>
                      <li><code>session:qr</code> - QR code generated</li>
                      <li><code>session:ready</code> - Session connected</li>
                      <li><code>session:disconnected</code> - Session disconnected</li>
                    </ul>
                  </div>
                  <div>
                    <strong>Payload Format:</strong>
                    <pre className="bg-blue-100 p-3 rounded-lg mt-2 overflow-x-auto">
{`{
  "event": "message:received",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "sessionId": "my-session",
  "data": {
    "message": {
      "id": "true_628123...",
      "from": "6281234567890@c.us",
      "body": "Hello!",
      "type": "chat",
      "hasMedia": false
    }
  }
}`}
                    </pre>
                  </div>
                  <div>
                    <strong>Security (HMAC Signature):</strong>
                    <p className="mt-1">
                      If you set a webhook secret, WASimple will include a signature header:
                    </p>
                    <pre className="bg-blue-100 p-3 rounded-lg mt-2">
{`// Node.js verification example
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hmac === signature;
}

// Usage
const signature = req.headers['x-webhook-signature'];
const isValid = verifyWebhook(req.body, signature, WEBHOOK_SECRET);`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-6">
              <ProviderSetup providerInfo={providerInfo} onSwitch={loadData} />

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">API Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={apiKey}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(apiKey);
                          alert('API key copied!');
                        }}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Use this key in the X-API-Key header for API requests
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">API Endpoints</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <code className="text-indigo-600">POST /api/sessions</code>
                    <span className="text-gray-500">Create new session</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <code className="text-indigo-600">POST /api/sessions/:id/start</code>
                    <span className="text-gray-500">Start session</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <code className="text-indigo-600">POST /api/messages/send</code>
                    <span className="text-gray-500">Send text message</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <code className="text-indigo-600">POST /api/:sessionId/messages/send-image</code>
                    <span className="text-gray-500">Send image (base64)</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <code className="text-indigo-600">POST /api/:sessionId/messages/send-document</code>
                    <span className="text-gray-500">Send document (base64)</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <code className="text-indigo-600">GET /api/health</code>
                    <span className="text-gray-500">Health check</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <CreateSessionModal
        isOpen={showCreateSession}
        onClose={() => setShowCreateSession(false)}
        onCreate={handleCreateSession}
      />

      <WebhookForm
        webhook={editingWebhook}
        isOpen={showWebhookForm}
        onClose={() => {
          setShowWebhookForm(false);
          setEditingWebhook(undefined);
        }}
        onSave={handleSaveWebhook}
      />

      <WebhookMonitor
        isOpen={showWebhookMonitor}
        onClose={() => setShowWebhookMonitor(false)}
      />

      <SendMessageModal
        isOpen={showSendMessage}
        onClose={() => setShowSendMessage(false)}
        sessionId={selectedSession}
        sessions={sessions}
        providerInfo={providerInfo}
      />
    </div>
  );
}

export default App;
