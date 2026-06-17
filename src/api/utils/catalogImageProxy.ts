import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';

const ALLOWED_IMAGE_HOSTS = [
  'mmg.whatsapp.net',
  'cdn.whatsapp.net',
  'whatsapp.net',
  'fbcdn.net',
] as const;

type CatalogImageTokenPayload = {
  sessionId: string;
  url: string;
  exp: number;
};

export type VerifiedCatalogImageToken = CatalogImageTokenPayload;

function getSigningSecret(): string {
  return config.apiKeys[0] ?? config.apiKey;
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', getSigningSecret()).update(encodedPayload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'base64url');
  const rightBuffer = Buffer.from(right, 'base64url');

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAllowedCatalogImageUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;

  const hostname = url.hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
}

export function createCatalogImageProxyToken(sessionId: string, imageUrl: string): string | null {
  if (!isAllowedCatalogImageUrl(imageUrl)) return null;

  const payload: CatalogImageTokenPayload = {
    sessionId,
    url: imageUrl,
    exp: 4102444800000, // Fixed expiration in the year 2100 for deterministic tokens and browser cache optimization
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function createCatalogImageProxyPath(sessionId: string, imageUrl: string): string | null {
  const token = createCatalogImageProxyToken(sessionId, imageUrl);
  if (!token) return null;

  return `/api/sessions/${encodeURIComponent(sessionId)}/business/catalog/images/${token}`;
}

export function verifyCatalogImageProxyToken(sessionId: string, token: string): VerifiedCatalogImageToken | null {
  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra !== undefined) return null;

  const expectedSignature = signPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  let payload: CatalogImageTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as CatalogImageTokenPayload;
  } catch {
    return null;
  }

  if (payload.sessionId !== sessionId) return null;
  if (!payload.url || !isAllowedCatalogImageUrl(payload.url)) return null;
  if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;

  return payload;
}

export async function getCatalogImageLocalPath(sessionId: string, imageUrl: string): Promise<string> {
  const hash = createHash('md5').update(imageUrl).digest('hex');
  const dir = join(config.storage.path, 'media', 'catalog', sessionId);
  await fs.mkdir(dir, { recursive: true });
  return join(dir, `${hash}.jpg`);
}

export async function downloadAndCacheCatalogImage(sessionId: string, imageUrl: string): Promise<string> {
  const localPath = await getCatalogImageLocalPath(sessionId, imageUrl);

  // Check if file already exists
  try {
    await fs.access(localPath);
    return localPath; // Already cached
  } catch {
    // Proceed to download
  }

  const response = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(localPath, buffer);
  logger.info({ sessionId, localPath }, 'Catalog image cached locally');
  return localPath;
}

export async function cleanupOrphanedCatalogImages(sessionId: string, activeUrls: string[]): Promise<void> {
  const dir = join(config.storage.path, 'media', 'catalog', sessionId);
  try {
    const files = await fs.readdir(dir);
    const activeHashes = new Set(activeUrls.map(url => `${createHash('md5').update(url).digest('hex')}.jpg`));
    
    for (const file of files) {
      if (file.endsWith('.jpg') && !activeHashes.has(file)) {
        await fs.unlink(join(dir, file)).catch(() => {});
      }
    }
  } catch (error) {
    // Directory may not exist yet, ignore
  }
}
