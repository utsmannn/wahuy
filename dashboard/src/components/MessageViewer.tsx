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
    <div className="space-y-6 font-sans transition-colors duration-300">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex flex-1 gap-4">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search by body or sender..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-4 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:border-neutral-900 dark:focus:border-white transition-all text-neutral-900 dark:text-neutral-100"
            />
          </div>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-600 dark:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white transition-all cursor-pointer"
          >
            <option value="">All Accounts</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.name || s.id}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{filteredMessages.length} Messages Found</span>
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-100 dark:hover:border-red-900 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
          >
            <Trash2 size={14} />
            Purge
          </button>
        </div>
      </div>

      {/* Messages List */}
      {filteredMessages.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-20 text-center border border-neutral-200 dark:border-neutral-800 shadow-sm animate-in fade-in duration-500">
          <div className="w-16 h-16 bg-neutral-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-neutral-100 dark:border-neutral-700">
            <MessageSquare size={24} className="text-neutral-200 dark:text-neutral-700" />
          </div>
          <h4 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Inbox Empty</h4>
          <p className="text-neutral-400 dark:text-neutral-500 font-medium">Real-time messages will populate this feed automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((msg, idx) => (
            <div
              key={`${msg.id}-${idx}`}
              className={`bg-white dark:bg-neutral-900 rounded-2xl border p-5 transition-all hover:border-neutral-400 dark:hover:border-neutral-600 shadow-sm hover:shadow-md ${
                msg.fromMe ? 'border-neutral-200 dark:border-neutral-700' : 'border-neutral-100 dark:border-neutral-800'
              }`}
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs font-black uppercase tracking-widest ${
                      msg.fromMe ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'
                    }`}>
                      {msg.fromMe ? 'SYSTEM OUT' : formatPhone(msg.from)}
                    </span>
                    <div className="h-1 w-1 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
                    <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tighter">
                      {formatTime(msg.timestamp)}
                    </span>
                    {msg.sessionId && (
                      <span className="text-[9px] bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-black px-2 py-0.5 rounded-md uppercase tracking-widest ml-auto shadow-sm">
                        {sessions.find(s => s.id === msg.sessionId)?.name || msg.sessionId}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 leading-relaxed break-words">
                    {msg.body || (msg.hasMedia && (
                      <span className="text-neutral-400 dark:text-neutral-500 italic">Encrypted media content</span>
                    ))}
                  </div>

                  {msg.hasMedia && msg.media && (
                    <div className="mt-4 flex items-center gap-4">
                      {msg.media.mimetype?.startsWith('image/') ? (
                        <div className="relative group rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 max-w-sm shadow-sm transition-all hover:shadow-md">
                          <img
                            src={`data:${msg.media.mimetype};base64,${msg.media.data}`}
                            alt="Media"
                            className="max-h-64 w-full object-cover transition-transform group-hover:scale-105 duration-500 dark:opacity-90"
                          />
                          <button
                            onClick={() => downloadMedia(msg)}
                            className="absolute inset-0 bg-neutral-900/40 dark:bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white backdrop-blur-sm"
                          >
                            <div className="flex items-center gap-2 bg-neutral-900 dark:bg-white dark:text-neutral-900 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg">
                              <Download size={14} /> Download
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-4 w-full max-w-md shadow-sm transition-all hover:shadow-md">
                          <div className="w-10 h-10 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl flex items-center justify-center shadow-sm">
                            <FileText size={18} className="text-neutral-400 dark:text-neutral-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                              {msg.media.filename || 'DOCUMENT_ASSET'}
                            </p>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider mt-0.5">
                              {msg.media.mimetype}
                            </p>
                          </div>
                          <button
                            onClick={() => downloadMedia(msg)}
                            className="w-10 h-10 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 dark:hover:bg-white hover:text-white dark:hover:text-neutral-900 rounded-xl transition-all flex items-center justify-center shadow-sm hover:shadow-md"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {msg.hasMedia && (
                    <div className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-100 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 shadow-sm">
                      {msg.media?.mimetype?.startsWith('image/') ? (
                        <Image size={14} />
                      ) : (
                        <FileText size={14} />
                      )}
                    </div>
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
