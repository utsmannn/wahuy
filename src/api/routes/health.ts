/**
 * Health check routes
 */

import { FastifyInstance } from 'fastify';
import { sessionManager } from '../../core/SessionManager.js';
import { getProvider, isInternalProvider } from '../../providers/index.js';
import { config } from '../../config.js';

export async function healthRoutes(server: FastifyInstance): Promise<void> {
  // Basic health check
  server.get('/health', async () => {
    const stats = sessionManager.getStats();
    const provider = getProvider();

    return {
      status: 'healthy',
      version: '1.2.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      provider: {
        name: provider.name,
        version: provider.version,
        status: provider.getStatus(),
        mode: config.provider
      },
      sessions: isInternalProvider() ? stats : undefined
    };
  });

  // Readiness check
  server.get('/health/ready', async () => {
    return {
      ready: true
    };
  });

  // Liveness check
  server.get('/health/live', async () => {
    return {
      alive: true
    };
  });
}
