import { Trash2, Play, Edit, ExternalLink } from 'lucide-react';
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
      <div className="text-center py-8 text-gray-500">
        No webhooks configured yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">URL</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Events</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Stats</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {webhooks.map(webhook => (
            <tr key={webhook.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono truncate max-w-xs">{webhook.url}</span>
                  <a href={webhook.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600">
                    <ExternalLink size={14} />
                  </a>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex flex-wrap gap-1">
                  {webhook.events.slice(0, 3).map(event => (
                    <span key={event} className="px-2 py-0.5 text-xs bg-gray-100 rounded">
                      {event}
                    </span>
                  ))}
                  {webhook.events.length > 3 && (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 rounded">
                      +{webhook.events.length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${
                  webhook.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${webhook.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {webhook.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="py-3 px-4 text-sm text-gray-600">
                {webhook.stats ? (
                  <span>{webhook.stats.totalSent} sent / {webhook.stats.totalFailed} failed</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="py-3 px-4">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onTest(webhook.id)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Test webhook"
                  >
                    <Play size={16} />
                  </button>
                  <button
                    onClick={() => onEdit(webhook)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(webhook.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 size={16} />
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
