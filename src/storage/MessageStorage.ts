/**
 * SQLite-based message storage for persistent message history
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

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

export interface StoredMessage {
  id: string;
  sessionId: string;
  from: string;
  to: string;
  body: string;
  type: string;
  timestamp: string;
  fromMe: boolean;
  hasMedia: boolean;
  mediaType?: string;
  mediaPath?: string;
  quotedMessageId?: string;
  receivedAt: string;
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
  rawData?: unknown;
}

export interface MessageQuery {
  sessionId?: string;
  from?: string;
  to?: string;
  type?: string;
  fromMe?: boolean;
  hasMedia?: boolean;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MessageStats {
  total: number;
  bySession: Record<string, number>;
  byType: Record<string, number>;
  received: number;
  sent: number;
}

class MessageStorageImpl {
  private db: Database.Database | null = null;
  private dbPath: string;
  private initialized = false;

  constructor() {
    this.dbPath = join(config.storage.path, 'messages.db');
  }

  private ensureInitialized(): void {
    if (this.initialized && this.db) return;

    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');

      // Create messages table with JSON data column
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          from_jid TEXT NOT NULL,
          to_jid TEXT NOT NULL,
          body TEXT,
          type TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          from_me INTEGER NOT NULL DEFAULT 0,
          has_media INTEGER NOT NULL DEFAULT 0,
          media_type TEXT,
          media_path TEXT,
          quoted_message_id TEXT,
          received_at TEXT NOT NULL,
          data JSON
        );

        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_jid);
        CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_jid);
        CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
      `);

      this.initialized = true;
      logger.info({ path: this.dbPath }, 'Message storage initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize message storage');
      throw error;
    }
  }

  /**
   * Save a message to storage
   */
  saveMessage(message: StoredMessage, rawData?: unknown): void {
    this.ensureInitialized();
    if (!this.db) return;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO messages
        (id, session_id, from_jid, to_jid, body, type, timestamp, from_me, has_media, media_type, media_path, quoted_message_id, received_at, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        message.id,
        message.sessionId,
        message.from,
        message.to,
        message.body,
        message.type,
        message.timestamp,
        message.fromMe ? 1 : 0,
        message.hasMedia ? 1 : 0,
        message.mediaType || null,
        message.mediaPath || null,
        message.quotedMessageId || null,
        message.receivedAt,
        rawData ? JSON.stringify(rawData) : null
      );

      logger.debug({ messageId: message.id, sessionId: message.sessionId }, 'Message saved to storage');
    } catch (error) {
      logger.error({ error, messageId: message.id }, 'Failed to save message');
    }
  }

  private mapRow(row: {
    id: string;
    session_id: string;
    from_jid: string;
    to_jid: string;
    body: string;
    type: string;
    timestamp: string;
    from_me: number;
    has_media: number;
    media_type: string | null;
    media_path: string | null;
    quoted_message_id: string | null;
    received_at: string;
    data: string | null;
  }, includeRawData = false): StoredMessage {
    let contacts: StoredMessage['contacts'] = undefined;
    let media: StoredMessage['media'] = undefined;
    let rawData: unknown;

    if (row.data) {
      try {
        rawData = JSON.parse(row.data) as { contacts?: StoredMessage['contacts']; media?: StoredMessage['media'] };
        if (rawData && typeof rawData === 'object') {
          const parsed = rawData as { contacts?: StoredMessage['contacts']; media?: StoredMessage['media'] };
          contacts = parsed.contacts;
          media = parsed.media;
        }
      } catch {
        // Ignore parse errors
      }
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      from: row.from_jid,
      to: row.to_jid,
      body: row.body,
      type: row.type,
      timestamp: row.timestamp,
      fromMe: row.from_me === 1,
      hasMedia: row.has_media === 1,
      mediaType: row.media_type || undefined,
      mediaPath: row.media_path || undefined,
      quotedMessageId: row.quoted_message_id || undefined,
      receivedAt: row.received_at,
      contacts,
      media,
      rawData: includeRawData ? rawData : undefined,
    };
  }

  /**
   * Query messages with flexible filters
   */
  getMessages(query: MessageQuery = {}): StoredMessage[] {
    this.ensureInitialized();
    if (!this.db) return [];

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.sessionId) {
      conditions.push('session_id = ?');
      params.push(query.sessionId);
    }

    if (query.from) {
      conditions.push('from_jid LIKE ?');
      params.push(`%${query.from}%`);
    }

    if (query.to) {
      conditions.push('to_jid LIKE ?');
      params.push(`%${query.to}%`);
    }

    if (query.type) {
      conditions.push('type = ?');
      params.push(query.type);
    }

    if (query.fromMe !== undefined) {
      conditions.push('from_me = ?');
      params.push(query.fromMe ? 1 : 0);
    }

    if (query.hasMedia !== undefined) {
      conditions.push('has_media = ?');
      params.push(query.hasMedia ? 1 : 0);
    }

    if (query.startDate) {
      conditions.push('timestamp >= ?');
      params.push(query.startDate);
    }

    if (query.endDate) {
      conditions.push('timestamp <= ?');
      params.push(query.endDate);
    }

    if (query.search) {
      conditions.push('body LIKE ?');
      params.push(`%${query.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    const sql = `
      SELECT * FROM messages
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      session_id: string;
      from_jid: string;
      to_jid: string;
      body: string;
      type: string;
      timestamp: string;
      from_me: number;
      has_media: number;
      media_type: string | null;
      media_path: string | null;
      quoted_message_id: string | null;
      received_at: string;
      data: string | null;
    }>;

    return rows.map(row => this.mapRow(row));
  }

  /**
   * Get conversation messages between a session and a phone number
   * Returns all messages where the phone appears in either from or to field
   */
  getConversation(sessionId: string, phone: string, limit: number = 100, offset: number = 0): StoredMessage[] {
    this.ensureInitialized();
    if (!this.db) return [];

    // Clean phone number - remove non-digits for matching
    const cleanPhone = phone.replace(/\D/g, '');

    const sql = `
      SELECT * FROM messages
      WHERE session_id = ?
      AND (from_jid LIKE ? OR to_jid LIKE ?)
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(sql).all(
      sessionId,
      `%${cleanPhone}%`,
      `%${cleanPhone}%`,
      limit,
      offset
    ) as Array<{
      id: string;
      session_id: string;
      from_jid: string;
      to_jid: string;
      body: string;
      type: string;
      timestamp: string;
      from_me: number;
      has_media: number;
      media_type: string | null;
      media_path: string | null;
      quoted_message_id: string | null;
      received_at: string;
      data: string | null;
    }>;

    return rows.map(row => this.mapRow(row));
  }

  /**
   * Get conversation message count
   */
  getConversationCount(sessionId: string, phone: string): number {
    this.ensureInitialized();
    if (!this.db) return 0;

    const cleanPhone = phone.replace(/\D/g, '');

    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE session_id = ?
      AND (from_jid LIKE ? OR to_jid LIKE ?)
    `).get(sessionId, `%${cleanPhone}%`, `%${cleanPhone}%`) as { count: number };

    return result.count;
  }

  /**
   * Get a single message by ID
   */
  getMessage(id: string): StoredMessage | null {
    this.ensureInitialized();
    if (!this.db) return null;

    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as {
      id: string;
      session_id: string;
      from_jid: string;
      to_jid: string;
      body: string;
      type: string;
      timestamp: string;
      from_me: number;
      has_media: number;
      media_type: string | null;
      media_path: string | null;
      quoted_message_id: string | null;
      received_at: string;
      data: string | null;
    } | undefined;

    if (!row) return null;

    return this.mapRow(row, true);
  }

  /**
   * Get message statistics
   */
  getStats(): MessageStats {
    this.ensureInitialized();
    if (!this.db) {
      return { total: 0, bySession: {}, byType: {}, received: 0, sent: 0 };
    }

    const total = (this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }).count;

    const bySession: Record<string, number> = {};
    const sessionRows = this.db.prepare('SELECT session_id, COUNT(*) as count FROM messages GROUP BY session_id').all() as Array<{ session_id: string; count: number }>;
    for (const row of sessionRows) {
      bySession[row.session_id] = row.count;
    }

    const byType: Record<string, number> = {};
    const typeRows = this.db.prepare('SELECT type, COUNT(*) as count FROM messages GROUP BY type').all() as Array<{ type: string; count: number }>;
    for (const row of typeRows) {
      byType[row.type] = row.count;
    }

    const received = (this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE from_me = 0').get() as { count: number }).count;
    const sent = (this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE from_me = 1').get() as { count: number }).count;

    return { total, bySession, byType, received, sent };
  }

  /**
   * Delete messages by session
   */
  deleteBySession(sessionId: string): number {
    this.ensureInitialized();
    if (!this.db) return 0;

    const result = this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    logger.info({ sessionId, deleted: result.changes }, 'Deleted messages for session');
    return result.changes;
  }

  /**
   * Delete all messages
   */
  deleteAll(): number {
    this.ensureInitialized();
    if (!this.db) return 0;

    const result = this.db.prepare('DELETE FROM messages').run();
    logger.info({ deleted: result.changes }, 'Deleted all messages');
    return result.changes;
  }

  /**
   * Delete messages older than a date
   */
  deleteOlderThan(date: string): number {
    this.ensureInitialized();
    if (!this.db) return 0;

    const result = this.db.prepare('DELETE FROM messages WHERE timestamp < ?').run(date);
    logger.info({ date, deleted: result.changes }, 'Deleted old messages');
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
      logger.info('Message storage closed');
    }
  }
}

export const messageStorage = new MessageStorageImpl();
