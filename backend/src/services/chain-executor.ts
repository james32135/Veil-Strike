// On-chain transaction executor using @provablehq/sdk
// Handles close_market, resolve_market, finalize_resolution for auto-resolution

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
 * Execute close_market on-chain — permissionless, anyone can call after deadline
 */
export async function executeCloseMarket(marketId: string): Promise<string | null> {
  try {
    const pm = await getProgramManager();
    console.log(`[ChainExecutor] Closing market ${marketId.slice(0, 20)}...`);

    const txId = await pm.execute({
      programName: config.programId,
      functionName: 'close_market',
      inputs: [marketId],
      priorityFee: PRIORITY_FEE,
      privateFee: false,
    });

    console.log(`[ChainExecutor] close_market tx: ${txId}`);
    return txId;
  } catch (err: any) {
    console.error(`[ChainExecutor] close_market failed:`, err?.message || err);
    return null;
  }
}

/**
 * Execute resolve_market on-chain — only the stored resolver can call this
 * winning_outcome: 1u8 = outcome 1 (UP), 2u8 = outcome 2 (DOWN)
 */
export async function executeResolveMarket(
  marketId: string,
  winningOutcome: number
): Promise<string | null> {
  try {
    const pm = await getProgramManager();
    console.log(`[ChainExecutor] Resolving market ${marketId.slice(0, 20)}... outcome=${winningOutcome}`);

    const txId = await pm.execute({
      programName: config.programId,
      functionName: 'resolve_market',
      inputs: [marketId, `${winningOutcome}u8`],
      priorityFee: PRIORITY_FEE,
      privateFee: false,
    });

    console.log(`[ChainExecutor] resolve_market tx: ${txId}`);
    return txId;
  } catch (err: any) {
    console.error(`[ChainExecutor] resolve_market failed:`, err?.message || err);
    return null;
  }
}

/**
 * Execute finalize_resolution on-chain — permissionless, after challenge window
 */
export async function executeFinalizeResolution(marketId: string): Promise<string | null> {
  try {
    const pm = await getProgramManager();
    console.log(`[ChainExecutor] Finalizing resolution for ${marketId.slice(0, 20)}...`);

    const txId = await pm.execute({
      programName: config.programId,
      functionName: 'finalize_resolution',
      inputs: [marketId],
      priorityFee: PRIORITY_FEE,
      privateFee: false,
    });

    console.log(`[ChainExecutor] finalize_resolution tx: ${txId}`);
    return txId;
  } catch (err: any) {
    console.error(`[ChainExecutor] finalize_resolution failed:`, err?.message || err);
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
