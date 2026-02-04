/**
 * Official API - Messages Routes
 *
 * POST /v1/messages - Send messages
 * Mirrors Meta's WhatsApp Business API
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getProvider } from '../../../providers/index.js';
import type { SendMessageRequest } from '../../../providers/types.js';

// Extend FastifyRequest to include auth
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: string;
  }
}

export async function officialMessagesRoutes(server: FastifyInstance): Promise<void> {
  // POST /v1/messages - Send a message
  server.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const provider = getProvider();
      const body = request.body as SendMessageRequest;

      // Validate request
      if (!body.messaging_product || body.messaging_product !== 'whatsapp') {
        reply.status(400);
        return {
          error: {
            message: 'Invalid messaging_product. Must be "whatsapp".',
            type: 'InvalidParameterException',
            code: 100,
          }
        };
      }

      if (!body.to) {
        reply.status(400);
        return {
          error: {
            message: 'Missing required parameter: to',
            type: 'InvalidParameterException',
            code: 100,
          }
        };
      }

      if (!body.type) {
        reply.status(400);
        return {
          error: {
            message: 'Missing required parameter: type',
            type: 'InvalidParameterException',
            code: 100,
          }
        };
      }

      // Send via provider
      const result = await provider.sendMessage(body);

      reply.status(200);
      return result;
    } catch (error) {
      const err = error as Error;
      const providerErr = error as { code?: string; metaCode?: number; fbTraceId?: string };

      logger.error({ error: err, body: request.body }, 'Failed to send message');

      reply.status(500);
      return {
        error: {
          message: err.message,
          type: providerErr.code || 'APIException',
          code: providerErr.metaCode || 0,
          error_data: {
            details: err.message,
            messaging_product: 'whatsapp',
          },
          fbtrace_id: providerErr.fbTraceId,
        }
      };
    }
  });
}

// Need to import logger
import { logger } from '../../../utils/logger.js';
