import { WifiOff, QrCode, Phone, Trash2, Power, PowerOff, Send } from 'lucide-react';
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

const statusColors: Record<string, string> = {
  ready: 'bg-green-500',
  connected: 'bg-green-500',
  authenticated: 'bg-yellow-500',
  connecting: 'bg-yellow-500',
  scan_qr: 'bg-blue-500',
  starting: 'bg-yellow-500',
  created: 'bg-gray-500',
  disconnected: 'bg-red-500',
  stopped: 'bg-gray-500',
  failed: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  ready: 'Connected',
  connected: 'Connected',
  authenticated: 'Authenticated',
  connecting: 'Connecting...',
  scan_qr: 'Scan QR',
  starting: 'Starting...',
  created: 'Created',
  disconnected: 'Disconnected',
  stopped: 'Stopped',
  failed: 'Auth Failed',
};

export function SessionCard({ session, qrCode, onStart, onStop, onDelete, onLogout, onSendMessage }: SessionCardProps) {
  const showQR = session.status === 'scan_qr' && qrCode;
  const isActive = ['ready', 'connected', 'authenticated', 'connecting', 'scan_qr', 'starting'].includes(session.status);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{session.name || session.id}</h3>
          <p className="text-sm text-gray-500">{session.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${statusColors[session.status] || 'bg-gray-500'}`} />
          <span className="text-sm text-gray-600">{statusLabels[session.status] || session.status}</span>
        </div>
      </div>

      {session.phone && (
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
          <Phone size={14} />
          <span>{session.phone}</span>
          {session.pushName && <span className="text-gray-400">({session.pushName})</span>}
        </div>
      )}

      {showQR && (
        <div className="flex justify-center mb-4 p-4 bg-white rounded border">
          <img src={qrCode} alt="QR Code" className="w-48 h-48" />
        </div>
      )}

      {session.status === 'scan_qr' && !qrCode && (
        <div className="flex items-center justify-center gap-2 mb-4 p-8 bg-gray-50 rounded border border-dashed">
          <QrCode size={24} className="text-gray-400" />
          <span className="text-gray-500">Waiting for QR code...</span>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        {!isActive && session.status !== 'starting' && (
          <button
            onClick={onStart}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
          >
            <Power size={14} /> Start
          </button>
        )}
        {isActive && (
          <button
            onClick={onStop}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            <PowerOff size={14} /> Stop
          </button>
        )}
        {session.status === 'ready' && (
          <>
            <button
              onClick={onSendMessage}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600"
            >
              <Send size={14} /> Send
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              <WifiOff size={14} /> Logout
            </button>
          </>
        )}
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 ml-auto"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}
