import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import { logger } from '../lib/logger';

(async () => {
  try {
    logger.info('running migrations...');

    // Wake up Neon — first query often times out on suspended DB
    let ready = false;
    for (let i = 1; i <= 5; i++) {
      try {
        await pool.query('SELECT 1');
        ready = true;
        logger.info('✅ database awake');
        break;
      } catch (err: any) {
        logger.warn(`wake attempt ${i}/5 failed: ${err?.message || err?.code || 'unknown'}`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (!ready) {
      logger.error('❌ Could not connect to database. Check DATABASE_URL in backend/.env');
      process.exit(1);
    }

    const schemaPath = path.join(__dirname, 'schema.sql');
    logger.info('  applying schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    logger.info('  ✅ schema.sql done');

    const migrationsDir = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      logger.info(`  found ${files.length} migration(s)`);
      for (const f of files) {
        logger.info(`  applying ${f}`);
        const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
        try {
          await pool.query(sql);
          logger.info(`  ✅ ${f} done`);
        } catch (err: any) {
          logger.error(`  ❌ ${f} failed`);
          console.error('  message:', err?.message);
          console.error('  detail :', err?.detail);
          console.error('  hint   :', err?.hint);
          console.error('  code   :', err?.code);
          console.error('  position:', err?.position);
          console.error('  stack  :', err?.stack);
          throw err;
        }
      }
    } else {
      logger.warn('  no migrations folder found');
    }

    logger.info('✅ migrations complete');
    await pool.end();
    process.exit(0);
  } catch (e: any) {
    logger.error('❌ migration failed');
    console.error('FULL ERROR:', e);
    console.error('message :', e?.message);
    console.error('detail  :', e?.detail);
    console.error('hint    :', e?.hint);
    console.error('code    :', e?.code);
    console.error('stack   :', e?.stack);
    process.exit(1);
  }
})();