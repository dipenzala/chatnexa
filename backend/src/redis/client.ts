import IORedis, { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from '../lib/logger';

/**
 * SIMPLE + WORKING Redis client for Upstash free tier.
 *
 * Key decisions:
 * - Single shared connection (avoid connection-limit hits)
 * - No family:4 (TLS+IPv4 issue on Windows)
 * - Simple retry strategy (no cap bomb)
 * - enableReadyCheck:false (Upstash latency)
 */

const isTls = env.REDIS_URL.startsWith('rediss://');

const opts: any = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  connectTimeout: 30000,
  retryStrategy: (times: number) => {
    // Never exceed 2 seconds between retries
    return Math.min(times * 200, 2000);
  },
};

if (isTls) opts.tls = { rejectUnauthorized: false };

// ============================================================
// ONE shared client — used for cache + health + BullMQ
// ============================================================
export const redis: Redis = new IORedis(env.REDIS_URL, opts);

// Throttle connection logs to avoid spam
let lastLog = 0;
function logThrottled(msg: string, level: 'info' | 'warn' = 'info') {
  const now = Date.now();
  if (now - lastLog < 30000) return;
  lastLog = now;
  if (level === 'warn') logger.warn(msg);
  else logger.info(msg);
}

redis.on('connect', () => logThrottled('✅ redis connected'));
redis.on('ready', () => logThrottled('✅ redis ready'));
redis.on('error', (e) => {
  // Silence ECONNRESET/EPIPE — they self-heal
  if (e.message.includes('ECONNRESET') || e.message.includes('EPIPE')) return;
  logThrottled(`redis error: ${e.message}`, 'warn');
});

// ============================================================
// BullMQ uses the SAME shared instance (BullMQ v5 handles multiplexing)
// ============================================================
export const bullConnection = redis;

// ============================================================
// Cache helpers
// ============================================================
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const v = await redis.get(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch { return null; }
  },
  async set(key: string, val: any, ttl = 60) {
    try { await redis.set(key, JSON.stringify(val), 'EX', ttl); } catch {}
  },
  async del(...keys: string[]) {
    if (!keys.length) return;
    try { await redis.del(...keys); } catch {}
  },
};
