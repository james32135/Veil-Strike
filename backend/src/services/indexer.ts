import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../config';
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
}

// ── JSON persistence for dynamically discovered/registered markets ──
const DYNAMIC_REGISTRY_PATH = join(__dirname, '../../data/dynamic-markets.json');

function loadDynamicRegistry(): Record<string, MarketMeta> {
  try {
    if (existsSync(DYNAMIC_REGISTRY_PATH)) {
      const raw = readFileSync(DYNAMIC_REGISTRY_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[Indexer] Failed to load dynamic registry:', err);
  }
  return {};
}

function saveDynamicRegistry(registry: Record<string, MarketMeta>): void {
  try {
    const dir = join(__dirname, '../../data');
    if (!existsSync(dir)) {
      const { mkdirSync } = require('fs');
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(DYNAMIC_REGISTRY_PATH, JSON.stringify(registry, null, 2));
  } catch (err) {
    console.error('[Indexer] Failed to save dynamic registry:', err);
  }
}

// Registry of known market IDs with their off-chain metadata
// v6: Seed registry is empty — all markets are discovered dynamically via scanner
// or registered via POST /api/markets/register. Legacy v5 seeds removed.
const SEED_REGISTRY: Record<string, MarketMeta> = {};

// Merge seed + dynamic (file-persisted) registries
// Seed entries take priority — they have curated question text & correct metadata
const MARKET_REGISTRY: Record<string, MarketMeta> = {
  ...loadDynamicRegistry(),
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
  2: 'Crypto',
  3: 'Sports',
  4: 'Politics',
  5: 'Science',
  6: 'Entertainment',
  7: 'Other',
};

const TOKEN_TYPE_MAP: Record<number, string> = {
  0: 'ALEO',
  1: 'USDCX',
  2: 'USAD',
};

// Average block time ~15 seconds on testnet
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
    const url = `${config.aleoEndpoint}/testnet/program/${pid}/mapping/${mappingName}/${key}`;
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
    const res = await fetch(`${config.aleoEndpoint}/testnet/block/height/latest`);
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
  const markets: MarketInfo[] = [];
  const currentBlock = await fetchCurrentBlockHeight();

  for (const [marketId, meta] of Object.entries(MARKET_REGISTRY)) {
    try {
      // Determine which program to query based on token type
      const pid = meta.tokenType === 'USDCX' ? config.programIdCx
        : meta.tokenType === 'USAD' ? config.programIdSd : config.programId;

      const [marketRaw, poolRaw] = await Promise.all([
        fetchMapping('markets', marketId, pid),
        fetchMapping('amm_pools', marketId, pid),
      ]);

      if (!marketRaw || !poolRaw) {
        console.log(`[Indexer] Market ${marketId.slice(0, 20)}... not found on chain`);
        continue;
      }

      const market = parseMarketStruct(marketRaw);
      const pool = parsePoolStruct(poolRaw);
      if (!market || !pool) continue;

      const tokenType = market.token_type;

      const reserves: number[] = [];
      reserves.push(pool.reserve_1);
      reserves.push(pool.reserve_2);
      if (market.num_outcomes >= 3) reserves.push(pool.reserve_3);
      if (market.num_outcomes >= 4) reserves.push(pool.reserve_4);

      // Fetch resolved outcome if market is resolved or pending resolution
      let resolvedOutcome: number | undefined;
      if (market.status === 3 || market.status === 5) {
        try {
          const resRaw = await fetchMapping('market_resolutions', marketId, pid);
          if (resRaw) {
            const resFields = parseAleoStruct(resRaw);
            const wo = parseInt(parseAleoValue(resFields['winning_outcome'] || '0'), 10);
            if (wo > 0) resolvedOutcome = wo - 1; // Convert 1-based to 0-based for frontend
          }
        } catch {}
      }

      markets.push({
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
      });
    } catch (err) {
      console.error(`[Indexer] Error fetching market ${marketId.slice(0, 20)}...`, err);
    }
  }

  console.log(`[Indexer] Fetched ${markets.length} markets from chain`);
  return markets;
}

export function getCachedMarkets(): MarketInfo[] {
  return marketsCache;
}

export function setCachedMarkets(markets: MarketInfo[]): void {
  marketsCache = markets;
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
    return false; // Already has real metadata
  }
  MARKET_REGISTRY[marketId] = meta;
  return true;
}

/**
 * Persist all dynamically registered markets (those not in the seed registry) to disk.
 * Called after scanner discovers new markets or after manual registration.
 */
export function persistRegistry(): void {
  const dynamic: Record<string, MarketMeta> = {};
  for (const [id, meta] of Object.entries(MARKET_REGISTRY)) {
    if (!SEED_REGISTRY[id]) {
      dynamic[id] = meta;
    }
  }
  saveDynamicRegistry(dynamic);
  console.log(`[Indexer] Persisted ${Object.keys(dynamic).length} dynamic market(s) to disk`);
}

/**
 * Update metadata for an already-registered market (e.g., replace placeholder question).
 */
export function updateMarketMeta(marketId: string, partial: Partial<MarketMeta>): void {
  const existing = MARKET_REGISTRY[marketId];
  if (!existing) return;
  Object.assign(existing, partial);
}

/**
 * Clear isLightning on ALL existing markets in the registry.
 * Called by round-bot at startup to prevent orphaned rounds from previous runs
 * showing on the Rounds page.
 */
export function clearAllLightningFlags(): number {
  let count = 0;
  for (const meta of Object.values(MARKET_REGISTRY)) {
    if (meta.isLightning) {
      meta.isLightning = false;
      count++;
    }
  }
  if (count > 0) persistRegistry();
  return count;
}
