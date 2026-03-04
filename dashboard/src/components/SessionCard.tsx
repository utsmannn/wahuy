import {
  WifiOff,
  QrCode,
  Phone,
  Trash2,
  Power,
  PowerOff,
  Send,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { Session } from '../types';

interface SessionCardProps {
  session: Session;
  qrCode?: string;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onLogout: () => void;
  onSendMessage?: () => void;
}

const statusConfig: Record<string, { color: string; bg: string; label: string; icon: typeof CheckCircle }> = {
  ready: {
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900/50',
    label: 'READY',
    icon: CheckCircle
  },
  connected: {
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900/50',
    label: 'READY',
    icon: CheckCircle
  },
  authenticated: {
    color: 'text-neutral-900 dark:text-neutral-100',
    bg: 'bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700',
    label: 'AUTH',
    icon: Loader2
  },
  connecting: {
    color: 'text-neutral-900 dark:text-neutral-100',
    bg: 'bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700',
    label: 'LINKING',
    icon: Loader2
  },
  scan_qr: {
    color: 'text-neutral-900 dark:text-neutral-100',
    bg: 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white',
    label: 'SCAN',
    icon: QrCode
  },
  starting: {
    color: 'text-neutral-900 dark:text-neutral-100',
    bg: 'bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700',
    label: 'BOOTING',
    icon: Loader2
  },
  created: {
    color: 'text-neutral-400 dark:text-neutral-500',
    bg: 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-100 dark:border-neutral-800',
    label: 'IDLE',
    icon: Smartphone
  },
  disconnected: {
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50',
    label: 'LOST',
    icon: WifiOff
  },
  stopped: {
    color: 'text-neutral-400 dark:text-neutral-500',
    bg: 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-100 dark:border-neutral-800',
    label: 'OFF',
    icon: PowerOff
  },
  failed: {
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50',
    label: 'FAIL',
    icon: AlertCircle
  },
};

export function SessionCard({ session, qrCode, onStart, onStop, onDelete, onLogout, onSendMessage }: SessionCardProps) {
  const showQR = session.status === 'scan_qr' && qrCode;
  const isActive = ['ready', 'connected', 'authenticated', 'connecting', 'scan_qr', 'starting'].includes(session.status);

  const status = statusConfig[session.status] || {
    color: 'text-neutral-400 dark:text-neutral-500',
    bg: 'bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700',
    label: session.status.toUpperCase(),
    icon: Smartphone
  };

  const StatusIcon = status.icon;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden transition-all duration-300 hover:border-neutral-400 dark:hover:border-neutral-600 shadow-sm hover:shadow-md group">
      {/* Header */}
      <div className="p-8">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors ${status.bg} ${status.color}`}>
              <Smartphone size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{session.name || session.id}</h3>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest mt-1">ID: {session.id}</p>
            </div>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-black text-[10px] tracking-widest transition-colors ${status.bg} ${status.color}`}>
            <StatusIcon size={12} className={session.status === 'starting' || session.status === 'connecting' ? 'animate-spin' : ''} />
            {status.label}
          </div>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Info Side */}
          <div className="space-y-4">
            {session.phone ? (
              <div className="p-5 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5">Linked Number</p>
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-neutral-900 dark:text-neutral-100" />
                  <span className="text-base font-bold text-neutral-900 dark:text-neutral-100">{session.phone}</span>
                </div>
                {session.pushName && (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium mt-1 ml-7">{session.pushName}</p>
                )}
              </div>
            ) : (
              <div className="p-5 bg-neutral-50/50 dark:bg-neutral-800/20 rounded-2xl border border-neutral-100 dark:border-neutral-800 border-dashed text-center">
                <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Awaiting Link</p>
              </div>
            )}
          </div>

          {/* QR Side */}
          <div className="flex justify-center md:justify-end">
            {showQR ? (
              <div className="p-3 bg-white rounded-2xl border border-neutral-200 dark:border-neutral-700 relative group/qr shadow-sm">
                <img src={qrCode} alt="QR Code" className="w-32 h-32 dark:invert dark:hue-rotate-180" />
                <div className="absolute inset-0 bg-white/10 dark:bg-black/10 backdrop-blur-[1px] opacity-0 group-hover/qr:opacity-100 transition-opacity flex items-center justify-center">
                  <QrCode size={24} className="text-neutral-900 dark:text-neutral-100" />
                </div>
              </div>
            ) : session.status === 'scan_qr' ? (
              <div className="w-32 h-32 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-800 border-dashed flex items-center justify-center">
                <Loader2 size={24} className="text-neutral-200 dark:text-neutral-700 animate-spin" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-8 py-5 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center gap-3">
        {!isActive && session.status !== 'starting' && (
          <button
            onClick={onStart}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all uppercase tracking-widest shadow-sm hover:shadow-md"
          >
            <Power size={14} /> Start Session
          </button>
        )}

        {isActive && (
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-neutral-900 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition-all uppercase tracking-widest shadow-sm"
          >
            <PowerOff size={14} /> Stop
          </button>
        )}

        {session.status === 'ready' && (
          <>
            <button
              onClick={onSendMessage}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all uppercase tracking-widest shadow-sm hover:shadow-md"
            >
              <Send size={14} /> Message
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-xl text-xs font-bold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all uppercase tracking-widest shadow-sm"
            >
              <WifiOff size={14} /> Log Out
            </button>
          </>
        )}

        <button
          onClick={onDelete}
          className="flex items-center justify-center w-10 h-10 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all ml-auto border border-transparent hover:border-red-100 dark:hover:border-red-900/50 shadow-sm hover:shadow-md"
          title="Delete Session"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
