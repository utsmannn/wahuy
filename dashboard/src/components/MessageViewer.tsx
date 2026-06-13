import { useState } from 'react';
import { Trash2, Download, Image, FileText, MessageSquare } from 'lucide-react';
import type { Message, Session } from '../types';

interface MessageViewerProps { messages: Message[]; onClear: () => void; sessions: Session[]; }

export function MessageViewer({ messages, onClear, sessions }: MessageViewerProps) {
  const [filter, setFilter] = useState('');
  const [selSess, setSelSess] = useState('');

  const filtered = messages.filter(m => {
    const q = filter.toLowerCase();
    const sender = m.contacts?.sender;
    const match =
      m.body?.toLowerCase().includes(q) ||
      m.from?.toLowerCase().includes(q) ||
      sender?.number?.includes(filter) ||
      sender?.pushname?.toLowerCase().includes(q) ||
      sender?.name?.toLowerCase().includes(q);
    return match && (!selSess || m.sessionId === selSess);
  });

  const fmtPhone = (msg: Message) => {
    const contact = msg.fromMe ? msg.contacts?.receiver : msg.contacts?.sender;
    return contact?.number || msg.from?.replace('@c.us', '').replace('@s.whatsapp.net', '').replace('@g.us', '') || '?';
  };
  const fmtTime = (t: string) => { try { return new Date(t).toLocaleString(); } catch { return t; } };

  const downloadMedia = (msg: Message) => {
    if (!msg.media) return;
    const a = document.createElement('a');
    a.href = `data:${msg.media.mimetype};base64,${msg.media.data}`;
    a.download = msg.media.filename || 'download';
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3">
        <input type="text" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)}
          className="flex-1 min-w-[150px] px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
        <select value={selSess} onChange={e => setSelSess(e.target.value)}
          className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none">
          <option value="">All sessions</option>
          {sessions.map(s => (<option key={s.id} value={s.id}>{s.name || s.id}</option>))}
        </select>
        <span className="text-xs text-gray-400">{filtered.length} msgs</span>
        <button onClick={onClear}
          className="flex items-center gap-1 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg text-xs font-medium transition-colors">
          <Trash2 size={13} /> Clear
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-16 text-center">
          <MessageSquare size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-gray-400 text-sm">No messages</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((msg, i) => (
            <div key={`${msg.id}-${i}`} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-semibold ${msg.fromMe ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                      {msg.fromMe ? `→ Sent to ${fmtPhone(msg)}` : `← ${fmtPhone(msg)}`}
                    </span>
                    <span className="text-[10px] text-gray-400">{fmtTime(msg.timestamp)}</span>
                    {msg.sessionId && (
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-medium">{sessions.find(s => s.id === msg.sessionId)?.name || msg.sessionId}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{msg.body || (msg.hasMedia && <span className="text-gray-400 italic">Media</span>)}</p>
                  {msg.hasMedia && msg.media && (
                    <div className="mt-2 flex items-center gap-2">
                      {msg.media.mimetype?.startsWith('image/') ? (
                        <div className="relative group">
                          <img src={`data:${msg.media.mimetype};base64,${msg.media.data}`} alt="" className="max-h-40 rounded-lg border border-gray-200 dark:border-gray-700" />
                          <button onClick={() => downloadMedia(msg)}
                            className="absolute bottom-2 right-2 px-2 py-1 bg-gray-900/80 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Download size={11} /> Save
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => downloadMedia(msg)}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <FileText size={14} /> {msg.media.filename || 'Download'} <Download size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {msg.hasMedia && !msg.media && (
                  <div className="text-gray-300 dark:text-gray-600"><Image size={14} /></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
