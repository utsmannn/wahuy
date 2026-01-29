/**
 * API route registration
 */

import { FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health.js';
import { sessionRoutes } from './routes/sessions.js';
import { messageRoutes } from './routes/messages.js';
import { webhookRoutes } from './routes/webhooks.js';
import { authMiddleware } from './middleware/auth.js';

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
}

// Re-export core modules for routes
export { sessionManager } from '../core/SessionManager.js';
export { webhookDispatcher } from '../core/WebhookDispatcher.js';
