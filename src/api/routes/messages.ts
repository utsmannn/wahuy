/**
 * Message routes
 */

import { FastifyInstance } from 'fastify';
import { sessionManager } from '../../core/SessionManager.js';

export async function messageRoutes(server: FastifyInstance): Promise<void> {
  // Send text message
  server.post('/:sessionId/messages/send', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { to: string; text: string };

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
  server.post('/:sessionId/messages/send-image', async (_request, reply) => {
    reply.status(501);
    return {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Image sending will be available in Phase 5'
      }
    };
  });

  // Send document - Phase 5
  server.post('/:sessionId/messages/send-document', async (_request, reply) => {
    reply.status(501);
    return {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Document sending will be available in Phase 5'
      }
    };
  });

  // Send location - Phase 5
  server.post('/:sessionId/messages/send-location', async (_request, reply) => {
    reply.status(501);
    return {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Location sending will be available in Phase 5'
      }
    };
  });

  // Reply to message - Phase 5
  server.post('/:sessionId/messages/reply', async (_request, reply) => {
    reply.status(501);
    return {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Reply feature will be available in Phase 5'
      }
    };
  });

  // Get chat messages - Phase 5
  server.get('/:sessionId/chats/:phone/messages', async (_request, reply) => {
    reply.status(501);
    return {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Chat history will be available in Phase 5'
      }
    };
  });
}
