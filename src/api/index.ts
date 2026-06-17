/**
 * API route registration
 */

import { FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health.js';
import { catalogImageRoutes } from './routes/catalog-images.js';
import { sessionRoutes } from './routes/sessions.js';
import { messageRoutes } from './routes/messages.js';
import { webhookRoutes } from './routes/webhooks.js';
import { registerOfficialRoutes, registerOfficialWebhookRoutes } from './routes/whatsapp-official/index.js';
import { providerRoutes } from './routes/provider.js';
import { authMiddleware } from './middleware/auth.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export async function registerRoutes(server: FastifyInstance): Promise<void> {
  // Health check (no auth required)
  await server.register(healthRoutes, { prefix: '/api' });

  // Signed catalog image proxy (no API key header required for <img src>)
  await server.register(catalogImageRoutes, { prefix: '/api' });

  // Protected routes
  await server.register(async (protectedServer) => {
    // Add auth middleware
    protectedServer.addHook('preHandler', authMiddleware);

    // Register protected routes
    await protectedServer.register(sessionRoutes, { prefix: '/sessions' });
    await protectedServer.register(messageRoutes, { prefix: '/sessions' });
    await protectedServer.register(webhookRoutes, { prefix: '/webhooks' });
    await protectedServer.register(providerRoutes, { prefix: '/provider' });
  }, { prefix: '/api' });

  // Official API routes (auth protected)
  await server.register(async (officialServer) => {
    officialServer.addHook('preHandler', authMiddleware);
    await registerOfficialRoutes(officialServer);
  }, { prefix: '/v1' });

  // Official API webhooks (NO auth — Meta uses X-Hub-Signature-256, not X-API-Key)
  await registerOfficialWebhookRoutes(server);

  logger.info({ provider: config.provider }, 'Routes registered');
}

// Re-export core modules for routes
export { sessionManager } from '../core/SessionManager.js';
export { webhookDispatcher } from '../core/WebhookDispatcher.js';
