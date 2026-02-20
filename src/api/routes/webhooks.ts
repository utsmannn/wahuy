/**
 * Webhook management routes
 */

import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { webhookDispatcher } from '../../core/WebhookDispatcher.js';
import { webhookLogStorage } from '../../storage/WebhookLogStorage.js';

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

  // ============================================================================
  // Webhook Logs
  // ============================================================================

  // Get webhook logs
  server.get('/logs', async (request) => {
    const query = request.query as {
      source?: 'meta' | 'internal';
      event?: string;
      limit?: string;
      offset?: string;
      startDate?: string;
      endDate?: string;
    };

    const logs = webhookLogStorage.getLogs({
      source: query.source,
      event: query.event,
      limit: query.limit ? parseInt(query.limit, 10) : 100,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const count = webhookLogStorage.getCount({
      source: query.source,
      event: query.event,
    });

    return {
      success: true,
      data: {
        logs,
        count: logs.length,
        total: count,
      }
    };
  });

  // Get webhook log statistics
  server.get('/logs/stats', async () => {
    const total = webhookLogStorage.getCount();
    const summary = webhookLogStorage.getEventSummary();

    return {
      success: true,
      data: {
        total,
        byEvent: summary,
      }
    };
  });

  // Clear webhook logs
  server.delete('/logs', async () => {
    const deleted = webhookLogStorage.clearAll();
    return {
      success: true,
      data: {
        deleted,
        message: `Deleted ${deleted} webhook logs`
      }
    };
  });
}
