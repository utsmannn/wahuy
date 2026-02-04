/**
 * API route registration
 */

import { FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health.js';
import { sessionRoutes } from './routes/sessions.js';
import { messageRoutes } from './routes/messages.js';
import { webhookRoutes } from './routes/webhooks.js';
import { registerOfficialRoutes } from './routes/whatsapp-official/index.js';
import { authMiddleware } from './middleware/auth.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export async function registerRoutes(server: FastifyInstance): Promise<void> {
  // Health check (no auth required)
  await server.register(healthRoutes, { prefix: '/api' });

  // Protected routes
  await server.register(async (protectedServer) => {
    // Add auth middleware
    protectedServer.addHook('preHandler', authMiddleware);

    // Register protected routes
    await protectedServer.register(sessionRoutes, { prefix: '/sessions' });
    await protectedServer.register(messageRoutes, { prefix: '/sessions' });
    await protectedServer.register(webhookRoutes, { prefix: '/webhooks' });
  }, { prefix: '/api' });

  // Official API routes (for both internal and official providers)
  // These use Official API format for forward compatibility
  await server.register(async (officialServer) => {
    // Auth middleware for official routes
    officialServer.addHook('preHandler', authMiddleware);

    // Register official API routes
    await registerOfficialRoutes(officialServer);
  }, { prefix: '/v1' });

  logger.info({ provider: config.provider }, 'Routes registered');
}

// Re-export core modules for routes
export { sessionManager } from '../core/SessionManager.js';
export { webhookDispatcher } from '../core/WebhookDispatcher.js';
