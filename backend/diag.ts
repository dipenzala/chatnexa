import { pool } from './src/db/pool';
import fs from 'fs';
import path from 'path';

(async () => {
  console.log('=== DIAGNOSTIC START ===');

  // 1. Test DB connection
  try {
    const r = await pool.query('SELECT NOW() AS now');
    console.log('✅ DB connected. Time:', r.rows[0].now);
  } catch (e: any) {
    console.log('❌ DB connection FAILED');
    console.log('   message:', e?.message);
    console.log('   code   :', e?.code);
    console.log('   full   :', JSON.stringify(e, null, 2));
    process.exit(1);
  }

  // 2. Check schema.sql
  const schemaPath = path.join(__dirname, 'src/db/schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.log('❌ schema.sql MISSING at:', schemaPath);
    process.exit(1);
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');
  console.log('✅ schema.sql found, size:', schema.length, 'chars');

  if (schema.length < 100) {
    console.log('⚠️  schema.sql is suspiciously small — likely truncated');
    console.log('Content:', JSON.stringify(schema));
    process.exit(1);
  }

  // 3. Check for bad escapes
  if (schema.includes('\\$')) {
    console.log('⚠️  schema.sql contains \\$ (backslash-dollar). Running fix...');
  } else {
    console.log('✅ schema.sql has no \\$ escapes');
  }

  // 4. Test running schema
  try {
    await pool.query(schema);
    console.log('✅ schema.sql executed successfully');
  } catch (e: any) {
    console.log('❌ schema.sql FAILED');
    console.log('   message:', e?.message);
    console.log('   detail :', e?.detail);
    console.log('   hint   :', e?.hint);
    console.log('   code   :', e?.code);
    console.log('   position:', e?.position);
    process.exit(1);
  }

  // 5. Check migrations folder
  const migDir = path.join(__dirname, 'src/db/migrations');
  if (fs.existsSync(migDir)) {
    const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));
    console.log('✅ migrations folder found:', files);
    for (const f of files) {
      try {
        const sql = fs.readFileSync(path.join(migDir, f), 'utf8');
        await pool.query(sql);
        console.log(`✅ ${f} OK`);
      } catch (e: any) {
        console.log(`❌ ${f} FAILED:`, e?.message, '| code:', e?.code, '| pos:', e?.position);
      }
    }
  } else {
    console.log('⚠️  migrations folder missing:', migDir);
  }

  console.log('=== DIAGNOSTIC DONE ===');
  await pool.end();
  process.exit(0);
})();
