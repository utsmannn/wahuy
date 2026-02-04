/**
 * Provider Factory
 *
 * Creates the appropriate provider based on configuration
 */

import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { IWhatsAppProvider } from './types.js';

// Lazy load providers to avoid circular dependencies
let InternalProviderClass: typeof import('./internal/InternalProvider.js').InternalProvider | null = null;
let OfficialProviderClass: typeof import('./official/OfficialProvider.js').OfficialProvider | null = null;

let currentProvider: IWhatsAppProvider | null = null;

/**
 * Create and initialize the configured provider
 */
export async function createProvider(): Promise<IWhatsAppProvider> {
  if (currentProvider) {
    return currentProvider;
  }

  const providerType = config.provider || 'internal';

  logger.info({ provider: providerType }, 'Creating WhatsApp provider');

  switch (providerType) {
    case 'official': {
      if (!config.official) {
        throw new Error('Official provider selected but no configuration provided. Set OFFICIAL_* environment variables.');
      }

      // Lazy load
      if (!OfficialProviderClass) {
        const { OfficialProvider } = await import('./official/OfficialProvider.js');
        OfficialProviderClass = OfficialProvider;
      }

      currentProvider = new OfficialProviderClass(config.official);
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
 * Check if using official provider
 */
export function isOfficialProvider(): boolean {
  return config.provider === 'official';
}

/**
 * Check if using internal provider
 */
export function isInternalProvider(): boolean {
  return !config.provider || config.provider === 'internal';
}
