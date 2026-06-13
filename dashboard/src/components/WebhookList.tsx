import { Trash2, Play, Edit, Globe } from 'lucide-react';
import type { Webhook } from '../types';

interface WebhookListProps { webhooks: Webhook[]; onEdit: (w: Webhook) => void; onDelete: (id: string) => void; onTest: (id: string) => void; }

export function WebhookList({ webhooks, onEdit, onDelete, onTest }: WebhookListProps) {
  if (webhooks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-16 text-center">
        <Globe size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-gray-400 text-sm">No webhooks configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {webhooks.map(w => (
        <div key={w.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full ${w.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm font-medium truncate">{w.url}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-mono">{w.id}</span>
                <span className={`text-[10px] font-medium ${w.active ? 'text-green-600' : 'text-gray-400'}`}>{w.active ? 'Active' : 'Paused'}</span>
              </div>
              <div className="flex gap-1 mt-1.5">
                {w.events.slice(0, 3).map(e => (
                  <span key={e} className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-medium text-gray-600 dark:text-gray-400">{e}</span>
                ))}
                {w.events.length > 3 && <span className="text-[10px] text-gray-400">+{w.events.length - 3} more</span>}
              </div>
              {w.stats && (
                <div className="text-[10px] text-gray-400 mt-1">
                  Delivered: {w.stats.totalSent || 0} · Failed: {w.stats.totalFailed || 0}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => onTest(w.id)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="Test"><Play size={14} /></button>
              <button onClick={() => onEdit(w)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="Edit"><Edit size={14} /></button>
              <button onClick={() => onDelete(w.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950" title="Delete"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
