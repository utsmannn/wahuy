/**
 * Session Manager
 *
 * Orchestrates multiple WhatsApp client sessions.
 *
 * TODO: Implement this class
 */

import { EventEmitter } from 'events';
import { WhatsAppClient } from './WhatsAppClient.js';
import { logger } from '../utils/logger.js';
import type { SessionState, SessionInfo } from '../types/session.js';

export class SessionManager extends EventEmitter {
  private sessions: Map<string, WhatsAppClient> = new Map();

  constructor() {
    super();
  }

  /**
   * Create a new session
   */
  async createSession(id: string, name?: string): Promise<SessionInfo> {
    if (this.sessions.has(id)) {
      throw new Error(`Session '${id}' already exists`);
    }

    const client = new WhatsAppClient(id, name);

    // Forward events
    client.on('qr', (qr) => this.emit('session:qr', { sessionId: id, qr }));
    client.on('authenticated', () => this.emit('session:authenticated', { sessionId: id }));
    client.on('ready', () => this.emit('session:ready', { sessionId: id }));
    client.on('disconnected', (reason) => this.emit('session:disconnected', { sessionId: id, reason }));
    client.on('message', (msg) => this.emit('message:received', { sessionId: id, message: msg }));

    this.sessions.set(id, client);

    logger.info({ sessionId: id }, 'Session created');

    return {
      id,
      name: name ?? id,
      status: 'created',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Get session by ID
   */
  getSession(id: string): WhatsAppClient | undefined {
    return this.sessions.get(id);
  }

  /**
   * List all sessions
   */
  listSessions(): SessionInfo[] {
    const result: SessionInfo[] = [];
    for (const [id, client] of this.sessions) {
      result.push(client.getInfo());
    }
    return result;
  }

  /**
   * Start a session
   */
  async startSession(id: string): Promise<void> {
    const client = this.sessions.get(id);
    if (!client) {
      throw new Error(`Session '${id}' not found`);
    }
    await client.start();
  }

  /**
   * Stop a session
   */
  async stopSession(id: string): Promise<void> {
    const client = this.sessions.get(id);
    if (!client) {
      throw new Error(`Session '${id}' not found`);
    }
    await client.stop();
  }

  /**
   * Delete a session
   */
  async deleteSession(id: string): Promise<void> {
    const client = this.sessions.get(id);
    if (!client) {
      throw new Error(`Session '${id}' not found`);
    }

    await client.destroy();
    this.sessions.delete(id);

    logger.info({ sessionId: id }, 'Session deleted');
  }

  /**
   * Get QR code for a session
   */
  getQRCode(id: string): string | null {
    const client = this.sessions.get(id);
    if (!client) {
      throw new Error(`Session '${id}' not found`);
    }
    return client.getQRCode();
  }

  /**
   * Shutdown all sessions
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down all sessions...');
    for (const [id, client] of this.sessions) {
      try {
        await client.destroy();
      } catch (error) {
        logger.error({ sessionId: id, error }, 'Failed to destroy session');
      }
    }
    this.sessions.clear();
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
