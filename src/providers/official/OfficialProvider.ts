/**
 * Official Provider
 *
 * Proxies requests to WhatsApp Business Official API (Meta Graph API)
 */

import { Readable } from 'stream';
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '../../utils/logger.js';
import {
  type IWhatsAppProvider,
  type ProviderStatus,
  type SendMessageRequest,
  type SendMessageResponse,
  type UploadMediaResponse,
  type WahuyMessage,
  type MessageStatusUpdate,
  type OfficialWebhookPayload,
  type OfficialIncomingMessage,
  type OfficialMessageStatus,
  ProviderError,
  type OfficialProviderConfig
} from '../types.js';

export class OfficialProvider implements IWhatsAppProvider {
  readonly name = 'WhatsApp Business API (Official)';
  readonly version = '20.0';

  private config: OfficialProviderConfig;
  private status: ProviderStatus = 'connecting';

  constructor(config: OfficialProviderConfig) {
    this.config = config;
    this.validateConfig();
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  private validateConfig(): void {
    const required = ['baseUrl', 'accessToken', 'appSecret', 'phoneNumberId', 'webhookVerifyToken'];
    for (const key of required) {
      if (!(this.config as unknown as Record<string, string>)[key]) {
        throw new Error(`Missing required official provider config: ${key}`);
      }
    }
  }

  async initialize(): Promise<void> {
    // Validate credentials by fetching business profile
    try {
      await this.getBusinessProfile();
      this.status = 'ready';
      logger.info('Official provider initialized successfully');
    } catch (error) {
      this.status = 'error';
      logger.error({ error }, 'Failed to initialize official provider');
      throw error;
    }
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const url = `${this.config.baseUrl}/${this.config.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      throw this.transformError(data);
    }

    return data as SendMessageResponse;
  }

  // ============================================================================
  // Media Operations - STREAMING (No Buffering!)
  // ============================================================================

  /**
   * Upload media to Meta
   */
  async uploadMedia(fileStream: Readable, mimeType: string): Promise<UploadMediaResponse> {
    const url = `${this.config.baseUrl}/${this.config.phoneNumberId}/media`;

    // Convert stream to buffer for upload (Meta requires multipart/form-data)
    const chunks: Buffer[] = [];
    for await (const chunk of fileStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Create multipart form data
    const boundary = `----FormBoundary${Date.now()}`;
    const formData = this.createMultipartFormData(boundary, buffer, mimeType);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw this.transformError(data);
    }

    return { id: (data as { id?: string }).id || '' };
  }

  private createMultipartFormData(boundary: string, buffer: Buffer, mimeType: string): Buffer {
    const CRLF = '\r\n';
    const header = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="upload"${CRLF}` +
      `Content-Type: ${mimeType}${CRLF}${CRLF}`
    );
    const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);

    return Buffer.concat([header, buffer, footer]);
  }

  /**
   * Get media download URL from Meta
   */
  async getMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string }> {
    const url = `${this.config.baseUrl}/${mediaId}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw this.transformError(data);
    }

    const dataRecord = data as { url?: string; mime_type?: string };

    return {
      url: dataRecord.url || '',
      mimeType: dataRecord.mime_type || 'application/octet-stream',
    };
  }

  /**
   * STREAM media directly to client (NO BUFFERING!)
   *
   * This is the CRITICAL FIX from Gemini review - stream directly
   * instead of buffering to memory as base64
   */
  async downloadMedia(mediaId: string): Promise<Readable> {
    // Step 1: Get temporary download URL from Meta
    const { url: tempUrl } = await this.getMediaUrl(mediaId);

    // Step 2: Fetch binary from Meta's CDN
    const response = await fetch(tempUrl);

    if (!response.ok) {
      throw new ProviderError('DOWNLOAD_FAILED', `Failed to download media: ${response.statusText}`);
    }

    if (!response.body) {
      throw new ProviderError('DOWNLOAD_FAILED', 'No response body');
    }

    // Step 3: Return as Readable stream (no buffering!)
    // This pipes directly from Meta CDN → Client response
    return Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
  }

  // ============================================================================
  // Webhook Operations - With Signature Verification
  // ============================================================================

  /**
   * Verify webhook signature using HMAC-SHA256
   *
   * SECURITY FIX: This prevents webhook spoofing attacks
   */
  verifySignature(payload: string, signature: string): boolean {
    // Extract signature from header: sha256=<signature>
    const expectedSignature = signature.replace('sha256=', '');

    // Compute HMAC
    const computed = createHmac('sha256', this.config.appSecret)
      .update(payload, 'utf8')
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      return timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(computed, 'hex')
      );
    } catch {
      // Length mismatch or other error
      return false;
    }
  }

  /**
   * Handle webhook verification challenge from Meta
   */
  async verifyWebhook(mode: string, token: string, challenge: string): Promise<string | null> {
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
      logger.info('Webhook verification successful');
      return challenge;
    }
    logger.warn({ mode, tokenMatch: token === this.config.webhookVerifyToken }, 'Webhook verification failed');
    return null;
  }

  /**
   * Handle incoming webhook from Meta
   */
  async handleWebhook(payload: unknown): Promise<void> {
    const officialPayload = payload as OfficialWebhookPayload;

    if (officialPayload.object !== 'whatsapp_business_account') {
      logger.warn({ object: officialPayload.object }, 'Unknown webhook object type');
      return;
    }

    for (const entry of officialPayload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') {
          logger.debug({ field: change.field }, 'Ignoring non-message webhook field');
          continue;
        }

        const value = change.value;

        // Handle incoming messages
        if (value.messages) {
          for (const message of value.messages) {
            const transformed = this.transformIncomingMessage(message, value.metadata);
            this.emitMessageReceived(transformed);
          }
        }

        // Handle status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            const transformed = this.transformStatusUpdate(status);
            this.emitStatusUpdate(transformed);
          }
        }
      }
    }
  }

  // ============================================================================
  // Event Transformation
  // ============================================================================

  private transformIncomingMessage(message: OfficialIncomingMessage, metadata: { display_phone_number: string; phone_number_id: string }): WahuyMessage {
    // Extract body based on message type
    const body = this.extractMessageBody(message);

    // Transform media info
    let media: WahuyMessage['media'] = undefined;
    if (message.image || message.video || message.document || message.audio || message.voice) {
      const mediaObj = message.image || message.video || message.document || message.audio || message.voice;
      media = {
        id: mediaObj?.id,
        mimeType: mediaObj?.mime_type,
        caption: mediaObj?.caption,
        filename: mediaObj?.filename,
        // Note: URL not included - must be fetched on-demand (expires in 5 min)
      };
    }

    return {
      id: message.id,
      from: `${message.from}@c.us`,
      to: `${metadata.display_phone_number}@c.us`,
      body,
      type: message.type,
      timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
      fromMe: false,
      hasMedia: !!media,
      hasQuotedMsg: !!message.context,
      quotedMessage: message.context ? {
        id: message.context.id || '',
        from: message.context.from ? `${message.context.from}@c.us` : undefined,
      } : null,
      media,
      location: message.location,
      contacts: {
        sender: null, // Will be populated by event handler
        receiver: null,
      },
    };
  }

  private extractMessageBody(message: OfficialIncomingMessage): string {
    switch (message.type) {
      case 'text':
        return message.text?.body || '';
      case 'image':
        return message.image?.caption || '[Image]';
      case 'video':
        return message.video?.caption || '[Video]';
      case 'document':
        return message.document?.caption || `[Document: ${message.document?.filename || 'file'}]`;
      case 'audio':
        return '[Voice message]';
      case 'location':
        return `[Location: ${message.location?.name || `${message.location?.latitude}, ${message.location?.longitude}`}]`;
      case 'sticker':
        return '[Sticker]';
      default:
        return `[${message.type}]`;
    }
  }

  private transformStatusUpdate(status: OfficialMessageStatus): MessageStatusUpdate {
    const statusMap: Record<string, number> = {
      'sent': 1,
      'delivered': 2,
      'read': 3,
      'failed': 0,
      'deleted': 0,
    };

    return {
      id: status.id,
      status: statusMap[status.status] ?? 0,
      statusName: status.status,
      timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString(),
      recipientId: status.recipient_id,
      conversation: status.conversation ? {
        id: status.conversation.id,
        category: status.conversation.origin?.type,
      } : undefined,
    };
  }

  private emitMessageReceived(message: WahuyMessage): void {
    // This will be connected to the event system
    logger.debug({ messageId: message.id, from: message.from }, 'Message received from Meta');
    // Emit to event listeners (will be implemented in webhook handler)
  }

  private emitStatusUpdate(status: MessageStatusUpdate): void {
    logger.debug({ messageId: status.id, status: status.statusName }, 'Status update from Meta');
    // Emit to event listeners
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  getStatus(): ProviderStatus {
    return this.status;
  }

  async getBusinessProfile(): Promise<{ messaging_product: 'whatsapp'; about?: string; address?: string; description?: string; email?: string; profile_picture_url?: string; websites?: string[]; vertical?: string } & Record<string, unknown>> {
    const url = `${this.config.baseUrl}/${this.config.phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw this.transformError(data);
    }

    const dataRecord = data as Record<string, unknown>;

    return {
      messaging_product: 'whatsapp',
      ...dataRecord,
    };
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private transformError(metaError: unknown): ProviderError {
    const metaErr = metaError as { error?: { message: string; type: string; code: number; error_data?: { details: string }; fbtrace_id: string } };
    const error = metaErr.error;
    if (!error) {
      return new ProviderError('UNKNOWN_ERROR', 'Unknown error from Meta API');
    }

    // Map Meta error codes to Wahuy error codes
    const errorCodeMap: Record<number, string> = {
      130429: 'RATE_LIMIT_HIT',
      130472: 'RATE_LIMIT_HIT',
      132000: 'TEMPLATE_NOT_FOUND',
      132001: 'TEMPLATE_PARAM_INVALID',
      133000: 'INVALID_PHONE_NUMBER',
      133004: 'MESSAGE_TOO_OLD',
      133005: 'RECIPIENT_NOT_IN_WHATSAPP',
      133008: 'MEDIA_DOWNLOAD_ERROR',
      135000: 'MEDIA_UPLOAD_ERROR',
      136001: 'TEMPLATE_CATEGORY_INVALID',
    };

    return new ProviderError(
      errorCodeMap[error.code] || 'META_API_ERROR',
      error.message,
      error.code,
      error.fbtrace_id
    );
  }

  // ============================================================================
  // Template Management
  // ============================================================================

  async getTemplates(): Promise<unknown[]> {
    const url = `${this.config.baseUrl}/${this.config.businessAccountId || this.config.phoneNumberId}/message_templates`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw this.transformError(data);
    }

    const dataRecord = data as { data?: unknown[] };
    return dataRecord.data || [];
  }

  // ============================================================================
  // Shutdown
  // ============================================================================

  async shutdown(): Promise<void> {
    this.status = 'disconnected';
    logger.info('Official provider shut down');
  }
}
