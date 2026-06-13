import { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Webhook, Session } from '../types';

interface WebhookFormProps { webhook?: Webhook; isOpen: boolean; onClose: () => void; onSave: (data: Partial<Webhook>) => void; }

const events = [
  { v: 'message.received', l: 'Message Received' },
  { v: 'message.sent', l: 'Message Sent' },
  { v: 'message.ack', l: 'Message ACK' },
  { v: 'session.qr_updated', l: 'Session QR' },
  { v: 'session.authenticated', l: 'Auth OK' },
  { v: 'session.ready', l: 'Session Ready' },
  { v: 'session.disconnected', l: 'Disconnected' },
  { v: 'session.reconnecting', l: 'Reconnecting' },
  { v: 'session.failed', l: 'Session Failed' },
];

export function WebhookForm({ webhook, isOpen, onClose, onSave }: WebhookFormProps) {
  const [url, setUrl] = useState(webhook?.url || '');
  const [selected, setSelected] = useState<string[]>(webhook?.events || ['*']);
  const [secret, setSecret] = useState(webhook?.secret || '');
  const [active, setActive] = useState(webhook?.active ?? true);
  const [allSessions, setAllSessions] = useState(webhook?.sessions?.includes('*') || (!webhook?.sessions?.length));
  const [selectedSessions, setSelectedSessions] = useState<string[]>(webhook?.sessions?.filter(s => s !== '*') || []);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await api.getSessions();
      setSessions(res.data || []);
    } catch { /* ignore */ }
    finally { setLoadingSessions(false); }
  };

  if (!isOpen) return null;

  const toggleEvent = (e: string) => {
    if (e === '*') { setSelected(['*']); return; }
    const rest = selected.filter(x => x !== '*');
    setSelected(rest.includes(e) ? rest.filter(x => x !== e) : [...rest, e]);
  };

  const toggleSession = (id: string) => {
    setAllSessions(false);
    setSelectedSessions(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleAllSessions = () => {
    setAllSessions(true);
    setSelectedSessions([]);
    setError('');
  };

  const buildSessions = (): string[] => {
    if (allSessions) return ['*'];
    return selectedSessions;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sessionsVal = buildSessions();

    // Validate: must pick at least one session or "*"
    if (sessionsVal.length === 0) {
      setError('Select at least one session or "All sessions".');
      return;
    }

    onSave({ url, events: selected, secret: secret || undefined, active, sessions: sessionsVal });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{webhook ? 'Edit Webhook' : 'New Webhook'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">URL <span className="text-red-400">*</span></label>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" required />
          </div>

          {/* Session Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Sessions <span className="text-red-400">*</span>
              <span className="text-gray-400 font-normal ml-1">— which sessions trigger this webhook</span>
            </label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
              {/* All sessions toggle */}
              <label className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${allSessions ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <input type="radio" checked={allSessions} onChange={handleAllSessions} className="hidden" />
                {allSessions ? <Check size={12} /> : <span className="w-3 h-3 border border-gray-300 dark:border-gray-600 rounded-full" />}
                <span className="text-xs font-medium">All sessions</span>
              </label>
              <hr className="border-gray-100 dark:border-gray-800" />
              {loadingSessions ? (
                <div className="flex items-center gap-2 px-2 py-2 text-xs text-gray-400"><Loader2 size={12} className="animate-spin" />Loading...</div>
              ) : sessions.length === 0 ? (
                <div className="px-2 py-2 text-xs text-gray-400">No sessions yet</div>
              ) : (
                sessions.map(s => (
                  <label key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${!allSessions && selectedSessions.includes(s.id) ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <input type="checkbox" checked={!allSessions && selectedSessions.includes(s.id)} onChange={() => toggleSession(s.id)} className="hidden" />
                    {!allSessions && selectedSessions.includes(s.id) ? <Check size={12} /> : <span className="w-3 h-3 border border-gray-300 dark:border-gray-600 rounded-sm" />}
                    <span className="text-xs">{s.name || s.id}</span>
                    {s.phone && <span className="text-[10px] text-gray-400">{s.phone}</span>}
                    <span className={`ml-auto w-1.5 h-1.5 rounded-full ${s.status === 'ready' ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </label>
                ))
              )}
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            <p className="text-[10px] text-gray-400 mt-1">Pick specific sessions or "All sessions". Events only fire from selected sessions.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Events</label>
            <div className="grid grid-cols-2 gap-1.5">
              {events.map(ev => (
                <button key={ev.v} type="button" onClick={() => toggleEvent(ev.v)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selected.includes(ev.v) ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {selected.includes(ev.v) ? <Check size={12} /> : <span className="w-3 h-3 border border-gray-300 dark:border-gray-600 rounded-sm" />}
                  {ev.l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Secret (optional)</label>
              <input type="text" value={secret} onChange={e => setSecret(e.target.value)} placeholder="HMAC key"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${active ? 'translate-x-4' : ''}`} />
                </div>
                <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="hidden" />
                <span className="text-xs font-medium">{active ? 'Active' : 'Paused'}</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
            <button type="submit"
              className="flex-1 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
