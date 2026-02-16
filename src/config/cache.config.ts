import Redis from 'ioredis';
import { env } from './env.config';

// ==================== CONNECTION ====================
export const cacheRedis = new Redis({
  host: env.REDIS_CACHE_HOST,
  port: env.REDIS_CACHE_PORT,
  password: env.REDIS_CACHE_PASSWORD || undefined,
  db: 0,
  lazyConnect: true,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  reconnectOnError: (err: Error) => {
    return err.message.includes('READONLY');
  },
});

cacheRedis.on('connect', () => {
  console.log('Cache Redis connected');
});

cacheRedis.on('error', (err: Error) => {
  console.error('Cache Redis error:', err.message);
});

cacheRedis.on('reconnecting', () => {
  console.warn('Cache Redis reconnecting...');
});

cacheRedis.connect().catch((err: Error) => {
  console.error('Cache Redis initial connect failed:', err.message);
});

// ==================== TYPES ====================

const CACHE_PREFIX = 'cache:' as const;

type CacheTTL = number;

interface CacheSetOptions {
  ttl?: CacheTTL;
  nx?: boolean;
}

// ==================== HELPERS ====================

function buildKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

// ==================== CACHE API ====================

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await cacheRedis.get(buildKey(key));
    if (raw === null) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  /**
   * Set a cached value with optional TTL (seconds).
   */
  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    const serialized = JSON.stringify(value);
    const fullKey = buildKey(key);

    if (options.nx) {
      // SET ... NX [EX seconds]
      if (options.ttl) {
        await cacheRedis.set(fullKey, serialized, 'EX', options.ttl, 'NX');
      } else {
        await cacheRedis.set(fullKey, serialized, 'NX');
      }
    } else if (options.ttl) {
      await cacheRedis.setex(fullKey, options.ttl, serialized);
    } else {
      await cacheRedis.set(fullKey, serialized);
    }
  },

  /**
   * Delete one or more keys.
   */
  async del(...keys: [string, ...string[]]): Promise<void> {
    await cacheRedis.del(...keys.map(buildKey));
  },

  /**
   * Delete all keys matching a glob pattern (scoped to CACHE_PREFIX).
   * Pattern examples: '*', 'user:*', 'session:abc'
   */
  async clear(pattern: string = '*'): Promise<number> {
    const fullPattern = buildKey(pattern);
    const keys = await cacheRedis.keys(fullPattern);

    if (keys.length === 0) return 0;

    // keys() returns already-prefixed keys — pass them raw, do NOT re-prefix
    await cacheRedis.del(...(keys as [string, ...string[]]));
    return keys.length;
  },

  /**
   * Check if a key exists.
   */
  async has(key: string): Promise<boolean> {
    return (await cacheRedis.exists(buildKey(key))) === 1;
  },

  /**
   * Get remaining TTL in seconds (-1 = no expiry, -2 = not found).
   */
  async ttl(key: string): Promise<number> {
    return cacheRedis.ttl(buildKey(key));
  },

  /**
   * Atomically get-or-set: returns cached value, or calls factory + caches result.
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheSetOptions = {}
  ): Promise<T> {
    const cached = await cache.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await factory();
    await cache.set(key, fresh, options);
    return fresh;
  },

  /**
   * Increment a counter. Returns the new value.
   */
  async increment(key: string, by = 1): Promise<number> {
    return by === 1
      ? cacheRedis.incr(buildKey(key))
      : cacheRedis.incrby(buildKey(key), by);
  },
} as const;

export type Cache = typeof cache;
