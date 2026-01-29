/**
 * WhatsApp Client Wrapper
 *
 * Wraps whatsapp-web.js Client with additional functionality.
 */

import { EventEmitter } from 'events';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type { SessionState, SessionInfo } from '../types/session.js';

export class WhatsAppClient extends EventEmitter {
  private client: InstanceType<typeof Client>;
  private id: string;
  private name: string;
  private status: SessionState = 'created';
  private phone: string | null = null;
  private pushName: string | null = null;
  private qrCode: string | null = null;
  private createdAt: Date;
  private lastActivity: Date | null = null;
  private readyTimeout: NodeJS.Timeout | null = null;

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
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-crashpad',
          '--disable-crash-reporter',
          '--single-process',
          '--no-initial-navigation',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials'
        ]
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1031592179-alpha.html',
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('qr', (qr: string) => {
      this.qrCode = qr;
      this.status = 'scan_qr';
      logger.info({ sessionId: this.id }, 'QR code generated');
      this.emit('qr', qr);
    });

    this.client.on('loading_screen', (percent: number, message: string) => {
      this.status = 'connecting';
      logger.info({ sessionId: this.id, percent, message }, 'Loading screen');
      this.emit('status', 'connecting');
    });

    this.client.on('authenticated', () => {
      this.status = 'connecting';
      logger.info({ sessionId: this.id }, 'Authenticated');
      this.emit('authenticated');

      // Set timeout for ready event
      this.readyTimeout = setTimeout(() => {
        if (this.status !== 'ready') {
          logger.warn({ sessionId: this.id }, 'Ready timeout - client stuck after authenticated');
          this.emit('auth_failure', 'Ready timeout after authenticated');
        }
      }, 30000);
    });

    this.client.on('auth_failure', (msg: string) => {
      this.status = 'failed';
      logger.error({ sessionId: this.id, msg }, 'Auth failed');
      this.emit('auth_failure', msg);
    });

    this.client.on('ready', () => {
      this.status = 'ready';
      this.qrCode = null;

      // Clear ready timeout
      if (this.readyTimeout) {
        clearTimeout(this.readyTimeout);
        this.readyTimeout = null;
      }

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

    this.client.on('disconnected', (reason: string) => {
      this.status = 'disconnected';
      logger.warn({ sessionId: this.id, reason }, 'Disconnected');
      if (this.readyTimeout) {
        clearTimeout(this.readyTimeout);
        this.readyTimeout = null;
      }
      this.emit('disconnected', reason);
    });

    this.client.on('change_state', (state: string) => {
      logger.info({ sessionId: this.id, state }, 'State changed');
      // Map whatsapp-web.js states to our states
      const stateMap: Record<string, SessionState> = {
        'CONFLICT': 'connecting',
        'CONNECTED': 'ready',
        'DEPRECATED': 'failed',
        'OPENING': 'starting',
        'PAIRING': 'connecting',
        'PROXYBLOCK': 'failed',
        'SMB_TOS_BLOCK': 'failed',
        'TIMEOUT': 'failed',
        'TOS_BLOCK': 'failed',
        'UNLAUNCHED': 'connecting',
        'UNPAIRED': 'disconnected',
        'UNPAIRED_IDLE': 'disconnected'
      };
      const newStatus = stateMap[state];
      if (newStatus) {
        this.status = newStatus;
        this.emit('status', newStatus);
      }
    });

    this.client.on('message', (msg: pkg.Message) => {
      this.lastActivity = new Date();
      this.emit('message', this.formatMessage(msg));
    });

    this.client.on('message_create', (msg: pkg.Message) => {
      if (msg.fromMe) {
        this.lastActivity = new Date();
        this.emit('message_sent', this.formatMessage(msg));
      }
    });

    this.client.on('message_ack', (msg: pkg.Message, ack: number) => {
      this.emit('message_ack', {
        id: msg.id._serialized,
        ack,
        ackName: this.getAckName(ack)
      });
    });
  }

  private formatMessage(msg: pkg.Message): object {
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
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
    }
    try {
      await this.client.destroy();
    } catch {
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
  async sendMessage(to: string, text: string): Promise<pkg.Message> {
    const chatId = this.formatChatId(to);
    return await this.client.sendMessage(chatId, text);
  }

  /**
   * Send image message
   */
  async sendImage(to: string, imagePath: string, caption?: string): Promise<pkg.Message> {
    const chatId = this.formatChatId(to);
    const media = await pkg.MessageMedia.fromFilePath(imagePath);
    return await this.client.sendMessage(chatId, media, { caption });
  }

  /**
   * Send image from base64
   */
  async sendImageBase64(to: string, base64Data: string, mimeType: string, caption?: string, filename?: string): Promise<pkg.Message> {
    const chatId = this.formatChatId(to);
    const media = new pkg.MessageMedia(mimeType, base64Data, filename);
    return await this.client.sendMessage(chatId, media, { caption });
  }

  /**
   * Send document/file
   */
  async sendDocument(to: string, filePath: string, caption?: string, filename?: string): Promise<pkg.Message> {
    const chatId = this.formatChatId(to);
    const media = await pkg.MessageMedia.fromFilePath(filePath);
    if (filename) {
      media.filename = filename;
    }
    return await this.client.sendMessage(chatId, media, { caption, sendMediaAsDocument: true });
  }

  /**
   * Send document from base64
   */
  async sendDocumentBase64(to: string, base64Data: string, mimeType: string, filename: string, caption?: string): Promise<pkg.Message> {
    const chatId = this.formatChatId(to);
    const media = new pkg.MessageMedia(mimeType, base64Data, filename);
    return await this.client.sendMessage(chatId, media, { caption, sendMediaAsDocument: true });
  }

  /**
   * Send location
   */
  async sendLocation(to: string, latitude: number, longitude: number, _description?: string): Promise<pkg.Message> {
    const chatId = this.formatChatId(to);
    const location = new pkg.Location(latitude, longitude);
    return await this.client.sendMessage(chatId, location);
  }

  /**
   * Reply to a message
   */
  async replyToMessage(to: string, messageId: string, text: string): Promise<pkg.Message> {
    const chatId = this.formatChatId(to);
    const chat = await this.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 100 });
    const targetMsg = messages.find(m => m.id._serialized === messageId);

    if (!targetMsg) {
      throw new Error('Message not found');
    }

    return await targetMsg.reply(text);
  }

  /**
   * Get chat messages
   */
  async getChatMessages(phone: string, limit: number = 50): Promise<unknown[]> {
    const chatId = this.formatChatId(phone);
    const chat = await this.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });

    return messages.map(msg => this.formatMessage(msg));
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
