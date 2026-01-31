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
import type { SessionState, SessionInfo, SessionError } from '../types/session.js';

// Reconnect configuration
const RECONNECT_MAX_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 5000; // 5 seconds
const RECONNECT_MAX_DELAY = 300000; // 5 minutes

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

  // Error tracking
  private lastError: SessionError | null = null;

  // Reconnect state
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private nextReconnectAt: Date | null = null;
  private lastReconnectAttempt: Date | null = null;
  private autoReconnectEnabled: boolean = true;
  private isDestroyed: boolean = false;

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
      this.lastError = {
        code: 'AUTH_FAILURE',
        message: msg,
        timestamp: new Date().toISOString(),
      };
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

      // Reset reconnect state on successful connection
      this.reconnectAttempts = 0;
      this.nextReconnectAt = null;
      this.lastError = null;

      this.emit('ready');
    });

    this.client.on('disconnected', (reason: string) => {
      this.status = 'disconnected';
      this.lastError = {
        code: 'DISCONNECTED',
        message: reason,
        timestamp: new Date().toISOString(),
      };
      logger.warn({ sessionId: this.id, reason }, 'Disconnected');
      if (this.readyTimeout) {
        clearTimeout(this.readyTimeout);
        this.readyTimeout = null;
      }
      this.emit('disconnected', reason);

      // Attempt auto-reconnect if enabled and not manually stopped
      if (this.autoReconnectEnabled && !this.isDestroyed && this.shouldReconnect(reason)) {
        this.scheduleReconnect();
      }
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

    this.client.on('message', async (msg: pkg.Message) => {
      this.lastActivity = new Date();
      const formatted = await this.formatMessage(msg);
      this.emit('message', formatted);
    });

    this.client.on('message_create', async (msg: pkg.Message) => {
      if (msg.fromMe) {
        this.lastActivity = new Date();
        const formatted = await this.formatMessage(msg);
        this.emit('message_sent', formatted);
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

  private async formatMessage(msg: pkg.Message): Promise<object> {
    // Get sender contact
    let senderContact = null;
    let receiverContact = null;

    try {
      const sender = await msg.getContact();
      if (sender) {
        senderContact = {
          id: sender.id?._serialized || null,
          number: sender.number || null,
          name: sender.name || null,
          pushname: sender.pushname || null,
          shortName: sender.shortName || null,
          isBusiness: sender.isBusiness || false,
          isEnterprise: sender.isEnterprise || false,
          isMe: sender.isMe || false,
        };
      }
    } catch {
      // Contact not available
    }

    try {
      // Get receiver contact (the 'to' field)
      if (msg.to) {
        const receiver = await this.client.getContactById(msg.to);
        if (receiver) {
          receiverContact = {
            id: receiver.id?._serialized || null,
            number: receiver.number || null,
            name: receiver.name || null,
            pushname: receiver.pushname || null,
            shortName: receiver.shortName || null,
            isBusiness: receiver.isBusiness || false,
            isEnterprise: receiver.isEnterprise || false,
            isMe: receiver.isMe || false,
          };
        }
      }
    } catch {
      // Contact not available
    }

    const baseMessage = {
      id: msg.id._serialized,
      from: msg.from,
      to: msg.to,
      body: msg.body,
      type: msg.type,
      timestamp: new Date(msg.timestamp * 1000).toISOString(),
      fromMe: msg.fromMe,
      hasMedia: msg.hasMedia,
      isForwarded: msg.isForwarded,
      contacts: {
        sender: senderContact,
        receiver: receiverContact,
      },
    };

    // Download media if present
    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media) {
          return {
            ...baseMessage,
            media: {
              data: media.data,
              mimetype: media.mimetype,
              filename: media.filename || null
            }
          };
        }
      } catch (error) {
        logger.warn({ sessionId: this.id, messageId: msg.id._serialized, error }, 'Failed to download media');
      }
    }

    return baseMessage;
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
    this.autoReconnectEnabled = false;
    this.cancelReconnect();
    logger.info({ sessionId: this.id }, 'Stopping client...');
    await this.client.destroy();
  }

  /**
   * Destroy the client and clean up
   */
  async destroy(): Promise<void> {
    this.isDestroyed = true;
    this.autoReconnectEnabled = false;
    this.cancelReconnect();
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
   * Check if we should attempt reconnection based on disconnect reason
   */
  private shouldReconnect(reason: string): boolean {
    // Don't reconnect if manually destroyed or stopped
    if (this.isDestroyed) return false;

    // Don't reconnect if max attempts reached
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      logger.warn({ sessionId: this.id, attempts: this.reconnectAttempts }, 'Max reconnect attempts reached');
      return false;
    }

    // Don't reconnect for certain permanent failures
    const permanentFailures = [
      'LOGOUT',
      'TOS_BLOCK',
      'SMB_TOS_BLOCK',
      'DEPRECATED',
    ];

    if (permanentFailures.some(f => reason.toUpperCase().includes(f))) {
      logger.warn({ sessionId: this.id, reason }, 'Permanent failure - not reconnecting');
      return false;
    }

    return true;
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    this.cancelReconnect();

    // Calculate delay with exponential backoff
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY
    );

    this.nextReconnectAt = new Date(Date.now() + delay);
    this.status = 'reconnecting';

    logger.info({
      sessionId: this.id,
      attempt: this.reconnectAttempts + 1,
      maxAttempts: RECONNECT_MAX_ATTEMPTS,
      delayMs: delay,
      nextAttemptAt: this.nextReconnectAt.toISOString()
    }, 'Scheduling reconnect');

    this.emit('status', 'reconnecting');
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: RECONNECT_MAX_ATTEMPTS,
      nextAttemptAt: this.nextReconnectAt.toISOString(),
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  /**
   * Cancel any pending reconnection
   */
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.nextReconnectAt = null;
  }

  /**
   * Attempt to reconnect
   */
  private async reconnect(): Promise<void> {
    if (this.isDestroyed || !this.autoReconnectEnabled) {
      return;
    }

    this.reconnectAttempts++;
    this.lastReconnectAttempt = new Date();
    this.nextReconnectAt = null;

    logger.info({
      sessionId: this.id,
      attempt: this.reconnectAttempts,
      maxAttempts: RECONNECT_MAX_ATTEMPTS
    }, 'Attempting reconnect');

    try {
      // Destroy old client instance
      try {
        await this.client.destroy();
      } catch {
        // Ignore destroy errors
      }

      // Create new client instance
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: this.id,
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

      // Re-attach event handlers
      this.setupEventHandlers();

      // Initialize
      this.status = 'starting';
      await this.client.initialize();

    } catch (error) {
      const err = error as Error;
      logger.error({ sessionId: this.id, error: err.message }, 'Reconnect failed');

      this.lastError = {
        code: 'RECONNECT_FAILED',
        message: err.message,
        timestamp: new Date().toISOString(),
      };

      // Schedule another attempt if we haven't exceeded max
      if (this.reconnectAttempts < RECONNECT_MAX_ATTEMPTS && this.autoReconnectEnabled) {
        this.scheduleReconnect();
      } else {
        this.status = 'failed';
        this.emit('status', 'failed');
        this.emit('failed', {
          reason: 'Max reconnect attempts exceeded',
          lastError: this.lastError,
        });
      }
    }
  }

  /**
   * Enable or disable auto-reconnect
   */
  setAutoReconnect(enabled: boolean): void {
    this.autoReconnectEnabled = enabled;
    if (!enabled) {
      this.cancelReconnect();
    }
    logger.info({ sessionId: this.id, enabled }, 'Auto-reconnect setting changed');
  }

  /**
   * Get auto-reconnect status
   */
  isAutoReconnectEnabled(): boolean {
    return this.autoReconnectEnabled;
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

    return Promise.all(messages.map(msg => this.formatMessage(msg)));
  }

  /**
   * Get all chats
   */
  async getChats(): Promise<object[]> {
    const chats = await this.client.getChats();
    return chats.map(chat => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      isReadOnly: chat.isReadOnly,
      unreadCount: chat.unreadCount,
      timestamp: chat.timestamp ? new Date(chat.timestamp * 1000).toISOString() : null,
      lastMessage: chat.lastMessage ? {
        body: chat.lastMessage.body,
        timestamp: chat.lastMessage.timestamp ? new Date(chat.lastMessage.timestamp * 1000).toISOString() : null,
        fromMe: chat.lastMessage.fromMe,
      } : null,
    }));
  }

  /**
   * Get groups only
   */
  async getGroups(): Promise<object[]> {
    const chats = await this.client.getChats();
    const groups = chats.filter(chat => chat.isGroup);

    return Promise.all(groups.map(async (group) => {
      let participants: object[] = [];
      try {
        // Type assertion for group chat
        const groupChat = group as unknown as { participants?: Array<{ id: { _serialized: string }, isAdmin: boolean, isSuperAdmin: boolean }> };
        if (groupChat.participants) {
          participants = groupChat.participants.map(p => ({
            id: p.id._serialized,
            isAdmin: p.isAdmin,
            isSuperAdmin: p.isSuperAdmin,
          }));
        }
      } catch {
        // Ignore errors getting participants
      }

      return {
        id: group.id._serialized,
        name: group.name,
        isReadOnly: group.isReadOnly,
        unreadCount: group.unreadCount,
        timestamp: group.timestamp ? new Date(group.timestamp * 1000).toISOString() : null,
        participantCount: participants.length,
        participants,
        lastMessage: group.lastMessage ? {
          body: group.lastMessage.body,
          timestamp: group.lastMessage.timestamp ? new Date(group.lastMessage.timestamp * 1000).toISOString() : null,
          fromMe: group.lastMessage.fromMe,
        } : null,
      };
    }));
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
      lastActivity: this.lastActivity?.toISOString() ?? null,
      lastError: this.lastError,
      reconnect: {
        enabled: this.autoReconnectEnabled,
        attempts: this.reconnectAttempts,
        maxAttempts: RECONNECT_MAX_ATTEMPTS,
        nextAttemptAt: this.nextReconnectAt?.toISOString() ?? null,
        lastAttemptAt: this.lastReconnectAttempt?.toISOString() ?? null,
      },
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
   * Preserves JID suffix if already provided (@c.us, @lid, @g.us)
   */
  private formatChatId(phone: string): string {
    // If already a valid JID (contains @), return as-is
    if (phone.includes('@')) {
      return phone;
    }

    // Remove non-digits
    let cleaned = phone.replace(/\D/g, '');

    // Handle Indonesian numbers starting with 0
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }

    return cleaned + '@c.us';
  }

  /**
   * Send typing indicator
   */
  async sendTyping(to: string, duration: number = 3000): Promise<void> {
    const chatId = this.formatChatId(to);
    const chat = await this.client.getChatById(chatId);
    await chat.sendStateTyping();

    // Clear typing state after duration
    if (duration > 0) {
      setTimeout(async () => {
        try {
          await chat.clearState();
        } catch {
          // Ignore errors during clear state
        }
      }, Math.min(duration, 25000)); // Cap at 25 seconds (WhatsApp limit)
    }
  }

  /**
   * Send recording indicator (voice message typing)
   */
  async sendRecording(to: string, duration: number = 3000): Promise<void> {
    const chatId = this.formatChatId(to);
    const chat = await this.client.getChatById(chatId);
    await chat.sendStateRecording();

    if (duration > 0) {
      setTimeout(async () => {
        try {
          await chat.clearState();
        } catch {
          // Ignore errors during clear state
        }
      }, Math.min(duration, 25000));
    }
  }

  /**
   * Clear chat state (stop typing/recording indicator)
   */
  async clearState(to: string): Promise<void> {
    const chatId = this.formatChatId(to);
    const chat = await this.client.getChatById(chatId);
    await chat.clearState();
  }

  /**
   * Mark chat as read (send seen/blue checkmark)
   */
  async markAsRead(to: string): Promise<void> {
    const chatId = this.formatChatId(to);
    const chat = await this.client.getChatById(chatId);
    await chat.sendSeen();
  }

  /**
   * Mark specific message as read by finding it in the chat
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    // The message ID contains the chat ID, extract it
    // Format: true_6281234567890@c.us_3EB0...
    const parts = messageId.split('_');
    if (parts.length >= 2) {
      const chatId = parts[1];
      const chat = await this.client.getChatById(chatId);
      await chat.sendSeen();
    } else {
      throw new Error('Invalid message ID format');
    }
  }
}
