/**
 * Official WhatsApp Business API Routes
 *
 * Mounts all /v1/* routes for Official API compatibility
 */

import { FastifyInstance } from 'fastify';
import { officialMessagesRoutes } from './messages.js';
import { officialMediaRoutes } from './media.js';
import { officialGroupRoutes } from './groups.js';
import { officialWebhooksRoutes } from './webhooks.js';
import { logger } from '../../../utils/logger.js';

export async function registerOfficialRoutes(server: FastifyInstance): Promise<void> {
  logger.info('Registering Official API routes');

  // Messages API - POST /v1/messages
  await server.register(officialMessagesRoutes, { prefix: '/messages' });

  // Media API - GET/POST /v1/media/:id
  await server.register(officialMediaRoutes, { prefix: '/media' });

  // Groups API - /v1/groups (Cloud API v19.0+)
  await server.register(officialGroupRoutes, { prefix: '/groups' });

  logger.info('Official API routes registered');
}

/**
 * Register webhook routes SEPARATELY (no auth middleware).
 * Meta sends webhooks without X-API-Key — it uses X-Hub-Signature-256 instead.
 */
export async function registerOfficialWebhookRoutes(server: FastifyInstance): Promise<void> {
  await server.register(officialWebhooksRoutes, { prefix: '/webhooks/whatsapp' });
}
