/**
 * Storage interfaces
 */

export interface StoredSession {
  id: string;
  name: string;
  createdAt: string;
  webhooks?: {
    url: string;
    events: string[];
  }[];
}

export interface StoredWebhook {
  id: string;
  url: string;
  events: string[];
  sessions?: string[];
  secret?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface IStorage {
  // Sessions
  getSessions(): Promise<StoredSession[]>;
  getSession(id: string): Promise<StoredSession | null>;
  saveSession(session: StoredSession): Promise<void>;
  deleteSession(id: string): Promise<void>;

  // Webhooks
  getWebhooks(): Promise<StoredWebhook[]>;
  getWebhook(id: string): Promise<StoredWebhook | null>;
  saveWebhook(webhook: StoredWebhook): Promise<void>;
  updateWebhook(id: string, updates: Partial<StoredWebhook>): Promise<StoredWebhook | null>;
  deleteWebhook(id: string): Promise<void>;
}
