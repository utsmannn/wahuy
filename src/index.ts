/**
 * WASimple - WhatsApp Multi-Session Service
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

let server: Awaited<ReturnType<typeof createServer>> | null = null;

async function main(): Promise<void> {
  try {
    logger.info('Starting WASimple...');
    logger.info({
      port: config.port,
      env: config.nodeEnv,
      dashboard: config.dashboard.enabled
    }, 'Configuration loaded');

    // Initialize core modules
    await sessionManager.initialize();
    await webhookDispatcher.initialize();

    // Wire session events to webhook dispatcher
    wireEventsToWebhooks();

    // Create and start server
    server = await createServer();

    await server.listen({
      port: config.port,
      host: config.host
    });

    logger.info(`WASimple is running on http://${config.host}:${config.port}`);
    logger.info(`Health check: http://${config.host}:${config.port}/api/health`);
    logger.info(`API Base: http://${config.host}:${config.port}/api`);

  } catch (error) {
    logger.fatal(error, 'Failed to start WASimple');
    process.exit(1);
  }
}

/**
 * Wire SessionManager events to WebhookDispatcher
 */
function wireEventsToWebhooks(): void {
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

  logger.info('Event wiring completed');
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

    // Shutdown all sessions
    await sessionManager.shutdown();
    logger.info('Sessions shutdown complete');

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
