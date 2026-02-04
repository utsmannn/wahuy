/**
 * Internal Provider
 *
 * Wraps WhatsApp Web.js to conform to the Official API interface.
 * This allows Internal Mode to accept requests in Official API format.
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

interface LocalMedia {
  id: string;
  path: string;
  mimeType: string;
  filename?: string;
  createdAt: Date;
}

export class InternalProvider implements IWhatsAppProvider {
  readonly name = 'WhatsApp Web.js (Internal)';
  readonly version = '1.0.0';

  private mediaStorage: Map<string, LocalMedia> = new Map();
  private mediaStoragePath: string;

  constructor(config: InternalProviderConfig) {
    // Store config for potential future use (cleanup intervals, etc)
    void config; // Currently unused but reserved for future features
    this.mediaStoragePath = path.join(config.storagePath, 'media');
    this.ensureMediaDirectory();
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  private async ensureMediaDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.mediaStoragePath, { recursive: true });
    } catch (err) {
      logger.error({ error: err }, 'Failed to create media storage directory');
    }
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    // Get the first active session
    const sessions = sessionManager.listSessions();
    const activeSession = sessions.find(s => s.status === 'ready');

    if (!activeSession) {
      throw new ProviderError(
        'NO_ACTIVE_SESSION',
        'No active WhatsApp session available. Please create and authenticate a session first.'
      );
    }

    const client = sessionManager.getSession(activeSession.id);
    if (!client) {
      throw new ProviderError('SESSION_NOT_FOUND', 'Session not found');
    }

    try {
      let result: unknown;

      // Transform Official API format to Web.js format
      switch (request.type) {
        case 'text':
          result = await client.sendMessage(request.to, request.text?.body || '');
          break;

        case 'template':
          // Template shim: unwrap template to text for Web.js
          result = await this.sendTemplateAsText(client, request);
          break;

        case 'image':
          if (request.image?.link) {
            result = await client.sendImage(request.to, request.image.link, request.image.caption);
          } else {
            throw new ProviderError('INVALID_MEDIA', 'Image link is required for internal provider');
          }
          break;

        case 'document':
          if (request.document?.link) {
            result = await client.sendDocument(
              request.to,
              request.document.link,
              request.document.caption,
              request.document.filename
            );
          } else {
            throw new ProviderError('INVALID_MEDIA', 'Document link is required for internal provider');
          }
          break;

        case 'video':
          if (request.video?.link) {
            result = await client.sendMessage(request.to, request.video.link);
          } else {
            throw new ProviderError('INVALID_MEDIA', 'Video link is required for internal provider');
          }
          break;

        case 'audio':
          if (request.audio?.link) {
            result = await client.sendMessage(request.to, request.audio.link);
          } else {
            throw new ProviderError('INVALID_MEDIA', 'Audio link is required for internal provider');
          }
          break;

        case 'location':
          if (request.location) {
            result = await client.sendLocation(
              request.to,
              request.location.latitude,
              request.location.longitude,
              request.location.name
            );
          } else {
            throw new ProviderError('INVALID_LOCATION', 'Location data is required');
          }
          break;

        default:
          throw new ProviderError(
            'UNSUPPORTED_TYPE',
            `Message type '${request.type}' is not supported in internal mode`
          );
      }

      // Transform Web.js result to Official API format
      const messageId = this.extractMessageId(result);

      return {
        messaging_product: 'whatsapp',
        contacts: [{
          input: request.to,
          wa_id: request.to.replace(/\D/g, '')
        }],
        messages: [{
          id: messageId || `internal_${nanoid()}`,
          message_status: 'accepted'
        }]
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err, to: request.to, type: request.type }, 'Failed to send message');
      throw new ProviderError('SEND_FAILED', err.message);
    }
  }

  /**
   * Template shim: Convert template to text message for Web.js
   */
  private async sendTemplateAsText(client: any, request: SendMessageRequest): Promise<unknown> {
    const template = request.template;
    if (!template) {
      throw new ProviderError('INVALID_TEMPLATE', 'Template data is required');
    }

    // Extract body text from template
    let bodyText = '';
    if (template.components) {
      const bodyComponent = template.components.find(c => c.type === 'body');
      if (bodyComponent?.parameters) {
        // Join all text parameters
        bodyText = bodyComponent.parameters
          .filter(p => p.type === 'text')
          .map(p => p.text)
          .join(' ');
      }
    }

    // If no body text, use template name
    if (!bodyText) {
      bodyText = `[Template: ${template.name}]`;
    }

    logger.debug({ templateName: template.name, bodyText }, 'Sending template as text (shim)');

    return client.sendMessage(request.to, bodyText);
  }

  private extractMessageId(result: unknown): string {
    if (result && typeof result === 'object') {
      const msg = result as { id?: { _serialized?: string }; _data?: { id?: { _serialized?: string } } };
      return msg.id?._serialized || msg._data?.id?._serialized || '';
    }
    return '';
  }

  // ============================================================================
  // Media Operations
  // ============================================================================

  /**
   * Mock media upload for API compatibility
   * In internal mode, we store files locally and return a mock ID
   */
  async uploadMedia(fileStream: Readable, mimeType: string): Promise<UploadMediaResponse> {
    const mediaId = `internal_${nanoid(20)}`;
    const extension = this.getExtensionFromMimeType(mimeType);
    const filename = `${mediaId}.${extension}`;
    const filePath = path.join(this.mediaStoragePath, filename);

    try {
      // Save file to local storage
      await pipeline(fileStream, createWriteStream(filePath));

      // Store metadata
      this.mediaStorage.set(mediaId, {
        id: mediaId,
        path: filePath,
        mimeType,
        filename,
        createdAt: new Date()
      });

      logger.debug({ mediaId, mimeType, path: filePath }, 'Media uploaded (internal)');

      return { id: mediaId };
    } catch (error) {
      logger.error({ error, mediaId }, 'Failed to upload media');
      throw new ProviderError('UPLOAD_FAILED', 'Failed to save media file');
    }
  }

  async downloadMedia(mediaId: string): Promise<Readable> {
    const media = this.mediaStorage.get(mediaId);

    if (!media) {
      throw new ProviderError('MEDIA_NOT_FOUND', `Media with ID ${mediaId} not found`);
    }

    try {
      await fs.access(media.path);
    } catch {
      throw new ProviderError('MEDIA_NOT_FOUND', 'Media file no longer exists');
    }

    return createReadStream(media.path);
  }

  async getMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }> {
    const media = this.mediaStorage.get(mediaId);

    if (!media) {
      throw new ProviderError('MEDIA_NOT_FOUND', `Media with ID ${mediaId} not found`);
    }

    // For internal mode, return a local file path as URL
    // This will be handled by a local file serving endpoint
    return {
      url: `/media/${mediaId}`,
      mimeType: media.mimeType
    };
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
    };
    return map[mimeType] || 'bin';
  }

  // ============================================================================
  // Webhook Operations
  // ============================================================================

  async handleWebhook(_payload: unknown): Promise<void> {
    // Internal provider doesn't receive external webhooks
    // Events are handled internally via EventEmitter
    logger.debug('Internal provider received webhook (ignored)');
  }

  async verifyWebhook(_mode: string, _token: string, _challenge: string): Promise<string | null> {
    // Internal provider doesn't use webhook verification
    // Return null to indicate no verification needed
    return null;
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  getStatus(): ProviderStatus {
    const sessions = sessionManager.listSessions();
    const hasReady = sessions.some(s => s.status === 'ready');
    const hasConnecting = sessions.some(s => s.status === 'connecting' || s.status === 'starting');

    if (hasReady) return 'ready';
    if (hasConnecting) return 'connecting';
    return 'disconnected';
  }

  async getBusinessProfile(): Promise<{ messaging_product: 'whatsapp'; about?: string; profile_picture_url?: string }> {
    const sessions = sessionManager.listSessions();
    const activeSession = sessions.find(s => s.status === 'ready');

    if (!activeSession) {
      throw new ProviderError('NO_ACTIVE_SESSION', 'No active session to get profile');
    }

    return {
      messaging_product: 'whatsapp',
      about: activeSession.pushName || undefined,
      profile_picture_url: undefined
    };
  }

  // ============================================================================
  // Media Cleanup
  // ============================================================================

  async cleanupOldMedia(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, media] of this.mediaStorage.entries()) {
      if (now - media.createdAt.getTime() > maxAgeMs) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      const media = this.mediaStorage.get(id);
      if (media) {
        try {
          await fs.unlink(media.path);
          this.mediaStorage.delete(id);
          logger.debug({ mediaId: id }, 'Cleaned up old media');
        } catch (error) {
          logger.warn({ error, mediaId: id }, 'Failed to clean up media');
        }
      }
    }

    logger.info({ deleted: toDelete.length }, 'Media cleanup completed');
  }
}
