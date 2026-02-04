/**
 * Official API - Media Routes
 *
 * GET /v1/media/:mediaId - Download media (STREAMING)
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getProvider } from '../../../providers/index.js';
import { logger } from '../../../utils/logger.js';

export async function officialMediaRoutes(server: FastifyInstance): Promise<void> {

  // GET /v1/media/:mediaId - Download media
  server.get('/:mediaId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { mediaId } = request.params as { mediaId: string };
      const provider = getProvider();

      logger.debug({ mediaId }, 'Media download requested');

      // Get media stream from provider (NO BUFFERING!)
      const stream = await provider.downloadMedia(mediaId);

      // Get media URL for content type (if needed)
      let mimeType = 'application/octet-stream';
      if (provider.getMediaUrl) {
        try {
          const mediaInfo = await provider.getMediaUrl(mediaId);
          mimeType = mediaInfo.mimeType;
        } catch {
          // Use default
        }
      }

      // Stream directly to client (CRITICAL FIX: no buffering!)
      reply.header('Content-Type', mimeType);
      reply.header('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes

      return reply.send(stream);
    } catch (error) {
      const err = error as Error;
      const providerErr = error as { code?: string };

      logger.error({ error: err, mediaId: (request.params as { mediaId: string }).mediaId }, 'Media download failed');

      if (providerErr.code === 'MEDIA_NOT_FOUND') {
        reply.status(404);
        return {
          error: {
            message: 'Media not found',
            type: 'NotFoundException',
            code: 404,
          }
        };
      }

      reply.status(500);
      return {
        error: {
          message: err.message,
          type: 'APIException',
          code: 500,
        }
      };
    }
  });

  // POST /v1/media - Upload media (for internal provider compatibility)
  server.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // For internal provider: handle multipart upload
      // For official provider: forward to Meta

      // Check if multipart
      const contentType = request.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        reply.status(400);
        return {
          error: {
            message: 'Content-Type must be multipart/form-data',
            type: 'InvalidParameterException',
            code: 100,
          }
        };
      }

      // For now, return not implemented
      // Full multipart parsing would require additional plugins
      reply.status(501);
      return {
        error: {
          message: 'Media upload via multipart not yet implemented. Use direct Meta API for official provider.',
          type: 'NotImplementedException',
          code: 501,
        }
      };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err }, 'Media upload failed');

      reply.status(500);
      return {
        error: {
          message: err.message,
          type: 'APIException',
          code: 500,
        }
      };
    }
  });
}
