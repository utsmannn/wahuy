import { useState } from 'react';
import { Trash2, Download, Image, FileText, MessageSquare } from 'lucide-react';
import type { Message, Session } from '../types';

interface MessageViewerProps {
  messages: Message[];
  onClear: () => void;
  sessions: Session[];
}

export function MessageViewer({ messages, onClear, sessions }: MessageViewerProps) {
  const [filter, setFilter] = useState('');
  const [selectedSession, setSelectedSession] = useState('');

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = msg.body?.toLowerCase().includes(filter.toLowerCase()) ||
                         msg.from?.includes(filter);
    const matchesSession = !selectedSession || msg.sessionId === selectedSession;
    return matchesSearch && matchesSession;
  });

  const formatPhone = (jid: string) => {
    return jid?.replace('@c.us', '').replace('@g.us', '') || 'Unknown';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const downloadMedia = (msg: Message) => {
    if (!msg.media) return;

    const link = document.createElement('a');
    link.href = `data:${msg.media.mimetype};base64,${msg.media.data}`;
    link.download = msg.media.filename || `download.${msg.media.mimetype.split('/')[1]}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search messages..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
          />
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Sessions</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.name || s.id}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{filteredMessages.length} messages</span>
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
          >
            <Trash2 size={16} />
            Clear
          </button>
        </div>
      </div>

      {/* Messages List */}
      {filteredMessages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
          <h4 className="text-lg font-medium text-gray-600 mb-2">No Messages</h4>
          <p className="text-gray-500">Messages will appear here when received</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMessages.map((msg, idx) => (
            <div
              key={`${msg.id}-${idx}`}
              className={`bg-white rounded-lg border p-4 ${
                msg.fromMe ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-medium ${
                      msg.fromMe ? 'text-indigo-700' : 'text-gray-700'
                    }`}>
                      {msg.fromMe ? 'You' : formatPhone(msg.from)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTime(msg.timestamp)}
                    </span>
                    {msg.sessionId && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {sessions.find(s => s.id === msg.sessionId)?.name || msg.sessionId}
                      </span>
                    )}
                  </div>

                  <div className="text-gray-800">
                    {msg.body || (msg.hasMedia && (
                      <span className="text-gray-500 italic">Media message</span>
                    ))}
                  </div>

                  {msg.hasMedia && msg.media && (
                    <div className="mt-3 flex items-center gap-3">
                      {msg.media.mimetype?.startsWith('image/') ? (
                        <div className="relative group">
                          <img
                            src={`data:${msg.media.mimetype};base64,${msg.media.data}`}
                            alt="Media"
                            className="max-w-xs max-h-48 rounded-lg object-cover"
                          />
                          <button
                            onClick={() => downloadMedia(msg)}
                            className="absolute bottom-2 right-2 p-2 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-3">
                          <FileText size={20} className="text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {msg.media.filename || 'Document'}
                          </span>
                          <button
                            onClick={() => downloadMedia(msg)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {msg.hasMedia && (
                    <span className="p-1 text-gray-400">
                      {msg.media?.mimetype?.startsWith('image/') ? (
                        <Image size={16} />
                      ) : (
                        <FileText size={16} />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
