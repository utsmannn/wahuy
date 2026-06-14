/**
 * WhatsApp Client Wrapper — Baileys
 *
 * Wraps @whiskeysockets/baileys for multi-session WhatsApp.
 * No Chromium/Puppeteer needed.
 */

import { EventEmitter } from 'events';
import { rm } from 'fs/promises';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  jidNormalizedUser,
  isLidUser,
  isPnUser,
  jidDecode,
  downloadContentFromMessage,
  type WASocket,
  type WAMessage,
  type WAMessageKey,
  type ConnectionState,
  type Contact,
  type LIDMapping,
} from '@whiskeysockets/baileys';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type { SessionState, SessionInfo, SessionError } from '../types/session.js';

const RECONNECT_MAX_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 5000;
const RECONNECT_MAX_DELAY = 300000;

const MEDIA_MESSAGE_KEYS = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'] as const;
type MediaMessageKey = typeof MEDIA_MESSAGE_KEYS[number];

type MediaContent = {
  mediaKey?: Uint8Array | Buffer | null;
  directPath?: string | null;
  url?: string | null;
  mimetype?: string | null;
  fileName?: string | null;
  caption?: string | null;
};

type ReadMessageKeyInput = {
  remoteJid: string;
  id: string;
  fromMe?: boolean;
  participant?: string;
};

type DownloadedMedia = {
  data: string;
  mimetype: string;
  mimeType: string;
  filename?: string;
  caption?: string;
};

export class WhatsAppClient extends EventEmitter {
  private sock: WASocket | null = null;
  private id: string;
  private name: string;
  private status: SessionState = 'created';
  private phone: string | null = null;
  private pushName: string | null = null;
  private qrCode: string | null = null;
  private createdAt: Date;
  private lastActivity: Date | null = null;
  private authDir: string;

  private lastError: SessionError | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private nextReconnectAt: Date | null = null;
  private lastReconnectAttempt: Date | null = null;
  private autoReconnectEnabled = true;
  private isDestroyed = false;
  private authStateInvalid = false;
  private saveCreds: ((creds: unknown) => Promise<void>) | null = null;
  private lidToPn = new Map<string, string>();
  private profilePicUrls = new Map<string, string | null>();

  constructor(id: string, name?: string) {
    super();
    this.id = id;
    this.name = name ?? id;
    this.createdAt = new Date();
    this.authDir = join(config.storage.path, 'sessions', id);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  async start(): Promise<void> {
    this.cancelReconnect();
    this.closeSocket();

    if (this.authStateInvalid) {
      await this.clearAuthState('previous auth state was rejected');
    }

    this.status = 'starting';
    this.isDestroyed = false;
    this.autoReconnectEnabled = true;
    this.nextReconnectAt = null;
    logger.info({ sessionId: this.id }, 'Baileys: connecting...');
    await this.connect();
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    this.autoReconnectEnabled = false;
    this.cancelReconnect();
    logger.info({ sessionId: this.id }, 'Stopping...');
    this.closeSocket();
  }

  async destroy(): Promise<void> {
    this.isDestroyed = true;
    this.autoReconnectEnabled = false;
    this.cancelReconnect();
    this.closeSocket();
    this.removeAllListeners();
  }

  private closeSocket(): void {
    if (this.sock) {
      try { this.sock.end(undefined); } catch { /* ignore */ }
      this.sock = null;
    }
  }

  private async clearAuthState(reason: string): Promise<void> {
    this.cancelReconnect();
    this.closeSocket();
    await rm(this.authDir, { recursive: true, force: true });
    this.phone = null;
    this.pushName = null;
    this.qrCode = null;
    this.reconnectAttempts = 0;
    this.nextReconnectAt = null;
    this.lastReconnectAttempt = null;
    this.authStateInvalid = false;
    logger.info({ sessionId: this.id, reason }, 'Cleared Baileys auth state');
  }

  // ============================================================================
  // Core Connection
  // ============================================================================

  private async connect(): Promise<void> {
    try {
      const versionInfo = await fetchLatestBaileysVersion();
      const { version } = versionInfo;
      logger.info({
        sessionId: this.id,
        version: version.join('.'),
        isLatest: versionInfo.isLatest,
        versionError: versionInfo.error instanceof Error ? versionInfo.error.message : undefined,
      }, 'Baileys version');

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      this.saveCreds = saveCreds as unknown as (creds: unknown) => Promise<void>;

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger as unknown as any),
        },
        printQRInTerminal: false,
        browser: Browsers.macOS('Chrome'),
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        retryRequestDelayMs: 1000,
        shouldIgnoreJid: jid => jid.includes('@broadcast'),
        defaultQueryTimeoutMs: 60000,
      });

      this.setupEventHandlers();
    } catch (err) {
      const e = err as Error;
      logger.error({ sessionId: this.id, error: e.message }, 'Baileys: connect failed');
      this.status = 'failed';
      this.lastError = { code: 'CONNECT_FAILED', message: e.message, timestamp: new Date().toISOString() };
      this.emit('status', 'failed');
      if (this.autoReconnectEnabled && !this.isDestroyed) this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.sock) return;

    this.sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCode = qr;
        this.status = 'scan_qr';
        logger.info({ sessionId: this.id }, 'QR code ready');
        this.emit('status', 'scan_qr');
        this.emit('qr', qr);
      }

      if (connection === 'open') {
        this.status = 'ready';
        this.qrCode = null;
        this.reconnectAttempts = 0;
        this.nextReconnectAt = null;
        this.lastError = null;

        const raw = this.sock?.user as { id?: string; name?: string } | undefined;
        if (raw) {
          this.phone = raw.id?.split(':')[0]?.split('@')[0] || null;
          this.pushName = raw.name || null;
        }

        logger.info({ sessionId: this.id, phone: this.phone }, 'Baileys: connected');
        this.emit('ready');
      }

      if (connection === 'close') {
        const err = lastDisconnect?.error;
        const output = (err as Record<string, unknown> | undefined)?.output as Record<string, unknown> | undefined;
        const code = output?.statusCode as number | undefined;
        const errorData = output?.data;
        const message = err instanceof Error ? err.message : 'Unknown disconnect error';
        const reason = code ? String(code) : 'unknown';
        const shouldReconnect = code !== DisconnectReason.loggedOut;

        this.status = 'disconnected';
        this.lastError = {
          code: 'DISCONNECTED',
          message: `${message} (close code: ${reason})`,
          timestamp: new Date().toISOString(),
        };
        logger.warn({ sessionId: this.id, code: reason, error: message, errorData }, 'Baileys: disconnected');

        if (code === DisconnectReason.loggedOut) {
          this.status = 'failed';
          this.authStateInvalid = true;
          this.emit('status', 'failed');
          this.emit('auth_failure', 'Logged out');
          return;
        }

        this.emit('disconnected', reason);

        if (this.autoReconnectEnabled && !this.isDestroyed && shouldReconnect) {
          this.scheduleReconnect();
        }
      }
    });

    this.sock.ev.on('creds.update', async () => {
      if (this.saveCreds) {
        try { await this.saveCreds(this.sock?.authState?.creds); } catch { /* ignore */ }
      }
    });

    const rememberContact = (contact: Partial<Contact>) => {
      this.rememberLidPn(contact.lid, contact.phoneNumber);

      if (isLidUser(contact.id) && contact.phoneNumber) {
        this.rememberLidPn(contact.id, contact.phoneNumber);
      } else if (isPnUser(contact.id) && contact.lid) {
        this.rememberLidPn(contact.lid, contact.id);
      }
    };

    this.sock.ev.on('lid-mapping.update', ({ lid, pn }: LIDMapping) => {
      this.rememberLidPn(lid, pn);
    });

    this.sock.ev.on('contacts.upsert', (contacts: Contact[]) => {
      for (const contact of contacts) rememberContact(contact);
    });

    this.sock.ev.on('contacts.update', (contacts: Partial<Contact>[]) => {
      for (const contact of contacts) rememberContact(contact);
    });

    this.sock.ev.on('messaging-history.set', ({ contacts, lidPnMappings }) => {
      for (const mapping of lidPnMappings || []) {
        this.rememberLidPn(mapping.lid, mapping.pn);
      }
      for (const contact of contacts || []) rememberContact(contact);
    });

    this.sock.ev.on('messages.upsert', async ({ messages, type }: { messages: WAMessage[]; type: string }) => {
      for (const msg of messages) {
        if (msg.key.remoteJid === 'status@broadcast') continue;

        const formatted = await this.formatMessage(msg);
        this.lastActivity = new Date();

        if (type === 'notify') {
          this.emit('message', formatted);
        } else if (msg.key.fromMe) {
          this.emit('message_sent', formatted);
        }
      }
    });

    this.sock.ev.on('messages.update', (updates: any[]) => {
      for (const u of updates) {
        const s = u.update?.status;
        if (s) {
          this.emit('message_ack', {
            id: u.key?.id || '',
            ack: s === 'READ' ? 4 : s === 'DELIVERY_ACK' ? 3 : s === 'SERVER_ACK' ? 2 : 1,
            ackName: s || 'unknown',
          });
        }
      }
    });
  }

  // ============================================================================
  // Message Formatting (Baileys raw → WahuyMessage)
  // ============================================================================

  private normalizeJid(jid?: string | null): string {
    return jid ? jidNormalizedUser(jid) : '';
  }

  private rememberLidPn(lid?: string | null, pn?: string | null): void {
    const normalizedLid = this.normalizeJid(lid);
    const normalizedPn = this.normalizeJid(pn);

    if (isLidUser(normalizedLid) && isPnUser(normalizedPn)) {
      this.lidToPn.set(normalizedLid, normalizedPn);
    }
  }

  private async resolvePhoneJid(jid?: string | null, preferredPn?: string | null): Promise<string | null> {
    const normalized = this.normalizeJid(jid);
    if (!normalized) return null;
    if (!isLidUser(normalized)) return normalized;

    const normalizedPreferredPn = this.normalizeJid(preferredPn);
    if (isPnUser(normalizedPreferredPn)) {
      this.lidToPn.set(normalized, normalizedPreferredPn);
      return normalizedPreferredPn;
    }

    const cached = this.lidToPn.get(normalized);
    if (cached) return cached;

    try {
      const pn = await this.sock?.signalRepository?.lidMapping?.getPNForLID(normalized);
      const normalizedPn = this.normalizeJid(pn);
      if (isPnUser(normalizedPn)) {
        this.lidToPn.set(normalized, normalizedPn);
        return normalizedPn;
      }
    } catch (error) {
      logger.debug({ sessionId: this.id, jid: normalized, error: (error as Error).message }, 'Failed to resolve LID to phone number');
    }

    return null;
  }

  private async numberFromJid(jid?: string | null, preferredPn?: string | null): Promise<string | null> {
    const phoneJid = await this.resolvePhoneJid(jid, preferredPn);
    if (!phoneJid || !isPnUser(phoneJid)) return null;
    return jidDecode(phoneJid)?.user ?? null;
  }

  private async profilePicUrlFromJid(jid?: string | null): Promise<string | null> {
    const normalized = this.normalizeJid(jid);
    if (!normalized || normalized.endsWith('@g.us')) return null;
    if (this.profilePicUrls.has(normalized)) return this.profilePicUrls.get(normalized) ?? null;

    try {
      const url = await this.sock?.profilePictureUrl(normalized, 'image');
      this.profilePicUrls.set(normalized, url || null);
      return url || null;
    } catch (error) {
      this.profilePicUrls.set(normalized, null);
      logger.debug({ sessionId: this.id, jid: normalized, error: (error as Error).message }, 'Failed to fetch profile picture');
      return null;
    }
  }

  private getMediaMessage(message?: Record<string, unknown>): { key: MediaMessageKey; content: MediaContent } | null {
    for (const mediaKey of MEDIA_MESSAGE_KEYS) {
      const content = message?.[mediaKey] as MediaContent | undefined;
      if (content) return { key: mediaKey, content };
    }
    return null;
  }

  private mediaDownloadType(mediaKey: MediaMessageKey): 'image' | 'video' | 'audio' | 'document' | 'sticker' {
    return mediaKey.replace('Message', '') as 'image' | 'video' | 'audio' | 'document' | 'sticker';
  }

  private extractMessageKey(rawData: unknown): ReadMessageKeyInput | null {
    if (!rawData || typeof rawData !== 'object') return null;
    const message = rawData as { key?: Partial<WAMessageKey> };
    const key = message.key;
    if (!key?.id || !key.remoteJid) return null;

    return {
      remoteJid: key.remoteJid,
      id: key.id,
      fromMe: !!key.fromMe,
      participant: key.participant || undefined,
    };
  }

  private async formatMessage(msg: WAMessage): Promise<object> {
    const key = msg.key;
    const m = msg.message as Record<string, unknown> | undefined;
    const isFromMe = !!key.fromMe;

    let body = '';
    let type = 'chat';
    let hasMedia = false;
    let media: Omit<DownloadedMedia, 'data'> | undefined;

    if (m) {
      const imageMessage = m.imageMessage as MediaContent | undefined;
      const videoMessage = m.videoMessage as MediaContent | undefined;
      const audioMessage = m.audioMessage as MediaContent | undefined;
      const documentMessage = m.documentMessage as MediaContent | undefined;

      if (typeof m.conversation === 'string') { body = m.conversation; type = 'chat'; }
      else if (m.extendedTextMessage) { body = ((m.extendedTextMessage as { text?: string }).text) || ''; type = 'chat'; }
      else if (imageMessage) { body = imageMessage.caption || ''; type = 'image'; hasMedia = true; }
      else if (videoMessage) { body = videoMessage.caption || ''; type = 'video'; hasMedia = true; }
      else if (audioMessage) { body = ''; type = 'audio'; hasMedia = true; }
      else if (documentMessage) { body = documentMessage.caption || ''; type = 'document'; hasMedia = true; }
      else if (m.stickerMessage) { body = ''; type = 'sticker'; hasMedia = true; }
      else if (m.locationMessage) { type = 'location'; hasMedia = true; }
      else if (m.reactionMessage) { body = ((m.reactionMessage as { text?: string }).text) || ''; type = 'reaction'; }
      else if (m.contactMessage) { type = 'contact'; }
      else { type = 'unknown'; }

      const mediaMessage = this.getMediaMessage(m);
      if (mediaMessage) {
        media = {
          mimetype: mediaMessage.content.mimetype || 'application/octet-stream',
          mimeType: mediaMessage.content.mimetype || 'application/octet-stream',
          filename: mediaMessage.content.fileName || undefined,
          caption: mediaMessage.content.caption || undefined,
        };
      }
    }

    let quotedMessage = null;
    const ctx = (m?.extendedTextMessage as { contextInfo?: { quotedMessage?: Record<string, unknown>; stanzaId?: string; participant?: string } } | undefined)?.contextInfo;
    if (ctx?.quotedMessage) {
      const qm = ctx.quotedMessage;
      quotedMessage = {
        id: ctx.stanzaId || '',
        from: ctx.participant || '',
        body: (qm.conversation as string | undefined) || (qm.extendedTextMessage as { text?: string } | undefined)?.text || '',
        type: 'chat',
        fromMe: ctx.participant === this.id,
        hasMedia: false,
      };
    }

    const senderJid = this.normalizeJid(key.participant || key.remoteJid);
    const receiverJid = this.normalizeJid(isFromMe ? key.remoteJid : (this.phone ? `${this.phone}@s.whatsapp.net` : ''));
    const keyWithAlt = key as typeof key & {
      remoteJidAlt?: string | null;
      participantAlt?: string | null;
      senderPn?: string | null;
    };
    const senderPreferredPn = key.participant
      ? keyWithAlt.participantAlt || keyWithAlt.senderPn
      : keyWithAlt.remoteJidAlt || keyWithAlt.senderPn;
    const receiverPreferredPn = isFromMe ? keyWithAlt.remoteJidAlt : null;
    const senderPhone = await this.numberFromJid(senderJid, senderPreferredPn);
    const receiverPhone = await this.numberFromJid(receiverJid, receiverPreferredPn);
    const [senderProfilePicUrl, receiverProfilePicUrl] = await Promise.all([
      this.profilePicUrlFromJid(senderJid),
      this.profilePicUrlFromJid(receiverJid),
    ]);

    return {
      id: key.id || '',
      from: senderJid,
      to: receiverJid,
      body,
      type,
      timestamp: new Date((msg.messageTimestamp as number || 0) * 1000).toISOString(),
      fromMe: isFromMe,
      hasMedia,
      media,
      hasQuotedMsg: !!quotedMessage,
      quotedMessage,
      isForwarded: false,
      key: {
        remoteJid: key.remoteJid,
        id: key.id,
        fromMe: isFromMe,
        participant: key.participant,
      },
      contacts: {
        sender: { id: senderJid, number: senderPhone, name: null, pushname: msg.pushName || null, shortName: null, profilePicUrl: senderProfilePicUrl, isBusiness: false, isEnterprise: false, isMe: isFromMe },
        receiver: { id: receiverJid, number: receiverPhone, name: null, pushname: null, shortName: null, profilePicUrl: receiverProfilePicUrl, isBusiness: false, isEnterprise: false, isMe: !isFromMe },
      },
    };
  }

  // ============================================================================
  // Reconnect Logic
  // ============================================================================

  private scheduleReconnect(): void {
    this.cancelReconnect();
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this.status = 'failed';
      this.emit('status', 'failed');
      this.emit('failed', { reason: 'Max reconnect attempts exceeded', lastError: this.lastError });
      return;
    }

    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts), RECONNECT_MAX_DELAY);
    this.nextReconnectAt = new Date(Date.now() + delay);
    this.status = 'reconnecting';

    logger.info({ sessionId: this.id, attempt: this.reconnectAttempts + 1, delay }, 'Scheduling reconnect');
    this.emit('status', 'reconnecting');
    this.emit('reconnecting', { attempt: this.reconnectAttempts + 1, maxAttempts: RECONNECT_MAX_ATTEMPTS, nextAttemptAt: this.nextReconnectAt.toISOString() });

    this.reconnectTimer = setTimeout(() => void this.reconnect(), delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.nextReconnectAt = null;
  }

  private async reconnect(): Promise<void> {
    if (this.isDestroyed || !this.autoReconnectEnabled) return;
    this.reconnectAttempts++;
    this.lastReconnectAttempt = new Date();
    this.nextReconnectAt = null;

    logger.info({ sessionId: this.id, attempt: this.reconnectAttempts }, 'Reconnecting...');

    try {
      this.closeSocket();
      await this.connect();
    } catch (err) {
      logger.error({ sessionId: this.id, error: (err as Error).message }, 'Reconnect failed');
      this.lastError = { code: 'RECONNECT_FAILED', message: (err as Error).message, timestamp: new Date().toISOString() };
      this.scheduleReconnect();
    }
  }

  // ============================================================================
  // Session Info
  // ============================================================================

  setAutoReconnect(enabled: boolean): void { this.autoReconnectEnabled = enabled; if (!enabled) this.cancelReconnect(); }
  isAutoReconnectEnabled(): boolean { return this.autoReconnectEnabled; }
  getQRCode(): string | null { return this.qrCode; }
  getStatus(): SessionState { return this.status; }

  getInfo(): SessionInfo {
    return {
      id: this.id, name: this.name, status: this.status,
      phone: this.phone, pushName: this.pushName,
      createdAt: this.createdAt.toISOString(), lastActivity: this.lastActivity?.toISOString() ?? null,
      lastError: this.lastError,
      reconnect: {
        enabled: this.autoReconnectEnabled, attempts: this.reconnectAttempts,
        maxAttempts: RECONNECT_MAX_ATTEMPTS,
        nextAttemptAt: this.nextReconnectAt?.toISOString() ?? null,
        lastAttemptAt: this.lastReconnectAttempt?.toISOString() ?? null,
      },
    };
  }

  // ============================================================================
  // Actions
  // ============================================================================

  async logout(): Promise<void> {
    if (this.sock) {
      try { await this.sock.logout(); } catch { /* ignore */ }
      this.closeSocket();
    }
    await this.clearAuthState('logout requested');
    this.lastError = null;
    this.autoReconnectEnabled = true;
    this.status = 'created';
    logger.info({ sessionId: this.id }, 'Logged out');
  }

  // ============================================================================
  // Messaging
  // ============================================================================

  private toJid(phone: string): string {
    if (phone.includes('@')) return phone;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
    return cleaned + '@s.whatsapp.net';
  }

  async sendMessage(to: string, text: string): Promise<{ id: { _serialized: string }; to: string }> {
    const jid = this.toJid(to);
    const result = await this.sock!.sendMessage(jid, { text });
    return { id: { _serialized: result?.key?.id || '' }, to: jid };
  }

  async sendImageBase64(to: string, base64Data: string, mimetype: string, caption?: string, fileName?: string): Promise<{ id: { _serialized: string }; to: string }> {
    const jid = this.toJid(to);
    const buf = Buffer.from(base64Data, 'base64');
    const result = await this.sock!.sendMessage(jid, { image: buf, caption, mimetype, fileName });
    return { id: { _serialized: result?.key?.id || '' }, to: jid };
  }

  async sendDocumentBase64(to: string, base64Data: string, mimetype: string, fileName: string, caption?: string): Promise<{ id: { _serialized: string }; to: string }> {
    const jid = this.toJid(to);
    const buf = Buffer.from(base64Data, 'base64');
    const result = await this.sock!.sendMessage(jid, { document: buf, mimetype, fileName, caption });
    return { id: { _serialized: result?.key?.id || '' }, to: jid };
  }

  async sendLocation(to: string, latitude: number, longitude: number, description?: string): Promise<{ id: { _serialized: string }; to: string }> {
    const jid = this.toJid(to);
    const result = await this.sock!.sendMessage(jid, {
      location: { degreesLatitude: latitude, degreesLongitude: longitude, name: description },
    });
    return { id: { _serialized: result?.key?.id || '' }, to: jid };
  }

  async replyToMessage(to: string, messageId: string, text: string): Promise<{ id: { _serialized: string }; to: string }> {
    const jid = this.toJid(to);
    const result = await this.sock!.sendMessage(jid, { text }, {
      quoted: { key: { id: messageId, remoteJid: jid, fromMe: false }, message: { conversation: '' } },
    });
    return { id: { _serialized: result?.key?.id || '' }, to: jid };
  }

  // ============================================================================
  // Chats & History
  // ============================================================================

  async getChatMessages(_phone: string, _limit = 50): Promise<object[]> { return []; }

  async getChats(): Promise<object[]> { return []; }

  async getGroups(): Promise<object[]> {
    if (!this.sock) return [];
    try {
      const groups = await this.sock.groupFetchAllParticipating();
      return Object.values(groups).map(g => ({
        id: g.id, name: g.subject,
        isGroup: true, isReadOnly: false, unreadCount: 0,
        timestamp: g.subjectTime ? new Date(g.subjectTime * 1000).toISOString() : null,
        participantCount: g.participants?.length || 0,
        participants: (g.participants || []).map(p => ({ id: p.id, isAdmin: p.admin !== undefined, isSuperAdmin: false })),
        lastMessage: null,
      }));
    } catch { return []; }
  }

  // ============================================================================
  // Chat States
  // ============================================================================

  async sendTyping(to: string, duration = 3000): Promise<void> {
    const jid = this.toJid(to);
    await this.sock?.sendPresenceUpdate('composing', jid);
    if (duration > 0) {
      setTimeout(() => { this.sock?.sendPresenceUpdate('available', jid).catch(() => {}); }, Math.min(duration, 25000));
    }
  }

  async sendRecording(to: string, duration = 3000): Promise<void> {
    const jid = this.toJid(to);
    await this.sock?.sendPresenceUpdate('recording', jid);
    if (duration > 0) {
      setTimeout(() => { this.sock?.sendPresenceUpdate('available', jid).catch(() => {}); }, Math.min(duration, 25000));
    }
  }

  async markAsRead(to: string, messageId?: string, participant?: string, fromMe = false): Promise<void> {
    if (!messageId) throw new Error('messageId is required to mark a chat as read');
    const jid = this.toJid(to);
    await this.readMessageKey({ remoteJid: jid, id: messageId, fromMe, participant });
  }

  async markMessageAsRead(messageId: string, rawData?: unknown): Promise<void> {
    const key = this.extractMessageKey(rawData);
    if (!key) throw new Error('Stored message key not found; provide chatId and messageId');
    if (key.id !== messageId) throw new Error('Stored message key does not match messageId');
    await this.readMessageKey(key);
  }

  async readMessageKey(key: ReadMessageKeyInput): Promise<void> {
    if (!key.remoteJid || !key.id) throw new Error('remoteJid and message id are required');
    await this.sock!.readMessages([{ remoteJid: key.remoteJid, id: key.id, fromMe: !!key.fromMe, participant: key.participant }]);
  }

  async downloadMedia(rawData: unknown): Promise<DownloadedMedia> {
    if (!rawData || typeof rawData !== 'object') throw new Error('Message data not found');

    const message = rawData as { message?: Record<string, unknown> };
    const mediaMessage = this.getMediaMessage(message.message);
    if (!mediaMessage) throw new Error('Message does not contain downloadable media');

    const stream = await downloadContentFromMessage(mediaMessage.content, this.mediaDownloadType(mediaMessage.key));
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    const mimetype = mediaMessage.content.mimetype || 'application/octet-stream';
    return {
      data: buffer.toString('base64'),
      mimetype,
      mimeType: mimetype,
      filename: mediaMessage.content.fileName || undefined,
      caption: mediaMessage.content.caption || undefined,
    };
  }
}
