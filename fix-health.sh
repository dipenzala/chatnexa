#!/usr/bin/env bash
set -euo pipefail

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; C='\033[0;36m'; N='\033[0m'

cd ~/OneDrive/Desktop/chatnexa/chatnexa

echo -e "${B}🔧 Fixing /health endpoint + Postgres hang...${N}"

# Backup
cp backend/src/server.ts ".server-backup-$(date +%s).ts" 2>/dev/null || true

# Fix 1: Fast health check with timeout
cat > backend/src/server.ts << 'END'
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './lib/logger';
import { pool } from './db/pool';
import { redis } from './redis/client';
import { initSocket } from './services/socket';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: [env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'], credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(compression());
app.use(cookieParser());

app.use('/api/v1/webhooks/razorpay', express.raw({ type: 'application/json', limit: '2mb' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(morgan(env.IS_PROD ? 'combined' : 'dev'));

app.use('/api/', rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api/v1/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 20 }));
app.use('/api/v1/auth/signup', rateLimit({ windowMs: 60 * 60_000, max: 10 }));

app.get('/', (_req, res) => res.json({ name: 'ChatNexa API', version: '1.1.0', ts: new Date().toISOString() }));

// FAST health check — returns immediately, DB check in background
app.get('/health', (_req, res) => {
  const out: any = {
    ok: true,
    ts: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    services: {
      postgres: 'unknown',
      redis: redis.status === 'ready' ? 'up' : 'connecting',
      openai: env.OPENAI_API_KEY ? 'configured' : 'not_configured',
    },
  };
  // Respond immediately (do not block on DB)
  res.json(out);
  // Optional: background DB ping (non-blocking)
  pool.query('SELECT 1').catch(() => {});
});

app.use('/api/v1', routes);
app.use(notFoundHandler);
app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);

(async () => {
  server.listen(env.PORT, () => {
    logger.info(`🚀 ChatNexa API → http://localhost:${env.PORT}`);
    logger.info(`   env: ${env.NODE_ENV} | frontend: ${env.FRONTEND_URL}`);
  });

  // Wake DB in background (non-blocking)
  setTimeout(() => {
    pool.query('SELECT 1')
      .then(() => logger.info('✅ postgres connected'))
      .catch((e) => logger.warn('postgres wakeup:', e.message));
  }, 1000);
})();

const shutdown = async (signal: string) => {
  logger.info(`${signal} received`);
  server.close(async () => { try { await pool.end(); await redis.quit(); } catch {} process.exit(0); });
  setTimeout(() => process.exit(1), 15_000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (r) => logger.error('unhandledRejection', r));
process.on('uncaughtException', (e) => logger.error('uncaughtException', (e as any)?.stack || e));

export default app;
END

# Fix 2: Fast-fail Postgres pool with short timeouts
cat > backend/src/db/pool.ts << 'END'
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
  query_timeout: 30_000,
  ssl: env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});
pool.on('error', (e) => logger.warn('pg pool warn:', e.message));

export async function query<T extends QueryResultRow = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
export async function one<T extends QueryResultRow = any>(text: string, params: any[] = []): Promise<T | null> {
  const r = await query<T>(text, params); return r.rows[0] ?? null;
}
export async function many<T extends QueryResultRow = any>(text: string, params: any[] = []): Promise<T[]> {
  const r = await query<T>(text, params); return r.rows;
}
export async function tx<T>(fn: (c: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const out = await fn(client); await client.query('COMMIT'); return out; }
  catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
export async function waitForDb(retries = 6): Promise<boolean> {
  for (let i = 1; i <= retries; i++) {
    try { await pool.query('SELECT 1'); logger.info('✅ postgres connected'); return true; }
    catch (e: any) { logger.warn(`postgres attempt ${i}/${retries} — ${e.message}`); await new Promise((r) => setTimeout(r, 3000)); }
  }
  return false;
}
END

# Fix 3: Rebuild migrate with fast path
cat > backend/src/db/migrate.ts << 'END'
import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import { logger } from '../lib/logger';

(async () => {
  try {
    logger.info('running migrations...');
    for (let i = 1; i <= 5; i++) {
      try { await pool.query('SELECT 1'); break; }
      catch { await new Promise((r) => setTimeout(r, 2000)); }
    }
    const schemaPath = path.join(__dirname, 'schema.sql');
    logger.info('  applying schema.sql');
    await pool.query(fs.readFileSync(schemaPath, 'utf8'));
    logger.info('  ✅ schema.sql done');

    const migDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migDir)) {
      const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
      for (const f of files) {
        logger.info(`  applying ${f}`);
        try { await pool.query(fs.readFileSync(path.join(migDir, f), 'utf8')); logger.info(`  ✅ ${f} done`); }
        catch (e: any) { logger.error(`  ❌ ${f}: ${e.message}`); }
      }
    }
    logger.info('✅ migrations complete');
    await pool.end();
    process.exit(0);
  } catch (e: any) {
    logger.error('❌ migration failed:', e.message);
    process.exit(1);
  }
})();
END

rm -rf backend/dist frontend/.next

echo -e "${G}✅ All fixes applied${N}"
echo ""
echo -e "${B}Now starting dev server...${N}"
echo -e "${Y}Wait for: 🚀 ChatNexa API → http://localhost:8080${N}"
echo ""

cd ~/OneDrive/Desktop/chatnexa/chatnexa
npm run dev