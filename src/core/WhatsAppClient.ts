/**
 * WhatsApp Client Wrapper
 *
 * Wraps whatsapp-web.js Client with additional functionality.
 *
 * TODO: Complete implementation
 */

import { EventEmitter } from 'events';
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type { SessionState, SessionInfo } from '../types/session.js';

export class WhatsAppClient extends EventEmitter {
  private client: Client;
  private id: string;
  private name: string;
  private status: SessionState = 'created';
  private phone: string | null = null;
  private pushName: string | null = null;
  private qrCode: string | null = null;
  private createdAt: Date;
  private lastActivity: Date | null = null;

  constructor(id: string, name?: string) {
    super();
    this.id = id;
    this.name = name ?? id;
    this.createdAt = new Date();

    // Initialize whatsapp-web.js client
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: id,
        dataPath: config.storage.path + '/sessions'
      }),
      puppeteer: {
        headless: config.puppeteer.headless,
        args: config.puppeteer.args,
        executablePath: config.puppeteer.executablePath
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('qr', (qr) => {
      this.qrCode = qr;
      this.status = 'scan_qr';
      logger.info({ sessionId: this.id }, 'QR code generated');
      this.emit('qr', qr);
    });

    this.client.on('authenticated', () => {
      this.status = 'connecting';
      logger.info({ sessionId: this.id }, 'Authenticated');
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      this.status = 'failed';
      logger.error({ sessionId: this.id, msg }, 'Auth failed');
      this.emit('auth_failure', msg);
    });

    this.client.on('ready', () => {
      this.status = 'ready';
      this.qrCode = null;

      // Get client info
      const info = this.client.info;
      if (info) {
        this.phone = info.wid.user;
        this.pushName = info.pushname;
      }

      logger.info({
        sessionId: this.id,
        phone: this.phone,
        pushName: this.pushName
      }, 'Client ready');

      this.emit('ready');
    });

    this.client.on('disconnected', (reason) => {
      this.status = 'disconnected';
      logger.warn({ sessionId: this.id, reason }, 'Disconnected');
      this.emit('disconnected', reason);

      // Auto-reconnect if enabled
      if (config.session.restartOnAuthFail) {
        this.scheduleReconnect();
      }
    });

    this.client.on('message', (msg) => {
      this.lastActivity = new Date();
      this.emit('message', this.formatMessage(msg));
    });

    this.client.on('message_create', (msg) => {
      if (msg.fromMe) {
        this.lastActivity = new Date();
        this.emit('message_sent', this.formatMessage(msg));
      }
    });

    this.client.on('message_ack', (msg, ack) => {
      this.emit('message_ack', {
        id: msg.id._serialized,
        ack,
        ackName: this.getAckName(ack)
      });
    });
  }

  private formatMessage(msg: Message): object {
    return {
      id: msg.id._serialized,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      type: msg.type,
      timestamp: new Date(msg.timestamp * 1000).toISOString(),
      fromMe: msg.fromMe,
      hasMedia: msg.hasMedia,
      isForwarded: msg.isForwarded
    };
  }

  private getAckName(ack: number): string {
    const names: Record<number, string> = {
      0: 'error',
      1: 'pending',
      2: 'sent',
      3: 'delivered',
      4: 'read'
    };
    return names[ack] ?? 'unknown';
  }

  private scheduleReconnect(): void {
    // TODO: Implement reconnection with exponential backoff
    logger.info({ sessionId: this.id }, 'Scheduling reconnect...');
  }

  /**
   * Start the client
   */
  async start(): Promise<void> {
    this.status = 'starting';
    logger.info({ sessionId: this.id }, 'Starting client...');
    await this.client.initialize();
  }

  /**
   * Stop the client
   */
  async stop(): Promise<void> {
    this.status = 'stopped';
    logger.info({ sessionId: this.id }, 'Stopping client...');
    await this.client.destroy();
  }

  /**
   * Destroy the client and clean up
   */
  async destroy(): Promise<void> {
    try {
      await this.client.destroy();
    } catch (error) {
      // Ignore errors during destroy
    }
    this.removeAllListeners();
  }

  /**
   * Logout from WhatsApp
   */
  async logout(): Promise<void> {
    await this.client.logout();
    this.phone = null;
    this.pushName = null;
    this.status = 'created';
  }

  /**
   * Send text message
   */
  async sendMessage(to: string, text: string): Promise<Message> {
    const chatId = this.formatChatId(to);
    return await this.client.sendMessage(chatId, text);
  }

  /**
   * Get session info
   */
  getInfo(): SessionInfo {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      phone: this.phone,
      pushName: this.pushName,
      createdAt: this.createdAt.toISOString(),
      lastActivity: this.lastActivity?.toISOString() ?? null
    };
  }

  /**
   * Get current QR code
   */
  getQRCode(): string | null {
    return this.qrCode;
  }

  /**
   * Get current status
   */
  getStatus(): SessionState {
    return this.status;
  }

  /**
   * Format phone number to chat ID
   */
  private formatChatId(phone: string): string {
    // Remove non-digits
    let cleaned = phone.replace(/\D/g, '');

    // Handle Indonesian numbers starting with 0
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }

    return cleaned + '@c.us';
  }
}
