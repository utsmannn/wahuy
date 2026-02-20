/**
 * Official API - Webhooks Routes
 *
 * GET  /webhooks/whatsapp - Webhook verification (challenge)
 * POST /webhooks/whatsapp - Receive webhook events from Meta
 */

import { Readable } from 'stream';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getProvider, isOfficialProvider } from '../../../providers/index.js';
import { webhookLogStorage } from '../../../storage/WebhookLogStorage.js';
import { logger } from '../../../utils/logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export async function officialWebhooksRoutes(server: FastifyInstance): Promise<void> {

  // Capture raw body for HMAC signature verification.
  // Meta computes HMAC on the raw HTTP body — we must compare against
  // the exact bytes, not a re-serialized JSON.stringify output.
  server.addHook('preParsing', async (request, _reply, payload) => {
    if (request.method !== 'POST') return payload;

    const chunks: Buffer[] = [];
    for await (const chunk of payload as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks);
    request.rawBody = rawBody.toString('utf8');
    return Readable.from([rawBody]);
  });

  // GET /webhooks/whatsapp - Verification challenge from Meta
  server.get('/', async (request: FastifyRequest<{ Querystring: { 'hub.mode': string; 'hub.verify_token': string; 'hub.challenge': string } }>, reply: FastifyReply) => {
    try {
      const provider = getProvider();

      // Query parameters from Meta
      const mode = request.query['hub.mode'];
      const token = request.query['hub.verify_token'];
      const challenge = request.query['hub.challenge'];

      logger.debug({ mode, token, challenge }, 'Received webhook verification request');

      // Verify webhook
      const result = await provider.verifyWebhook(mode, token, challenge);

      if (result === null) {
        reply.status(403);
        return {
          error: {
            message: 'Webhook verification failed',
            type: 'VerificationException',
            code: 403,
          }
        };
      }

      // Return the challenge to verify
      reply.status(200);
      reply.type('text/plain');
      return result;
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err }, 'Webhook verification error');

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

  // POST /webhooks/whatsapp - Receive webhook events from Meta
  server.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const timestamp = new Date().toISOString();
    const body = request.body as Record<string, unknown>;

    // Extract event type from payload
    const eventType = extractEventType(body);

    try {
      const provider = getProvider();

      // Only official provider needs signature verification
      if (isOfficialProvider()) {
        const officialProvider = provider as import('../../../providers/official/OfficialProvider.js').OfficialProvider;

        // Get signature from header
        const signature = request.headers['x-hub-signature-256'] as string;

        if (!signature) {
          logger.warn('Missing X-Hub-Signature-256 header');

          // Log failed webhook
          webhookLogStorage.log({
            timestamp,
            source: 'meta',
            event: eventType,
            payload: body,
            processed: false,
            error: 'Missing signature header',
          });

          reply.status(401);
          return {
            error: {
              message: 'Missing signature header',
              type: 'AuthenticationException',
              code: 401,
            }
          };
        }

        // Verify signature using raw body (not re-serialized JSON)
        const payload = request.rawBody || '';
        const isValid = officialProvider.verifySignature(payload, signature);

        if (!isValid) {
          logger.warn('Invalid webhook signature');

          // Log failed webhook
          webhookLogStorage.log({
            timestamp,
            source: 'meta',
            event: eventType,
            payload: body,
            processed: false,
            error: 'Invalid signature',
          });

          reply.status(401);
          return {
            error: {
              message: 'Invalid signature',
              type: 'AuthenticationException',
              code: 401,
            }
          };
        }

        logger.debug('Webhook signature verified');
      }

      // Process the webhook
      await provider.handleWebhook(request.body);

      // Log successful webhook
      webhookLogStorage.log({
        timestamp,
        source: 'meta',
        event: eventType,
        payload: body,
        processed: true,
      });

      // Always return 200 OK to acknowledge receipt
      // Meta will retry if we don't respond quickly
      reply.status(200);
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error({ error: err, body: request.body }, 'Webhook processing error');

      // Log failed webhook
      webhookLogStorage.log({
        timestamp,
        source: 'meta',
        event: eventType,
        payload: body,
        processed: false,
        error: err.message,
      });

      // Still return 200 to prevent Meta from retrying
      // Log the error but acknowledge receipt
      reply.status(200);
      return { success: false, error: err.message };
    }
  });
}

/**
 * Extract event type from webhook payload
 */
function extractEventType(body: Record<string, unknown>): string {
  try {
    const entries = (body as { entry?: Array<{ changes?: Array<{ field?: string }> }> }).entry;
    if (entries && entries[0]?.changes?.[0]?.field) {
      return entries[0].changes[0].field;
    }
  } catch {
    // Ignore
  }
  return 'unknown';
}
