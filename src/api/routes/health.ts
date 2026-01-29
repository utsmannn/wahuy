/**
 * Health check routes
 */

import { FastifyInstance } from 'fastify';
import { sessionManager } from '../../core/SessionManager.js';

export async function healthRoutes(server: FastifyInstance): Promise<void> {
  // Basic health check
  server.get('/health', async () => {
    const stats = sessionManager.getStats();

    return {
      status: 'healthy',
      version: '1.0.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      sessions: stats
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
