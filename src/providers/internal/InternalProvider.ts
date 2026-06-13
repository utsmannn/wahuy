/**
 * Internal Provider — Baileys
 *
 * Wraps Baileys-based SessionManager to conform to the Official API interface.
 */

import { Readable } from 'stream';
import { createWriteStream, createReadStream, promises as fs } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { nanoid } from 'nanoid';
import { logger } from '../../utils/logger.js';
import { sessionManager } from '../../core/SessionManager.js';
import {
  type IWhatsAppProvider,
  type ProviderStatus,
  type SendMessageRequest,
  type SendMessageResponse,
  type UploadMediaResponse,
  ProviderError,
  type InternalProviderConfig
} from '../types.js';

interface LocalMedia { id: string; path: string; mimeType: string; filename?: string; createdAt: Date; }

export class InternalProvider implements IWhatsAppProvider {
  readonly name = 'WhatsApp Baileys (Internal)';
  readonly version = '2.0.0';

  private mediaStorage: Map<string, LocalMedia> = new Map();
  private mediaStoragePath: string;

  constructor(config: InternalProviderConfig) {
    void config;
    this.mediaStoragePath = path.join(config.storagePath, 'media');
    this.ensureMediaDirectory();
  }

  private async ensureMediaDirectory(): Promise<void> {
    try { await fs.mkdir(this.mediaStoragePath, { recursive: true }); } catch {}
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const sessions = sessionManager.listSessions();
    const activeSession = sessions.find(s => s.status === 'ready');
    if (!activeSession) throw new ProviderError('NO_ACTIVE_SESSION', 'No active WhatsApp session available.');

    const client = sessionManager.getSession(activeSession.id);
    if (!client) throw new ProviderError('SESSION_NOT_FOUND', 'Session not found');

    try {
      let result: { id: { _serialized: string }; to: string };

      switch (request.type) {
        case 'text':
          result = await client.sendMessage(request.to, request.text?.body || '');
          break;

        case 'template':
          result = await client.sendMessage(request.to, this.templateToText(request));
          break;

        case 'image':
          if (!request.image?.link) throw new ProviderError('INVALID_MEDIA', 'Image link required');
          result = await this.sendMediaFromUrl(client, request.to, request.image.link, 'image', request.image.caption);
          break;

        case 'document':
          if (!request.document?.link) throw new ProviderError('INVALID_MEDIA', 'Document link required');
          result = await this.sendMediaFromUrl(client, request.to, request.document.link, 'document', request.document.caption, request.document.filename);
          break;

        case 'video':
          if (!request.video?.link) throw new ProviderError('INVALID_MEDIA', 'Video link required');
          result = await this.sendMediaFromUrl(client, request.to, request.video.link, 'video', request.video.caption);
          break;

        case 'audio':
          if (!request.audio?.link) throw new ProviderError('INVALID_MEDIA', 'Audio link required');
          result = await this.sendMediaFromUrl(client, request.to, request.audio.link, 'audio');
          break;

        case 'location':
          if (!request.location) throw new ProviderError('INVALID_LOCATION', 'Location data required');
          result = await client.sendLocation(request.to, request.location.latitude, request.location.longitude, request.location.name);
          break;

        default:
          throw new ProviderError('UNSUPPORTED_TYPE', `Type '${request.type}' not supported in internal mode`);
      }

      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: request.to, wa_id: request.to.replace(/\D/g, '') }],
        messages: [{ id: result.id._serialized || `internal_${nanoid()}`, message_status: 'accepted' }],
      };
    } catch (error) {
      const err = error as Error;
      if (err instanceof ProviderError) throw err;
      logger.error({ error: err.message, to: request.to, type: request.type }, 'Failed to send message');
      throw new ProviderError('SEND_FAILED', err.message);
    }
  }

  private templateToText(request: SendMessageRequest): string {
    if (!request.template) return '';
    const body = request.template.components?.find(c => c.type === 'body');
    if (body?.parameters) return body.parameters.filter(p => p.type === 'text').map(p => p.text).join(' ');
    return `[Template: ${request.template.name}]`;
  }

  private async sendMediaFromUrl(
    client: ReturnType<typeof sessionManager.getSession>,
    to: string,
    url: string,
    mediaType: string,
    caption?: string,
    filename?: string
  ): Promise<{ id: { _serialized: string }; to: string }> {
    if (!client) throw new ProviderError('SESSION_NOT_FOUND', 'Session not found');

    // Download from URL
    const response = await fetch(url);
    if (!response.ok) throw new ProviderError('DOWNLOAD_FAILED', `Failed to download media: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mime = response.headers.get('content-type') || (mediaType === 'image' ? 'image/jpeg' : 'application/octet-stream');

    if (mediaType === 'image' || mediaType === 'video') {
      return client.sendImageBase64(to, base64, mime, caption, filename);
    } else if (mediaType === 'document') {
      return client.sendDocumentBase64(to, base64, mime, filename || 'file', caption);
    } else {
      return client.sendMessage(to, '[Media]');
    }
  }

  // ============================================================================
  // Media Operations
  // ============================================================================

  async uploadMedia(fileStream: Readable, mimeType: string): Promise<UploadMediaResponse> {
    const mediaId = `internal_${nanoid(20)}`;
    const ext = this.getExtensionByMime(mimeType);
    const filePath = path.join(this.mediaStoragePath, `${mediaId}.${ext}`);
    try {
      await pipeline(fileStream, createWriteStream(filePath));
      this.mediaStorage.set(mediaId, { id: mediaId, path: filePath, mimeType, filename: `${mediaId}.${ext}`, createdAt: new Date() });
      return { id: mediaId };
    } catch (err) {
      throw new ProviderError('UPLOAD_FAILED', 'Failed to save media file');
    }
  }

  async downloadMedia(mediaId: string): Promise<Readable> {
    const media = this.mediaStorage.get(mediaId);
    if (!media) throw new ProviderError('MEDIA_NOT_FOUND', `Media ${mediaId} not found`);
    try { await fs.access(media.path); } catch { throw new ProviderError('MEDIA_NOT_FOUND', 'File no longer exists'); }
    return createReadStream(media.path);
  }

  async getMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }> {
    const media = this.mediaStorage.get(mediaId);
    if (!media) throw new ProviderError('MEDIA_NOT_FOUND', `Media ${mediaId} not found`);
    return { url: `/media/${mediaId}`, mimeType: media.mimeType };
  }

  private getExtensionByMime(m: string): string {
    const map: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'application/pdf': 'pdf' };
    return map[m] || 'bin';
  }

  // ============================================================================
  // Webhook & Status
  // ============================================================================

  async handleWebhook(_payload: unknown): Promise<void> { logger.debug('Internal provider webhook ignored'); }
  async verifyWebhook(_mode: string, _token: string, _challenge: string): Promise<string | null> { return null; }

  getStatus(): ProviderStatus {
    const sessions = sessionManager.listSessions();
    return sessions.some(s => s.status === 'ready') ? 'ready' : sessions.some(s => s.status === 'connecting' || s.status === 'starting') ? 'connecting' : 'disconnected';
  }

  async getBusinessProfile(): Promise<{ messaging_product: 'whatsapp'; about?: string }> {
    const sessions = sessionManager.listSessions();
    const active = sessions.find(s => s.status === 'ready');
    if (!active) throw new ProviderError('NO_ACTIVE_SESSION', 'No active session');
    return { messaging_product: 'whatsapp', about: active.pushName || undefined };
  }

  async cleanupOldMedia(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];
    for (const [id, media] of this.mediaStorage) if (now - media.createdAt.getTime() > maxAgeMs) toDelete.push(id);
    for (const id of toDelete) {
      try { const m = this.mediaStorage.get(id); if (m) { await fs.unlink(m.path); this.mediaStorage.delete(id); } } catch {}
    }
    logger.info({ deleted: toDelete.length }, 'Media cleanup done');
  }
}
