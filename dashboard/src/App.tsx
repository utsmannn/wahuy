import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Wifi, WifiOff, LogOut } from 'lucide-react';
import { Login } from './components/Login';
import { SessionCard } from './components/SessionCard';
import { CreateSessionModal } from './components/CreateSessionModal';
import { WebhookList } from './components/WebhookList';
import { WebhookForm } from './components/WebhookForm';
import { useWebSocket } from './hooks/useWebSocket';
import { api } from './lib/api';
import type { Session, Webhook as WebhookType } from './types';

function App() {
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem('apiKey') || '');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | undefined>();
  const [loading, setLoading] = useState(false);

  const handleQR = useCallback((sessionId: string, qr: string) => {
    setQrCodes(prev => ({ ...prev, [sessionId]: qr }));
  }, []);

  const handleStatus = useCallback((sessionId: string, status: string) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, status: status as Session['status'] } : s
    ));
    if (status === 'ready' || status === 'disconnected') {
      setQrCodes(prev => {
        const { [sessionId]: _, ...rest } = prev;
        return rest;
      });
    }
  }, []);

  const { connected, sessions: wsSessions, refreshSessions } = useWebSocket({
    apiKey,
    onQR: handleQR,
    onStatus: handleStatus,
  });

  useEffect(() => {
    if (wsSessions.length > 0) {
      setSessions(wsSessions);
    }
  }, [wsSessions]);

  useEffect(() => {
    if (apiKey) {
      loadData();
    }
  }, [apiKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, webhooksRes] = await Promise.all([
        api.getSessions(),
        api.getWebhooks(),
      ]);
      setSessions(sessionsRes.data);
      setWebhooks(webhooksRes.data);
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

  if (!apiKey) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">WASimple</h1>
            <span className={`flex items-center gap-1 text-sm ${connected ? 'text-green-600' : 'text-red-500'}`}>
              {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Sessions Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
            <button
              onClick={() => setShowCreateSession(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <Plus size={18} />
              New Session
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
              No sessions yet. Create one to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  qrCode={qrCodes[session.id]}
                  onStart={() => handleStartSession(session.id)}
                  onStop={() => handleStopSession(session.id)}
                  onDelete={() => handleDeleteSession(session.id)}
                  onLogout={() => handleLogoutSession(session.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Webhooks Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Webhooks</h2>
            <button
              onClick={() => {
                setEditingWebhook(undefined);
                setShowWebhookForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <Plus size={18} />
              Add Webhook
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
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
        </section>
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
    </div>
  );
}

export default App;
