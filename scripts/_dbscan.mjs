import pg from 'pg';

const sup = new pg.Pool({ connectionString: 'postgresql://postgres:eH1iY9L16Y0OXvJ_CNJHQ9Q7@127.0.0.1:5432/postgres', max: 1 });
try {
  const r = await sup.query("SELECT datname FROM pg_database WHERE datistemplate = false");
  console.log('local databases:', r.rows.map((x) => x.datname).join(', '));
} catch (e) { console.log('local postgres ERR', e.message.split('\n')[0]); }
try { await sup.end(); } catch {}

async function check(dbname) {
  const p = new pg.Pool({ connectionString: `postgresql://postgres:eH1iY9L16Y0OXvJ_CNJHQ9Q7@127.0.0.1:5432/${dbname}`, max: 1 });
  try {
    const t = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('admins','sessions') ORDER BY table_name");
    console.log(`${dbname}: tables=`, t.rows.map((r) => r.table_name).join(',') || '(none)');
    if (t.rows.length) {
      const a = await p.query("SELECT id, email FROM admins");
      console.log(`  admins rows:`, a.rows.map((r) => r.email).join(', ') || '(empty)');
      const s = await p.query("SELECT count(*) FROM sessions");
      console.log(`  sessions count:`, s.rows[0].count);
    }
  } catch (e) { console.log(`${dbname}: ERR `, e.message.split('\n')[0]); }
  try { await p.end(); } catch {}
}
await check('stillcraft');
await check('postgres');
process.exit(0);