import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Session } from '../types';

interface UseWebSocketOptions {
  apiKey: string;
  onQR?: (sessionId: string, qr: string) => void;
  onStatus?: (sessionId: string, status: string, phone?: string, pushName?: string) => void;
  onMessage?: (sessionId: string, message: object) => void;
}

export function useWebSocket({ apiKey, onQR, onStatus, onMessage }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!apiKey) return;

    const socket = io(window.location.origin, {
      auth: { apiKey },
      path: '/socket.io',
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe', { sessions: ['*'] });
      socket.emit('getSessions');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('sessions', (data: Session[]) => {
      setSessions(data);
    });

    socket.on('session:qr', (data: { sessionId: string; qr: string }) => {
      onQR?.(data.sessionId, data.qr);
    });

    socket.on('session:status', (data: { sessionId: string; status: string; phone?: string; pushName?: string }) => {
      onStatus?.(data.sessionId, data.status, data.phone, data.pushName);
      socket.emit('getSessions');
    });

    socket.on('message:received', (data: { sessionId: string; message: object }) => {
      onMessage?.(data.sessionId, data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [apiKey, onQR, onStatus, onMessage]);

  const refreshSessions = useCallback(() => {
    socketRef.current?.emit('getSessions');
  }, []);

  return { connected, sessions, refreshSessions };
}
