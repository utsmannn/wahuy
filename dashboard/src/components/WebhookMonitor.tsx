import { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle, XCircle, Terminal, Trash2, Filter } from 'lucide-react';
import { api } from '../lib/api';
import type { WebhookLog } from '../types';

interface WebhookMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebhookMonitor({ isOpen, onClose }: WebhookMonitorProps) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [filter, setFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'meta' | 'internal'>('all');
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [stats, setStats] = useState({ total: 0, byEvent: [] as Array<{ event: string; count: number }> });

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      loadStats();
      const interval = setInterval(loadLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, sourceFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await api.getWebhookLogs({
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        limit: 200,
      });
      setLogs(response.data.logs || []);
    } catch (err) {
      console.error('Failed to load webhook logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.getWebhookLogStats();
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load webhook stats:', err);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Clear all webhook logs?')) return;
    try {
      await api.clearWebhookLogs();
      setLogs([]);
      setStats({ total: 0, byEvent: [] });
      setSelectedLog(null);
    } catch (err) {
      console.error('Failed to clear logs:', err);
      alert('Failed to clear logs');
    }
  };

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log =>
    log.event.toLowerCase().includes(filter.toLowerCase()) ||
    (log.error && log.error.toLowerCase().includes(filter.toLowerCase()))
  );

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/40 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-6 font-sans">
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden shadow-2xl dark:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-10 transition-colors">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">Traffic Monitor</h3>
            <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mt-1.5">
              {stats.total} Events Tracked • Meta Integration Live
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-2 px-5 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-100 dark:hover:border-red-900/50 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <Trash2 size={14} />
              Purge Logs
            </button>
            <div className="h-8 w-px bg-neutral-100 dark:bg-neutral-800 mx-2" />
            <button
              onClick={() => { loadLogs(); loadStats(); }}
              className="w-10 h-10 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-all shadow-sm"
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-all shadow-sm">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Filters & Stats Row */}
        <div className="px-8 py-5 border-b border-neutral-50 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-800/20 flex flex-wrap gap-6 items-center">
          <div className="flex-1 min-w-[300px]">
            <div className="relative group">
              <Filter size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300 dark:text-neutral-600 group-focus-within:text-neutral-900 dark:group-focus-within:text-white transition-colors" />
              <input
                type="text"
                placeholder="Filter by event key or error message..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-neutral-100 placeholder-neutral-300 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white transition-all shadow-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {(['all', 'meta', 'internal'] as const).map(src => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm ${
                  sourceFilter === src 
                    ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white text-white dark:text-neutral-900' 
                    : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 hover:border-neutral-900 dark:hover:border-white hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {src}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Log List Table */}
          <div className="flex-1 overflow-auto bg-white dark:bg-neutral-900">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-20 text-center animate-in fade-in duration-500">
                <Terminal size={40} className="text-neutral-100 dark:text-neutral-800 mb-6" />
                <p className="text-sm font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">No matching logs</p>
                <p className="text-[10px] text-neutral-300 dark:text-neutral-600 font-bold mt-2 uppercase">Listening for events...</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="bg-neutral-50/50 dark:bg-neutral-800/30 sticky top-0 z-10 border-b border-neutral-100 dark:border-neutral-800">
                  <tr>
                    <th className="text-left py-4 px-8 text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Timestamp</th>
                    <th className="text-left py-4 px-8 text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Source</th>
                    <th className="text-left py-4 px-8 text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Event Key</th>
                    <th className="text-left py-4 px-8 text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`group cursor-pointer transition-colors ${
                        selectedLog?.id === log.id ? 'bg-neutral-50 dark:bg-neutral-800/50' : 'hover:bg-neutral-50/30 dark:hover:bg-neutral-800/20'
                      }`}
                    >
                      <td className="py-4 px-8">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{formatTime(log.timestamp)}</span>
                          <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tighter mt-0.5">{formatDate(log.timestamp)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-8">
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-md border uppercase tracking-widest shadow-sm ${
                          log.source === 'meta'
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                            : 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-400'
                        }`}>
                          {log.source}
                        </span>
                      </td>
                      <td className="py-4 px-8">
                        <span className="text-xs font-mono font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md shadow-sm border border-neutral-200 dark:border-neutral-700">
                          {log.event}
                        </span>
                      </td>
                      <td className="py-4 px-8">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-[10px] font-black tracking-widest uppercase shadow-sm transition-colors ${
                          log.processed ? 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900 text-red-700 dark:text-red-400'
                        }`}>
                          {log.processed ? (
                            <><CheckCircle size={10} /> Processed</>
                          ) : (
                            <><XCircle size={10} /> Failure</>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Side Detail Panel */}
          <div className="w-[400px] bg-neutral-50 dark:bg-neutral-900/50 border-l border-neutral-100 dark:border-neutral-800 overflow-auto p-8 transition-colors">
            {selectedLog ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-neutral-900 dark:text-white uppercase tracking-[0.2em]">Event Inspection</h4>
                  <span className="text-[9px] font-mono text-neutral-400 dark:text-neutral-500">ID: {selectedLog.id.slice(0, 8)}</span>
                </div>

                <div className="space-y-6">
                  <div className="p-5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-sm">
                    <label className="block text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Core Parameters</label>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-neutral-500">Event Name</span>
                        <span className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100">{selectedLog.event}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-neutral-500">Origin</span>
                        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 capitalize">{selectedLog.source}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-neutral-500">Execution</span>
                        <span className={`text-xs font-bold ${selectedLog.processed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {selectedLog.processed ? 'SUCCESS' : 'FAILED'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedLog.error && (
                    <div className="p-5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-2xl shadow-sm">
                      <label className="block text-[9px] font-black text-red-400 dark:text-red-500 uppercase tracking-widest mb-2 px-1">Error Diagnostic</label>
                      <p className="text-xs font-bold text-red-700 dark:text-red-400 leading-relaxed">{selectedLog.error}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="block text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-1">Raw Payload JSON</label>
                    <div className="bg-neutral-900 dark:bg-black rounded-2xl p-5 border border-neutral-800 dark:border-neutral-800 overflow-hidden relative group shadow-lg">
                      <pre className="text-[11px] font-mono text-neutral-300 dark:text-neutral-400 overflow-auto max-h-[400px] leading-relaxed scrollbar-hide">
                        {JSON.stringify(selectedLog.payload, null, 2)}
                      </pre>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedLog.payload, null, 2));
                          alert('Payload copied');
                        }}
                        className="absolute top-4 right-4 p-2 bg-neutral-800 dark:bg-neutral-900 text-neutral-400 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-neutral-700 shadow-sm"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-neutral-300 dark:text-neutral-700 space-y-4 opacity-50 transition-opacity">
                <Terminal size={32} />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Select Event To Inspect</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
