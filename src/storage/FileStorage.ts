/**
 * File-based storage implementation
 *
 * Stores sessions and webhooks in JSON files.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { IStorage, StoredSession, StoredWebhook } from './types.js';

export class FileStorage implements IStorage {
  private sessionsPath: string;
  private webhooksPath: string;
  private sessions: StoredSession[] = [];
  private webhooks: StoredWebhook[] = [];
  private initialized = false;

  constructor() {
    this.sessionsPath = join(config.storage.path, 'sessions.json');
    this.webhooksPath = join(config.storage.path, 'webhooks.json');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Ensure data directory exists
    const dataDir = dirname(this.sessionsPath);
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
      logger.info({ path: dataDir }, 'Created data directory');
    }

    // Load existing data
    await this.loadSessions();
    await this.loadWebhooks();

    this.initialized = true;
  }

  private async loadSessions(): Promise<void> {
    try {
      if (existsSync(this.sessionsPath)) {
        const data = await readFile(this.sessionsPath, 'utf-8');
        this.sessions = JSON.parse(data);
        logger.debug({ count: this.sessions.length }, 'Loaded sessions from storage');
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to load sessions, starting fresh');
      this.sessions = [];
    }
  }

  private async loadWebhooks(): Promise<void> {
    try {
      if (existsSync(this.webhooksPath)) {
        const data = await readFile(this.webhooksPath, 'utf-8');
        this.webhooks = JSON.parse(data);
        logger.debug({ count: this.webhooks.length }, 'Loaded webhooks from storage');
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to load webhooks, starting fresh');
      this.webhooks = [];
    }
  }

  private async saveSessions(): Promise<void> {
    await writeFile(this.sessionsPath, JSON.stringify(this.sessions, null, 2));
  }

  private async saveWebhooks(): Promise<void> {
    await writeFile(this.webhooksPath, JSON.stringify(this.webhooks, null, 2));
  }

  // Sessions

  async getSessions(): Promise<StoredSession[]> {
    await this.ensureInitialized();
    return [...this.sessions];
  }

  async getSession(id: string): Promise<StoredSession | null> {
    await this.ensureInitialized();
    return this.sessions.find(s => s.id === id) ?? null;
  }

  async saveSession(session: StoredSession): Promise<void> {
    await this.ensureInitialized();

    const index = this.sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      this.sessions[index] = session;
    } else {
      this.sessions.push(session);
    }

    await this.saveSessions();
    logger.debug({ sessionId: session.id }, 'Session saved to storage');
  }

  async deleteSession(id: string): Promise<void> {
    await this.ensureInitialized();

    const index = this.sessions.findIndex(s => s.id === id);
    if (index >= 0) {
      this.sessions.splice(index, 1);
      await this.saveSessions();
      logger.debug({ sessionId: id }, 'Session deleted from storage');
    }
  }

  // Webhooks

  async getWebhooks(): Promise<StoredWebhook[]> {
    await this.ensureInitialized();
    return [...this.webhooks];
  }

  async getWebhook(id: string): Promise<StoredWebhook | null> {
    await this.ensureInitialized();
    return this.webhooks.find(w => w.id === id) ?? null;
  }

  async saveWebhook(webhook: StoredWebhook): Promise<void> {
    await this.ensureInitialized();

    const index = this.webhooks.findIndex(w => w.id === webhook.id);
    if (index >= 0) {
      this.webhooks[index] = webhook;
    } else {
      this.webhooks.push(webhook);
    }

    await this.saveWebhooks();
    logger.debug({ webhookId: webhook.id }, 'Webhook saved to storage');
  }

  async updateWebhook(id: string, updates: Partial<StoredWebhook>): Promise<StoredWebhook | null> {
    await this.ensureInitialized();

    const index = this.webhooks.findIndex(w => w.id === id);
    if (index < 0) return null;

    this.webhooks[index] = {
      ...this.webhooks[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.saveWebhooks();
    logger.debug({ webhookId: id }, 'Webhook updated in storage');

    return this.webhooks[index];
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.ensureInitialized();

    const index = this.webhooks.findIndex(w => w.id === id);
    if (index >= 0) {
      this.webhooks.splice(index, 1);
      await this.saveWebhooks();
      logger.debug({ webhookId: id }, 'Webhook deleted from storage');
    }
  }
}
