/**
 * Configuration module
 *
 * Loads and validates environment variables.
 */

import { config as loadEnv } from 'dotenv';

// Load .env file
loadEnv();

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvArray(key: string, defaultValue: string[] = []): string[] {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export const config = {
  // Server
  port: getEnvNumber('PORT', 3000),
  host: getEnv('HOST', '0.0.0.0'),
  nodeEnv: getEnv('NODE_ENV', 'development'),

  // API Security
  apiKey: getEnv('API_KEY', 'development-api-key'),
  apiKeys: getEnvArray('API_KEYS'),

  // Dashboard
  dashboard: {
    enabled: getEnvBoolean('DASHBOARD_ENABLED', true),
    username: getEnv('DASHBOARD_USERNAME', 'admin'),
    password: getEnv('DASHBOARD_PASSWORD', 'admin123')
  },

  // Storage
  storage: {
    type: getEnv('STORAGE_TYPE', 'file') as 'file' | 'sqlite',
    path: getEnv('STORAGE_PATH', './data')
  },

  // Webhook
  webhook: {
    timeout: getEnvNumber('WEBHOOK_TIMEOUT', 30000),
    retryCount: getEnvNumber('WEBHOOK_RETRY_COUNT', 3),
    retryDelay: getEnvNumber('WEBHOOK_RETRY_DELAY', 5000)
  },

  // Session
  session: {
    restartOnAuthFail: getEnvBoolean('SESSION_RESTART_ON_AUTH_FAIL', true),
    reconnectInterval: getEnvNumber('SESSION_RECONNECT_INTERVAL', 5000),
    maxReconnectAttempts: getEnvNumber('SESSION_MAX_RECONNECT_ATTEMPTS', 10)
  },

  // Logging
  log: {
    level: getEnv('LOG_LEVEL', 'info'),
    format: getEnv('LOG_FORMAT', 'pretty') as 'json' | 'pretty'
  },

  // Puppeteer (optional)
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: getEnvBoolean('PUPPETEER_HEADLESS', true),
    args: getEnvArray('PUPPETEER_ARGS', ['--no-sandbox', '--disable-setuid-sandbox'])
  }
} as const;

export type Config = typeof config;
