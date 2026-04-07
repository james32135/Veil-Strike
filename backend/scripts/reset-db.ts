import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://veil_strike_db_user:SED6aSgTI5EdiXePYHXkXNprixVQzpfi@dpg-d78r78hr0fns73e401ug-a.oregon-postgres.render.com/veil_strike_db';

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tables = [
  'markets',
  'series',
  'market_tags',
  'proposals',
  'round_bot_state',
  'round_bot_slots',
  'price_history',
  'pending_market_meta',
  'scanner_state',
  'event_log',
];

async function main() {
  console.log('Connecting to PostgreSQL...');

  for (const t of tables) {
    try {
      await pool.query(`TRUNCATE TABLE ${t} CASCADE`);
      console.log(`TRUNCATED: ${t}`);
    } catch (e: any) {
      console.log(`SKIP ${t}: ${e.message}`);
    }
  }

  // Re-seed singleton rows
  await pool.query(`
    INSERT INTO scanner_state (id, last_scanned_block) VALUES (1, 0)
    ON CONFLICT (id) DO UPDATE SET last_scanned_block = 0, updated_at = NOW()
  `);
  await pool.query(`
    INSERT INTO round_bot_state (id, resolver_address, total_rounds_created, total_rounds_settled, total_rounds_skipped, started_at)
    VALUES (1, '', 0, 0, 0, 0)
    ON CONFLICT (id) DO UPDATE SET
      resolver_address = '',
      total_rounds_created = 0,
      total_rounds_settled = 0,
      total_rounds_skipped = 0,
      started_at = 0,
      updated_at = NOW()
  `);
  console.log('Re-seeded: scanner_state + round_bot_state');

  await pool.end();
  console.log('DONE — Database cleared for mainnet');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
