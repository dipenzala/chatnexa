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
