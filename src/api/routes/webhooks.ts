/**
 * Webhook management routes
 */

import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { webhookDispatcher } from '../../core/WebhookDispatcher.js';

export async function webhookRoutes(server: FastifyInstance): Promise<void> {
  // List webhooks
  server.get('/', async () => {
    const webhooks = webhookDispatcher.getWebhooks();
    return {
      success: true,
      data: webhooks
    };
  });

  // Register webhook
  server.post('/', async (request, reply) => {
    const body = request.body as {
      url: string;
      events: string[];
      sessions?: string[];
      secret?: string;
      active?: boolean;
    };

    if (!body.url || !body.events || body.events.length === 0) {
      reply.status(400);
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: url, events'
        }
      };
    }

    const webhook = {
      id: 'wh_' + nanoid(10),
      url: body.url,
      events: body.events,
      sessions: body.sessions ?? [],
      secret: body.secret,
      active: body.active ?? true,
      createdAt: new Date().toISOString()
    };

    await webhookDispatcher.registerWebhook(webhook);

    reply.status(201);
    return {
      success: true,
      data: webhook
    };
  });

  // Get webhook
  server.get('/:webhookId', async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    const webhook = webhookDispatcher.getWebhook(webhookId);

    if (!webhook) {
      reply.status(404);
      return {
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `Webhook '${webhookId}' not found`
        }
      };
    }

    return {
      success: true,
      data: webhook
    };
  });

  // Update webhook
  server.put('/:webhookId', async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    const body = request.body as {
      url?: string;
      events?: string[];
      sessions?: string[];
      secret?: string;
      active?: boolean;
    };

    const updated = await webhookDispatcher.updateWebhook(webhookId, body);

    if (!updated) {
      reply.status(404);
      return {
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `Webhook '${webhookId}' not found`
        }
      };
    }

    return {
      success: true,
      data: updated
    };
  });

  // Delete webhook
  server.delete('/:webhookId', async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    const deleted = await webhookDispatcher.removeWebhook(webhookId);

    if (!deleted) {
      reply.status(404);
      return {
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `Webhook '${webhookId}' not found`
        }
      };
    }

    return {
      success: true,
      message: `Webhook ${webhookId} deleted`
    };
  });

  // Test webhook
  server.post('/:webhookId/test', async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };

    try {
      const result = await webhookDispatcher.testWebhook(webhookId);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('not found')) {
        reply.status(404);
        return {
          success: false,
          error: {
            code: 'WEBHOOK_NOT_FOUND',
            message: err.message
          }
        };
      }
      throw error;
    }
  });
}
