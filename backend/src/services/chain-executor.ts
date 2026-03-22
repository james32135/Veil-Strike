// On-chain transaction executor using @provablehq/sdk
// Handles seal_market, judge_market, confirm_verdict, settle_round for auto-resolution

import { config } from '../config';

// Lazy-load the ESM SDK
let sdkCache: any = null;
async function getSDK() {
  if (!sdkCache) {
    sdkCache = await import('@provablehq/sdk');
  }
  return sdkCache;
}

const PRIVATE_KEY = process.env.RESOLVER_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const PRIORITY_FEE = 10_000; // 0.01 ALEO

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
export async function executeCloseMarket(marketId: string): Promise<string | null> {
  try {
    const pm = await getProgramManager();
    console.log(`[ChainExecutor] Sealing market ${marketId.slice(0, 20)}...`);

    const txId = await pm.execute({
      programName: config.programId,
      functionName: 'seal_market',
      inputs: [marketId],
      priorityFee: PRIORITY_FEE,
      privateFee: false,
    });

    console.log(`[ChainExecutor] seal_market tx: ${txId}`);
    return txId;
  } catch (err: any) {
    console.error(`[ChainExecutor] seal_market failed:`, err?.message || err);
    return null;
  }
}

/**
 * Execute judge_market on-chain — only the stored resolver can call this
 * winning_outcome: 1u8 = outcome 1 (UP), 2u8 = outcome 2 (DOWN)
 */
export async function executeResolveMarket(
  marketId: string,
  winningOutcome: number
): Promise<string | null> {
  try {
    const pm = await getProgramManager();
    console.log(`[ChainExecutor] Judging market ${marketId.slice(0, 20)}... outcome=${winningOutcome}`);

    const txId = await pm.execute({
      programName: config.programId,
      functionName: 'judge_market',
      inputs: [marketId, `${winningOutcome}u8`],
      priorityFee: PRIORITY_FEE,
      privateFee: false,
    });

    console.log(`[ChainExecutor] judge_market tx: ${txId}`);
    return txId;
  } catch (err: any) {
    console.error(`[ChainExecutor] judge_market failed:`, err?.message || err);
    return null;
  }
}

/**
 * Execute confirm_verdict on-chain — permissionless, after challenge window
 */
export async function executeFinalizeResolution(marketId: string): Promise<string | null> {
  try {
    const pm = await getProgramManager();
    console.log(`[ChainExecutor] Confirming verdict for ${marketId.slice(0, 20)}...`);

    const txId = await pm.execute({
      programName: config.programId,
      functionName: 'confirm_verdict',
      inputs: [marketId],
      priorityFee: PRIORITY_FEE,
      privateFee: false,
    });

    console.log(`[ChainExecutor] confirm_verdict tx: ${txId}`);
    return txId;
  } catch (err: any) {
    console.error(`[ChainExecutor] confirm_verdict failed:`, err?.message || err);
    return null;
  }
}

/**
 * Execute settle_round on-chain — instant resolution for lightning rounds
 * Only the resolver can call. Skips the challenge window entirely.
 */
export async function executeSettleRound(
  marketId: string,
  winningOutcome: number
): Promise<string | null> {
  try {
    const pm = await getProgramManager();
    console.log(`[ChainExecutor] Settling round ${marketId.slice(0, 20)}... outcome=${winningOutcome}`);

    const txId = await pm.execute({
      programName: config.programId,
      functionName: 'settle_round',
      inputs: [marketId, `${winningOutcome}u8`],
      priorityFee: PRIORITY_FEE,
      privateFee: false,
    });

    console.log(`[ChainExecutor] settle_round tx: ${txId}`);
    return txId;
  } catch (err: any) {
    console.error(`[ChainExecutor] settle_round failed:`, err?.message || err);
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
  nonce: string
): Promise<string | null> {
  try {
    const pm = await getProgramManager();
    console.log(`[ChainExecutor] Creating lightning market hash=${questionHash.slice(0, 20)}...`);

    const txId = await pm.execute({
      programName: config.programId,
      functionName: 'init_market',
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

    console.log(`[ChainExecutor] init_market tx: ${txId}`);
    return txId;
  } catch (err: any) {
    console.error(`[ChainExecutor] init_market failed:`, err?.message || err);
    return null;
  }
}

/**
 * Fetch the market_resolutions mapping for a market to check challenge_deadline
 */
export async function fetchResolution(marketId: string): Promise<{
  winningOutcome: number;
  resolvedAt: number;
  challengeDeadline: number;
  finalized: boolean;
} | null> {
  try {
    const url = `${config.aleoEndpoint}/testnet/program/${config.programId}/mapping/market_resolutions/${marketId}`;
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
    const res = await fetch(`${config.aleoEndpoint}/testnet/block/height/latest`);
    if (!res.ok) return 0;
    return parseInt(await res.text(), 10);
  } catch {
    return 0;
  }
}
