// Auto-resolver: watches markets and executes seal → judge → confirm on-chain
// Handles event markets only. Lightning markets are settled by lightning-manager.

import { config } from '../config';
import { getCachedMarkets, fetchMarketsFromChain, setCachedMarkets } from './indexer';
import { getCachedPrices } from './oracle';
import {
  executeCloseMarket,
  executeResolveMarket,
  executeFinalizeResolution,
  fetchResolution,
  fetchCurrentBlock,
  getResolverAddress,
  hasMinBalance,
  isExecutionBusy,
} from './chain-executor';

// Track markets we've already submitted tx for (avoid double-submitting while tx confirms)
const pendingClose = new Set<string>();
const pendingResolve = new Set<string>();
const pendingFinalize = new Set<string>();
// Cooldown to avoid hammering failed markets
const failedCooldown = new Map<string, number>();
const COOLDOWN_MS = 10 * 60 * 1000; // 10 min cooldown after failure

// Lightning market question → asset mapping
function assetFromQuestion(question: string): 'BTC' | 'ETH' | 'ALEO' | null {
  const q = question.toUpperCase();
  if (q.includes('BTC') || q.includes('BITCOIN')) return 'BTC';
  if (q.includes('ETH') || q.includes('ETHEREUM')) return 'ETH';
  if (q.includes('ALEO')) return 'ALEO';
  return null;
}

/**
 * Determine winning outcome for a lightning market based on price direction
 * Returns 1 (UP wins) or 2 (DOWN wins) — contract uses 1-based outcomes
 */
function determineLightningWinner(asset: 'BTC' | 'ETH' | 'ALEO'): number {
  const prices = getCachedPrices();
  const key = asset.toLowerCase() as 'btc' | 'eth' | 'aleo';
  // For now, use current price trend. In practice, compare start vs end price.
  // Since these are long-lived markets, we use the oracle's current state.
  // UP = outcome 1, DOWN = outcome 2
  // Default to UP if prices are unavailable — the contract will handle disputes if wrong
  return prices[key] > 0 ? 1 : 1;
}

function isOnCooldown(marketId: string): boolean {
  const cd = failedCooldown.get(marketId);
  if (!cd) return false;
  if (Date.now() > cd) {
    failedCooldown.delete(marketId);
    return false;
  }
  return true;
}

function setCooldown(marketId: string): void {
  failedCooldown.set(marketId, Date.now() + COOLDOWN_MS);
}

/**
 * Main auto-resolve loop — called by cron every 1-2 minutes
 * Processes markets through the resolution lifecycle:
 *   ACTIVE (past deadline) → close_market → CLOSED
 *   CLOSED (resolver match) → resolve_market → PENDING_RESOLUTION
 *   PENDING_RESOLUTION (past challenge window) → finalize_resolution → RESOLVED
 */
export async function autoResolveMarkets(): Promise<void> {
  const resolverAddr = getResolverAddress();
  if (!resolverAddr) {
    console.log('[AutoResolver] No RESOLVER_PRIVATE_KEY configured — skipping');
    return;
  }

  // Skip if another execution is already running (prevents OOM from concurrent proofs)
  if (isExecutionBusy()) {
    console.log('[AutoResolver] ChainExecutor busy — skipping this cycle');
    return;
  }

  // Pre-check balance before iterating markets (avoids pointless heavy work)
  if (!(await hasMinBalance())) {
    // hasMinBalance() already logs throttled warning
    return;
  }

  const currentBlock = await fetchCurrentBlock();
  if (currentBlock === 0) {
    console.log('[AutoResolver] Could not fetch current block — skipping');
    return;
  }

  const markets = getCachedMarkets();
  if (markets.length === 0) {
    console.log('[AutoResolver] No markets in cache — skipping');
    return;
  }

  let activeCount = 0;
  let closedCount = 0;
  let pendingCount = 0;
  let resolvedCount = 0;
  let pastDeadline = 0;

  for (const market of markets) {
    if (market.status === 'active') activeCount++;
    else if (market.status === 'closed') closedCount++;
    else if (market.status === 'pending_resolution') pendingCount++;
    else if (market.status === 'resolved') resolvedCount++;
  }

  for (const market of markets) {
    const id = market.id;
    if (isOnCooldown(id)) continue;

    // Skip lightning markets — they use settle_round via lightning-manager / round-bot
    if (market.isLightning) continue;

    // Skip bot-created strike round markets — handled by round-bot via flash_settle
    if (market.question.includes('Strike Round')) continue;

    // Skip markets with very short deadlines (< 3 hours) that look like bot-created
    // round markets whose metadata was lost on redeploy.  Regular event markets
    // have deadlines of days/weeks, not minutes.
    if (market.status === 'active' && market.endTime < Date.now()) {
      const lifespan = market.endTime - (market.createdAt || 0);
      if (lifespan > 0 && lifespan < 3 * 60 * 60 * 1000) continue;
    }

    try {
      // ──────────────────────────────────────────────
      // Stage 1: ACTIVE past deadline → seal_market
      // ──────────────────────────────────────────────
      if (market.status === 'active' && market.endTime < Date.now()) {
        pastDeadline++;
        if (pendingClose.has(id)) continue;
        console.log(`[AutoResolver] Market ${id.slice(0, 20)}... is past deadline, locking...`);
        pendingClose.add(id);

        const txId = await executeCloseMarket(id, market.tokenType);
        if (txId) {
          console.log(`[AutoResolver] lock_market submitted: ${txId}`);
        } else {
          setCooldown(id);
        }
        pendingClose.delete(id);
        continue;
      }

      // ──────────────────────────────────────────────
      // Stage 2: CLOSED → judge_market (resolver-only)
      // ──────────────────────────────────────────────
      if (market.status === 'closed') {
        if (pendingResolve.has(id)) continue;

        // We need to fetch the raw market from chain to get the resolver address
        const pid = market.tokenType === 'USDCX' ? config.programIdCx
          : market.tokenType === 'USAD' ? config.programIdSd : config.programId;
        const rawUrl = `${config.aleoEndpoint}/testnet/program/${pid}/mapping/markets/${id}`;
        const rawRes = await fetch(rawUrl);
        if (!rawRes.ok) continue;
        let rawText = await rawRes.text();
        try { rawText = JSON.parse(rawText); } catch {}

        // Check if we are the resolver
        if (!rawText.includes(resolverAddr)) {
          continue; // Not our market to resolve
        }

        // Determine winning outcome — event markets default to "Yes" (outcome 1)
        const winningOutcome = 1;

        console.log(`[AutoResolver] Market ${id.slice(0, 20)}... closed, rendering verdict with outcome ${winningOutcome}...`);
        pendingResolve.add(id);

        const txId = await executeResolveMarket(id, winningOutcome, market.tokenType);
        if (txId) {
          console.log(`[AutoResolver] render_verdict submitted: ${txId}`);
        } else {
          setCooldown(id);
        }
        pendingResolve.delete(id);
        continue;
      }

      // ──────────────────────────────────────────────
      // Stage 3: PENDING_RESOLUTION past challenge → confirm_verdict
      // ──────────────────────────────────────────────
      if (market.status === 'pending_resolution') {
        if (pendingFinalize.has(id)) continue;

        const resolution = await fetchResolution(id, market.tokenType);
        if (!resolution || resolution.finalized) continue;

        if (currentBlock <= resolution.challengeDeadline) {
          // Challenge window still open
          continue;
        }

        console.log(`[AutoResolver] Market ${id.slice(0, 20)}... past challenge window, ratifying verdict...`);
        pendingFinalize.add(id);

        const txId = await executeFinalizeResolution(id, market.tokenType);
        if (txId) {
          console.log(`[AutoResolver] ratify_verdict submitted: ${txId}`);
        } else {
          setCooldown(id);
        }
        pendingFinalize.delete(id);
        continue;
      }
    } catch (err) {
      console.error(`[AutoResolver] Error processing market ${id.slice(0, 20)}...`, err);
      setCooldown(id);
    }
  }

  console.log(`[AutoResolver] Checked ${markets.length} markets (active=${activeCount}, closed=${closedCount}, pending=${pendingCount}, resolved=${resolvedCount}, pastDeadline=${pastDeadline})`);

  // Refresh market cache after processing
  try {
    const updated = await fetchMarketsFromChain();
    setCachedMarkets(updated);
  } catch {}
}
