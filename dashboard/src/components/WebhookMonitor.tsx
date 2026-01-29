import { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle, XCircle, Clock, Terminal } from 'lucide-react';

interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  responseTime?: number;
  error?: string;
  timestamp: string;
  payload?: object;
}

interface WebhookMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebhookMonitor({ isOpen, onClose }: WebhookMonitorProps) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      const interval = setInterval(loadLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      // This would need a new API endpoint to get webhook delivery logs
      // For now, we'll use mock data
      const response = await fetch('/api/webhook-logs', {
        headers: { 'X-API-Key': localStorage.getItem('apiKey') || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load webhook logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log =>
    log.event.toLowerCase().includes(filter.toLowerCase()) ||
    log.webhookId.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Webhook Monitor</h3>
            <p className="text-sm text-gray-500">View recent webhook deliveries</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadLogs}
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

        {/* Filter */}
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Filter by event or webhook ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Log List */}
          <div className="w-2/3 overflow-auto border-r">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Terminal size={48} className="mx-auto text-gray-300 mb-4" />
                <p>No webhook deliveries yet</p>
                <p className="text-sm mt-1">Webhook logs will appear here when events are triggered</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-600">Time</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-600">Event</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-600">Status</th>
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-600">Response</th>
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
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          {log.event}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {log.status === 'success' && (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle size={14} /> Success
                          </span>
                        )}
                        {log.status === 'failed' && (
                          <span className="flex items-center gap-1 text-red-600 text-sm">
                            <XCircle size={14} /> Failed
                          </span>
                        )}
                        {log.status === 'pending' && (
                          <span className="flex items-center gap-1 text-yellow-600 text-sm">
                            <Clock size={14} /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {log.statusCode ? (
                          <span className={log.statusCode >= 200 && log.statusCode < 300 ? 'text-green-600' : 'text-red-600'}>
                            {log.statusCode}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                        {log.responseTime && (
                          <span className="text-gray-400 ml-2">({log.responseTime}ms)</span>
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
                  <label className="text-xs font-medium text-gray-500">Timestamp</label>
                  <p className="text-sm">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <p className="text-sm capitalize">{selectedLog.status}</p>
                </div>
                {selectedLog.statusCode && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Status Code</label>
                    <p className="text-sm">{selectedLog.statusCode}</p>
                  </div>
                )}
                {selectedLog.responseTime && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Response Time</label>
                    <p className="text-sm">{selectedLog.responseTime}ms</p>
                  </div>
                )}
                {selectedLog.error && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Error</label>
                    <p className="text-sm text-red-600">{selectedLog.error}</p>
                  </div>
                )}
                {selectedLog.payload && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Payload</label>
                    <pre className="text-xs bg-gray-800 text-gray-100 p-3 rounded-lg overflow-auto mt-1">
                      {JSON.stringify(selectedLog.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 mt-8">
                <p>Select a log entry to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
