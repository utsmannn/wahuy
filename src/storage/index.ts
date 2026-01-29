/**
 * Storage module
 */

import { FileStorage } from './FileStorage.js';

export * from './types.js';
export * from './FileStorage.js';

// Singleton storage instance
export const storage = new FileStorage();
