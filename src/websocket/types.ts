/**
 * WebSocket types
 */

export interface SocketAuth {
  apiKey: string;
}

export interface SubscribePayload {
  sessions: string[];  // Session IDs or ['*'] for all
  events?: string[];   // Event types to subscribe to
}

export interface UnsubscribePayload {
  sessions: string[];
}

export interface SessionQREvent {
  sessionId: string;
  qr: string;
}

export interface SessionStatusEvent {
  sessionId: string;
  status: string;
  phone?: string | null;
  reason?: string;
  lastError?: {
    code: string;
    message: string;
    timestamp: string;
  } | null;
  reconnect?: {
    enabled: boolean;
    attempts: number;
    maxAttempts: number;
    nextAttemptAt: string | null;
    lastAttemptAt: string | null;
  };
}

export interface MessageEvent {
  sessionId: string;
  message: object;
}
