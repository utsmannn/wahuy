/**
 * Fastify server setup
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { registerRoutes } from './api/index.js';
import { initWebSocket } from './websocket/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false, // We use our own logger
    trustProxy: true
  });

  // Security middleware
  await server.register(helmet, {
    contentSecurityPolicy: config.nodeEnv === 'production'
  });

  // CORS
  await server.register(cors, {
    origin: true,
    credentials: true
  });

  // Rate limiting
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Request logging
  server.addHook('onRequest', async (request) => {
    logger.debug({
      method: request.method,
      url: request.url,
      ip: request.ip
    }, 'Incoming request');
  });

  // Error handler
  server.setErrorHandler(async (error, request, reply) => {
    logger.error({
      error: error.message,
      stack: error.stack,
      url: request.url
    }, 'Request error');

    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: error.message
      }
    });
  });

  // Register API routes
  await registerRoutes(server);

  // Serve dashboard static files if enabled
  if (config.dashboard.enabled) {
    const dashboardPath = join(__dirname, '..', 'dashboard', 'dist');

    await server.register(fastifyStatic, {
      root: dashboardPath,
      prefix: '/',
    });

    // SPA fallback - serve index.html for non-API routes
    server.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Endpoint not found' }
        });
      } else {
        const indexPath = join(dashboardPath, 'index.html');
        const html = await readFile(indexPath, 'utf-8');
        reply.type('text/html').send(html);
      }
    });
  }

  // Initialize WebSocket after server is ready
  server.addHook('onReady', async () => {
    // Get the underlying HTTP server
    const httpServer = server.server;
    initWebSocket(httpServer);
  });

  return server;
}
