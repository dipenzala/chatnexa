import { Pool, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 25_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
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
  logger.error('❌ postgres failed after retries');
  return false;
}
