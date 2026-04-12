// On-chain transaction executor — delegates heavy proof work to Provable API
// Handles lock_market, render_verdict, ratify_verdict for auto-resolution

import { config } from '../config';
import { delegatedExecute } from './delegated-prover';

// Real ESM import() — TSC compiles dynamic import() to require() in CJS mode,
// which fails for ESM packages with top-level await (Node 22+)
const importESM = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>;

let sdkCache: any = null;
async function getSDK() {
  if (!sdkCache) {
    sdkCache = await importESM('@provablehq/sdk/mainnet.js');
  }
  return sdkCache;
}

const PRIVATE_KEY = process.env.RESOLVER_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const PRIORITY_FEE = 10_000; // 0.01 ALEO

// Minimum balance (microcredits) required to attempt on-chain execution.
// lock_market costs ~10 ALEO; set threshold at 11 ALEO = 11,000,000 microcredits.
const MIN_BALANCE_MICROCREDITS = 11_000_000;

// Throttle the "insufficient balance" log so it doesn't spam every 2 minutes
let lastBalanceWarnAt = 0;

// Serialization lock — only one local proof at a time to prevent OOM on small instances
let executionBusy = false;

async function fetchAccountBalance(): Promise<number> {
  try {
    const addr = resolverAddressCache;
    if (!addr) return 0;
    const url = `${config.aleoEndpoint}/${config.aleoNetwork}/program/credits.aleo/mapping/account/${addr}`;
    const res = await fetch(url);
    if (!res.ok) return 0;
    let text = await res.text();
    try { text = JSON.parse(text); } catch {}
    return parseInt(text.replace(/u64$/, ''), 10) || 0;
  } catch {
    return 0;
  }
}

export async function hasMinBalance(): Promise<boolean> {
  const balance = await fetchAccountBalance();
  if (balance < MIN_BALANCE_MICROCREDITS) {
    const now = Date.now();
    if (now - lastBalanceWarnAt > 300_000) { // warn at most once per 5 min
      console.log(`[ChainExecutor] Insufficient balance: ${(balance / 1_000_000).toFixed(2)} ALEO (need ${MIN_BALANCE_MICROCREDITS / 1_000_000} ALEO) — skipping`);
      lastBalanceWarnAt = now;
    }
    return false;
  }
  return true;
}

export function isExecutionBusy(): boolean { return executionBusy; }

function getProgramId(tokenType?: string): string {
  if (tokenType === 'USDCX') return config.programIdCx;
  if (tokenType === 'USAD') return config.programIdSd;
  return config.programId;
}

let programManager: any = null;

async function getProgramManager() {
  if (programManager) return programManager;
  const { ProgramManager, AleoNetworkClient, AleoKeyProvider, NetworkRecordProvider, Account } = await getSDK();

  if (!PRIVATE_KEY) {
    throw new Error('[ChainExecutor] No RESOLVER_PRIVATE_KEY or PRIVATE_KEY set in environment');
  }

  const account = new Account({ privateKey: PRIVATE_KEY });
  const networkClient = new AleoNetworkClient(config.aleoEndpoint);
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);

  const pm = new ProgramManager(
    config.aleoEndpoint,
    keyProvider,
    recordProvider
  );
  pm.setAccount(account);
  programManager = pm;

  console.log(`[ChainExecutor] Initialized with resolver: ${account.address().to_string()}`);
  return pm;
}

export function getResolverAddress(): string {
  if (!PRIVATE_KEY) return '';
  // Derive address from private key synchronously (cache it)
  return resolverAddressCache;
}

let resolverAddressCache = '';

// Initialize address cache at startup
async function initResolverAddress() {
  if (!PRIVATE_KEY) return;
  try {
    const { Account } = await getSDK();
    const account = new Account({ privateKey: PRIVATE_KEY });
    resolverAddressCache = account.address().to_string();
  } catch (err) {
    console.error('[ChainExecutor] Failed to derive resolver address:', err);
  }
}
initResolverAddress();

/**
 * Execute seal_market on-chain — permissionless, anyone can call after deadline
 */
export async function executeCloseMarket(marketId: string, tokenType?: string): Promise<string | null> {
  if (executionBusy) { console.log('[ChainExecutor] Busy — skipping lock_market'); return null; }
  if (!(await hasMinBalance())) return null;
  executionBusy = true;
  try {
    console.log(`[ChainExecutor] Locking market ${marketId.slice(0, 20)}...`);
    const result = await delegatedExecute(
      getProgramId(tokenType),
      'lock_market',
      [marketId],
      PRIORITY_FEE,
    );
    if (result.success && result.txId) {
      console.log(`[ChainExecutor] lock_market tx: ${result.txId}`);
      return result.txId;
    }
    console.error(`[ChainExecutor] lock_market failed:`, result.error);
    return null;
  } catch (err: any) {
    console.error(`[ChainExecutor] lock_market failed:`, err?.message || err);
    return null;
  } finally {
    executionBusy = false;
  }
}

/**
 * Execute judge_market on-chain — only the stored resolver can call this
 * winning_outcome: 1u8 = outcome 1 (UP), 2u8 = outcome 2 (DOWN)
 */
export async function executeResolveMarket(
  marketId: string,
  winningOutcome: number,
  tokenType?: string
): Promise<string | null> {
  if (executionBusy) { console.log('[ChainExecutor] Busy — skipping render_verdict'); return null; }
  if (!(await hasMinBalance())) return null;
  executionBusy = true;
  try {
    console.log(`[ChainExecutor] Rendering verdict ${marketId.slice(0, 20)}... outcome=${winningOutcome}`);
    const result = await delegatedExecute(
      getProgramId(tokenType),
      'render_verdict',
      [marketId, `${winningOutcome}u8`],
      PRIORITY_FEE,
    );
    if (result.success && result.txId) {
      console.log(`[ChainExecutor] render_verdict tx: ${result.txId}`);
      return result.txId;
    }
    console.error(`[ChainExecutor] render_verdict failed:`, result.error);
    return null;
  } catch (err: any) {
    console.error(`[ChainExecutor] render_verdict failed:`, err?.message || err);
    return null;
  } finally {
    executionBusy = false;
  }
}

/**
 * Execute confirm_verdict on-chain — permissionless, after challenge window
 */
export async function executeFinalizeResolution(marketId: string, tokenType?: string): Promise<string | null> {
  if (executionBusy) { console.log('[ChainExecutor] Busy — skipping ratify_verdict'); return null; }
  if (!(await hasMinBalance())) return null;
  executionBusy = true;
  try {
    console.log(`[ChainExecutor] Ratifying verdict for ${marketId.slice(0, 20)}...`);
    const result = await delegatedExecute(
      getProgramId(tokenType),
      'ratify_verdict',
      [marketId],
      PRIORITY_FEE,
    );
    if (result.success && result.txId) {
      console.log(`[ChainExecutor] ratify_verdict tx: ${result.txId}`);
      return result.txId;
    }
    console.error(`[ChainExecutor] ratify_verdict failed:`, result.error);
    return null;
  } catch (err: any) {
    console.error(`[ChainExecutor] ratify_verdict failed:`, err?.message || err);
    return null;
  } finally {
    executionBusy = false;
  }
}

/**
 * Execute settle_round on-chain — instant resolution for lightning rounds
 * Only the resolver can call. Skips the challenge window entirely.
 */
export async function executeSettleRound(
  marketId: string,
  winningOutcome: number,
  tokenType?: string
): Promise<string | null> {
  try {
    const pm = await getProgramManager();
    console.log(`[ChainExecutor] Flash settling ${marketId.slice(0, 20)}... outcome=${winningOutcome}`);

    const txId = await pm.execute({
      programName: getProgramId(tokenType),
      functionName: 'flash_settle',
      inputs: [marketId, `${winningOutcome}u8`],
      priorityFee: PRIORITY_FEE,
      privateFee: false,
    });

    console.log(`[ChainExecutor] flash_settle tx: ${txId}`);
    return txId;
  } catch (err: any) {
    console.error(`[ChainExecutor] flash_settle failed:`, err?.message || err);
    return null;
  }
}

/**
 * Execute init_market on-chain — creates a new market (used by lightning-manager)
 */
export async function executeInitMarket(
  questionHash: string,
  category: number,
  numOutcomes: number,
  deadline: number,
  resolutionDeadline: number,
  resolver: string,
  initialLiquidity: number,
  nonce: string,
  tokenType?: string
): Promise<string | null> {
  try {
    const pm = await getProgramManager();
    console.log(`[ChainExecutor] Creating lightning market hash=${questionHash.slice(0, 20)}...`);

    const txId = await pm.execute({
      programName: getProgramId(tokenType),
      functionName: 'open_market',
      inputs: [
        questionHash,
        `${category}u8`,
        `${numOutcomes}u8`,
        `${deadline}u32`,
        `${resolutionDeadline}u32`,
        resolver,
        `${initialLiquidity}u128`,
        nonce,
      ],
      priorityFee: PRIORITY_FEE,
      privateFee: false,
    });

    console.log(`[ChainExecutor] open_market tx: ${txId}`);
    return txId;
  } catch (err: any) {
    console.error(`[ChainExecutor] open_market failed:`, err?.message || err);
    return null;
  }
}

/**
 * Fetch the market_resolutions mapping for a market to check challenge_deadline
 */
export async function fetchResolution(marketId: string, tokenType?: string): Promise<{
  winningOutcome: number;
  resolvedAt: number;
  challengeDeadline: number;
  finalized: boolean;
} | null> {
  try {
    const pid = getProgramId(tokenType);
    const url = `${config.aleoEndpoint}/${config.aleoNetwork}/program/${pid}/mapping/market_resolutions/${marketId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    let text = await res.text();
    try { text = JSON.parse(text); } catch {}

    const fields: Record<string, string> = {};
    const cleaned = text.replace(/^\{|\}$/g, '').trim();
    for (const part of cleaned.split(',')) {
      const idx = part.indexOf(':');
      if (idx === -1) continue;
      fields[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }

    return {
      winningOutcome: parseInt(fields['winning_outcome']?.replace(/u\d+$/, '') || '0', 10),
      resolvedAt: parseInt(fields['resolved_at']?.replace(/u\d+$/, '') || '0', 10),
      challengeDeadline: parseInt(fields['challenge_deadline']?.replace(/u\d+$/, '') || '0', 10),
      finalized: fields['finalized']?.trim() === 'true',
    };
  } catch {
    return null;
  }
}

/**
 * Fetch current block height
 */
export async function fetchCurrentBlock(): Promise<number> {
  try {
    const res = await fetch(`${config.aleoEndpoint}/${config.aleoNetwork}/block/height/latest`);
    if (!res.ok) return 0;
    return parseInt(await res.text(), 10);
  } catch {
    return 0;
  }
}
