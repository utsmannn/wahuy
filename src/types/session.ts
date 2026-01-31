/**
 * Session types
 */

export type SessionState =
  | 'created'
  | 'starting'
  | 'scan_qr'
  | 'connecting'
  | 'connected'
  | 'ready'
  | 'disconnected'
  | 'reconnecting'
  | 'stopped'
  | 'failed';

export interface SessionError {
  code: string;
  message: string;
  timestamp: string;
}

export interface ReconnectInfo {
  enabled: boolean;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
}

export interface SessionInfo {
  id: string;
  name: string;
  status: SessionState;
  phone?: string | null;
  pushName?: string | null;
  platform?: string;
  createdAt: string;
  lastActivity?: string | null;
  lastError?: SessionError | null;
  reconnect?: ReconnectInfo;
  statistics?: SessionStatistics;
}

export interface SessionStatistics {
  messagesSent: number;
  messagesReceived: number;
  uptime: number;
}

export interface CreateSessionRequest {
  id?: string;
  name?: string;
  webhooks?: {
    url: string;
    events: string[];
  }[];
}

export interface SessionResponse {
  success: boolean;
  data?: SessionInfo;
  error?: {
    code: string;
    message: string;
  };
}
