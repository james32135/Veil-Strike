import pg from 'pg';
import { config } from '../config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

/** Run a single parameterised query */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

/** Auto-create all tables on first run */
export async function initializeDatabase(): Promise<void> {
  console.log('[DB] Initializing schema...');

  await pool.query(`
    -- Markets registry (replaces dynamic-markets.json)
    CREATE TABLE IF NOT EXISTS markets (
      id TEXT PRIMARY KEY,
      question_hash TEXT NOT NULL DEFAULT '',
      question TEXT NOT NULL,
      outcomes JSONB NOT NULL DEFAULT '["Yes","No"]',
      is_lightning BOOLEAN NOT NULL DEFAULT false,
      token_type TEXT DEFAULT 'ALEO',
      image_url TEXT,
      bot_end_time BIGINT,
      series_id TEXT,
      round_number INTEGER,
      start_price DOUBLE PRECISION,
      time_slot TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Series (persistent market groups for rolling rounds)
    CREATE TABLE IF NOT EXISTS series (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      asset TEXT NOT NULL,
      icon_url TEXT,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'Crypto',
      duration_seconds INTEGER NOT NULL DEFAULT 900,
      token_type TEXT NOT NULL DEFAULT 'ALEO',
      total_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_rounds INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Market tags for multi-tag filtering
    CREATE TABLE IF NOT EXISTS market_tags (
      market_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (market_id, tag)
    );

    -- Proposals (replaces governance-registry.json)
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      tx_id TEXT,
      resolved_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      action_type INTEGER NOT NULL DEFAULT 0,
      target_market TEXT NOT NULL DEFAULT '0field',
      amount TEXT NOT NULL DEFAULT '0',
      recipient TEXT NOT NULL DEFAULT '',
      token_type INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL DEFAULT 0
    );

    -- Round bot state (single row)
    CREATE TABLE IF NOT EXISTS round_bot_state (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      resolver_address TEXT NOT NULL DEFAULT '',
      started_at BIGINT NOT NULL DEFAULT 0,
      total_rounds_created INTEGER NOT NULL DEFAULT 0,
      total_rounds_settled INTEGER NOT NULL DEFAULT 0,
      total_rounds_skipped INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Round bot slots
    CREATE TABLE IF NOT EXISTS round_bot_slots (
      slot_id TEXT PRIMARY KEY,
      asset TEXT NOT NULL,
      token_type TEXT NOT NULL,
      program_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'idle',
      market_id TEXT,
      tx_id TEXT,
      start_price DOUBLE PRECISION NOT NULL DEFAULT 0,
      start_time BIGINT NOT NULL DEFAULT 0,
      end_time BIGINT NOT NULL DEFAULT 0,
      round_number INTEGER NOT NULL DEFAULT 1,
      total_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
      error TEXT,
      last_settle_tx_id TEXT,
      settle_retries INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Price history (replaces in-memory array)
    CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      btc DOUBLE PRECISION NOT NULL DEFAULT 0,
      eth DOUBLE PRECISION NOT NULL DEFAULT 0,
      aleo DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp DESC);

    -- Pending market metadata (replaces in-memory pendingMetaByHash)
    CREATE TABLE IF NOT EXISTS pending_market_meta (
      question_hash TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      outcomes JSONB NOT NULL DEFAULT '["Yes","No"]',
      is_lightning BOOLEAN NOT NULL DEFAULT false,
      created_at BIGINT NOT NULL DEFAULT 0
    );

    -- Scanner state (single row)
    CREATE TABLE IF NOT EXISTS scanner_state (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      last_scanned_block BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Event log (audit trail)
    CREATE TABLE IF NOT EXISTS event_log (
      id SERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at DESC);
  `);

  // ── Migrate existing tables: add columns that may not exist yet ──
  const alterQueries = [
    `ALTER TABLE markets ADD COLUMN IF NOT EXISTS series_id TEXT`,
    `ALTER TABLE markets ADD COLUMN IF NOT EXISTS round_number INTEGER`,
    `ALTER TABLE markets ADD COLUMN IF NOT EXISTS start_price DOUBLE PRECISION`,
    `ALTER TABLE markets ADD COLUMN IF NOT EXISTS time_slot TEXT`,
    `ALTER TABLE series ALTER COLUMN total_volume TYPE DOUBLE PRECISION`,
  ];
  for (const q of alterQueries) {
    await pool.query(q).catch(() => {});
  }

  // Seed singleton rows
  await pool.query(`
    INSERT INTO scanner_state (id, last_scanned_block) VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING;
  `);
  await pool.query(`
    INSERT INTO round_bot_state (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING;
  `);

  console.log('[DB] Schema ready');
}

/** Seed the 3 default Strike Round series if they don't exist yet */
export async function seedDefaultSeries(): Promise<void> {
  const defaults = [
    {
      id: 'series-btc', slug: 'btc-up-or-down',
      title: 'Bitcoin Up or Down', subtitle: '15 Minutes',
      asset: 'BTC', description: 'Predict whether Bitcoin price will go up or down in the next 15 minutes. Fully private on Aleo.',
      category: 'Crypto', duration_seconds: 900, token_type: 'ALEO',
    },
    {
      id: 'series-eth', slug: 'eth-up-or-down',
      title: 'Ethereum Up or Down', subtitle: '15 Minutes',
      asset: 'ETH', description: 'Predict whether Ethereum price will go up or down in the next 15 minutes. Fully private on Aleo.',
      category: 'Crypto', duration_seconds: 900, token_type: 'ALEO',
    },
    {
      id: 'series-aleo', slug: 'aleo-up-or-down',
      title: 'ALEO Up or Down', subtitle: '15 Minutes',
      asset: 'ALEO', description: 'Predict whether ALEO price will go up or down in the next 15 minutes. Fully private on Aleo.',
      category: 'Crypto', duration_seconds: 900, token_type: 'ALEO',
    },
  ];
  for (const s of defaults) {
    await pool.query(
      `INSERT INTO series (id, slug, title, subtitle, asset, description, category, duration_seconds, token_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [s.id, s.slug, s.title, s.subtitle, s.asset, s.description, s.category, s.duration_seconds, s.token_type],
    );
  }
  console.log('[DB] Default series seeded');
}

/** Delete old price_history rows (keep last 2 hours) */
export async function cleanupOldPrices(): Promise<void> {
  const cutoff = Date.now() - 120 * 60 * 1000;
  await pool.query('DELETE FROM price_history WHERE timestamp < $1', [cutoff]);
}

/** Get all active series from DB */
export async function getAllSeries(): Promise<any[]> {
  const { rows } = await pool.query('SELECT * FROM series WHERE is_active = true ORDER BY created_at');
  return rows;
}

/** Get a single series by slug */
export async function getSeriesBySlug(slug: string): Promise<any | null> {
  const { rows } = await pool.query('SELECT * FROM series WHERE slug = $1', [slug]);
  return rows[0] || null;
}

/** Increment series stats after a round settles */
export async function updateSeriesStats(seriesId: string, addVolume: number): Promise<void> {
  await pool.query(
    `UPDATE series SET total_volume = total_volume + $1, total_rounds = total_rounds + 1 WHERE id = $2`,
    [addVolume, seriesId],
  );
}

/** Map asset name to series ID */
export function assetToSeriesId(asset: string): string {
  return `series-${asset.toLowerCase()}`;
}

/** Log an event to the audit trail */
export async function logEvent(eventType: string, payload?: unknown): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO event_log (event_type, payload) VALUES ($1, $2)',
      [eventType, payload ? JSON.stringify(payload) : null],
    );
  } catch (err) {
    console.error('[DB] logEvent failed:', err);
  }
}
