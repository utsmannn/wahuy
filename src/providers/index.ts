/**
 * Provider Factory
 *
 * Creates the appropriate provider based on configuration.
 * Supports runtime switching between Internal and Official providers.
 * Persists provider config to disk for survival across restarts.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { IWhatsAppProvider, OfficialProviderConfig } from './types.js';

// Lazy load providers to avoid circular dependencies
let InternalProviderClass: typeof import('./internal/InternalProvider.js').InternalProvider | null = null;
let OfficialProviderClass: typeof import('./official/OfficialProvider.js').OfficialProvider | null = null;

let currentProvider: IWhatsAppProvider | null = null;

// Runtime overrides (mutable, set by switchProvider or loadSavedConfig)
let runtimeProviderMode: 'internal' | 'official' | null = null;
let runtimeOfficialConfig: OfficialProviderConfig | null = null;

// Persistence
const CONFIG_FILENAME = 'provider-config.json';

interface SavedProviderConfig {
  mode: 'internal' | 'official';
  official?: OfficialProviderConfig;
}

function getConfigPath(): string {
  return join(config.storage.path, CONFIG_FILENAME);
}

/**
 * Load saved provider config from disk (called on startup)
 */
export function loadSavedConfig(): boolean {
  const configPath = getConfigPath();
  try {
    if (!existsSync(configPath)) {
      return false;
    }
    const raw = readFileSync(configPath, 'utf-8');
    const saved: SavedProviderConfig = JSON.parse(raw);

    if (saved.mode && ['internal', 'official'].includes(saved.mode)) {
      runtimeProviderMode = saved.mode;
      if (saved.mode === 'official' && saved.official) {
        runtimeOfficialConfig = saved.official;
      }
      logger.info({ mode: saved.mode }, 'Loaded saved provider config');
      return true;
    }
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Failed to load saved provider config, using defaults');
  }
  return false;
}

/**
 * Save current provider config to disk
 */
function saveConfig(): void {
  const configPath = getConfigPath();
  try {
    const dir = config.storage.path;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const data: SavedProviderConfig = {
      mode: getEffectiveMode(),
    };
    if (runtimeOfficialConfig) {
      data.official = runtimeOfficialConfig;
    }

    writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info({ path: configPath }, 'Provider config saved');
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'Failed to save provider config');
  }
}

/**
 * Get the effective provider mode (runtime override > env config)
 */
function getEffectiveMode(): 'internal' | 'official' {
  return runtimeProviderMode ?? config.provider ?? 'internal';
}

/**
 * Create and initialize the configured provider
 */
export async function createProvider(): Promise<IWhatsAppProvider> {
  if (currentProvider) {
    return currentProvider;
  }

  const providerType = getEffectiveMode();

  logger.info({ provider: providerType }, 'Creating WhatsApp provider');

  switch (providerType) {
    case 'official': {
      const officialConfig = runtimeOfficialConfig ?? config.official;
      if (!officialConfig) {
        throw new Error('Official provider selected but no configuration provided. Set OFFICIAL_* environment variables or provide config via dashboard.');
      }

      // Lazy load
      if (!OfficialProviderClass) {
        const { OfficialProvider } = await import('./official/OfficialProvider.js');
        OfficialProviderClass = OfficialProvider;
      }

      currentProvider = new OfficialProviderClass(officialConfig);
      break;
    }

    case 'internal':
    default: {
      // Lazy load
      if (!InternalProviderClass) {
        const { InternalProvider } = await import('./internal/InternalProvider.js');
        InternalProviderClass = InternalProvider;
      }

      currentProvider = new InternalProviderClass({
        storagePath: config.storage.path,
      });
      break;
    }
  }

  // Initialize if the provider has an initialize method
  if (currentProvider.initialize) {
    await currentProvider.initialize();
  }

  logger.info({ provider: providerType, name: currentProvider.name }, 'Provider initialized');

  return currentProvider;
}

/**
 * Get the current provider instance
 */
export function getProvider(): IWhatsAppProvider {
  if (!currentProvider) {
    throw new Error('Provider not initialized. Call createProvider() first.');
  }
  return currentProvider;
}

/**
 * Shutdown the current provider
 */
export async function shutdownProvider(): Promise<void> {
  if (currentProvider?.shutdown) {
    await currentProvider.shutdown();
    logger.info('Provider shut down');
  }
  currentProvider = null;
}

/**
 * Switch provider at runtime without server restart
 */
export async function switchProvider(
  mode: 'internal' | 'official',
  officialConfig?: OfficialProviderConfig,
  onReady?: (provider: IWhatsAppProvider) => void
): Promise<IWhatsAppProvider> {
  logger.info({ from: getEffectiveMode(), to: mode }, 'Switching provider');

  // 1. Shutdown current provider
  await shutdownProvider();

  // 2. Set runtime overrides
  runtimeProviderMode = mode;
  if (mode === 'official' && officialConfig) {
    runtimeOfficialConfig = officialConfig;
  } else if (mode === 'internal') {
    runtimeOfficialConfig = null;
  }

  // 3. Persist config to disk
  saveConfig();

  // 4. Create and initialize new provider
  const provider = await createProvider();

  // 5. Call onReady callback for event wiring
  if (onReady) {
    onReady(provider);
  }

  logger.info({ mode, name: provider.name }, 'Provider switched successfully');
  return provider;
}

/**
 * Get current provider info for API responses
 */
export function getProviderInfo(): {
  mode: 'internal' | 'official';
  status: string;
  name: string;
  version: string;
  hasConfig?: boolean;
} {
  const mode = getEffectiveMode();
  if (!currentProvider) {
    return { mode, status: 'not_initialized', name: '', version: '' };
  }
  return {
    mode,
    status: currentProvider.getStatus(),
    name: currentProvider.name,
    version: currentProvider.version,
    hasConfig: mode === 'official' ? !!runtimeOfficialConfig : undefined,
  };
}

/**
 * Check if using official provider
 */
export function isOfficialProvider(): boolean {
  return getEffectiveMode() === 'official';
}

/**
 * Check if using internal provider
 */
export function isInternalProvider(): boolean {
  return getEffectiveMode() === 'internal';
}
