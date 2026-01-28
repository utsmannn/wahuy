/**
 * Authentication middleware
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config.js';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing X-API-Key header'
      }
    });
    return;
  }

  // Check against configured API keys
  const validKeys = config.apiKeys.length > 0
    ? config.apiKeys
    : [config.apiKey];

  if (!validKeys.includes(apiKey)) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key'
      }
    });
    return;
  }
}
