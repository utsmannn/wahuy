/**
 * Pino logger setup
 */

import pino from 'pino';
import { config } from '../config.js';

const transport = config.log.format === 'pretty'
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  : undefined;

export const logger = pino({
  level: config.log.level,
  transport
});
