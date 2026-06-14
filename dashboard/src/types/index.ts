export interface Session {
  id: string;
  name?: string;
  status: 'created' | 'starting' | 'scan_qr' | 'connecting' | 'ready' | 'disconnected' | 'stopped' | 'failed';
  phone?: string | null;
  pushName?: string | null;
  qr?: string | null;
  createdAt?: string;
  lastActivity?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  sessions?: string[];
  secret?: string;
  active: boolean;
  createdAt?: string;
  stats?: {
    totalSent: number;
    totalFailed: number;
    lastTriggered?: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  timestamp: string;
  sessions?: {
    total: number;
    connected: number;
    disconnected: number;
  };
  data?: {
    sessions: {
      total: number;
      connected: number;
      disconnected: number;
    };
  };
}

export interface ContactInfo {
  id: string | null;
  number: string | null;
  name: string | null;
  pushname: string | null;
  shortName: string | null;
  profilePicUrl?: string | null;
  isBusiness: boolean;
  isEnterprise: boolean;
  isMe: boolean;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  body: string;
  type: string;
  timestamp: string;
  fromMe: boolean;
  hasMedia: boolean;
  contacts?: {
    sender: ContactInfo | null;
    receiver: ContactInfo | null;
  };
  media?: {
    id?: string;
    url?: string;
    data?: string;
    mimetype?: string;
    mimeType?: string;
    filename?: string;
    caption?: string;
  };
  sessionId?: string;
  receivedAt?: string;
}

export interface ProviderInfo {
  mode: 'internal' | 'official';
  status: string;
  name: string;
  version: string;
  hasConfig?: boolean;
}

export interface OfficialConfig {
  accessToken: string;
  appSecret: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  baseUrl?: string;
  businessAccountId?: string;
}

export interface WhatsAppTemplate {
  name: string;
  status: string;
  category: string;
  language: string;
  id: string;
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: {
      body_text?: string[][];
      header_text?: string[];
    };
  }>;
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  source: 'meta' | 'internal';
  event: string;
  payload: unknown;
  processed: boolean;
  error?: string;
}

export interface WebhookLogStats {
  total: number;
  byEvent: Array<{ event: string; count: number }>;
}
