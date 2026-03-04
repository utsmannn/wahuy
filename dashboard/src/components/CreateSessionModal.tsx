import { useState } from 'react';
import { X } from 'lucide-react';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (id: string, name: string) => void;
}

export function CreateSessionModal({ isOpen, onClose, onCreate }: CreateSessionModalProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(id || `session-${Date.now()}`, name);
    setId('');
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/40 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-6 font-sans">
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 p-10 w-full max-w-md shadow-2xl dark:shadow-none animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">New Session</h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest mt-1">Configure Instance</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">
                Unique Identifier
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="Leave empty for auto-gen"
                className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:border-neutral-900 dark:focus:border-white focus:bg-white dark:focus:bg-neutral-800 transition-all text-sm font-medium placeholder-neutral-300 dark:placeholder-neutral-600 text-neutral-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">
                Alias / Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marketing Dept"
                className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:border-neutral-900 dark:focus:border-white focus:bg-white dark:focus:bg-neutral-800 transition-all text-sm font-medium placeholder-neutral-300 dark:placeholder-neutral-600 text-neutral-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-bold text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl font-bold text-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all uppercase tracking-widest shadow-md"
            >
              Initialize
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
