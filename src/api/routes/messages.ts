/**
 * Message routes - Phase 5: Media messages + Message History
 */

import { FastifyInstance } from 'fastify';
import { sessionManager } from '../../core/SessionManager.js';
import { messageStorage, MessageQuery } from '../../storage/MessageStorage.js';
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

  // Send typing indicator
  server.post('/:sessionId/typing', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { to: string; duration?: number };

    const validation = validateSession(sessionId, reply);
    if (!validation.success || !validation.client) return validation;
    const client = validation.client;

    if (!body.to) {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required field: to'
        }
      };
    }

    try {
      const duration = body.duration ?? 3000;
      await client.sendTyping(body.to, duration);
      return {
        success: true,
        data: {
          to: body.to,
          duration,
          status: 'typing'
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ sessionId, error: err.message }, 'Failed to send typing indicator');
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'TYPING_FAILED',
          message: err.message
        }
      };
    }
  });

  // Send recording indicator
  server.post('/:sessionId/recording', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { to: string; duration?: number };

    const validation = validateSession(sessionId, reply);
    if (!validation.success || !validation.client) return validation;
    const client = validation.client;

    if (!body.to) {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required field: to'
        }
      };
    }

    try {
      const duration = body.duration ?? 3000;
      await client.sendRecording(body.to, duration);
      return {
        success: true,
        data: {
          to: body.to,
          duration,
          status: 'recording'
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ sessionId, error: err.message }, 'Failed to send recording indicator');
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'RECORDING_FAILED',
          message: err.message
        }
      };
    }
  });

  // Mark chat/message as read (send seen / blue checkmark)
  server.post('/:sessionId/read', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { chatId?: string; messageId?: string };

    const validation = validateSession(sessionId, reply);
    if (!validation.success || !validation.client) return validation;
    const client = validation.client;

    if (!body.chatId && !body.messageId) {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Provide either chatId or messageId'
        }
      };
    }

    try {
      if (body.messageId) {
        await client.markMessageAsRead(body.messageId);
      } else if (body.chatId) {
        await client.markAsRead(body.chatId);
      }
      return {
        success: true,
        data: {
          chatId: body.chatId,
          messageId: body.messageId,
          status: 'read'
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ sessionId, error: err.message }, 'Failed to mark as read');
      reply.status(500);
      return {
        success: false,
        error: {
          code: 'READ_FAILED',
          message: err.message
        }
      };
    }
  });

  // Get conversation messages from persistent storage
  // Returns all messages between a session and a phone number (both sent and received)
  server.get('/:sessionId/conversations/:phone', async (request) => {
    const { sessionId, phone } = request.params as { sessionId: string; phone: string };
    const query = request.query as { limit?: string; offset?: string };
    const limit = parseInt(query.limit || '100', 10);
    const offset = parseInt(query.offset || '0', 10);

    const messages = messageStorage.getConversation(sessionId, phone, limit, offset);
    const total = messageStorage.getConversationCount(sessionId, phone);

    return {
      success: true,
      data: {
        sessionId,
        phone,
        messages,
        count: messages.length,
        total,
        offset,
        limit,
      }
    };
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

  // Get message history from persistent storage
  server.get('/messages/history', async (request) => {
    const query = request.query as {
      sessionId?: string;
      from?: string;
      to?: string;
      type?: string;
      fromMe?: string;
      hasMedia?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };

    const messageQuery: MessageQuery = {
      sessionId: query.sessionId,
      from: query.from,
      to: query.to,
      type: query.type,
      fromMe: query.fromMe !== undefined ? query.fromMe === 'true' : undefined,
      hasMedia: query.hasMedia !== undefined ? query.hasMedia === 'true' : undefined,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      limit: query.limit ? parseInt(query.limit, 10) : 100,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };

    const messages = messageStorage.getMessages(messageQuery);
    const stats = messageStorage.getStats();

    return {
      success: true,
      data: {
        messages,
        count: messages.length,
        total: stats.total,
        offset: messageQuery.offset,
        limit: messageQuery.limit,
      }
    };
  });

  // Get message statistics
  server.get('/messages/stats', async () => {
    const stats = messageStorage.getStats();
    return {
      success: true,
      data: stats
    };
  });

  // Clear message history
  server.delete('/messages/history', async (request) => {
    const query = request.query as { sessionId?: string; olderThan?: string };

    let deleted = 0;
    if (query.sessionId) {
      deleted = messageStorage.deleteBySession(query.sessionId);
    } else if (query.olderThan) {
      deleted = messageStorage.deleteOlderThan(query.olderThan);
    } else {
      deleted = messageStorage.deleteAll();
    }

    return {
      success: true,
      data: {
        deleted,
        message: `Deleted ${deleted} messages`
      }
    };
  });
}
