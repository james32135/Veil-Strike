// Round Bot — automated 5-min Strike Round lifecycle.
// State machine per market slot: IDLE → CREATING → OPEN → SETTLING → IDLE
// Empty rounds (no bets) get a virtual reset at zero on-chain cost.

import { config } from '../config';
import { fetchWithTimeout } from './fetch-timeout';
import { getCachedPrices } from './oracle';
import { registerMarket, persistRegistry, clearStaleLightningFlags, getCachedMarkets, updateMarketMeta, markMarketResolved, injectMarketIntoCache } from './indexer';
import { savePendingMeta, deletePendingMeta } from './scanner';
import { delegatedSettle, delegatedCreateMarket, isDelegatedProvingAvailable, getResolverAddressFromKey } from './delegated-prover';
import { fetchCurrentBlock } from './chain-executor';
import { query } from './db';
import { assetToSeriesId, updateSeriesStats } from './db';
import { findUsdcxRecord, markRecordSpent } from './record-scanner';
import { getUsdcxProofs } from './freeze-list';

// ─── Types ───────────────────────────────────────────────────────────────────

type SlotState = 'idle' | 'creating' | 'open' | 'settling' | 'cooldown';
type Asset = 'BTC' | 'ETH' | 'ALEO';
type TokenType = 'ALEO' | 'USDCX' | 'USAD';

interface MarketSlot {
  id: string;                   // e.g. "BTC-ALEO"
  asset: Asset;
  tokenType: TokenType;
  programId: string;
  state: SlotState;
  marketId: string | null;      // on-chain market field ID
  txId: string | null;          // pending tx
  startPrice: number;
  startTime: number;            // unix ms when round opened
  endTime: number;              // unix ms when round expires
  roundNumber: number;
  totalVolume: number;          // from amm_pools, >0 means bets exist
  error: string | null;
  lastSettleTxId: string | null;
  settleRetries: number;         // settle failure counter (max 3 before skip)
  createRetries: number;         // create failure counter
  nextCreateAttempt: number;     // unix ms — earliest time to retry create
}

interface BotState {
  slots: MarketSlot[];
  resolverAddress: string;
  startedAt: number;
  totalRoundsCreated: number;
  totalRoundsSettled: number;
  totalRoundsSkipped: number;   // empty rounds (virtual reset)
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROUND_DURATION_MS = config.roundDurationMinutes * 60 * 1000;
const TICK_INTERVAL_MS = 5_000;       // Check every 5s (faster for 5-min rounds)
const COOLDOWN_MS = 10_000;           // Wait 10s after settle before creating next
const TX_CONFIRM_TIMEOUT_MS = 120_000; // 2 min to confirm
const TX_POLL_INTERVAL_MS = 10_000;
const MAX_CREATE_RETRIES = 3;          // Max create retries before longer cooldown
const CREATE_RETRY_BACKOFF_MS = 60_000; // 1 min backoff between create retries

const SLOT_DEFINITIONS: { id: string; asset: Asset; tokenType: TokenType }[] = [
  { id: 'BTC-USDCX',  asset: 'BTC',  tokenType: 'USDCX' },
  { id: 'ETH-USDCX',  asset: 'ETH',  tokenType: 'USDCX' },
  { id: 'ALEO-USDCX', asset: 'ALEO', tokenType: 'USDCX' },
];

// ─── State ───────────────────────────────────────────────────────────────────

let botState: BotState | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

function getProgramId(tokenType: TokenType): string {
  if (tokenType === 'USDCX') return config.programIdCx;
  if (tokenType === 'USAD') return config.programIdSd;
  return config.programId;
}

function getAssetPrice(asset: Asset): number {
  const prices = getCachedPrices();
  return prices[asset.toLowerCase() as 'btc' | 'eth' | 'aleo'] || 0;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

let saveDebounce: ReturnType<typeof setTimeout> | null = null;

function saveState(): void {
  if (!botState) return;
  // Debounce rapid saves — wait 2s before persisting (merges burst calls)
  if (saveDebounce) clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => {
    saveDebounce = null;
    _doSaveState();
  }, 2_000);
}

function _doSaveState(): void {
  if (!botState) return;
  // Persist to DB in a single transaction (fire-and-forget async)
  (async () => {
    const client = await (await import('./db')).pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE round_bot_state SET
          resolver_address = $1, started_at = $2,
          total_rounds_created = $3, total_rounds_settled = $4,
          total_rounds_skipped = $5, updated_at = NOW()
        WHERE id = 1`,
        [
          botState!.resolverAddress,
          botState!.startedAt,
          botState!.totalRoundsCreated,
          botState!.totalRoundsSettled,
          botState!.totalRoundsSkipped,
        ],
      );

      for (const s of botState!.slots) {
        await client.query(
          `INSERT INTO round_bot_slots
            (slot_id, asset, token_type, program_id, state, market_id, tx_id,
             start_price, start_time, end_time, round_number, total_volume,
             error, last_settle_tx_id, settle_retries, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
           ON CONFLICT (slot_id) DO UPDATE SET
             state = EXCLUDED.state, market_id = EXCLUDED.market_id,
             tx_id = EXCLUDED.tx_id, start_price = EXCLUDED.start_price,
             start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
             round_number = EXCLUDED.round_number, total_volume = EXCLUDED.total_volume,
             error = EXCLUDED.error, last_settle_tx_id = EXCLUDED.last_settle_tx_id,
             settle_retries = EXCLUDED.settle_retries, updated_at = NOW()`,
          [
            s.id, s.asset, s.tokenType, s.programId, s.state,
            s.marketId, s.txId, s.startPrice, s.startTime, s.endTime,
            s.roundNumber, s.totalVolume, s.error, s.lastSettleTxId, s.settleRetries,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[RoundBot] Failed to save state to DB:', err);
    } finally {
      client.release();
    }
  })();
}

async function loadState(): Promise<BotState | null> {
  try {
    const { rows: stateRows } = await query('SELECT * FROM round_bot_state WHERE id = 1');
    if (stateRows.length === 0) return null;
    const st = stateRows[0];

    const { rows: slotRows } = await query('SELECT * FROM round_bot_slots ORDER BY slot_id');
    if (slotRows.length === 0) return null;

    return {
      resolverAddress: st.resolver_address || '',
      startedAt: Number(st.started_at) || Date.now(),
      totalRoundsCreated: st.total_rounds_created || 0,
      totalRoundsSettled: st.total_rounds_settled || 0,
      totalRoundsSkipped: st.total_rounds_skipped || 0,
      slots: slotRows.map((r: any) => ({
        id: r.slot_id,
        asset: r.asset as Asset,
        tokenType: r.token_type as TokenType,
        programId: r.program_id,
        state: r.state as SlotState,
        marketId: r.market_id || null,
        txId: r.tx_id || null,
        startPrice: r.start_price || 0,
        startTime: Number(r.start_time) || 0,
        endTime: Number(r.end_time) || 0,
        roundNumber: r.round_number || 1,
        totalVolume: r.total_volume || 0,
        error: r.error || null,
        lastSettleTxId: r.last_settle_tx_id || null,
        settleRetries: r.settle_retries || 0,
        createRetries: 0,
        nextCreateAttempt: 0,
      })),
    };
  } catch (err) {
    console.error('[RoundBot] Failed to load state from DB:', err);
    return null;
  }
}

// ─── Market Creation ─────────────────────────────────────────────────────────

function generateQuestionHash(asset: Asset, tokenType: TokenType, roundNumber: number): string {
  const question = `${asset} Strike Round #${roundNumber}`;
  const hash = BigInt(
    Array.from(new TextEncoder().encode(question))
      .reduce((h, b) => h * 31n + BigInt(b), 0n)
  ) % BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001');
  return `${hash}field`;
}

function generateNonce(): string {
  return `${BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))}field`;
}

/**
 * Extract the market_id from a DPS transaction response.
 * The open_market transition outputs a future whose finalize arguments contain the market_id at index 0.
 */
function extractMarketIdFromTx(transaction: any): string | null {
  try {
    const transitions = transaction?.execution?.transitions || [];
    for (const t of transitions) {
      if (t.function !== 'open_market') continue;
      for (const output of t.outputs || []) {
        if (output.type !== 'future') continue;
        // Parse the future value to extract market_id (first field argument)
        const value = output.value || '';
        // Extract top-level arguments, stripping nested futures
        const argsIdx = value.indexOf('arguments:');
        if (argsIdx === -1) continue;
        const bracketStart = value.indexOf('[', argsIdx);
        if (bracketStart === -1) continue;
        // Find matching bracket
        let depth = 0, bracketEnd = -1;
        for (let i = bracketStart; i < value.length; i++) {
          if (value[i] === '[') depth++;
          else if (value[i] === ']') { depth--; if (depth === 0) { bracketEnd = i; break; } }
        }
        if (bracketEnd === -1) continue;
        const content = value.substring(bracketStart + 1, bracketEnd);
        // Strip nested {} and extract first field value
        let topLevel = '';
        let braceDepth = 0;
        for (let i = 0; i < content.length; i++) {
          if (content[i] === '{') braceDepth++;
          else if (content[i] === '}') braceDepth--;
          else if (braceDepth === 0) topLevel += content[i];
        }
        const fieldMatch = topLevel.match(/(\d+field)/);
        if (fieldMatch) return fieldMatch[1];
      }
    }
  } catch (err) {
    console.error('[RoundBot] Failed to extract market_id from tx:', err);
  }
  return null;
}

async function createMarketForSlot(slot: MarketSlot): Promise<void> {
  slot.state = 'creating';
  slot.error = null;
  const question = `${slot.asset} Strike Round #${slot.roundNumber}`;
  const questionHash = generateQuestionHash(slot.asset, slot.tokenType, slot.roundNumber);
  const nonce = generateNonce();

  const currentBlock = await fetchCurrentBlock();
  if (currentBlock <= 0) {
    slot.error = 'Cannot fetch block height';
    slot.state = 'idle';
    return;
  }

  // Use actual block time (~4-5s) for on-chain deadline so it doesn't expire early
  const ACTUAL_BLOCK_TIME_S = 5;
  const roundBlocks = Math.ceil(config.roundDurationMinutes * 60 / ACTUAL_BLOCK_TIME_S) + 30; // +30 buffer
  const deadline = currentBlock + roundBlocks;
  const resolutionDeadline = deadline + 2880; // 12h resolution window

  console.log(`[RoundBot] Creating ${slot.id} round #${slot.roundNumber}: "${question}"`);

  // Save pending meta so scanner registers this with isLightning: true + correct question
  savePendingMeta(questionHash, {
    question,
    outcomes: ['Up', 'Down'],
    isLightning: true,
    createdAt: Date.now(),
    tokenType: slot.tokenType === 'ALEO' ? undefined : slot.tokenType,
  });

  // For USDCX/USAD, fetch a private Token record and compute MerkleProofs
  let tokenRecord: string | undefined;
  let proofs: string | undefined;
  if (slot.tokenType !== 'ALEO') {
    try {
      tokenRecord = await findUsdcxRecord(config.roundInitialLiquidity) ?? undefined;
      if (!tokenRecord) {
        slot.error = `No ${slot.tokenType} Token record with sufficient balance`;
        slot.state = 'idle';
        console.error(`[RoundBot] ${slot.id} no ${slot.tokenType} record found`);
        return;
      }
      proofs = await getUsdcxProofs(slot.tokenType as 'USDCX' | 'USAD');
      console.log(`[RoundBot] ${slot.id} fetched Token record + MerkleProofs for ${slot.tokenType}`);
    } catch (err) {
      slot.error = `Failed to fetch ${slot.tokenType} record/proofs: ${err}`;
      slot.state = 'idle';
      console.error(`[RoundBot] ${slot.id} record/proof fetch failed:`, err);
      return;
    }
  }

  const result = await delegatedCreateMarket(
    questionHash,
    1, // category: Crypto
    2, // num_outcomes: UP/DOWN
    deadline,
    resolutionDeadline,
    botState!.resolverAddress,
    config.roundInitialLiquidity,
    nonce,
    slot.tokenType === 'ALEO' ? undefined : slot.tokenType,
    tokenRecord,
    proofs,
  );

  if (result.success && result.txId) {
    console.log(`[RoundBot] ${slot.id} market tx submitted: ${result.txId} (${result.durationMs}ms)`);
    slot.txId = result.txId;

    // Mark the token record as spent so the next slot won't reuse it
    if (tokenRecord) markRecordSpent(tokenRecord);

    // Try to extract the real market_id from the transaction response
    const marketId = extractMarketIdFromTx(result.transaction);
    if (marketId) {
      slot.marketId = marketId;
      console.log(`[RoundBot] ${slot.id} extracted market_id: ${marketId.slice(0, 20)}...`);
      const botEndTime = Date.now() + ROUND_DURATION_MS;
      // Register with startPrice immediately so the frontend never shows "—"
      const earlyStartPrice = getAssetPrice(slot.asset);
      registerMarket(marketId, {
        questionHash,
        question,
        outcomes: ['Up', 'Down'],
        isLightning: true,
        tokenType: slot.tokenType === 'ALEO' ? undefined : slot.tokenType,
        botEndTime,
        startPrice: earlyStartPrice,
        seriesId: assetToSeriesId(slot.asset),
        roundNumber: slot.roundNumber,
        timeSlot: buildTimeSlotLabel(Date.now(), Date.now() + ROUND_DURATION_MS),
      });
      // Delete pending meta so scanner won't tag old markets with same questionHash as lightning
      deletePendingMeta(questionHash);
      persistRegistry().catch(() => {});
    }

    // Wait for confirmation
    const confirmed = await waitForTxConfirmation(result.txId);
    if (confirmed) {
      // If we didn't get market_id from tx, the scanner will discover it
      // via pending meta (saved before tx creation above)
      if (!slot.marketId) {
        console.log(`[RoundBot] ${slot.id} waiting for scanner to discover market_id...`);
      }

      // Market is now live
      slot.startPrice = getAssetPrice(slot.asset);
      slot.startTime = Date.now();
      slot.endTime = Date.now() + ROUND_DURATION_MS;
      slot.state = 'open';
      slot.totalVolume = 0;
      slot.createRetries = 0;
      slot.nextCreateAttempt = 0;
      botState!.totalRoundsCreated++;

      // Attach series metadata to the market for the API
      const seriesId = assetToSeriesId(slot.asset);
      const timeSlot = buildTimeSlotLabel(slot.startTime, slot.endTime);
      if (slot.marketId) {
        // Update both in-memory registry and DB so API returns startPrice immediately
        // Include botEndTime in case scanner registered first without it
        updateMarketMeta(slot.marketId, {
          startPrice: slot.startPrice,
          seriesId,
          roundNumber: slot.roundNumber,
          timeSlot,
          botEndTime: slot.endTime,
        });
      }

      console.log(`[RoundBot] ${slot.id} round #${slot.roundNumber} OPEN. Start price: $${slot.startPrice}`);

      // Inject the new market directly into the cache so the frontend sees it
      // immediately on the next SSE broadcast, instead of waiting for chain indexing.
      if (slot.marketId) {
        const initialLiquidity = config.roundInitialLiquidity;
        injectMarketIntoCache({
          id: slot.marketId,
          question,
          category: 'Crypto',
          outcomes: ['Up', 'Down'],
          reserves: [initialLiquidity, initialLiquidity],
          totalLiquidity: initialLiquidity * 2,
          totalVolume: 0,
          tradeCount: 0,
          status: 'active',
          endTime: slot.endTime,
          createdAt: Date.now(),
          isLightning: true,
          tokenType: slot.tokenType === 'ALEO' ? undefined : slot.tokenType,
          startPrice: slot.startPrice,
          seriesId: assetToSeriesId(slot.asset),
          roundNumber: slot.roundNumber,
          timeSlot: buildTimeSlotLabel(slot.startTime, slot.endTime),
        });
      }
    } else {
      slot.error = 'Transaction not confirmed in time';
      slot.state = 'idle';
      slot.createRetries++;
      slot.nextCreateAttempt = Date.now() + CREATE_RETRY_BACKOFF_MS;
      console.error(`[RoundBot] ${slot.id} tx not confirmed: ${result.txId}`);
    }
  } else {
    slot.error = result.error || 'Create failed';
    slot.state = 'idle';
    slot.createRetries++;
    slot.nextCreateAttempt = Date.now() + CREATE_RETRY_BACKOFF_MS;
    console.error(`[RoundBot] ${slot.id} creation failed (retry ${slot.createRetries}/${MAX_CREATE_RETRIES}): ${result.error}`);

    // If rejection was due to a stale record whose input ID is already on-chain,
    // blacklist that record so the next retry picks a fresh one.
    // Use a short backoff since the next record should work.
    if (tokenRecord && result.error && result.error.includes('already exists')) {
      markRecordSpent(tokenRecord);
      slot.nextCreateAttempt = Date.now() + 5_000; // retry in 5s (not 60s)
      console.log(`[RoundBot] ${slot.id} blacklisted stale record — fast retry in 5s`);
    }
  }

  saveState();
}

// ─── Settlement ──────────────────────────────────────────────────────────────

async function settleSlot(slot: MarketSlot): Promise<void> {
  if (!slot.marketId) {
    // Try to find market from cache using the txId or question
    const marketId = await findMarketIdForSlot(slot);
    if (!marketId) {
      console.warn(`[RoundBot] ${slot.id} no market_id found, skipping round`);
      slot.state = 'idle';
      slot.marketId = null;
      slot.txId = null;
      slot.roundNumber++;
      saveState();
      return;
    }
    slot.marketId = marketId;
  }

  // Check on-chain volume
  const volume = await fetchPoolVolume(slot.marketId, slot.tokenType);
  slot.totalVolume = volume;

  // Settle on-chain (even empty markets — so UI moves from "AWAITING RESOLVE" to "RESOLVED")
  slot.state = 'settling';
  slot.error = null;
  const endPrice = getAssetPrice(slot.asset);
  const winningOutcome = endPrice >= slot.startPrice ? 1 : 2; // 1=UP, 2=DOWN
  const isEmpty = volume === 0;

  console.log(`[RoundBot] ${slot.id} round #${slot.roundNumber} ${isEmpty ? 'EMPTY' : 'SETTLING'}. Start=$${slot.startPrice} End=$${endPrice} → ${winningOutcome === 1 ? 'UP' : 'DOWN'}`);

  const result = await delegatedSettle(
    slot.marketId,
    winningOutcome,
    slot.tokenType === 'ALEO' ? undefined : slot.tokenType,
  );

  if (result.success && result.txId) {
    slot.lastSettleTxId = result.txId;
    const seriesId = assetToSeriesId(slot.asset);
    const settledMarketId = slot.marketId!; // Save before nulling
    if (isEmpty) {
      botState!.totalRoundsSkipped++;
      console.log(`[RoundBot] ${slot.id} EMPTY settled tx=${result.txId} (${result.durationMs}ms)`);
    } else {
      botState!.totalRoundsSettled++;
      console.log(`[RoundBot] ${slot.id} settled tx=${result.txId} (${result.durationMs}ms)`);
    }

    // Immediately mark resolved in indexer cache so frontend sees it on next SSE
    markMarketResolved(settledMarketId, winningOutcome);

    // Update series cumulative stats
    updateSeriesStats(seriesId, slot.totalVolume).catch(() => {});

    // Move to idle so batch-create can pick it up
    slot.state = 'idle';
    slot.marketId = null;
    slot.txId = null;
    slot.roundNumber++;
  } else {
    slot.settleRetries = (slot.settleRetries || 0) + 1;
    if (slot.settleRetries >= 3) {
      console.error(`[RoundBot] ${slot.id} settle failed ${slot.settleRetries} times — skipping round`);
      slot.state = 'idle';
      slot.marketId = null;
      slot.txId = null;
      slot.settleRetries = 0;
      slot.roundNumber++;
      botState!.totalRoundsSkipped++;
    } else {
      slot.error = result.error || 'Settle failed';
      console.error(`[RoundBot] ${slot.id} settle failed (attempt ${slot.settleRetries}/3): ${result.error}`);
    }
  }

  saveState();
}

// ─── On-chain queries ────────────────────────────────────────────────────────

async function fetchPoolVolume(marketId: string, tokenType: TokenType): Promise<number> {
  try {
    const programId = getProgramId(tokenType);
    const url = `${config.aleoEndpoint}/${config.aleoNetwork}/program/${programId}/mapping/amm_pools/${marketId}`;
    const res = await fetchWithTimeout(url, {}, 10_000);
    if (!res.ok) return 0;
    const text = await res.text();
    let raw: string;
    try { raw = JSON.parse(text); } catch { raw = text; }
    // Parse total_volume from the struct
    const match = raw.match(/total_volume:\s*(\d+)u128/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

async function findMarketIdForSlot(slot: MarketSlot): Promise<string | null> {
  // Look up from the indexer's cached markets
  const markets = getCachedMarkets();
  const question = `${slot.asset} Strike Round`;

  // Find an active lightning market matching our slot
  const match = markets.find((m) =>
    m.isLightning &&
    m.status === 'active' &&
    (m.tokenType || 'ALEO') === slot.tokenType &&
    m.question.toUpperCase().includes(slot.asset)
  );

  return match?.id || null;
}

async function waitForTxConfirmation(txId: string): Promise<boolean> {
  const deadline = Date.now() + TX_CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const url = `${config.aleoEndpoint}/${config.aleoNetwork}/transaction/${txId}`;
      const res = await fetchWithTimeout(url, {}, 10_000);
      if (res.ok) return true;
    } catch { /* not yet */ }
    await sleep(TX_POLL_INTERVAL_MS);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Build a human-readable time slot label like "2:30 – 2:45 PM" */
function buildTimeSlotLabel(startMs: number, endMs: number): string {
  const fmt = (d: Date) => {
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return { time: `${h}:${m}`, ampm };
  };
  const s = fmt(new Date(startMs));
  const e = fmt(new Date(endMs));
  return `${s.time} – ${e.time} ${e.ampm}`;
}

// ─── Main Tick ───────────────────────────────────────────────────────────────

let tickBusy = false;

async function tick(): Promise<void> {
  if (!botState || !running || tickBusy) return;
  tickBusy = true;

  try {
    // ── Per-slot interleaved settle + create ──
    // Each slot settles and creates independently — no more waiting for ALL
    // slots to be idle. This eliminates the 3-5 min gap where zero rounds
    // are active and ensures ETH/BTC/ALEO don't stall on each other.
    for (const slot of botState.slots) {
      if (!running) break;

      // Settle expired open rounds
      if (slot.state === 'open' && Date.now() >= slot.endTime) {
        await settleSlot(slot);
      }

      // Retry failed settlements
      if (slot.state === 'settling' && slot.error) {
        console.log(`[RoundBot] ${slot.id} retrying settle after error...`);
        slot.error = null;
        await settleSlot(slot);
      }

      // Create next round for idle slots immediately
      if (slot.state === 'idle') {
        // Respect backoff timer
        if (slot.nextCreateAttempt && Date.now() < slot.nextCreateAttempt) continue;

        // Check retry limits
        if (slot.createRetries >= MAX_CREATE_RETRIES) {
          slot.nextCreateAttempt = Date.now() + 5 * 60_000;
          slot.createRetries = 0;
          console.warn(`[RoundBot] ${slot.id} hit max create retries — cooling down 5min`);
          continue;
        }

        await createMarketForSlot(slot);
        saveState();
      }
    }
  } catch (err) {
    console.error('[RoundBot] Tick error:', err);
  } finally {
    tickBusy = false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start the round bot. Creates 5 market slots and begins cycling rounds.
 */
export async function startRoundBot(): Promise<void> {
  if (running) {
    console.log('[RoundBot] Already running');
    return;
  }

  if (!isDelegatedProvingAvailable()) {
    console.warn('[RoundBot] Delegated proving not configured — bot disabled');
    return;
  }

  if (!config.roundBotEnabled) {
    console.log('[RoundBot] Bot disabled by ROUND_BOT_ENABLED=false');
    return;
  }

  const resolverAddress = await getResolverAddressFromKey();
  if (!resolverAddress) {
    console.error('[RoundBot] No resolver address — cannot start bot');
    return;
  }

  // Try to restore state from database
  const saved = await loadState();
  const savedSlotIdsMatch = saved && saved.slots.length === SLOT_DEFINITIONS.length &&
    SLOT_DEFINITIONS.every((def) => saved.slots.some((s) => s.id === def.id));
  if (saved && savedSlotIdsMatch) {
    botState = saved;
    botState.resolverAddress = resolverAddress;
    console.log(`[RoundBot] Restored state: ${saved.totalRoundsCreated} created, ${saved.totalRoundsSettled} settled, ${saved.totalRoundsSkipped} skipped`);

    // On restart, recover slots intelligently:
    // - OPEN slots with valid marketId and time remaining → keep open (don't orphan)
    // - OPEN slots that have EXPIRED → settle them immediately (don't orphan on-chain)
    // - Everything else → reset to idle (stale rounds, transient states)
    const expiredSlotsToSettle: MarketSlot[] = [];
    for (const slot of botState.slots) {
      if (slot.state === 'open' && slot.marketId && slot.endTime > Date.now()) {
        // Round is still live — re-register it and keep going
        console.log(`[RoundBot] Resuming ${slot.id} round #${slot.roundNumber} (${Math.round((slot.endTime - Date.now()) / 1000)}s left)`);
        const questionHash = generateQuestionHash(slot.asset, slot.tokenType, slot.roundNumber);
        registerMarket(slot.marketId, {
          questionHash,
          question: `${slot.asset} Strike Round #${slot.roundNumber}`,
          outcomes: ['Up', 'Down'],
          isLightning: true,
          tokenType: slot.tokenType === 'ALEO' ? undefined : slot.tokenType,
          botEndTime: slot.endTime,
          startPrice: slot.startPrice || undefined,
          seriesId: assetToSeriesId(slot.asset),
          roundNumber: slot.roundNumber,
          timeSlot: buildTimeSlotLabel(slot.startTime, slot.endTime),
        });
      } else if (slot.state === 'open' && slot.marketId && slot.endTime <= Date.now()) {
        // Round EXPIRED during restart — queue it for settling
        console.log(`[RoundBot] ${slot.id} round #${slot.roundNumber} expired during downtime — will settle now`);
        slot.state = 'settling'; // Mark immediately so tick() won't double-settle
        expiredSlotsToSettle.push(slot);
      } else if (slot.state !== 'idle') {
        console.log(`[RoundBot] Reset slot ${slot.id} from '${slot.state}' (round #${slot.roundNumber}) → idle`);
        slot.state = 'idle';
        slot.marketId = null;
        slot.txId = null;
        slot.error = null;
        slot.settleRetries = 0;
        slot.roundNumber++;
      }
    }
    // Settle expired slots after the main loop starts (async, won't block startup)
    if (expiredSlotsToSettle.length > 0) {
      setTimeout(() => {
        (async () => {
          for (const slot of expiredSlotsToSettle) {
            try {
              await settleSlot(slot);
            } catch (err) {
              console.error(`[RoundBot] Failed to settle expired ${slot.id}:`, err);
              slot.state = 'idle';
              slot.marketId = null;
              slot.roundNumber++;
            }
          }
          saveState();
        })().catch((err) => console.error('[RoundBot] Expired slot settle error:', err));
      }, 5_000); // 5s delay to let other init finish
    }

    // ── Orphan cleanup: settle any active lightning markets that expired but are
    //    not tracked by any current slot (orphaned from previous restarts/crashes) ──
    const trackedMarketIds = new Set(botState.slots.map((s) => s.marketId).filter(Boolean));
    const allMarkets = getCachedMarkets();
    const orphanedExpired = allMarkets.filter(
      (m) => m.isLightning && m.status === 'active' && m.endTime < Date.now() && !trackedMarketIds.has(m.id)
    );
    if (orphanedExpired.length > 0) {
      console.log(`[RoundBot] Found ${orphanedExpired.length} orphaned expired market(s) — settling...`);
      setTimeout(() => {
        (async () => {
          for (const market of orphanedExpired) {
            try {
              const q = market.question.toUpperCase();
              const asset: Asset = q.includes('BTC') || q.includes('BITCOIN') ? 'BTC' : q.includes('ETH') || q.includes('ETHEREUM') ? 'ETH' : 'ALEO';
              const tokenType: TokenType = market.tokenType === 'USDCX' ? 'USDCX' : market.tokenType === 'USAD' ? 'USAD' : 'ALEO';
              const tmpSlot: MarketSlot = {
                id: `orphan-${market.id.slice(0, 8)}`,
                asset,
                tokenType,
                programId: tokenType === 'USDCX' ? 'veil_strike_v7_cx.aleo' : tokenType === 'USAD' ? 'veil_strike_v7_sd.aleo' : 'veil_strike_v7.aleo',
                state: 'open',
                marketId: market.id,
                txId: null,
                startPrice: market.startPrice || 0,
                startTime: market.endTime - ROUND_DURATION_MS,
                endTime: market.endTime,
                roundNumber: market.roundNumber || 0,
                totalVolume: 0,
                error: null,
                lastSettleTxId: null,
                settleRetries: 0,
                createRetries: 0,
                nextCreateAttempt: 0,
              };
              console.log(`[RoundBot] Settling orphan ${asset} market ${market.id.slice(0, 12)}...`);
              await settleSlot(tmpSlot);
            } catch (err) {
              console.error(`[RoundBot] Failed to settle orphan ${market.id.slice(0, 12)}:`, err);
            }
          }
        })().catch((err) => console.error('[RoundBot] Orphan settle error:', err));
      }, 10_000); // 10s delay — after expired slots settled
    }
  } else {
    // Fresh start — clear old slots from DB
    await query('DELETE FROM round_bot_slots').catch(() => {});
    await query('DELETE FROM round_bot_state').catch(() => {});
    botState = {
      slots: SLOT_DEFINITIONS.map((def) => ({
        id: def.id,
        asset: def.asset,
        tokenType: def.tokenType,
        programId: getProgramId(def.tokenType),
        state: 'idle',
        marketId: null,
        txId: null,
        startPrice: 0,
        startTime: 0,
        endTime: 0,
        roundNumber: 1,
        totalVolume: 0,
        error: null,
        lastSettleTxId: null,
        settleRetries: 0,
        createRetries: 0,
        nextCreateAttempt: 0,
      })),
      resolverAddress,
      startedAt: Date.now(),
      totalRoundsCreated: 0,
      totalRoundsSettled: 0,
      totalRoundsSkipped: 0,
    };
  }

  running = true;

  // Clear lightning flags only for resolved/cancelled/stale markets (not active ones)
  const cleared = clearStaleLightningFlags();
  if (cleared > 0) console.log(`[RoundBot] Cleared ${cleared} stale lightning flags`);

  // Adopt existing active lightning markets from cache into idle slots
  // This prevents creating duplicate markets when the bot restarts
  const cached = getCachedMarkets();
  for (const slot of botState.slots) {
    if (slot.state !== 'idle') continue;
    const match = cached.find((m) =>
      m.isLightning &&
      m.status === 'active' &&
      (m.tokenType || 'ALEO') === slot.tokenType &&
      m.question.toUpperCase().includes(slot.asset) &&
      m.endTime > Date.now()
    );
    if (match) {
      slot.marketId = match.id;
      slot.state = 'open';
      slot.endTime = match.endTime;
      slot.startTime = match.createdAt || Date.now();
      slot.startPrice = getAssetPrice(slot.asset);
      console.log(`[RoundBot] Adopted existing market for ${slot.id}: ${match.id.slice(0, 20)}... (${Math.round((match.endTime - Date.now()) / 1000)}s left)`);
    }
  }

  saveState();

  console.log(`[RoundBot] Started — ${SLOT_DEFINITIONS.length} slots, ${config.roundDurationMinutes}min rounds, resolver=${resolverAddress.slice(0, 15)}...`);

  // Start the tick loop
  tickTimer = setInterval(() => tick(), TICK_INTERVAL_MS);

  // Immediate first tick
  tick();
}

/**
 * Stop the round bot gracefully.
 */
export function stopRoundBot(): void {
  running = false;
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  saveState();
  console.log('[RoundBot] Stopped');
}

/**
 * Get the current bot status for API responses.
 */
export function getRoundBotStatus(): {
  running: boolean;
  slots: Array<{
    id: string;
    asset: string;
    tokenType: string;
    state: string;
    marketId: string | null;
    startPrice: number;
    startTime: number;
    endTime: number;
    roundNumber: number;
    totalVolume: number;
    error: string | null;
    timeRemainingMs: number;
  }>;
  stats: {
    totalRoundsCreated: number;
    totalRoundsSettled: number;
    totalRoundsSkipped: number;
    uptime: number;
  };
} {
  if (!botState) {
    return {
      running: false,
      slots: [],
      stats: { totalRoundsCreated: 0, totalRoundsSettled: 0, totalRoundsSkipped: 0, uptime: 0 },
    };
  }

  const now = Date.now();
  return {
    running,
    slots: botState.slots.map((s) => ({
      id: s.id,
      asset: s.asset,
      tokenType: s.tokenType,
      state: s.state,
      marketId: s.marketId,
      startPrice: s.startPrice,
      startTime: s.startTime,
      endTime: s.endTime,
      roundNumber: s.roundNumber,
      totalVolume: s.totalVolume,
      error: s.error,
      timeRemainingMs: s.state === 'open' ? Math.max(0, s.endTime - now) : 0,
    })),
    stats: {
      totalRoundsCreated: botState.totalRoundsCreated,
      totalRoundsSettled: botState.totalRoundsSettled,
      totalRoundsSkipped: botState.totalRoundsSkipped,
      uptime: now - botState.startedAt,
    },
  };
}

/**
 * Get active rounds for the lightning API (compatible with existing frontend).
 */
export function getBotActiveRounds(): Array<{
  id: string;
  marketId: string | null;
  asset: string;
  tokenType: string;
  startTime: number;
  endTime: number;
  startPrice: number;
  settled: boolean;
  onChainStatus: string;
  roundNumber: number;
}> {
  if (!botState) return [];
  return botState.slots
    .filter((s) => s.state === 'open' || s.state === 'settling')
    .map((s) => ({
      id: s.id,
      marketId: s.marketId,
      asset: s.asset,
      tokenType: s.tokenType,
      startTime: s.startTime,
      endTime: s.endTime,
      startPrice: s.startPrice,
      settled: s.state === 'settling',
      onChainStatus: s.state,
      roundNumber: s.roundNumber,
    }));
}

/**
 * Force settle a specific slot (manual override).
 */
export async function forceSettleSlot(slotId: string, winningOutcome: 1 | 2): Promise<{ success: boolean; error?: string }> {
  if (!botState) return { success: false, error: 'Bot not running' };

  const slot = botState.slots.find((s) => s.id === slotId);
  if (!slot) return { success: false, error: `Slot ${slotId} not found` };
  if (slot.state !== 'open') return { success: false, error: `Slot ${slotId} not in open state (${slot.state})` };
  if (!slot.marketId) return { success: false, error: `Slot ${slotId} has no market_id` };

  console.log(`[RoundBot] Force settle ${slotId} → outcome=${winningOutcome}`);
  slot.state = 'settling';
  const result = await delegatedSettle(
    slot.marketId,
    winningOutcome,
    slot.tokenType === 'ALEO' ? undefined : slot.tokenType,
  );

  if (result.success) {
    slot.lastSettleTxId = result.txId || null;
    botState.totalRoundsSettled++;
    slot.state = 'idle';
    slot.marketId = null;
    slot.roundNumber++;
    slot.settleRetries = 0;
    saveState();
    return { success: true };
  } else {
    slot.state = 'open';
    slot.settleRetries = 0;
    return { success: false, error: result.error };
  }
}
