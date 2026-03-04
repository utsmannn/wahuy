import { Trash2, Play, Edit, ExternalLink, Globe } from 'lucide-react';
import type { Webhook } from '../types';

interface WebhookListProps {
  webhooks: Webhook[];
  onEdit: (webhook: Webhook) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
}

export function WebhookList({ webhooks, onEdit, onDelete, onTest }: WebhookListProps) {
  if (webhooks.length === 0) {
    return (
      <div className="text-center py-20 bg-neutral-50 dark:bg-neutral-800/20 rounded-2xl border border-neutral-100 dark:border-neutral-800 border-dashed animate-in fade-in duration-500">
        <ExternalLink size={32} className="mx-auto text-neutral-200 dark:text-neutral-700 mb-4" />
        <p className="text-sm font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">No active endpoints</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto font-sans transition-colors duration-300">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
            <th className="text-left py-5 px-6 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Endpoint</th>
            <th className="text-left py-5 px-6 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Events</th>
            <th className="text-left py-5 px-6 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Status</th>
            <th className="text-left py-5 px-6 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Delivery</th>
            <th className="text-right py-5 px-6 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
          {webhooks.map(webhook => (
            <tr key={webhook.id} className="group hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
              <td className="py-5 px-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center border border-neutral-200 dark:border-neutral-700 shadow-sm">
                    <Globe size={14} className="text-neutral-900 dark:text-neutral-100" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-xs">{webhook.url}</span>
                    <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 truncate">{webhook.id}</span>
                  </div>
                </div>
              </td>
              <td className="py-5 px-6">
                <div className="flex flex-wrap gap-1.5">
                  {webhook.events.slice(0, 2).map(event => (
                    <span key={event} className="px-2 py-0.5 text-[9px] font-black bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-md uppercase tracking-wider shadow-sm">
                      {event === '*' ? 'ALL_EVENTS' : event.replace('.', '_').toUpperCase()}
                    </span>
                  ))}
                  {webhook.events.length > 2 && (
                    <span className="px-2 py-0.5 text-[9px] font-black bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-md uppercase tracking-wider shadow-sm">
                      +{webhook.events.length - 2}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-5 px-6">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black tracking-widest uppercase transition-colors shadow-sm ${
                  webhook.active ? 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900 text-green-700 dark:text-green-400' : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${webhook.active ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                  {webhook.active ? 'Active' : 'Paused'}
                </div>
              </td>
              <td className="py-5 px-6">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{webhook.stats?.totalSent || 0}</span>
                    <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tighter">Delivered</span>
                  </div>
                  <div className="h-6 w-px bg-neutral-100 dark:bg-neutral-800" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">{webhook.stats?.totalFailed || 0}</span>
                    <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tighter">Failures</span>
                  </div>
                </div>
              </td>
              <td className="py-5 px-6">
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => onTest(webhook.id)}
                    className="w-9 h-9 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-800 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 rounded-xl transition-all shadow-sm hover:shadow-md"
                    title="Send Test Payload"
                  >
                    <Play size={14} fill="currentColor" />
                  </button>
                  <button
                    onClick={() => onEdit(webhook)}
                    className="w-9 h-9 flex items-center justify-center text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-800 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 rounded-xl transition-all shadow-sm hover:shadow-md"
                    title="Configure"
                  >
                    <Edit size={14} />
                  </button>
                  <div className="w-px h-6 bg-neutral-100 dark:bg-neutral-800 mx-1 self-center" />
                  <button
                    onClick={() => onDelete(webhook.id)}
                    className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-100 dark:hover:border-red-900/50 rounded-xl transition-all shadow-sm hover:shadow-md"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
