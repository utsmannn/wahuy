/**
 * Wahuy - WhatsApp Multi-Session Service
 *
 * Entry point for the application.
 *
 * @see DESIGN_PLAN.md for complete documentation
 */

import { config } from './config.js';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';
import { sessionManager } from './core/SessionManager.js';
import { webhookDispatcher } from './core/WebhookDispatcher.js';
import { createProvider, shutdownProvider, isInternalProvider, isOfficialProvider, loadSavedConfig } from './providers/index.js';
import { wireProviderEvents } from './websocket/index.js';

let server: Awaited<ReturnType<typeof createServer>> | null = null;

async function main(): Promise<void> {
  try {
    logger.info('Starting Wahuy...');
    // Load saved provider config (from previous runtime switch)
    const hasSavedConfig = loadSavedConfig();

    logger.info({
      port: config.port,
      env: config.nodeEnv,
      dashboard: config.dashboard.enabled,
      provider: config.provider,
      savedConfig: hasSavedConfig
    }, 'Configuration loaded');

    // Initialize provider
    const provider = await createProvider();
    logger.info({ provider: provider.name, version: provider.version }, 'Provider ready');

    // Initialize webhook dispatcher (for both providers)
    await webhookDispatcher.initialize();

    // Initialize core modules (only for internal provider)
    if (isInternalProvider()) {
      await sessionManager.initialize();

      // Wire session events to webhook dispatcher
      wireSessionEventsToWebhooks();

      // Auto-start existing sessions
      await autoStartSessions();
    }

    // Wire provider events to webhook dispatcher (for official provider)
    if (isOfficialProvider()) {
      wireProviderEventsToWebhooks(provider);
    }

    // Create and start server
    server = await createServer();

    await server.listen({
      port: config.port,
      host: config.host
    });

    logger.info(`Wahuy is running on http://${config.host}:${config.port}`);
    logger.info(`Health check: http://${config.host}:${config.port}/api/health`);
    logger.info(`API Base: http://${config.host}:${config.port}/api`);
    logger.info(`Official API: http://${config.host}:${config.port}/v1/messages`);

    if (isOfficialProvider()) {
      logger.info(`Webhook endpoint: POST http://${config.host}:${config.port}/webhooks/whatsapp`);
    }

  } catch (error) {
    logger.fatal(error, 'Failed to start Wahuy');
    process.exit(1);
  }
}

/**
 * Auto-start all sessions from storage (Internal Provider only)
 */
async function autoStartSessions(): Promise<void> {
  // Only auto-start for internal provider
  if (!isInternalProvider()) {
    return;
  }

  const sessions = sessionManager.listSessions();
  logger.info({ count: sessions.length }, 'Auto-starting sessions');

  for (const session of sessions) {
    try {
      // Auto-start all sessions that were loaded from storage (status: created)
      // or were previously active (ready/connecting/starting)
      if (session.status === 'created' || ['ready', 'connecting', 'starting'].includes(session.status)) {
        logger.info({ sessionId: session.id, status: session.status }, 'Auto-starting session');
        await sessionManager.startSession(session.id);
        logger.info({ sessionId: session.id }, 'Session auto-started');
      } else {
        logger.debug({ sessionId: session.id, status: session.status }, 'Skipping auto-start for session');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error({ sessionId: session.id, error: errorMessage, stack: errorStack }, 'Failed to auto-start session');
    }
  }
}

/**
 * Wire SessionManager events to WebhookDispatcher (Internal Provider)
 */
function wireSessionEventsToWebhooks(): void {
  sessionManager.on('session:qr', (data) => {
    webhookDispatcher.dispatch('session.qr_updated', data.sessionId, {
      qr: data.qr
    });
  });

  sessionManager.on('session:authenticated', (data) => {
    webhookDispatcher.dispatch('session.authenticated', data.sessionId, {});
  });

  sessionManager.on('session:ready', (data) => {
    webhookDispatcher.dispatch('session.ready', data.sessionId, {
      phone: data.phone,
      pushName: data.pushName
    });
  });

  sessionManager.on('session:disconnected', (data) => {
    webhookDispatcher.dispatch('session.disconnected', data.sessionId, {
      reason: data.reason
    });
  });

  sessionManager.on('session:auth_failure', (data) => {
    webhookDispatcher.dispatch('session.auth_failure', data.sessionId, {
      reason: data.reason
    });
  });

  sessionManager.on('session:reconnecting', (data) => {
    webhookDispatcher.dispatch('session.reconnecting', data.sessionId, {
      attempt: data.attempt,
      maxAttempts: data.maxAttempts,
      nextAttemptAt: data.nextAttemptAt
    });
  });

  sessionManager.on('session:failed', (data) => {
    webhookDispatcher.dispatch('session.failed', data.sessionId, {
      reason: data.reason,
      lastError: data.lastError
    });
  });

  sessionManager.on('message:received', (data) => {
    webhookDispatcher.dispatch('message.received', data.sessionId, data.message);
  });

  sessionManager.on('message:sent', (data) => {
    webhookDispatcher.dispatch('message.sent', data.sessionId, data.message);
  });

  sessionManager.on('message:ack', (data) => {
    webhookDispatcher.dispatch('message.ack', data.sessionId, {
      id: data.id,
      ack: data.ack,
      ackName: data.ackName
    });
  });

  logger.info('Session event wiring completed');
}

/**
 * Wire OfficialProvider events to WebhookDispatcher (Official Provider)
 */
function wireProviderEventsToWebhooks(provider: import('./providers/types.js').IWhatsAppProvider): void {
  // Cast to OfficialProvider to access EventEmitter methods
  const officialProvider = provider as import('./providers/official/OfficialProvider.js').OfficialProvider;

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
      ackName: data.ackName
    });
  });

  // Wire to WebSocket and MessageStorage for persistence
  wireProviderEvents(provider);

  logger.info('Provider event wiring completed');
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');

  try {
    // Stop accepting new connections
    if (server) {
      await server.close();
      logger.info('Server closed');
    }

    // Shutdown provider
    await shutdownProvider();
    logger.info('Provider shutdown complete');

    // Shutdown all sessions (internal mode only)
    if (isInternalProvider()) {
      await sessionManager.shutdown();
      logger.info('Sessions shutdown complete');
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Error during shutdown');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal(error, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});

main();
