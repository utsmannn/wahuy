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
  | 'stopped'
  | 'failed';

export interface SessionInfo {
  id: string;
  name: string;
  status: SessionState;
  phone?: string | null;
  pushName?: string | null;
  platform?: string;
  createdAt: string;
  lastActivity?: string | null;
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
