import { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { Webhook } from '../types';

interface WebhookFormProps {
  webhook?: Webhook;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Webhook>) => void;
}

const eventOptions = [
  { value: '*', label: 'All Events' },
  { value: 'message.received', label: 'Message Received' },
  { value: 'message.sent', label: 'Message Sent' },
  { value: 'message.ack', label: 'Message ACK' },
  { value: 'session.qr', label: 'Session QR' },
  { value: 'session.authenticated', label: 'Session Authenticated' },
  { value: 'session.ready', label: 'Session Ready' },
  { value: 'session.disconnected', label: 'Session Disconnected' },
];

export function WebhookForm({ webhook, isOpen, onClose, onSave }: WebhookFormProps) {
  const [url, setUrl] = useState(webhook?.url || '');
  const [events, setEvents] = useState<string[]>(webhook?.events || ['*']);
  const [secret, setSecret] = useState(webhook?.secret || '');
  const [active, setActive] = useState(webhook?.active ?? true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ url, events, secret: secret || undefined, active });
    onClose();
  };

  const toggleEvent = (event: string) => {
    if (event === '*') {
      setEvents(['*']);
    } else {
      const newEvents = events.filter(e => e !== '*');
      if (newEvents.includes(event)) {
        setEvents(newEvents.filter(e => e !== event));
      } else {
        setEvents([...newEvents, event]);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/40 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-6 font-sans">
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 p-10 w-full max-w-xl shadow-2xl dark:shadow-none animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">{webhook ? 'Modify' : 'New'} Webhook</h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest mt-1">Event Forwarding</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">
                Endpoint URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/webhooks/whatsapp"
                required
                className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:border-neutral-900 dark:focus:border-white focus:bg-white dark:focus:bg-neutral-800 transition-all text-sm font-medium text-neutral-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">
                Event Subscription
              </label>
              <div className="grid grid-cols-2 gap-2">
                {eventOptions.map(option => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      events.includes(option.value)
                        ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md'
                        : 'border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={events.includes(option.value)}
                      onChange={() => toggleEvent(option.value)}
                      className="hidden"
                    />
                    {events.includes(option.value) ? (
                      <Check size={14} className="text-white dark:text-neutral-900" />
                    ) : (
                      <div className="w-3.5 h-3.5 border border-neutral-200 dark:border-neutral-700 rounded-sm bg-white dark:bg-neutral-900" />
                    )}
                    <span className="text-[11px] font-black uppercase tracking-wider">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">
                  Signature Secret
                </label>
                <input
                  type="text"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="HMAC SHA-256 Key"
                  className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:border-neutral-900 dark:focus:border-white focus:bg-white dark:focus:bg-neutral-800 transition-all text-sm font-mono placeholder-neutral-200 dark:placeholder-neutral-700 text-neutral-900 dark:text-white"
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-2xl cursor-pointer group">
                  <div className={`w-10 h-6 rounded-full p-1 transition-colors ${active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'bg-neutral-200 dark:bg-neutral-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${active ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="hidden"
                  />
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-widest">Active State</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-bold text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl font-bold text-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all uppercase tracking-widest shadow-md"
            >
              {webhook ? 'Update Hook' : 'Confirm Hook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
