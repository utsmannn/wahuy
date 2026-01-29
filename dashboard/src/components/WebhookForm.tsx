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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{webhook ? 'Edit Webhook' : 'Add Webhook'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Webhook URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Events
            </label>
            <div className="grid grid-cols-2 gap-2">
              {eventOptions.map(option => (
                <label
                  key={option.value}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                    events.includes(option.value)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={events.includes(option.value)}
                    onChange={() => toggleEvent(option.value)}
                    className="hidden"
                  />
                  {events.includes(option.value) ? (
                    <Check size={16} className="text-blue-500" />
                  ) : (
                    <div className="w-4 h-4 border border-gray-300 rounded" />
                  )}
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secret (optional)
            </label>
            <input
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="For HMAC signature verification"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 text-blue-500 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              {webhook ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
