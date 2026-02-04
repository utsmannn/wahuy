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
  },

  // Provider Selection
  provider: getEnv('PROVIDER', 'internal') as 'internal' | 'official',

  // Official WhatsApp Business API Configuration
  official: (() => {
    if (getEnv('PROVIDER', 'internal') !== 'official') {
      return undefined;
    }
    return {
      baseUrl: getEnv('OFFICIAL_BASE_URL', 'https://graph.facebook.com/v20.0'),
      accessToken: getEnv('OFFICIAL_ACCESS_TOKEN', ''),
      appSecret: getEnv('OFFICIAL_APP_SECRET', ''),
      phoneNumberId: getEnv('OFFICIAL_PHONE_NUMBER_ID', ''),
      businessAccountId: process.env.OFFICIAL_BUSINESS_ACCOUNT_ID,
      webhookVerifyToken: getEnv('OFFICIAL_WEBHOOK_VERIFY_TOKEN', ''),
      webhookPath: getEnv('OFFICIAL_WEBHOOK_PATH', '/webhooks/whatsapp'),
      autoDownloadMedia: getEnvBoolean('OFFICIAL_AUTO_DOWNLOAD_MEDIA', true),
      mediaCacheTtl: getEnvNumber('OFFICIAL_MEDIA_CACHE_TTL', 300),
      maxMediaSize: getEnvNumber('OFFICIAL_MAX_MEDIA_SIZE', 100 * 1024 * 1024), // 100MB
      rateLimit: {
        messagesPerSecond: getEnvNumber('OFFICIAL_RATE_LIMIT_MSG_PER_SEC', 80),
        queueEnabled: getEnvBoolean('OFFICIAL_QUEUE_ENABLED', true),
        queueMaxSize: getEnvNumber('OFFICIAL_QUEUE_MAX_SIZE', 10000),
        queueProvider: getEnv('OFFICIAL_QUEUE_PROVIDER', 'memory') as 'memory' | 'redis'
      }
    };
  })(),

  // Redis (for official provider queue)
  redis: {
    url: process.env.REDIS_URL
  }
} as const;

export type Config = typeof config;
