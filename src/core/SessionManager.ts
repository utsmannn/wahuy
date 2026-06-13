/**
 * Session Manager
 *
 * Orchestrates multiple WhatsApp client sessions (Baileys-based).
 */

import { EventEmitter } from 'events';
import { WhatsAppClient } from './WhatsAppClient.js';
import { logger } from '../utils/logger.js';
import { storage } from '../storage/index.js';
import type { SessionInfo } from '../types/session.js';

export class SessionManager extends EventEmitter {
  private sessions: Map<string, WhatsAppClient> = new Map();
  private initialized = false;

  constructor() { super(); }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const storedSessions = await storage.getSessions();
    logger.info({ count: storedSessions.length }, 'Loading sessions from storage');

    for (const stored of storedSessions) {
      const client = new WhatsAppClient(stored.id, stored.name);
      this.setupClientEvents(client, stored.id);
      this.sessions.set(stored.id, client);
    }

    this.initialized = true;
    logger.info('SessionManager initialized');
  }

  private setupClientEvents(client: WhatsAppClient, id: string): void {
    client.on('qr', (qr) => this.emit('session:qr', { sessionId: id, qr }));
    client.on('authenticated', () => this.emit('session:authenticated', { sessionId: id }));
    client.on('auth_failure', (msg) => this.emit('session:auth_failure', { sessionId: id, reason: msg }));
    client.on('ready', () => this.emit('session:ready', { sessionId: id, ...client.getInfo() }));
    client.on('disconnected', (reason) => this.emit('session:disconnected', { sessionId: id, reason }));
    client.on('reconnecting', (data) => this.emit('session:reconnecting', { sessionId: id, ...data }));
    client.on('failed', (data) => this.emit('session:failed', { sessionId: id, ...data }));
    client.on('status', (status) => this.emit('session:status', { sessionId: id, status }));
    client.on('message', (msg) => this.emit('message:received', { sessionId: id, message: msg }));
    client.on('message_sent', (msg) => this.emit('message:sent', { sessionId: id, message: msg }));
    client.on('message_ack', (data) => this.emit('message:ack', { sessionId: id, ...data }));
  }

  async createSession(id: string, name?: string): Promise<SessionInfo> {
    if (this.sessions.has(id)) throw new Error(`Session '${id}' already exists`);

    const client = new WhatsAppClient(id, name);
    this.setupClientEvents(client, id);
    this.sessions.set(id, client);

    await storage.saveSession({ id, name: name ?? id, createdAt: new Date().toISOString() });
    logger.info({ sessionId: id }, 'Session created');

    return { id, name: name ?? id, status: 'created', createdAt: new Date().toISOString() };
  }

  getSession(id: string): WhatsAppClient | undefined { return this.sessions.get(id); }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(c => c.getInfo());
  }

  async startSession(id: string): Promise<void> {
    const client = this.sessions.get(id);
    if (!client) throw new Error(`Session '${id}' not found`);
    this.emit('session:status', { sessionId: id, status: 'starting' });
    await client.start();
  }

  async stopSession(id: string): Promise<void> {
    const client = this.sessions.get(id);
    if (!client) throw new Error(`Session '${id}' not found`);
    await client.stop();
    this.emit('session:status', { sessionId: id, status: 'stopped' });
  }

  async deleteSession(id: string): Promise<void> {
    const client = this.sessions.get(id);
    if (!client) throw new Error(`Session '${id}' not found`);
    await client.destroy();
    this.sessions.delete(id);
    await storage.deleteSession(id);
    logger.info({ sessionId: id }, 'Session deleted');
  }

  getQRCode(id: string): string | null {
    const client = this.sessions.get(id);
    if (!client) throw new Error(`Session '${id}' not found`);
    return client.getQRCode();
  }

  async logoutSession(id: string): Promise<void> {
    const client = this.sessions.get(id);
    if (!client) throw new Error(`Session '${id}' not found`);
    await client.logout();
    logger.info({ sessionId: id }, 'Session logged out');
  }

  getStats(): { total: number; connected: number; disconnected: number } {
    let connected = 0, disconnected = 0;
    for (const client of this.sessions.values()) {
      const s = client.getStatus();
      if (s === 'ready' || s === 'connected') connected++;
      else if (s === 'disconnected' || s === 'stopped') disconnected++;
    }
    return { total: this.sessions.size, connected, disconnected };
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down all sessions...');
    for (const [id, client] of this.sessions) {
      try { await client.destroy(); } catch (e) { logger.error({ sessionId: id, error: e }, 'Failed to destroy'); }
    }
    this.sessions.clear();
  }
}

export const sessionManager = new SessionManager();
