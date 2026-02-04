/**
 * Unified Provider Types
 *
 * Abstraction layer for WhatsApp providers (Internal Web.js vs Official Meta API)
 */

import { Readable } from 'stream';

// ============================================================================
// Core Message Types (Official API Format)
// ============================================================================

export interface SendMessageRequest {
  messaging_product: 'whatsapp';
  recipient_type?: 'individual';
  to: string;
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'template' | 'interactive' | 'sticker' | 'location' | 'contacts';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  image?: {
    link?: string;
    caption?: string;
    filename?: string;
  };
  video?: {
    link?: string;
    caption?: string;
    filename?: string;
  };
  document?: {
    link?: string;
    caption?: string;
    filename?: string;
  };
  audio?: {
    link?: string;
    filename?: string;
  };
  sticker?: {
    link?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
      policy?: 'deterministic';
    };
    components?: TemplateComponent[];
  };
  interactive?: unknown;
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button';
  parameters?: TemplateParameter[];
  sub_type?: 'quick_reply' | 'url' | 'catalog';
  index?: number;
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'video' | 'document';
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
    day_of_week?: number;
    day_of_month?: number;
    year?: number;
    month?: number;
    hour?: number;
    minute?: number;
  };
  image?: {
    link: string;
  };
  video?: {
    link: string;
  };
  document?: {
    link: string;
    filename?: string;
  };
}

export interface SendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
    message_status?: 'accepted';
  }>;
}

// ============================================================================
// Media Types
// ============================================================================

export interface UploadMediaRequest {
  messaging_product: 'whatsapp';
  file: Readable | Buffer;
  type: 'image' | 'video' | 'document' | 'audio' | 'sticker';
}

export interface UploadMediaResponse {
  id: string;
}

export interface DownloadMediaResponse {
  stream: Readable;
  mimeType: string;
  filename?: string;
}

// ============================================================================
// Webhook Types (Official API Format)
// ============================================================================

export interface OfficialWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: OfficialIncomingMessage[];
        statuses?: OfficialMessageStatus[];
        errors?: OfficialError[];
      };
      field: 'messages' | 'message_template_status_update' | 'account_update' | 'account_review_update' | 'business_capability_update' | 'phone_number_name_update' | 'phone_number_quality_update';
    }>;
  }>;
}

export interface OfficialIncomingMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'location' | 'contacts' | 'interactive' | 'button' | 'order' | 'system' | 'unknown';
  // Text message
  text?: {
    body: string;
  };
  // Media messages
  image?: OfficialMedia;
  video?: OfficialMedia;
  document?: OfficialMedia;
  audio?: OfficialMedia;
  voice?: OfficialMedia;
  sticker?: OfficialMedia;
  // Other types
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: unknown[];
  interactive?: unknown;
  button?: {
    text: string;
    payload: string;
  };
  order?: unknown;
  system?: {
    body: string;
    identity?: string;
    wa_id?: string;
    type: 'user_changed_number' | 'user_identity_changed';
  };
  // Context for replies
  context?: {
    from?: string;
    id?: string;
    referred_product?: {
      catalog_id: string;
      product_retailer_id: string;
    };
  };
  // Reaction
  reaction?: {
    message_id: string;
    emoji: string;
  };
}

export interface OfficialMedia {
  id?: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string;
}

export interface OfficialMessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'deleted';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin?: {
      type: 'user_initiated' | 'business_initiated' | 'referral_conversion';
    };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: 'CBP';
    category: 'user_initiated' | 'business_initiated' | 'referral_conversion';
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: {
      details: string;
    };
  }>;
  biz_opaque_callback_data?: string;
}

export interface OfficialError {
  code: number;
  title: string;
  message?: string;
  error_data?: {
    details: string;
    messaging_product: 'whatsapp';
  };
}

// ============================================================================
// Unified Message Type (Internal Format)
// ============================================================================

export interface WahuyMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  type: string;
  timestamp: string;
  fromMe: boolean;
  hasMedia: boolean;
  hasQuotedMsg?: boolean;
  quotedMessage?: {
    id: string;
    from?: string;
    to?: string;
    body?: string;
    type?: string;
    timestamp?: string;
    fromMe?: boolean;
    hasMedia?: boolean;
  } | null;
  media?: {
    id?: string;
    url?: string;
    data?: string;
    mimeType?: string;
    filename?: string;
    caption?: string;
  };
  isForwarded?: boolean;
  isMentioningMe?: boolean;
  mentionedIds?: string[];
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: {
    sender: ContactInfo | null;
    receiver: ContactInfo | null;
  };
}

export interface ContactInfo {
  id: string;
  number: string | null;
  name: string | null;
  pushname: string | null;
  shortName: string | null;
  isBusiness: boolean;
  isEnterprise: boolean;
  isMe: boolean;
}

export interface MessageStatusUpdate {
  id: string;
  status: number;
  statusName: string;
  timestamp: string;
  recipientId: string;
  conversation?: {
    id?: string;
    category?: string;
  };
}

// ============================================================================
// Business Profile Types
// ============================================================================

export interface BusinessProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  messaging_product: 'whatsapp';
  profile_picture_url?: string;
  websites?: string[];
  vertical?: string;
}

// ============================================================================
// Provider Interface
// ============================================================================

export type ProviderStatus = 'ready' | 'connecting' | 'disconnected' | 'error' | 'limited';

export interface IWhatsAppProvider {
  // Provider identification
  readonly name: string;
  readonly version: string;

  // Message Operations
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  getMessageStatus?(messageId: string): Promise<MessageStatusUpdate | null>;

  // Media Operations
  uploadMedia?(file: Readable, mimeType: string): Promise<UploadMediaResponse>;
  downloadMedia(mediaId: string): Promise<Readable>;
  getMediaUrl?(mediaId: string): Promise<{ url: string; mimeType: string }>;

  // Webhook Operations
  handleWebhook(payload: unknown): Promise<void>;
  verifyWebhook(mode: string, token: string, challenge: string): Promise<string | null>;

  // Session Operations
  getStatus(): ProviderStatus;
  getBusinessProfile?(): Promise<BusinessProfile>;

  // Lifecycle
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}

// ============================================================================
// Error Types
// ============================================================================

export interface WahuyError {
  code: string;
  message: string;
  metaCode?: number;
  fbTraceId?: string;
  details?: unknown;
}

export class ProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public metaCode?: number,
    public fbTraceId?: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface OfficialProviderConfig {
  baseUrl: string;
  accessToken: string;
  appSecret: string;
  phoneNumberId: string;
  businessAccountId?: string;
  webhookVerifyToken: string;
  webhookPath: string;
  autoDownloadMedia: boolean;
  mediaCacheTtl: number;
  maxMediaSize: number;
  rateLimit: {
    messagesPerSecond: number;
    queueEnabled: boolean;
    queueMaxSize: number;
    queueProvider: 'memory' | 'redis';
  };
}

export interface InternalProviderConfig {
  storagePath: string;
  sessionPath?: string;
}
