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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Webhook Logs</h3>
            <p className="text-sm text-gray-500">
              {stats.total} total events • Real-time monitoring from Meta
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
            >
              <Trash2 size={16} />
              Clear
            </button>
            <button
              onClick={() => { loadLogs(); loadStats(); }}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by event or error..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'all' | 'meta' | 'internal')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Sources</option>
            <option value="meta">Meta Only</option>
            <option value="internal">Internal Only</option>
          </select>
        </div>

        {/* Stats Bar */}
        {stats.byEvent.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-4 text-sm">
            <span className="text-gray-500">Event Types:</span>
            {stats.byEvent.slice(0, 5).map(({ event, count }) => (
              <span key={event} className="inline-flex items-center gap-1">
                <span className="font-mono text-xs bg-gray-200 px-2 py-0.5 rounded">{event}</span>
                <span className="text-gray-600">{count}</span>
              </span>
            ))}
            {stats.byEvent.length > 5 && (
              <span className="text-gray-400">+{stats.byEvent.length - 5} more</span>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Log List */}
          <div className="w-2/3 overflow-auto border-r">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Terminal size={48} className="mx-auto text-gray-300 mb-4" />
                <p>No webhook logs yet</p>
                <p className="text-sm mt-1">Webhook events from Meta will appear here</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-600">Time</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-600">Source</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-600">Event</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`border-b hover:bg-gray-50 cursor-pointer ${
                        selectedLog?.id === log.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-sm">
                        <div className="text-gray-800">{formatTime(log.timestamp)}</div>
                        <div className="text-xs text-gray-400">{formatDate(log.timestamp)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          log.source === 'meta'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {log.source}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          {log.event}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {log.processed ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle size={14} /> OK
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-sm">
                            <XCircle size={14} /> Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail Panel */}
          <div className="w-1/3 bg-gray-50 p-4 overflow-auto">
            {selectedLog ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Event</label>
                  <p className="text-sm font-mono">{selectedLog.event}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Source</label>
                  <p className="text-sm capitalize">{selectedLog.source}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Timestamp</label>
                  <p className="text-sm">{new Date(selectedLog.timestamp).toLocaleString('id-ID')}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <p className={`text-sm ${selectedLog.processed ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedLog.processed ? 'Processed' : 'Failed'}
                  </p>
                </div>
                {selectedLog.error && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Error</label>
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{selectedLog.error}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-500">Payload</label>
                  <pre className="text-xs bg-gray-800 text-gray-100 p-3 rounded-lg overflow-auto mt-1 max-h-80">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 mt-8">
                <Terminal size={32} className="mx-auto mb-2 opacity-50" />
                <p>Select a log entry to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
