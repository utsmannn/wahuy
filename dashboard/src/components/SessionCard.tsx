import { useState, useEffect, useRef } from 'react';
import { Power, PowerOff, Trash2, Send, LogOut, QrCode } from 'lucide-react';
import { api } from '../lib/api';
import type { Session } from '../types';

interface SessionCardProps {
  session: Session;
  qrCode?: string;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onLogout: () => void;
  onSendMessage?: () => void;
  onShowQr?: (qr: string) => void;
}

const statusMeta: Record<string, string> = {
  ready: 'bg-green-500',
  connected: 'bg-green-500',
  scan_qr: 'bg-amber-500',
  connecting: 'bg-blue-400 animate-pulse',
  starting: 'bg-blue-400 animate-pulse',
  authenticated: 'bg-blue-400 animate-pulse',
  created: 'bg-gray-300 dark:bg-gray-600',
  disconnected: 'bg-red-500',
  stopped: 'bg-gray-300 dark:bg-gray-600',
  failed: 'bg-red-500',
};

export function SessionCard({ session, qrCode, onStart, onStop, onDelete, onLogout, onSendMessage, onShowQr }: SessionCardProps) {
  const isActive = ['ready', 'connected', 'authenticated', 'connecting', 'scan_qr', 'starting'].includes(session.status);
  const dot = statusMeta[session.status] || 'bg-gray-300';
  const [localQr, setLocalQr] = useState<string | null>(qrCode || null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Sync prop to local state
  useEffect(() => {
    if (qrCode) setLocalQr(qrCode);
  }, [qrCode]);

  // REST fallback: poll QR when session is in scan_qr but no QR from WebSocket yet
  useEffect(() => {
    if (session.status !== 'scan_qr' || localQr) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const fetchQr = async () => {
      try {
        const res = await api.getQR(session.id);
        if (res.data?.qr) setLocalQr(res.data.qr);
      } catch { /* QR not ready yet */ }
    };

    fetchQr(); // immediate attempt
    pollRef.current = setInterval(fetchQr, 2000); // poll every 2s

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session.status, session.id, localQr]);

  // Clear QR when session leaves scan_qr
  useEffect(() => {
    if (session.status !== 'scan_qr') setLocalQr(null);
  }, [session.status]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
            <span className="font-semibold text-sm truncate">{session.name || session.id}</span>
            <span className="text-[10px] text-gray-400 uppercase font-medium">{session.status}</span>
          </div>
          <div className="text-xs text-gray-400 space-y-0.5 ml-4">
            {session.phone ? (
              <span>{session.phone} {session.pushName && `(${session.pushName})`}</span>
            ) : (
              <span>ID: {session.id}</span>
            )}
          </div>
        </div>

        {/* QR CTA */}
        {session.status === 'scan_qr' && (
          <button
            onClick={() => localQr ? onShowQr?.(localQr) : null}
            disabled={!localQr}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              localQr
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-wait'
            }`}
          >
            {localQr ? (
              <><QrCode size={16} /> Show QR</>
            ) : (
              <><QrCode size={16} className="animate-pulse" /> Generating...</>
            )}
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {!isActive && session.status !== 'starting' && (
            <button onClick={onStart}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">
              <Power size={13} /> Start
            </button>
          )}
          {isActive && (
            <button onClick={onStop}
              className="flex items-center gap-1 px-3 py-1.5 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
              <PowerOff size={13} /> Stop
            </button>
          )}
          {session.status === 'ready' && (
            <>
              <button onClick={onSendMessage}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">
                <Send size={13} /> Message
              </button>
              <button onClick={onLogout}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <LogOut size={13} /> Logout
              </button>
            </>
          )}
          <button onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
