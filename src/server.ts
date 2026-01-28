/**
 * Fastify server setup
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { registerRoutes } from './api/index.js';

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

  return server;
}
