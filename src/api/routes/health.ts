/**
 * Health check routes
 */

import { FastifyInstance } from 'fastify';

export async function healthRoutes(server: FastifyInstance): Promise<void> {
  // Basic health check
  server.get('/health', async () => {
    return {
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      sessions: {
        total: 0,    // TODO: Get from SessionManager
        connected: 0,
        disconnected: 0
      }
    };
  });

  // Readiness check
  server.get('/health/ready', async () => {
    // TODO: Check if all dependencies are ready
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
