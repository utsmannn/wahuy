import { useState, useEffect } from 'react';
import { X, RefreshCw, Trash2, Filter } from 'lucide-react';
import { api } from '../lib/api';
import type { WebhookLog } from '../types';

interface WebhookMonitorProps { isOpen: boolean; onClose: () => void; }

export function WebhookMonitor({ isOpen, onClose }: WebhookMonitorProps) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [filter, setFilter] = useState('');
  const [srcFilter, setSrcFilter] = useState<'all' | 'meta' | 'internal'>('all');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<WebhookLog | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      const i = setInterval(loadLogs, 5000);
      return () => clearInterval(i);
    }
  }, [isOpen, srcFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try { const r = await api.getWebhookLogs({ source: srcFilter === 'all' ? undefined : srcFilter, limit: 200 }); setLogs(r.data.logs || []); }
    catch {} finally { setLoading(false); }
  };

  const clearLogs = async () => {
    if (!confirm('Clear all logs?')) return;
    try { await api.clearWebhookLogs(); setLogs([]); setSelected(null); } catch {}
  };

  if (!isOpen) return null;

  const filtered = logs.filter(l => l.event.toLowerCase().includes(filter.toLowerCase()) || (l.error && l.error.toLowerCase().includes(filter.toLowerCase())));

  const fmtTime = (t: string) => { try { return new Date(t).toLocaleString(); } catch { return t; } };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-full max-w-5xl h-[85vh] flex flex-col shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold">Traffic Monitor <span className="text-xs text-gray-400 font-normal ml-1">{logs.length} events</span></h3>
          <div className="flex items-center gap-1">
            <button onClick={clearLogs}
              className="flex items-center gap-1 px-2 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg text-xs font-medium"><Trash2 size={13} /> Clear</button>
            <button onClick={loadLogs}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-gray-50 dark:border-gray-800 flex gap-2">
          <div className="relative flex-1">
            <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
            <input type="text" placeholder="Filter events..." value={filter} onChange={e => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-gray-400" />
          </div>
          {(['all', 'meta', 'internal'] as const).map(s => (
            <button key={s} onClick={() => setSrcFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${srcFilter === s ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{s}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No logs</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-4 font-medium text-gray-400">Time</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-400">Source</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-400">Event</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filtered.map(l => (
                    <tr key={l.id} onClick={() => setSelected(l)}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selected?.id === l.id ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}>
                      <td className="py-2 px-4 text-gray-500">{fmtTime(l.timestamp)}</td>
                      <td className="py-2 px-4"><span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${l.source === 'meta' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700'}`}>{l.source}</span></td>
                      <td className="py-2 px-4 font-mono text-gray-600 dark:text-gray-400">{l.event}</td>
                      <td className="py-2 px-4">{l.processed ? <span className="text-green-600 font-medium">OK</span> : <span className="text-red-500 font-medium">Failed</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-80 border-l border-gray-100 dark:border-gray-800 p-4 overflow-auto flex-shrink-0">
              <div className="text-xs font-semibold mb-3">Event Detail</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-400">Event</span><span className="font-mono">{selected.event}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Source</span><span>{selected.source}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Status</span><span className={selected.processed ? 'text-green-600' : 'text-red-500'}>{selected.processed ? 'OK' : 'Failed'}</span></div>
                {selected.error && (
                  <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900 text-red-600 text-[11px]">{selected.error}</div>
                )}
              </div>
              <div className="mt-3">
                <div className="text-xs font-semibold mb-1 text-gray-400">Payload</div>
                <pre className="text-[11px] font-mono bg-gray-50 dark:bg-gray-800 rounded-lg p-2 overflow-auto max-h-96">{JSON.stringify(selected.payload, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
