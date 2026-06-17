import { createReadStream } from 'node:fs';
import { FastifyInstance } from 'fastify';
import { sessionManager } from '../../core/SessionManager.js';
import { logger } from '../../utils/logger.js';
import { verifyCatalogImageProxyToken, downloadAndCacheCatalogImage } from '../utils/catalogImageProxy.js';

export async function catalogImageRoutes(server: FastifyInstance): Promise<void> {
  server.get('/sessions/:sessionId/business/catalog/images/:token', async (request, reply) => {
    const { sessionId, token } = request.params as { sessionId: string; token: string };
    const payload = verifyCatalogImageProxyToken(sessionId, token);

    if (!payload) {
      reply.status(403);
      return {
        success: false,
        error: {
          code: 'INVALID_CATALOG_IMAGE_TOKEN',
          message: 'Catalog image link is invalid or expired'
        }
      };
    }

    const client = sessionManager.getSession(sessionId);
    if (!client) {
      reply.status(404);
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session '${sessionId}' not found`
        }
      };
    }

    if (client.getStatus() !== 'ready') {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_READY',
          message: 'Session is not ready'
        }
      };
    }

    try {
      // Download and cache the catalog image locally, then serve it from the local disk.
      // This completely bypasses the browser CORS / Referer restrictions and avoids CDN signature mismatch / bot blocking.
      const localPath = await downloadAndCacheCatalogImage(sessionId, payload.url);

      reply.type('image/jpeg');
      reply.header('Cache-Control', 'private, max-age=3600');
      reply.header('X-Content-Type-Options', 'nosniff');

      return reply.send(createReadStream(localPath));
    } catch (error) {
      const err = error as Error;
      logger.warn({ error: err, sessionId, url: payload.url }, 'Catalog image proxy fetch failed');

      reply.status(502);
      return {
        success: false,
        error: {
          code: 'CATALOG_IMAGE_FETCH_FAILED',
          message: err.message || 'Catalog image fetch failed'
        }
      };
    }
  });
}
