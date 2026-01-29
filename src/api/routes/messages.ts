/**
 * Message routes - Phase 5: Media messages
 */

import { FastifyInstance } from 'fastify';
import { sessionManager } from '../../core/SessionManager.js';
import { logger } from '../../utils/logger.js';

// Helper to validate session
function validateSession(sessionId: string, reply: any) {
  const client = sessionManager.getSession(sessionId);

  if (!client) {
    reply.status(404);
    return {
      success: false,
      error: {
        code: 'SESSION_NOT_FOUND',
        message: `Session '${sessionId}' not found`
      }
    };
  }

  if (client.getStatus() !== 'ready') {
    reply.status(400);
    return {
      success: false,
      error: {
        code: 'SESSION_NOT_READY',
        message: 'Session is not ready to send messages'
      }
    };
  }

  return { success: true, client };
}

export async function messageRoutes(server: FastifyInstance): Promise<void> {
  // Send text message
  server.post('/:sessionId/messages/send', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { to: string; text: string };

    const validation = validateSession(sessionId, reply);
    if (!validation.success || !validation.client) return validation;
    const client = validation.client;

    if (!body.to || !body.text) {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: to, text'
        }
      };
    }

    try {
      const msg = await client.sendMessage(body.to, body.text);
      return {
        success: true,
        data: {
          messageId: msg.id._serialized,
          to: msg.to,
          status: 'sent',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ sessionId, error: err.message }, 'Failed to send message');
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'MESSAGE_FAILED',
          message: err.message
        }
      };
    }
  });

  // Send image - Phase 5
  server.post('/:sessionId/messages/send-image', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as {
      to: string;
      base64Data: string;
      mimeType: string;
      caption?: string;
      filename?: string;
    };

    const validation = validateSession(sessionId, reply);
    if (!validation.success || !validation.client) return validation;
    const client = validation.client;

    if (!body.to || !body.base64Data || !body.mimeType) {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: to, base64Data, mimeType'
        }
      };
    }

    try {
      const msg = await client.sendImageBase64(
        body.to,
        body.base64Data,
        body.mimeType,
        body.caption,
        body.filename
      );
      return {
        success: true,
        data: {
          messageId: msg.id._serialized,
          to: msg.to,
          status: 'sent',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ sessionId, error: err.message }, 'Failed to send image');
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'IMAGE_SEND_FAILED',
          message: err.message
        }
      };
    }
  });

  // Send document - Phase 5
  server.post('/:sessionId/messages/send-document', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as {
      to: string;
      base64Data: string;
      mimeType: string;
      filename: string;
      caption?: string;
    };

    const validation = validateSession(sessionId, reply);
    if (!validation.success || !validation.client) return validation;
    const client = validation.client;

    if (!body.to || !body.base64Data || !body.mimeType || !body.filename) {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: to, base64Data, mimeType, filename'
        }
      };
    }

    try {
      const msg = await client.sendDocumentBase64(
        body.to,
        body.base64Data,
        body.mimeType,
        body.filename,
        body.caption
      );
      return {
        success: true,
        data: {
          messageId: msg.id._serialized,
          to: msg.to,
          status: 'sent',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ sessionId, error: err.message }, 'Failed to send document');
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'DOCUMENT_SEND_FAILED',
          message: err.message
        }
      };
    }
  });

  // Send location - Phase 5
  server.post('/:sessionId/messages/send-location', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as {
      to: string;
      latitude: number;
      longitude: number;
      description?: string;
    };

    const validation = validateSession(sessionId, reply);
    if (!validation.success || !validation.client) return validation;
    const client = validation.client;

    if (!body.to || body.latitude == null || body.longitude == null) {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: to, latitude, longitude'
        }
      };
    }

    try {
      const msg = await client.sendLocation(
        body.to,
        body.latitude,
        body.longitude,
        body.description
      );
      return {
        success: true,
        data: {
          messageId: msg.id._serialized,
          to: msg.to,
          status: 'sent',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ sessionId, error: err.message }, 'Failed to send location');
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'LOCATION_SEND_FAILED',
          message: err.message
        }
      };
    }
  });

  // Reply to message - Phase 5
  server.post('/:sessionId/messages/reply', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as {
      to: string;
      messageId: string;
      text: string;
    };

    const validation = validateSession(sessionId, reply);
    if (!validation.success || !validation.client) return validation;
    const client = validation.client;

    if (!body.to || !body.messageId || !body.text) {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: to, messageId, text'
        }
      };
    }

    try {
      const msg = await client.replyToMessage(body.to, body.messageId, body.text);
      return {
        success: true,
        data: {
          messageId: msg.id._serialized,
          to: msg.to,
          status: 'sent',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ sessionId, error: err.message }, 'Failed to reply to message');
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'REPLY_FAILED',
          message: err.message
        }
      };
    }
  });

  // Get chat messages - Phase 5
  server.get('/:sessionId/chats/:phone/messages', async (request, reply) => {
    const { sessionId, phone } = request.params as { sessionId: string; phone: string };
    const query = request.query as { limit?: string };
    const limit = parseInt(query.limit || '50', 10);

    const validation = validateSession(sessionId, reply);
    if (!validation.success || !validation.client) return validation;
    const client = validation.client;

    try {
      const messages = await client.getChatMessages(phone, limit);
      return {
        success: true,
        data: {
          phone,
          messages,
          count: messages.length
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ sessionId, phone, error: err.message }, 'Failed to get chat messages');
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'CHAT_HISTORY_FAILED',
          message: err.message
        }
      };
    }
  });
}
