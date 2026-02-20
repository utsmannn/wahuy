/**
 * Provider configuration routes
 *
 * Allows runtime switching between Internal and Official providers
 * without server restart.
 */

import { FastifyInstance } from 'fastify';
import { getProviderInfo, switchProvider, getProvider, isOfficialProvider } from '../../providers/index.js';
import { webhookDispatcher } from '../../core/WebhookDispatcher.js';
import { sessionManager } from '../../core/SessionManager.js';
import { wireProviderEvents } from '../../websocket/index.js';
import { logger } from '../../utils/logger.js';
import type { OfficialProviderConfig, IWhatsAppProvider, TemplateComponent } from '../../providers/types.js';

interface SwitchBody {
  mode: 'internal' | 'official';
  official?: {
    accessToken: string;
    appSecret: string;
    phoneNumberId: string;
    webhookVerifyToken: string;
    baseUrl?: string;
    businessAccountId?: string;
  };
}

interface TestBody {
  accessToken: string;
  appSecret: string;
  phoneNumberId: string;
  webhookVerifyToken: string;
  baseUrl?: string;
  businessAccountId?: string;
}

/**
 * Build a full OfficialProviderConfig from partial user input
 */
function buildOfficialConfig(input: SwitchBody['official']): OfficialProviderConfig | null {
  if (!input) return null;
  return {
    baseUrl: input.baseUrl || 'https://graph.facebook.com/v20.0',
    accessToken: input.accessToken,
    appSecret: input.appSecret,
    phoneNumberId: input.phoneNumberId,
    businessAccountId: input.businessAccountId,
    webhookVerifyToken: input.webhookVerifyToken,
    webhookPath: '/webhooks/whatsapp',
    autoDownloadMedia: true,
    mediaCacheTtl: 300,
    maxMediaSize: 100 * 1024 * 1024,
    rateLimit: {
      messagesPerSecond: 80,
      queueEnabled: true,
      queueMaxSize: 10000,
      queueProvider: 'memory',
    },
  };
}

/**
 * Wire official provider events to webhook dispatcher and message storage
 */
function wireOfficialEvents(provider: IWhatsAppProvider): void {
  const officialProvider = provider as import('../../providers/official/OfficialProvider.js').OfficialProvider;

  // Wire to WebhookDispatcher for external webhooks
  officialProvider.on('message:received', (data: { sessionId: string; message: object }) => {
    webhookDispatcher.dispatch('message.received', data.sessionId, data.message);
  });

  officialProvider.on('message:sent', (data: { sessionId: string; message: object }) => {
    webhookDispatcher.dispatch('message.sent', data.sessionId, data.message);
  });

  officialProvider.on('message:ack', (data: { sessionId: string; id: string; ack: number; ackName: string }) => {
    webhookDispatcher.dispatch('message.ack', data.sessionId, {
      id: data.id,
      ack: data.ack,
      ackName: data.ackName,
    });
  });

  // Wire to WebSocket and MessageStorage for persistence
  wireProviderEvents(provider);

  logger.info('Official provider events wired to webhook dispatcher and message storage');
}

/**
 * Wire internal provider events (session manager) to webhook dispatcher
 */
function wireInternalEvents(): void {
  // SessionManager events are wired once in index.ts main() — they survive provider switches
  // because SessionManager is independent of provider.
  // We just need to re-initialize SessionManager if switching TO internal.
  logger.info('Internal provider events already wired via SessionManager');
}

export async function providerRoutes(server: FastifyInstance): Promise<void> {
  /**
   * GET /api/provider — Current provider info
   */
  server.get('/', async () => {
    return {
      success: true,
      data: getProviderInfo(),
    };
  });

  /**
   * POST /api/provider/switch — Switch provider mode at runtime
   */
  server.post<{ Body: SwitchBody }>('/switch', async (request, reply) => {
    const { mode, official } = request.body;

    if (!mode || !['internal', 'official'].includes(mode)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_MODE', message: 'Mode must be "internal" or "official"' },
      });
    }

    if (mode === 'official') {
      if (!official?.accessToken || !official?.appSecret || !official?.phoneNumberId || !official?.webhookVerifyToken) {
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_CONFIG', message: 'Official mode requires accessToken, appSecret, phoneNumberId, and webhookVerifyToken' },
        });
      }
    }

    try {
      const officialConfig = mode === 'official' ? buildOfficialConfig(official) : undefined;

      const provider = await switchProvider(mode, officialConfig ?? undefined, (newProvider) => {
        if (mode === 'official') {
          wireOfficialEvents(newProvider);
        } else {
          wireInternalEvents();
        }
      });

      // If switching to internal, re-initialize session manager
      if (mode === 'internal') {
        await sessionManager.initialize();
      }

      return {
        success: true,
        data: {
          mode,
          status: provider.getStatus(),
          name: provider.name,
          version: provider.version,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Failed to switch provider');
      return reply.status(500).send({
        success: false,
        error: { code: 'SWITCH_FAILED', message },
      });
    }
  });

  /**
   * POST /api/provider/test — Test official credentials without switching
   */
  server.post<{ Body: TestBody }>('/test', async (request, reply) => {
    const { accessToken, appSecret, phoneNumberId, webhookVerifyToken, baseUrl, businessAccountId } = request.body;

    if (!accessToken || !appSecret || !phoneNumberId || !webhookVerifyToken) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_CONFIG', message: 'Requires accessToken, appSecret, phoneNumberId, and webhookVerifyToken' },
      });
    }

    try {
      const testConfig = buildOfficialConfig({
        accessToken,
        appSecret,
        phoneNumberId,
        webhookVerifyToken,
        baseUrl,
        businessAccountId,
      })!;

      // Lazy load OfficialProvider
      const { OfficialProvider } = await import('../../providers/official/OfficialProvider.js');
      const tempProvider = new OfficialProvider(testConfig);

      // Test by fetching business profile
      const profile = await tempProvider.getBusinessProfile();

      // Shutdown temp provider
      await tempProvider.shutdown();

      return {
        success: true,
        data: {
          message: 'Connection successful',
          profile,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ error: message }, 'Provider test failed');
      return reply.status(400).send({
        success: false,
        error: { code: 'TEST_FAILED', message },
      });
    }
  });

  /**
   * GET /api/provider/templates — Fetch available message templates (Official only)
   */
  server.get('/templates', async (_request, reply) => {
    if (!isOfficialProvider()) {
      return reply.status(400).send({
        success: false,
        error: { code: 'NOT_OFFICIAL', message: 'Templates are only available in Official provider mode' },
      });
    }

    try {
      const provider = getProvider() as import('../../providers/official/OfficialProvider.js').OfficialProvider;
      const templates = await provider.getTemplates();

      return {
        success: true,
        data: templates,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, 'Failed to fetch templates');
      return reply.status(500).send({
        success: false,
        error: { code: 'FETCH_FAILED', message },
      });
    }
  });

  /**
   * POST /api/provider/send-template — Send a template message (Official only)
   */
  server.post<{ Body: { to: string; templateName: string; languageCode: string; variables?: string[] } }>(
    '/send-template',
    async (request, reply) => {
      if (!isOfficialProvider()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NOT_OFFICIAL', message: 'Template sending is only available in Official provider mode' },
        });
      }

      const { to, templateName, languageCode, variables } = request.body;

      if (!to || !templateName || !languageCode) {
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_PARAMS', message: 'Requires to, templateName, and languageCode' },
        });
      }

      try {
        const provider = getProvider();

        const components: TemplateComponent[] = [];
        if (variables && variables.length > 0) {
          components.push({
            type: 'body',
            parameters: variables.map((v) => ({ type: 'text' as const, text: v })),
          });
        }

        const result = await provider.sendMessage({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: components.length > 0 ? components : undefined,
          },
        });

        return { success: true, data: result };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, 'Failed to send template message');
        return reply.status(500).send({
          success: false,
          error: { code: 'SEND_FAILED', message },
        });
      }
    }
  );
}
