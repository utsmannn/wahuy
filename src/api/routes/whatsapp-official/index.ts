/**
 * Official WhatsApp Business API Routes
 *
 * Mounts all /v1/* routes for Official API compatibility
 */

import { FastifyInstance } from 'fastify';
import { officialMessagesRoutes } from './messages.js';
import { officialMediaRoutes } from './media.js';
import { officialWebhooksRoutes } from './webhooks.js';
import { logger } from '../../../utils/logger.js';

export async function registerOfficialRoutes(server: FastifyInstance): Promise<void> {
  logger.info('Registering Official API routes');

  // Messages API - POST /v1/messages
  await server.register(officialMessagesRoutes, { prefix: '/messages' });

  // Media API - GET/POST /v1/media/:id
  await server.register(officialMediaRoutes, { prefix: '/media' });

  // Business Profile - GET /v1/business-profile
  // TODO: Implement business profile endpoints

  // Phone Numbers - GET /v1/phone-numbers
  // TODO: Implement phone number endpoints

  // Templates - GET/POST /v1/templates
  // TODO: Implement template endpoints

  // Webhooks - GET/POST /webhooks/whatsapp
  await server.register(officialWebhooksRoutes, { prefix: '/webhooks/whatsapp' });

  logger.info('Official API routes registered');
}
