/**
 * Webhook types
 */

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  sessions?: string[];
  secret?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  stats?: WebhookStats;
}

export interface WebhookStats {
  totalSent: number;
  totalFailed: number;
  lastTriggered?: string;
}

export interface WebhookEvent {
  event: string;
  timestamp: string;
  session: {
    id: string;
    phone: string | null;
  };
  payload: object;
}

export interface WebhookDelivery {
  success: boolean;
  statusCode: number;
  responseTime: number;
  body: string;
}

export interface CreateWebhookRequest {
  url: string;
  events: string[];
  sessions?: string[];
  secret?: string;
  active?: boolean;
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: string[];
  sessions?: string[];
  secret?: string;
  active?: boolean;
}
