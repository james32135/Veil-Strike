import { config } from '../config';
import { query } from './db';
import type { MarketInfo } from '../types';

let marketsCache: MarketInfo[] = [];

// Off-chain metadata for markets (question text, outcomes, etc. not stored on-chain)
export interface MarketMeta {
  questionHash: string;
  question: string;
  outcomes: string[];
  isLightning: boolean;
  tokenType?: 'ALEO' | 'USDCX' | 'USAD';
  imageUrl?: string;
  botEndTime?: number; // Wall-clock ms timestamp for round-bot markets
  seriesId?: string;
  roundNumber?: number;
  startPrice?: number;
  timeSlot?: string;
}

// ── Database persistence for dynamically discovered/registered markets ──

/** Load all market metadata from PostgreSQL on startup */
export async function loadRegistryFromDB(): Promise<void> {
  try {
    // Remove known test/dev event markets and placeholder scanner artifacts
    await query(
      `DELETE FROM markets WHERE question ILIKE '%US forces enter Iran%' OR question ILIKE '%Fed Decision in June%' OR question ~ '^Market [0-9]{5,}'`
    );

    const { rows } = await query('SELECT * FROM markets');
    for (const row of rows) {
      MARKET_REGISTRY[row.id] = {
        questionHash: row.question_hash || '',
        question: row.question,
        outcomes: row.outcomes || ['Yes', 'No'],
        isLightning: row.is_lightning || false,
        tokenType: row.token_type || undefined,
        imageUrl: row.image_url || undefined,
        botEndTime: row.bot_end_time ? Number(row.bot_end_time) : undefined,
        startPrice: row.start_price ? Number(row.start_price) : undefined,
        seriesId: row.series_id || undefined,
        roundNumber: row.round_number ? Number(row.round_number) : undefined,
        timeSlot: row.time_slot || undefined,
      };
    }
    console.log(`[Indexer] Loaded ${rows.length} market(s) from database`);
  } catch (err) {
    console.error('[Indexer] Failed to load registry from DB:', err);
  }
}

// Registry of known market IDs with their off-chain metadata
// v7: Seed registry is empty — all markets are discovered dynamically via scanner
// or registered via POST /api/markets/register. Legacy v5 seeds removed.
const SEED_REGISTRY: Record<string, MarketMeta> = {};

// Merge seed + dynamic (DB-loaded) registries
// Seed entries take priority — they have curated question text & correct metadata
const MARKET_REGISTRY: Record<string, MarketMeta> = {
  ...SEED_REGISTRY,
};

const STATUS_MAP: Record<number, MarketInfo['status']> = {
  1: 'active',
  2: 'closed',
  3: 'resolved',
  4: 'cancelled',
  5: 'pending_resolution',
};

const CATEGORY_MAP: Record<number, string> = {
  1: 'Crypto',
  2: 'Privacy',
  3: 'DeFi',
  4: 'Governance',
  5: 'Whale Watch',
  6: 'Geopolitics',
  7: 'AI',
  8: 'Sports',
  9: 'Culture',
  10: 'Other',
};

const TOKEN_TYPE_MAP: Record<number, string> = {
  0: 'ALEO',
  1: 'USDCX',
  2: 'USAD',
};

// Average block time on mainnet (~3-4s real, using 15s for conservative UI timestamps)
const BLOCK_TIME_SECONDS = 15;

function parseAleoValue(val: string): string {
  return val.replace(/u\d+$|field$|group$|address$|scalar$/, '');
}

function blockHeightToTimestamp(blockHeight: number, currentBlock: number): number {
  const blocksUntilDeadline = blockHeight - currentBlock;
  return Date.now() + blocksUntilDeadline * BLOCK_TIME_SECONDS * 1000;
}

function blockHeightToCreatedTimestamp(createdBlock: number, currentBlock: number): number {
  const blocksSinceCreation = currentBlock - createdBlock;
  return Date.now() - blocksSinceCreation * BLOCK_TIME_SECONDS * 1000;
}

async function fetchMapping(mappingName: string, key: string, programId?: string): Promise<string | null> {
  try {
    const pid = programId || config.programId;
    const url = `${config.aleoEndpoint}/${config.aleoNetwork}/program/${pid}/mapping/${mappingName}/${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    // API returns JSON-encoded strings — unwrap the outer quotes
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

async function fetchCurrentBlockHeight(): Promise<number> {
  try {
    const res = await fetch(`${config.aleoEndpoint}/${config.aleoNetwork}/block/height/latest`);
    if (!res.ok) return 15044000;
    const text = await res.text();
    return parseInt(text, 10);
  } catch {
    return 15044000;
  }
}

interface AleoMarket {
  id: string;
  creator: string;
  resolver: string;
  question_hash: string;
  category: number;
  num_outcomes: number;
  deadline: number;
  resolution_deadline: number;
  status: number;
  created_at: number;
  token_type: number;
}

interface AleoPool {
  market_id: string;
  reserve_1: number;
  reserve_2: number;
  reserve_3: number;
  reserve_4: number;
  total_liquidity: number;
  total_lp_shares: number;
  total_volume: number;
}

function parseAleoStruct(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const cleaned = raw.replace(/^\{|\}$/g, '').trim();
  const parts = cleaned.split(',');
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx).trim();
    const value = part.slice(colonIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

function parseMarketStruct(raw: string): AleoMarket | null {
  try {
    const fields = parseAleoStruct(raw);
    return {
      id: fields['id'] || '',
      creator: fields['creator'] || '',
      resolver: fields['resolver'] || '',
      question_hash: fields['question_hash'] || '',
      category: parseInt(parseAleoValue(fields['category'] || '0'), 10),
      num_outcomes: parseInt(parseAleoValue(fields['num_outcomes'] || '2'), 10),
      deadline: parseInt(parseAleoValue(fields['deadline'] || '0'), 10),
      resolution_deadline: parseInt(parseAleoValue(fields['resolution_deadline'] || '0'), 10),
      status: parseInt(parseAleoValue(fields['status'] || '1'), 10),
      created_at: parseInt(parseAleoValue(fields['created_at'] || '0'), 10),
      token_type: parseInt(parseAleoValue(fields['token_type'] || '0'), 10),
    };
  } catch {
    return null;
  }
}

function parsePoolStruct(raw: string): AleoPool | null {
  try {
    const fields = parseAleoStruct(raw);
    return {
      market_id: fields['market_id'] || '',
      reserve_1: parseInt(parseAleoValue(fields['reserve_1'] || '0'), 10),
      reserve_2: parseInt(parseAleoValue(fields['reserve_2'] || '0'), 10),
      reserve_3: parseInt(parseAleoValue(fields['reserve_3'] || '0'), 10),
      reserve_4: parseInt(parseAleoValue(fields['reserve_4'] || '0'), 10),
      total_liquidity: parseInt(parseAleoValue(fields['total_liquidity'] || '0'), 10),
      total_lp_shares: parseInt(parseAleoValue(fields['total_lp_shares'] || '0'), 10),
      total_volume: parseInt(parseAleoValue(fields['total_volume'] || '0'), 10),
    };
  } catch {
    return null;
  }
}

export async function fetchMarketsFromChain(): Promise<MarketInfo[]> {
  const currentBlock = await fetchCurrentBlockHeight();
  const entries = Object.entries(MARKET_REGISTRY);

  // Fetch all markets in parallel for dramatically faster loading
  const results = await Promise.allSettled(
    entries.map(async ([marketId, meta]): Promise<MarketInfo | null> => {
      try {
        const pid = meta.tokenType === 'USDCX' ? config.programIdCx
          : meta.tokenType === 'USAD' ? config.programIdSd : config.programId;

        const [marketRaw, poolRaw] = await Promise.all([
          fetchMapping('markets', marketId, pid),
          fetchMapping('amm_pools', marketId, pid),
        ]);

        if (!marketRaw || !poolRaw) return null;

        const market = parseMarketStruct(marketRaw);
        const pool = parsePoolStruct(poolRaw);
        if (!market || !pool) return null;

        const tokenType = market.token_type;

        const reserves: number[] = [];
        reserves.push(pool.reserve_1);
        reserves.push(pool.reserve_2);
        if (market.num_outcomes >= 3) reserves.push(pool.reserve_3);
        if (market.num_outcomes >= 4) reserves.push(pool.reserve_4);

        let resolvedOutcome: number | undefined;
        if (market.status === 3 || market.status === 5) {
          try {
            const resRaw = await fetchMapping('market_resolutions', marketId, pid);
            if (resRaw) {
              const resFields = parseAleoStruct(resRaw);
              const wo = parseInt(parseAleoValue(resFields['winning_outcome'] || '0'), 10);
              if (wo > 0) resolvedOutcome = wo - 1;
            }
          } catch {}
        }

        return {
          id: marketId,
          question: meta.question,
          category: CATEGORY_MAP[market.category] || 'Other',
          outcomes: meta.outcomes,
          reserves,
          totalLiquidity: pool.total_liquidity,
          totalVolume: pool.total_volume,
          tradeCount: 0,
          status: STATUS_MAP[market.status] || 'active',
          endTime: meta.botEndTime || blockHeightToTimestamp(market.deadline, currentBlock),
          createdAt: blockHeightToCreatedTimestamp(market.created_at, currentBlock),
          isLightning: meta.isLightning,
          tokenType: TOKEN_TYPE_MAP[tokenType] || 'ALEO',
          resolvedOutcome,
          imageUrl: meta.imageUrl,
          startPrice: meta.startPrice,
          seriesId: meta.seriesId,
          roundNumber: meta.roundNumber,
          timeSlot: meta.timeSlot,
        };
      } catch (err) {
        console.error(`[Indexer] Error fetching market ${marketId.slice(0, 20)}...`, err);
        return null;
      }
    })
  );

  const markets = results
    .filter((r): r is PromiseFulfilledResult<MarketInfo | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((m): m is MarketInfo => m !== null);

  // Filter out placeholder markets with no real metadata (scanner artifacts)
  const realMarkets = markets.filter((m) => !m.question.match(/^Market \d{5,}\.\.\./));

  // Only log when count changes to reduce noise
  if (realMarkets.length !== marketsCache.length) {
    console.log(`[Indexer] Fetched ${realMarkets.length} markets from chain (${markets.length - realMarkets.length} placeholder(s) hidden)`);
  }
  return realMarkets;
}

export function getCachedMarkets(): MarketInfo[] {
  return marketsCache;
}

// Track markets we've locally resolved (via round-bot flash_settle success)
// so the chain re-fetch doesn't overwrite them back to "active" before on-chain
// status catches up. Entries are cleaned up once the chain confirms resolved.
const locallyResolvedIds = new Map<string, number>(); // marketId → resolvedOutcome (0-indexed)

/**
 * Immediately mark a market as resolved in the in-memory cache.
 * Called by round-bot right after a successful flash_settle so the frontend
 * sees the status change on the next SSE broadcast (≤15s) instead of waiting
 * for a full chain re-fetch of 1000+ markets.
 */
export function markMarketResolved(marketId: string, outcome: number): void {
  const resolvedOutcome = outcome - 1; // on-chain 1=UP,2=DOWN → frontend 0=UP,1=DOWN
  locallyResolvedIds.set(marketId, resolvedOutcome);
  const idx = marketsCache.findIndex((m) => m.id === marketId);
  if (idx >= 0) {
    marketsCache[idx] = {
      ...marketsCache[idx],
      status: 'resolved',
      resolvedOutcome,
    };
    console.log(`[Indexer] Marked market ${marketId.slice(0, 16)}... as resolved (outcome=${outcome}) in cache`);
  }
}

/**
 * Update the market cache by merging new data instead of blindly replacing.
 * The Aleo mapping API is flaky and can return partial results (35 instead of 66).
 * If the new fetch is missing active/pending markets that exist in the old cache,
 * we keep them so active Strike Rounds never vanish from the frontend.
 */
export function setCachedMarkets(markets: MarketInfo[]): void {
  if (marketsCache.length === 0 || markets.length === 0) {
    // First load or empty result — just set directly
    marketsCache = markets;
    return;
  }

  // Apply local overrides: markets we've resolved via flash_settle but chain
  // hasn't caught up yet. Once chain confirms (status !== 'active'), clean up.
  const finalMarkets = markets.map((m) => {
    const localOutcome = locallyResolvedIds.get(m.id);
    if (localOutcome !== undefined) {
      if (m.status === 'resolved' || m.status === 'cancelled') {
        // Chain caught up — remove local override
        locallyResolvedIds.delete(m.id);
        return m;
      }
      // Chain still shows active — keep our local resolved status
      return { ...m, status: 'resolved' as const, resolvedOutcome: localOutcome };
    }
    return m;
  });

  const newById = new Map(finalMarkets.map((m) => [m.id, m]));

  // Preserve active / pending_resolution markets from old cache that are missing
  // from the new fetch (likely dropped by a partial Aleo API response).
  const preserved: MarketInfo[] = [];
  for (const old of marketsCache) {
    if (!newById.has(old.id) && (old.status === 'active' || old.status === 'pending_resolution')) {
      preserved.push(old);
    }
  }

  marketsCache = [...finalMarkets, ...preserved];
  if (preserved.length > 0) {
    console.log(`[Indexer] Preserved ${preserved.length} active market(s) missing from chain fetch`);
  }
}

export function registerMarket(marketId: string, meta: MarketMeta): boolean {
  const existing = MARKET_REGISTRY[marketId];
  if (existing) {
    // Allow updating placeholder entries (scanner discovers first with generic data,
    // then frontend POST /register arrives with real question/isLightning/tokenType)
    const isPlaceholder = existing.question.startsWith('Market ') && existing.question.includes('...');
    if (isPlaceholder && meta.question && !meta.question.startsWith('Market ')) {
      Object.assign(existing, meta);
      return true;
    }
    // Merge missing fields — scanner registers partial data first,
    // then round-bot fills in botEndTime, startPrice, seriesId, etc.
    let merged = false;
    for (const key of Object.keys(meta) as (keyof MarketMeta)[]) {
      if (meta[key] !== undefined && meta[key] !== null && existing[key] === undefined) {
        (existing as any)[key] = meta[key];
        merged = true;
      }
    }
    return merged;
  }
  MARKET_REGISTRY[marketId] = meta;
  return true;
}

/**
 * Persist all dynamically registered markets to the database.
 * Called after scanner discovers new markets or after manual registration.
 */
export async function persistRegistry(): Promise<void> {
  const entries = Object.entries(MARKET_REGISTRY).filter(([id]) => !SEED_REGISTRY[id]);
  if (entries.length === 0) return;

  try {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const [id, meta] of entries) {
      placeholders.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 11})`,
      );
      values.push(
        id,
        meta.questionHash || '',
        meta.question,
        JSON.stringify(meta.outcomes),
        meta.isLightning || false,
        meta.tokenType || 'ALEO',
        meta.imageUrl || null,
        meta.botEndTime || null,
        meta.seriesId || null,
        meta.roundNumber || null,
        meta.startPrice || null,
        meta.timeSlot || null,
      );
      idx += 12;
    }
    await query(
      `INSERT INTO markets (id, question_hash, question, outcomes, is_lightning, token_type, image_url, bot_end_time, series_id, round_number, start_price, time_slot)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (id) DO UPDATE SET
         question_hash = EXCLUDED.question_hash,
         question = EXCLUDED.question,
         outcomes = EXCLUDED.outcomes,
         is_lightning = EXCLUDED.is_lightning,
         token_type = EXCLUDED.token_type,
         image_url = EXCLUDED.image_url,
         bot_end_time = EXCLUDED.bot_end_time,
         series_id = COALESCE(EXCLUDED.series_id, markets.series_id),
         round_number = COALESCE(EXCLUDED.round_number, markets.round_number),
         start_price = COALESCE(EXCLUDED.start_price, markets.start_price),
         time_slot = COALESCE(EXCLUDED.time_slot, markets.time_slot),
         updated_at = NOW()`,
      values,
    );
    // Only log persist on first call or count change
    if (entries.length !== marketsCache.length) {
      console.log(`[Indexer] Persisted ${entries.length} market(s) to database`);
    }
  } catch (err) {
    console.error('[Indexer] Failed to persist registry to DB:', err);
  }
}

/**
 * Update metadata for an already-registered market (e.g., replace placeholder question).
 */
export function updateMarketMeta(marketId: string, partial: Partial<MarketMeta>): void {
  const existing = MARKET_REGISTRY[marketId];
  if (!existing) return;
  Object.assign(existing, partial);
  // Persist changed fields directly to DB so they survive a restart
  const fields: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (partial.imageUrl !== undefined)    { fields.push(`image_url = $${i++}`);    vals.push(partial.imageUrl || null); }
  if (partial.question !== undefined)    { fields.push(`question = $${i++}`);     vals.push(partial.question); }
  if (partial.tokenType !== undefined)   { fields.push(`token_type = $${i++}`);   vals.push(partial.tokenType); }
  if (partial.isLightning !== undefined) { fields.push(`is_lightning = $${i++}`); vals.push(partial.isLightning); }
  if (partial.startPrice !== undefined)  { fields.push(`start_price = $${i++}`);  vals.push(partial.startPrice); }
  if (partial.seriesId !== undefined)    { fields.push(`series_id = $${i++}`);    vals.push(partial.seriesId || null); }
  if (partial.roundNumber !== undefined) { fields.push(`round_number = $${i++}`); vals.push(partial.roundNumber); }
  if (partial.timeSlot !== undefined)    { fields.push(`time_slot = $${i++}`);    vals.push(partial.timeSlot || null); }
  if (partial.botEndTime !== undefined)  { fields.push(`bot_end_time = $${i++}`); vals.push(partial.botEndTime); }
  if (fields.length > 0) {
    vals.push(marketId);
    query(`UPDATE markets SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i}`, vals)
      .catch((err) => console.error('[Indexer] updateMarketMeta DB error:', err));
  }
}

/**
 * Clear isLightning only on markets that are resolved/cancelled in the cache,
 * or whose botEndTime is more than 60 minutes in the past (orphaned rounds).
 * This prevents wiping flags on markets that are still active and tradable.
 */
export function clearStaleLightningFlags(): number {
  const now = Date.now();
  const STALE_THRESHOLD = 60 * 60 * 1000; // 60 min
  let count = 0;
  for (const [id, meta] of Object.entries(MARKET_REGISTRY)) {
    if (!meta.isLightning) continue;
    // Clear resolved / cancelled markets
    const cached = marketsCache.find((m) => m.id === id);
    if (cached && (cached.status === 'resolved' || cached.status === 'cancelled')) {
      meta.isLightning = false;
      count++;
      continue;
    }
    // Clear orphaned rounds whose endTime is long past
    if (meta.botEndTime && meta.botEndTime < now - STALE_THRESHOLD) {
      meta.isLightning = false;
      count++;
    }
  }
  if (count > 0) persistRegistry().catch(() => {});
  return count;
}
