/**
 * Official API - Media Routes
 *
 * GET /v1/media/:mediaId - Download media (STREAMING)
 * POST /v1/media - Upload media
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import { getProvider } from '../../../providers/index.js';
import { logger } from '../../../utils/logger.js';

export async function officialMediaRoutes(server: FastifyInstance): Promise<void> {

  // Register multipart support for file uploads
  await server.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  });

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

  // POST /v1/media - Upload media
  server.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const provider = getProvider();

      if (!provider.uploadMedia) {
        reply.status(501);
        return {
          error: {
            message: 'Media upload not supported by this provider',
            type: 'NotImplementedException',
            code: 501,
          }
        };
      }

      const file = await request.file();

      if (!file) {
        reply.status(400);
        return {
          error: {
            message: 'No file uploaded. Send file as multipart/form-data with field name "file".',
            type: 'InvalidParameterException',
            code: 100,
          }
        };
      }

      const result = await provider.uploadMedia(file.file, file.mimetype);

      reply.status(200);
      return result;
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
