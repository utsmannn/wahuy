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

async function main(): Promise<void> {
  try {
    logger.info('Starting WASimple...');
    logger.info({
      port: config.port,
      env: config.nodeEnv,
      dashboard: config.dashboard.enabled
    }, 'Configuration loaded');

    const server = await createServer();

    await server.listen({
      port: config.port,
      host: config.host
    });

    logger.info(`WASimple is running on http://${config.host}:${config.port}`);
    logger.info(`Dashboard: http://${config.host}:${config.port}/`);
    logger.info(`API Docs: http://${config.host}:${config.port}/api/docs`);

  } catch (error) {
    logger.fatal(error, 'Failed to start WASimple');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  // TODO: Add graceful shutdown logic
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  // TODO: Add graceful shutdown logic
  process.exit(0);
});

main();
