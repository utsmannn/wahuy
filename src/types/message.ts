/**
 * Message types
 */

export type MessageType =
  | 'chat'
  | 'image'
  | 'video'
  | 'audio'
  | 'ptt'
  | 'document'
  | 'sticker'
  | 'location'
  | 'vcard'
  | 'buttons'
  | 'list';

export interface Message {
  id: string;
  from: string;
  to: string;
  body: string;
  type: MessageType;
  timestamp: string;
  fromMe: boolean;
  hasMedia: boolean;
  isForwarded: boolean;
  quotedMessage?: QuotedMessage;
  media?: MessageMedia;
}

export interface QuotedMessage {
  id: string;
  body: string;
  from: string;
}

export interface MessageMedia {
  mimetype: string;
  filename?: string;
  url?: string;
  data?: string; // base64
}

export interface SendMessageRequest {
  to: string;
  text: string;
}

export interface SendImageRequest {
  to: string;
  image: string; // URL or base64
  caption?: string;
}

export interface SendDocumentRequest {
  to: string;
  document: string; // URL or base64
  filename: string;
  caption?: string;
}

export interface SendLocationRequest {
  to: string;
  latitude: number;
  longitude: number;
  description?: string;
}

export interface SendContactRequest {
  to: string;
  contact: {
    name: string;
    phone: string;
  };
}

export interface ReplyMessageRequest {
  to: string;
  text: string;
  quotedMessageId: string;
}

export interface MessageResponse {
  success: boolean;
  data?: {
    messageId: string;
    to: string;
    status: 'sent' | 'pending' | 'failed';
    timestamp: string;
  };
  error?: {
    code: string;
    message: string;
  };
}
