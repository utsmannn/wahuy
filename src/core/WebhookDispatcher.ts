/**
 * Webhook Dispatcher
 *
 * Dispatches events to registered webhook URLs.
 */

import { EventEmitter } from 'events';
import { createHmac } from 'crypto';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { storage } from '../storage/index.js';
import type { Webhook, WebhookEvent, WebhookDelivery } from '../types/webhook.js';

interface QueuedEvent {
  webhook: Webhook;
  event: WebhookEvent;
  attempts: number;
  nextRetry: Date;
}

export class WebhookDispatcher extends EventEmitter {
  private webhooks: Map<string, Webhook> = new Map();
  private queue: QueuedEvent[] = [];
  private processing = false;
  private initialized = false;

  constructor() {
    super();
    this.startProcessing();
  }

  /**
   * Initialize dispatcher and load webhooks from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const storedWebhooks = await storage.getWebhooks();
    logger.info({ count: storedWebhooks.length }, 'Loading webhooks from storage');

    for (const stored of storedWebhooks) {
      // Migrate legacy webhooks: empty sessions → ["*"] (was old "broadcast all" behavior)
      const sessions = stored.sessions && stored.sessions.length > 0
        ? stored.sessions
        : ['*'];

      this.webhooks.set(stored.id, {
        ...stored,
        sessions,
        stats: { totalSent: 0, totalFailed: 0 }
      });
    }

    this.initialized = true;
    logger.info('WebhookDispatcher initialized');
  }

  /**
   * Register a new webhook
   */
  async registerWebhook(webhook: Webhook): Promise<void> {
    this.webhooks.set(webhook.id, webhook);

    // Save to storage
    await storage.saveWebhook({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      sessions: webhook.sessions,
      secret: webhook.secret,
      active: webhook.active,
      createdAt: webhook.createdAt
    });

    logger.info({ webhookId: webhook.id, url: webhook.url }, 'Webhook registered');
  }

  /**
   * Remove a webhook
   */
  async removeWebhook(id: string): Promise<boolean> {
    const deleted = this.webhooks.delete(id);
    if (deleted) {
      await storage.deleteWebhook(id);
      logger.info({ webhookId: id }, 'Webhook removed');
    }
    return deleted;
  }

  /**
   * Update a webhook
   */
  async updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook | null> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return null;

    const updated = {
      ...webhook,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.webhooks.set(id, updated);

    await storage.updateWebhook(id, {
      url: updated.url,
      events: updated.events,
      sessions: updated.sessions,
      secret: updated.secret,
      active: updated.active
    });

    logger.info({ webhookId: id }, 'Webhook updated');
    return updated;
  }

  /**
   * Get all webhooks
   */
  getWebhooks(): Webhook[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get webhook by ID
   */
  getWebhook(id: string): Webhook | undefined {
    return this.webhooks.get(id);
  }

  /**
   * Dispatch an event to all matching webhooks
   */
  dispatch(eventName: string, sessionId: string, payload: object): void {
    const event: WebhookEvent = {
      event: eventName,
      timestamp: new Date().toISOString(),
      session: {
        id: sessionId,
        phone: null // TODO: Get from session
      },
      payload
    };

    // Find matching webhooks
    for (const webhook of this.webhooks.values()) {
      if (!webhook.active) continue;

      // Check if event matches
      const eventMatches = webhook.events.includes(eventName) ||
        webhook.events.includes('*') ||
        webhook.events.some(e => eventName.startsWith(e.replace('*', '')));

      if (!eventMatches) continue;

      // Session filter: ["*"] = all sessions, [] = nothing (must be explicit)
      if (!webhook.sessions || webhook.sessions.length === 0) {
        // No sessions configured → skip (safety: don't broadcast without explicit opt-in)
        logger.warn({ webhookId: webhook.id, sessionId }, 'Webhook has no sessions configured, skipping dispatch');
        continue;
      }
      if (!webhook.sessions.includes('*') && !webhook.sessions.includes(sessionId)) {
        continue;
      }

      // Add to queue
      this.queue.push({
        webhook,
        event,
        attempts: 0,
        nextRetry: new Date()
      });
    }

    this.processQueue();
  }

  /**
   * Start queue processing
   */
  private startProcessing(): void {
    setInterval(() => this.processQueue(), 1000);
  }

  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;

    try {
      const now = new Date();
      const readyEvents = this.queue.filter(e => e.nextRetry <= now);

      for (const queuedEvent of readyEvents) {
        await this.deliverEvent(queuedEvent);
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Deliver a single event
   */
  private async deliverEvent(queuedEvent: QueuedEvent): Promise<void> {
    const { webhook, event } = queuedEvent;

    try {
      const startTime = Date.now();

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Wahuy/1.0',
          'X-Webhook-Event': event.event,
          'X-Webhook-Timestamp': event.timestamp,
          ...(webhook.secret && {
            'X-Webhook-Signature': this.generateSignature(event, webhook.secret)
          })
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(config.webhook.timeout)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        // Success - remove from queue and update stats
        this.removeFromQueue(queuedEvent);
        this.updateStats(webhook.id, true);
        logger.debug({
          webhookId: webhook.id,
          event: event.event,
          responseTime
        }, 'Webhook delivered');
      } else {
        // HTTP error - retry
        this.handleFailure(queuedEvent, new Error(`HTTP ${response.status}`));
      }
    } catch (error) {
      this.handleFailure(queuedEvent, error as Error);
    }
  }

  /**
   * Handle delivery failure
   */
  private handleFailure(queuedEvent: QueuedEvent, error: Error): void {
    queuedEvent.attempts++;

    if (queuedEvent.attempts >= config.webhook.retryCount) {
      // Max retries reached - remove from queue and update stats
      this.removeFromQueue(queuedEvent);
      this.updateStats(queuedEvent.webhook.id, false);
      logger.error({
        webhookId: queuedEvent.webhook.id,
        event: queuedEvent.event.event,
        attempts: queuedEvent.attempts,
        error: error.message
      }, 'Webhook delivery failed permanently');
    } else {
      // Schedule retry with exponential backoff
      const delay = config.webhook.retryDelay * Math.pow(2, queuedEvent.attempts - 1);
      queuedEvent.nextRetry = new Date(Date.now() + delay);
      logger.warn({
        webhookId: queuedEvent.webhook.id,
        event: queuedEvent.event.event,
        attempts: queuedEvent.attempts,
        nextRetry: queuedEvent.nextRetry
      }, 'Webhook delivery failed, will retry');
    }
  }

  /**
   * Remove event from queue
   */
  private removeFromQueue(queuedEvent: QueuedEvent): void {
    const index = this.queue.indexOf(queuedEvent);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Update webhook delivery stats
   */
  private updateStats(webhookId: string, success: boolean): void {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return;

    if (!webhook.stats) {
      webhook.stats = { totalSent: 0, totalFailed: 0 };
    }

    if (success) {
      webhook.stats.totalSent++;
    } else {
      webhook.stats.totalFailed++;
    }
    webhook.stats.lastTriggered = new Date().toISOString();
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(event: WebhookEvent, secret: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(JSON.stringify(event));
    return 'sha256=' + hmac.digest('hex');
  }

  /**
   * Test a webhook by sending a test event
   */
  async testWebhook(webhookId: string): Promise<WebhookDelivery> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook '${webhookId}' not found`);
    }

    const testEvent: WebhookEvent = {
      event: 'test',
      timestamp: new Date().toISOString(),
      session: { id: 'test', phone: null },
      payload: { test: true }
    };

    const startTime = Date.now();

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Wahuy/1.0',
          'X-Webhook-Event': 'test'
        },
        body: JSON.stringify(testEvent),
        signal: AbortSignal.timeout(config.webhook.timeout)
      });

      const responseTime = Date.now() - startTime;
      const body = await response.text();

      return {
        success: response.ok,
        statusCode: response.status,
        responseTime,
        body
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 0,
        responseTime: Date.now() - startTime,
        body: (error as Error).message
      };
    }
  }
}

// Singleton instance
export const webhookDispatcher = new WebhookDispatcher();
