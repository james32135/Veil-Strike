// Round Bot — automated 15-min Strike Round lifecycle.
// State machine per market slot: IDLE → CREATING → OPEN → SETTLING → IDLE
// Empty rounds (no bets) get a virtual reset at zero on-chain cost.

import { config } from '../config';
import { getCachedPrices } from './oracle';
import { registerMarket, persistRegistry } from './indexer';
import { savePendingMeta, deletePendingMeta } from './scanner';
import { delegatedSettle, delegatedCreateMarket, isDelegatedProvingAvailable, getResolverAddressFromKey } from './delegated-prover';
import { fetchCurrentBlock } from './chain-executor';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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
const TICK_INTERVAL_MS = 15_000;      // Check every 15s
const COOLDOWN_MS = 30_000;           // Wait 30s after settle before creating next
const TX_CONFIRM_TIMEOUT_MS = 120_000; // 2 min to confirm
const TX_POLL_INTERVAL_MS = 10_000;

const SLOT_DEFINITIONS: { id: string; asset: Asset; tokenType: TokenType }[] = [
  { id: 'BTC-ALEO',  asset: 'BTC',  tokenType: 'ALEO'  },
  { id: 'ETH-ALEO',  asset: 'ETH',  tokenType: 'ALEO'  },
  { id: 'ALEO-ALEO', asset: 'ALEO', tokenType: 'ALEO'  },
  // CX/SD variants disabled — open_market requires private Token records + MerkleProofs
  // { id: 'BTC-USDCX', asset: 'BTC',  tokenType: 'USDCX' },
  // { id: 'ETH-USAD',  asset: 'ETH',  tokenType: 'USAD'  },
];

const STATE_FILE = join(__dirname, '../../data/round-bot-state.json');

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

function saveState(): void {
  if (!botState) return;
  try {
    const dir = join(__dirname, '../../data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(botState, null, 2));
  } catch (err) {
    console.error('[RoundBot] Failed to save state:', err);
  }
}

function loadState(): BotState | null {
  try {
    if (existsSync(STATE_FILE)) {
      const raw = readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[RoundBot] Failed to load state:', err);
  }
  return null;
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

  // Use actual testnet block time (~4-5s) for on-chain deadline so it doesn't expire early
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
  });

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
  );

  if (result.success && result.txId) {
    console.log(`[RoundBot] ${slot.id} market tx submitted: ${result.txId} (${result.durationMs}ms)`);
    slot.txId = result.txId;

    // Try to extract the real market_id from the transaction response
    const marketId = extractMarketIdFromTx(result.transaction);
    if (marketId) {
      slot.marketId = marketId;
      console.log(`[RoundBot] ${slot.id} extracted market_id: ${marketId.slice(0, 20)}...`);
      const botEndTime = Date.now() + ROUND_DURATION_MS;
      // Register directly with the real market_id
      registerMarket(marketId, {
        questionHash,
        question,
        outcomes: ['Up', 'Down'],
        isLightning: true,
        tokenType: slot.tokenType === 'ALEO' ? undefined : slot.tokenType,
        botEndTime,
      });
      // Delete pending meta so scanner won't tag old markets with same questionHash as lightning
      deletePendingMeta(questionHash);
      persistRegistry();
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
      botState!.totalRoundsCreated++;
      console.log(`[RoundBot] ${slot.id} round #${slot.roundNumber} OPEN. Start price: $${slot.startPrice}`);
    } else {
      slot.error = 'Transaction not confirmed in time';
      slot.state = 'idle';
      console.error(`[RoundBot] ${slot.id} tx not confirmed: ${result.txId}`);
    }
  } else {
    slot.error = result.error || 'Create failed';
    slot.state = 'idle';
    console.error(`[RoundBot] ${slot.id} creation failed: ${result.error}`);
  }

  saveState();
}

// ─── Settlement ──────────────────────────────────────────────────────────────

async function settleSlot(slot: MarketSlot): Promise<void> {
  if (!slot.marketId) {
    // Try to find market from cache using the txId or question
    const marketId = await findMarketIdForSlot(slot);
    if (!marketId) {
      console.warn(`[RoundBot] ${slot.id} no market_id found, moving to cooldown`);
      slot.state = 'cooldown';
      slot.marketId = null;
      slot.txId = null;
      setTimeout(() => {
        slot.roundNumber++;
        slot.state = 'idle';
        saveState();
      }, COOLDOWN_MS);
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
    if (isEmpty) {
      botState!.totalRoundsSkipped++;
      console.log(`[RoundBot] ${slot.id} EMPTY settled tx=${result.txId} (${result.durationMs}ms)`);
    } else {
      botState!.totalRoundsSettled++;
      console.log(`[RoundBot] ${slot.id} settled tx=${result.txId} (${result.durationMs}ms)`);
    }

    // Cooldown before creating next round
    slot.state = 'cooldown';
    slot.marketId = null;
    slot.txId = null;
    setTimeout(() => {
      slot.roundNumber++;
      slot.state = 'idle';
      saveState();
    }, COOLDOWN_MS);
  } else {
    slot.settleRetries = (slot.settleRetries || 0) + 1;
    if (slot.settleRetries >= 3) {
      console.error(`[RoundBot] ${slot.id} settle failed ${slot.settleRetries} times — skipping round`);
      slot.state = 'cooldown';
      slot.marketId = null;
      slot.txId = null;
      slot.settleRetries = 0;
      botState!.totalRoundsSkipped++;
      setTimeout(() => {
        slot.roundNumber++;
        slot.state = 'idle';
        saveState();
      }, COOLDOWN_MS);
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
    const url = `${config.aleoEndpoint}/testnet/program/${programId}/mapping/amm_pools/${marketId}`;
    const res = await fetch(url);
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
  const { getCachedMarkets } = await import('./indexer');
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
      const url = `${config.aleoEndpoint}/testnet/transaction/${txId}`;
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not yet */ }
    await sleep(TX_POLL_INTERVAL_MS);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main Tick ───────────────────────────────────────────────────────────────

let tickBusy = false;

async function tick(): Promise<void> {
  if (!botState || !running || tickBusy) return;
  tickBusy = true;

  try {
    for (const slot of botState.slots) {
      if (!running) break;

      switch (slot.state) {
        case 'idle': {
          // Create a new market for this slot
          await createMarketForSlot(slot);
          break;
        }
        case 'open': {
          // Check if round expired
          if (Date.now() >= slot.endTime) {
            await settleSlot(slot);
          }
          break;
        }
        case 'settling': {
          // Retry settle if previous attempt failed
          if (slot.error) {
            console.log(`[RoundBot] ${slot.id} retrying settle after error...`);
            slot.error = null;
            await settleSlot(slot);
          }
          break;
        }
        case 'creating':
        case 'cooldown': {
          // Wait for async operation to complete
          break;
        }
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

  // Try to restore state from disk
  const saved = loadState();
  if (saved && saved.slots.length === SLOT_DEFINITIONS.length) {
    botState = saved;
    botState.resolverAddress = resolverAddress;
    console.log(`[RoundBot] Restored state: ${saved.totalRoundsCreated} created, ${saved.totalRoundsSettled} settled, ${saved.totalRoundsSkipped} skipped`);

    // On restart, recover slots intelligently:
    // - OPEN slots with valid marketId and time remaining → keep open (don't orphan)
    // - Everything else → reset to idle (stale rounds, transient states)
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
        });
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
  } else {
    // Fresh start
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
      })),
      resolverAddress,
      startedAt: Date.now(),
      totalRoundsCreated: 0,
      totalRoundsSettled: 0,
      totalRoundsSkipped: 0,
    };
  }

  running = true;

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
    slot.state = 'cooldown';
    slot.marketId = null;
    setTimeout(() => {
      slot.roundNumber++;
      slot.state = 'idle';
      saveState();
    }, COOLDOWN_MS);
    saveState();
    return { success: true };
  } else {
    slot.state = 'open';
    return { success: false, error: result.error };
  }
}
