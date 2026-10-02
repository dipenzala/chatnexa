import IORedis, { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const isTls = env.REDIS_URL.startsWith('rediss://');

/**
 * Shared base options — tuned for Upstash free tier + BullMQ.
 *
 * Key settings:
 * - maxRetriesPerRequest: null → BullMQ requirement
 * - enableReadyCheck: false → skip INFO command (Upstash latency)
 * - keepAlive → prevents idle-kill by Upstash
 * - retryStrategy → exponential backoff on disconnect
 * - reconnectOnError → always true so we survive ECONNRESET
 */
const baseOpts: any = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  keepAlive: 20000,
  connectTimeout: 25000,
  family: 4, // IPv4 (avoids IPv6 hangs on some Windows setups)
  retryStrategy: (times: number) => {
    const delay = Math.min(200 + times * 400, 5000);
    if (times % 5 === 0) logger.warn(`redis retry #${times} in ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    // Always reconnect on transient socket errors
    const transientErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'];
    return transientErrors.some((e) => err.message.includes(e));
  },
  lazyConnect: false,
};

if (isTls) {
  baseOpts.tls = { rejectUnauthorized: false };
}

// ============================================================
// Main shared client (used for cache + health check)
// ============================================================
export const redis: Redis = new IORedis(env.REDIS_URL, baseOpts);

let lastErrorTime = 0;
redis.on('error', (e) => {
  const now = Date.now();
  // Throttle: only log every 30 seconds
  if (now - lastErrorTime > 30000) {
    logger.warn('redis error:', e.message);
    lastErrorTime = now;
  }
});
redis.on('connect', () => logger.info('✅ redis connected'));
redis.on('ready', () => logger.info('✅ redis ready'));

// ============================================================
// BullMQ connection factory — each worker gets a fresh instance
// ============================================================
export function createBullConnection(): Redis {
  const conn = new IORedis(env.REDIS_URL, baseOpts);
  conn.on('error', (e) => {
    if (!e.message.includes('ECONNRESET') && !e.message.includes('EPIPE')) {
      logger.warn('bull redis error:', e.message);
    }
  });
  return conn;
}

// Keep backward-compat export (single shared instance for queues)
export const bullConnection = createBullConnection();

// ============================================================
// Cache helpers
// ============================================================
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const v = await redis.get(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch (e: any) {
      logger.warn('cache.get failed:', e.message);
      return null;
    }
  },
  async set(key: string, val: any, ttl = 60) {
    try {
      await redis.set(key, JSON.stringify(val), 'EX', ttl);
    } catch (e: any) {
      logger.warn('cache.set failed:', e.message);
    }
  },
  async del(...keys: string[]) {
    if (!keys.length) return;
    try {
      await redis.del(...keys);
    } catch (e: any) {
      logger.warn('cache.del failed:', e.message);
    }
  },
};
