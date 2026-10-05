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
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
    ];
    // Allow any vercel.app or trycloudflare.com subdomain (dev convenience)
    if (!origin) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin.endsWith('.trycloudflare.com')) return callback(null, true);
    return callback(null, true); // TEMP: allow all in dev
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
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

app.get('/health', (_req, res) => {
  res.json({
    ok: true, ts: new Date().toISOString(), uptime: Math.round(process.uptime()),
    services: {
      postgres: 'unknown',
      redis: redis.status === 'ready' ? 'up' : 'connecting',
      openai: env.OPENAI_API_KEY ? 'configured' : 'not_configured',
    },
  });
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
