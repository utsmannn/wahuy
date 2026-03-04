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
  Activity,
  History,
  Zap,
  Search,
  Moon,
  Sun
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

type Tab = 'sessions' | 'messages' | 'webhooks' | 'settings' | 'logs';

function App() {
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem('apiKey') || '');
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
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
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | undefined>();
  const [loading, setLoading] = useState(false);
  const [serverStats, setServerStats] = useState({ total: 0, connected: 0, messages: 0, webhooks: 0 });
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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
      if (messagesRes.data?.messages) {
        setMessages(messagesRes.data.messages.map(m => ({
          ...m,
          receivedAt: m.receivedAt || new Date().toISOString(),
        })));
        setServerStats(prev => ({
          ...prev,
          messages: messagesRes.data.total || messagesRes.data.messages.length,
          webhooks: webhooksRes.data.length,
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
    { id: 'sessions' as Tab, label: 'Sessions', icon: Smartphone, badge: serverStats.total },
    { id: 'messages' as Tab, label: 'Messages', icon: MessageSquare, badge: messages.length },
    { id: 'webhooks' as Tab, label: 'Webhooks', icon: Webhook, badge: serverStats.webhooks },
    { id: 'logs' as Tab, label: 'Logs', icon: History },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex text-neutral-900 dark:text-neutral-100 font-sans transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex ${sidebarOpen ? 'w-64' : 'w-20'} flex-col bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transition-all duration-300 shadow-sm`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-neutral-100 dark:border-neutral-800">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center">
                <Zap className="text-white dark:text-neutral-900" size={16} />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Wahuy</h1>
                <p className="text-[10px] text-neutral-400 font-medium tracking-wider -mt-0.5 uppercase">API</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center">
              <Zap className="text-white dark:text-neutral-900" size={16} />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-4 space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md'
                    : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left text-sm font-semibold">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                        isActive ? 'bg-white/20 dark:bg-neutral-900/10 text-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                      }`}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Connection Status */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 ${connected ? 'text-green-600' : 'text-red-500'} ${!sidebarOpen && 'justify-center'}`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
            {sidebarOpen && (
              <span className="text-xs font-bold uppercase tracking-widest">{connected ? 'Online' : 'Offline'}</span>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 z-40 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 -ml-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center">
              <Zap className="text-white dark:text-neutral-900" size={16} />
            </div>
            <span className="font-bold tracking-tight">Wahuy</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bg-white dark:bg-neutral-900 z-30 pt-4 px-6 animate-in fade-in duration-200">
          <nav className="space-y-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${
                    activeTab === item.id
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                      : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Icon size={20} />
                  <span className="flex-1 text-left font-bold">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen pt-16 lg:pt-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between px-8 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex p-2 -ml-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-baseline gap-3">
              <h2 className="text-xl font-bold tracking-tight capitalize">{activeTab}</h2>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all"
              title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="hidden sm:flex items-center gap-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-xl px-4 py-2">
              <Search size={16} className="text-neutral-400" />
              <input
                type="text"
                placeholder="Quick search..."
                className="bg-transparent text-sm text-neutral-700 dark:text-neutral-300 placeholder-neutral-400 outline-none w-48 font-medium"
              />
            </div>
            
            <button
              onClick={loadData}
              className="p-2.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <div className="h-8 w-px bg-neutral-100 dark:bg-neutral-800" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-4 py-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-100 dark:hover:border-red-900 rounded-xl transition-all"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline text-sm font-bold">Sign out</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8 lg:p-10">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700">
                  <Smartphone className="text-neutral-900 dark:text-neutral-100" size={20} />
                </div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Sessions</span>
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{serverStats.total}</p>
                <p className="text-[11px] font-bold text-green-600 dark:text-green-500 mt-1 uppercase tracking-wider">{serverStats.connected} active</p>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700">
                  <Wifi className="text-neutral-900 dark:text-neutral-100" size={20} />
                </div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Live</span>
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{serverStats.connected}</p>
                <p className="text-[11px] font-bold text-neutral-400 mt-1 uppercase tracking-wider">Connected now</p>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700">
                  <MessageSquare className="text-neutral-900 dark:text-neutral-100" size={20} />
                </div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Traffic</span>
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{serverStats.messages.toLocaleString()}</p>
                <p className="text-[11px] font-bold text-neutral-400 mt-1 uppercase tracking-wider">Total processed</p>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700">
                  <Webhook className="text-neutral-900 dark:text-neutral-100" size={20} />
                </div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Endpoints</span>
              </div>
              <div>
                <p className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{serverStats.webhooks}</p>
                <p className="text-[11px] font-bold text-neutral-400 mt-1 uppercase tracking-wider">Active hooks</p>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'sessions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Connected Accounts</h3>
                  <p className="text-sm text-neutral-500 font-medium">Manage and monitor your WhatsApp sessions</p>
                </div>
                <button
                  onClick={() => setShowCreateSession(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all font-bold text-sm shadow-md"
                >
                  <Plus size={18} />
                  Add Session
                </button>
              </div>

              {sessions.length === 0 ? (
                <div className="bg-white dark:bg-neutral-900 rounded-3xl p-16 text-center border border-neutral-200 dark:border-neutral-800 shadow-sm">
                  <div className="w-20 h-20 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Smartphone size={32} className="text-neutral-300 dark:text-neutral-600" />
                  </div>
                  <h4 className="text-xl font-bold mb-2">Start your first session</h4>
                  <p className="text-neutral-500 mb-8 max-w-sm mx-auto font-medium">Add a WhatsApp account to begin automating your communications</p>
                  <button
                    onClick={() => setShowCreateSession(true)}
                    className="px-8 py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all font-bold text-sm shadow-md"
                  >
                    Get Started
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Message Stream</h3>
                  <p className="text-sm text-neutral-500 font-medium">Real-time view of processed communications</p>
                </div>
                {isOfficialMode && (
                  <button
                    onClick={() => { setSelectedSession(''); setShowSendMessage(true); }}
                    className="flex items-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all font-bold text-sm shadow-md"
                  >
                    <MessageSquare size={18} />
                    New Message
                  </button>
                )}
              </div>
              <MessageViewer
                messages={messages}
                onClear={clearMessages}
                sessions={sessions}
              />
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Webhook Management</h3>
                  <p className="text-sm text-neutral-500 font-medium">Forward WhatsApp events to your servers</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowWebhookMonitor(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all font-bold text-sm shadow-sm"
                  >
                    <Activity size={18} />
                    Logs
                  </button>
                  <button
                    onClick={() => {
                      setEditingWebhook(undefined);
                      setShowWebhookForm(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all font-bold text-sm shadow-md"
                  >
                    <Plus size={18} />
                    Add Webhook
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
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
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-10 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">System Activity</h3>
                  <p className="text-sm text-neutral-500 font-medium">Monitoring all incoming traffic from Meta</p>
                </div>
                <button
                  onClick={() => setShowWebhookMonitor(true)}
                  className="flex items-center gap-2 px-8 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all font-bold text-sm shadow-md"
                >
                  <Activity size={18} />
                  Open Traffic Monitor
                </button>
              </div>
              <div className="text-center py-20 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-neutral-100 dark:border-neutral-800 border-dashed">
                <Activity size={40} className="mx-auto text-neutral-200 dark:text-neutral-700 mb-6" />
                <p className="text-neutral-500 font-medium">Real-time traffic monitor is available in a separate view</p>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-4xl space-y-8">
              <ProviderSetup providerInfo={providerInfo} onSwitch={loadData} />

              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm">
                <h3 className="text-lg font-bold tracking-tight mb-6">Security & Auth</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-3 px-1">Master API Key</label>
                    <div className="flex gap-4">
                      <input
                        type="password"
                        value={apiKey}
                        readOnly
                        className="flex-1 px-5 py-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-mono focus:ring-1 focus:ring-neutral-900 outline-none"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(apiKey);
                          alert('API key copied!');
                        }}
                        className="px-6 py-3.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-xl text-sm font-bold transition-all border border-neutral-200 dark:border-neutral-700"
                      >
                        Copy Key
                      </button>
                    </div>
                    <p className="text-[11px] text-neutral-400 font-medium mt-3 leading-relaxed">
                      All requests must include this key in the <code className="text-neutral-900 dark:text-neutral-100 font-bold">X-API-Key</code> header. Keep this key confidential.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm">
                <h3 className="text-lg font-bold tracking-tight mb-6">REST Endpoints</h3>
                <div className="space-y-1">
                  {[
                    { method: 'POST', path: '/api/sessions', desc: 'Create new session' },
                    { method: 'POST', path: '/api/sessions/:id/start', desc: 'Start session' },
                    { method: 'POST', path: '/api/messages/send', desc: 'Send text message' },
                    { method: 'POST', path: '/api/:sessionId/messages/send-image', desc: 'Send image (base64)' },
                    { method: 'GET', path: '/api/health', desc: 'Health check' },
                  ].map((ep, i) => (
                    <div key={i} className="flex items-center justify-between py-4 border-b border-neutral-50 dark:border-neutral-800 last:border-0">
                      <div className="flex items-center gap-4">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          ep.method === 'GET' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                        }`}>{ep.method}</span>
                        <code className="text-sm font-mono font-medium">{ep.path}</code>
                      </div>
                      <span className="text-xs text-neutral-400 font-medium">{ep.desc}</span>
                    </div>
                  ))}
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
