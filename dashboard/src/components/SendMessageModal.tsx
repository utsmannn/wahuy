import { useState } from 'react';
import { X, Send, Image, FileText, MapPin, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';
import type { Session } from '../types';

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessions: Session[];
}

type MessageType = 'text' | 'image' | 'document' | 'location';

export function SendMessageModal({ isOpen, onClose, sessionId, sessions }: SendMessageModalProps) {
  const [messageType, setMessageType] = useState<MessageType>('text');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [base64Data, setBase64Data] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [filename, setFilename] = useState('');
  const [caption, setCaption] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSession, setSelectedSession] = useState(sessionId);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setBase64Data(base64);
      setMimeType(file.type);
      setFilename(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let response;

      switch (messageType) {
        case 'text':
          response = await api.sendMessage(selectedSession, to, text);
          break;
        case 'image':
          response = await api.sendImage(selectedSession, to, base64Data, mimeType, caption, filename);
          break;
        case 'document':
          response = await api.sendDocument(selectedSession, to, base64Data, mimeType, filename, caption);
          break;
        case 'location':
          response = await api.sendLocation(selectedSession, to, parseFloat(latitude), parseFloat(longitude), description);
          break;
      }

      if (response?.success) {
        alert('Message sent successfully!');
        onClose();
        // Reset form
        setTo('');
        setText('');
        setBase64Data('');
        setMimeType('');
        setFilename('');
        setCaption('');
        setLatitude('');
        setLongitude('');
        setDescription('');
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const messageTypes = [
    { id: 'text' as MessageType, label: 'Text', icon: MessageSquare },
    { id: 'image' as MessageType, label: 'Image', icon: Image },
    { id: 'document' as MessageType, label: 'Document', icon: FileText },
    { id: 'location' as MessageType, label: 'Location', icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Send Message</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Session Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            >
              {sessions.filter(s => s.status === 'ready').map(s => (
                <option key={s.id} value={s.id}>
                  {s.name || s.id} {s.phone && `(${s.phone})`}
                </option>
              ))}
            </select>
          </div>

          {/* Message Type Tabs */}
          <div className="flex gap-2">
            {messageTypes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMessageType(id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  messageType === id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To (Phone Number)</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="6281234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>

          {/* Dynamic Fields based on type */}
          {messageType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          )}

          {(messageType === 'image' || messageType === 'document') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                <input
                  type="file"
                  accept={messageType === 'image' ? 'image/*' : '*/*'}
                  onChange={(e) => handleFileChange(e)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                {filename && <span className="text-sm text-gray-500">{filename}</span>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caption (optional)</label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </>
          )}

          {messageType === 'location' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="-6.2088"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="106.8456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Monas, Jakarta"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send size={18} />
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
