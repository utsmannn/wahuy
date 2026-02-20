/**
 * Webhook Log Storage
 *
 * Stores incoming webhook events for debugging and monitoring
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface WebhookLogEntry {
  id: string;
  timestamp: string;
  source: 'meta' | 'internal';
  event: string;
  payload: unknown;
  processed: boolean;
  error?: string;
}

class WebhookLogStorageImpl {
  private db: Database.Database | null = null;
  private dbPath: string;
  private initialized = false;
  private maxLogs = 1000; // Keep last 1000 logs

  constructor() {
    this.dbPath = join(config.storage.path, 'webhook-logs.db');
  }

  private ensureInitialized(): void {
    if (this.initialized && this.db) return;

    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS webhook_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          source TEXT NOT NULL,
          event TEXT NOT NULL,
          payload JSON,
          processed INTEGER NOT NULL DEFAULT 0,
          error TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_webhook_logs_timestamp ON webhook_logs(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
        CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_logs(event);
      `);

      this.initialized = true;
      logger.info({ path: this.dbPath }, 'Webhook log storage initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize webhook log storage');
      throw error;
    }
  }

  /**
   * Log a webhook event
   */
  log(entry: Omit<WebhookLogEntry, 'id'>): void {
    this.ensureInitialized();
    if (!this.db) return;

    try {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const stmt = this.db.prepare(`
        INSERT INTO webhook_logs (id, timestamp, source, event, payload, processed, error)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        entry.timestamp,
        entry.source,
        entry.event,
        JSON.stringify(entry.payload),
        entry.processed ? 1 : 0,
        entry.error || null
      );

      // Cleanup old logs
      this.cleanup();
    } catch (error) {
      logger.error({ error }, 'Failed to log webhook event');
    }
  }

  /**
   * Get webhook logs with filters
   */
  getLogs(query: {
    source?: 'meta' | 'internal';
    event?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): WebhookLogEntry[] {
    this.ensureInitialized();
    if (!this.db) return [];

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.source) {
      conditions.push('source = ?');
      params.push(query.source);
    }

    if (query.event) {
      conditions.push('event = ?');
      params.push(query.event);
    }

    if (query.startDate) {
      conditions.push('timestamp >= ?');
      params.push(query.startDate);
    }

    if (query.endDate) {
      conditions.push('timestamp <= ?');
      params.push(query.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    const sql = `
      SELECT * FROM webhook_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      timestamp: string;
      source: string;
      event: string;
      payload: string;
      processed: number;
      error: string | null;
    }>;

    return rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      source: row.source as 'meta' | 'internal',
      event: row.event,
      payload: JSON.parse(row.payload),
      processed: row.processed === 1,
      error: row.error || undefined,
    }));
  }

  /**
   * Get log count
   */
  getCount(query?: { source?: string; event?: string }): number {
    this.ensureInitialized();
    if (!this.db) return 0;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query?.source) {
      conditions.push('source = ?');
      params.push(query.source);
    }

    if (query?.event) {
      conditions.push('event = ?');
      params.push(query.event);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = this.db.prepare(`SELECT COUNT(*) as count FROM webhook_logs ${whereClause}`).get(...params) as { count: number };

    return result.count;
  }

  /**
   * Get event types summary
   */
  getEventSummary(): Array<{ event: string; count: number }> {
    this.ensureInitialized();
    if (!this.db) return [];

    return this.db.prepare(`
      SELECT event, COUNT(*) as count
      FROM webhook_logs
      GROUP BY event
      ORDER BY count DESC
    `).all() as Array<{ event: string; count: number }>;
  }

  /**
   * Delete old logs
   */
  cleanup(): void {
    if (!this.db) return;

    try {
      // Delete logs older than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      this.db.prepare('DELETE FROM webhook_logs WHERE timestamp < ?').run(sevenDaysAgo);

      // Keep only last N logs
      const count = this.getCount();
      if (count > this.maxLogs) {
        this.db.prepare(`
          DELETE FROM webhook_logs
          WHERE id NOT IN (
            SELECT id FROM webhook_logs
            ORDER BY timestamp DESC
            LIMIT ?
          )
        `).run(this.maxLogs);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup webhook logs');
    }
  }

  /**
   * Clear all logs
   */
  clearAll(): number {
    this.ensureInitialized();
    if (!this.db) return 0;

    const result = this.db.prepare('DELETE FROM webhook_logs').run();
    logger.info({ deleted: result.changes }, 'Cleared all webhook logs');
    return result.changes;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      logger.info('Webhook log storage closed');
    }
  }
}

export const webhookLogStorage = new WebhookLogStorageImpl();
