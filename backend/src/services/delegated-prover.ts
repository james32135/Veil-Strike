// Delegated Prover — offloads ZK proof generation to Provable API servers.
// ~15-30s per transaction vs 2-5 min local proving. Uses the same private key.
//
// Flow: buildAuthorization (local, ~1s) → submitProvingRequest (remote, ~15-30s) → broadcast result

import { config } from '../config';

const PRIVATE_KEY = process.env.RESOLVER_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const PRIORITY_FEE = 10_000; // 0.01 ALEO in microcredits
const DPS_URL = 'https://api.provable.com/prove/mainnet/prove'; // Delegated Proving Service
const SDK_TIMEOUT_MS = 120_000; // 2 min timeout for SDK calls (proving request + submission)

// Wrap a promise with a timeout to prevent permanent hangs
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[DelegatedProver] ${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

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

// Cached instances per program
const pmCache = new Map<string, any>();
let networkClientCache: any = null;

async function getNetworkClient() {
  if (networkClientCache) return networkClientCache;
  const { AleoNetworkClient } = await getSDK();
  networkClientCache = new AleoNetworkClient(config.aleoEndpoint);
  return networkClientCache;
}

async function getProgramManager(programId: string) {
  if (pmCache.has(programId)) return pmCache.get(programId);
  const { ProgramManager, AleoNetworkClient, AleoKeyProvider, NetworkRecordProvider, Account } = await getSDK();

  if (!PRIVATE_KEY) throw new Error('No RESOLVER_PRIVATE_KEY set');

  const account = new Account({ privateKey: PRIVATE_KEY });
  const networkClient = new AleoNetworkClient(config.aleoEndpoint);
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);

  const pm = new ProgramManager(config.aleoEndpoint, keyProvider, recordProvider);
  pm.setAccount(account);

  pmCache.set(programId, pm);
  console.log(`[DelegatedProver] Initialized ProgramManager for ${programId}`);
  return pm;
}

function getProgramId(tokenType?: string): string {
  if (tokenType === 'USDCX') return config.programIdCx;
  if (tokenType === 'USAD') return config.programIdSd;
  return config.programId;
}

export interface DelegatedResult {
  success: boolean;
  txId?: string;
  transaction?: any;
  broadcastStatus?: string;
  error?: string;
  durationMs?: number;
}

/**
 * Execute a program function via Provable's delegated proving.
 * Builds authorization locally (~1s), then submits to Provable for remote proving + broadcast.
 */
export async function delegatedExecute(
  programId: string,
  functionName: string,
  inputs: string[],
  priorityFee: number = PRIORITY_FEE,
): Promise<DelegatedResult> {
  const start = Date.now();

  if (!config.provableApiKey || !config.provableConsumerId) {
    return { success: false, error: 'Provable API credentials not configured' };
  }
  if (!PRIVATE_KEY) {
    return { success: false, error: 'No RESOLVER_PRIVATE_KEY set' };
  }

  try {
    const pm = await getProgramManager(programId);
    const networkClient = await getNetworkClient();

    console.log(`[DelegatedProver] Building proving request: ${programId}.${functionName}(${inputs.join(', ')})`);

    // Build the proving request (authorization + fee authorization bundled)
    // useFeeMaster=true: DPS pays the fee, we only authorize the execution
    const provingRequest = await withTimeout(pm.provingRequest({
      programName: programId,
      functionName,
      inputs,
      priorityFee,
      privateFee: false,
      useFeeMaster: true,
      broadcast: true, // Provable broadcasts the tx after proving
    }), SDK_TIMEOUT_MS, 'provingRequest');

    console.log(`[DelegatedProver] Submitting to Provable for remote proving...`);

    // Submit to Provable DPS — they prove remotely (~15-30s) and broadcast
    let result: any = await withTimeout(networkClient.submitProvingRequestSafe({
      provingRequest,
      url: DPS_URL,
      apiKey: config.provableApiKey,
      consumerId: config.provableConsumerId,
    }), SDK_TIMEOUT_MS, 'submitProvingRequestSafe');

    // Retry once on 401 — the SDK's internal JWT may have expired
    if (!result.ok && result.status === 401) {
      console.warn(`[DelegatedProver] 401 from DPS — refreshing network client and retrying...`);
      networkClientCache = null;
      const freshClient = await getNetworkClient();
      result = await withTimeout(freshClient.submitProvingRequestSafe({
        provingRequest,
        url: DPS_URL,
        apiKey: config.provableApiKey,
        consumerId: config.provableConsumerId,
      }), SDK_TIMEOUT_MS, 'submitProvingRequestSafe retry');
    }

    const durationMs = Date.now() - start;

    if (result.ok) {
      const { transaction, broadcast_result } = result.data;
      const txId = transaction?.id || '';
      const broadcastStatus = broadcast_result?.status || 'Unknown';

      console.log(`[DelegatedProver] Success: tx=${txId} broadcast=${broadcastStatus} (${durationMs}ms)`);

      return {
        success: broadcastStatus === 'Accepted',
        txId,
        transaction,
        broadcastStatus,
        durationMs,
        error: broadcastStatus !== 'Accepted' ? `Broadcast ${broadcastStatus}: ${broadcast_result?.message || ''}` : undefined,
      };
    } else {
      console.error(`[DelegatedProver] Failed: HTTP ${result.status} — ${result.error?.message}`);
      return {
        success: false,
        error: `Provable API error (${result.status}): ${result.error?.message || 'Unknown'}`,
        durationMs,
      };
    }
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.error(`[DelegatedProver] Exception:`, err?.message || err);
    return {
      success: false,
      error: err?.message || String(err),
      durationMs,
    };
  }
}

/**
 * Settle a market via delegated proving.
 */
export async function delegatedSettle(
  marketId: string,
  winningOutcome: number,
  tokenType?: string,
): Promise<DelegatedResult> {
  const programId = getProgramId(tokenType);
  console.log(`[DelegatedProver] flash_settle market=${marketId.slice(0, 20)}... outcome=${winningOutcome} program=${programId}`);
  return delegatedExecute(programId, 'flash_settle', [marketId, `${winningOutcome}u8`]);
}

/**
 * Create a market via delegated proving.
 */
export async function delegatedCreateMarket(
  questionHash: string,
  category: number,
  numOutcomes: number,
  deadline: number,
  resolutionDeadline: number,
  resolver: string,
  initialLiquidity: number,
  nonce: string,
  tokenType?: string,
  tokenRecord?: string,
  proofs?: string,
): Promise<DelegatedResult> {
  const programId = getProgramId(tokenType);
  console.log(`[DelegatedProver] open_market hash=${questionHash.slice(0, 20)}... program=${programId}`);
  const inputs: string[] = [
    questionHash,
    `${category}u8`,
    `${numOutcomes}u8`,
    `${deadline}u32`,
    `${resolutionDeadline}u32`,
    resolver,
    `${initialLiquidity}u128`,
    nonce,
  ];
  if (tokenRecord && proofs) {
    inputs.push(tokenRecord, proofs);
  }
  return delegatedExecute(programId, 'open_market', inputs);
}

/**
 * Withdraw LP tokens from a resolved market via delegated proving.
 * Returns private credits that need to be transferred back to public.
 */
export async function delegatedWithdrawPool(
  marketId: string,
  lpShares: string,
  lpNonce: string,
  tokenType?: string,
): Promise<DelegatedResult> {
  const programId = getProgramId(tokenType);
  console.log(`[DelegatedProver] withdraw_pool market=${marketId.slice(0, 20)}... program=${programId}`);
  // withdraw_pool takes the LPToken record as input
  // The record format: { owner, market_id, lp_shares, lp_nonce, token_type }
  return delegatedExecute(programId, 'withdraw_pool', [
    marketId,
    lpShares,
    lpNonce,
  ]);
}

/**
 * Check if delegated proving is available (credentials configured).
 */
export function isDelegatedProvingAvailable(): boolean {
  return !!(config.provableApiKey && config.provableConsumerId && PRIVATE_KEY);
}

/**
 * Get the resolver address derived from the private key.
 */
export async function getResolverAddressFromKey(): Promise<string> {
  if (!PRIVATE_KEY) return '';
  const { Account } = await getSDK();
  const account = new Account({ privateKey: PRIVATE_KEY });
  return account.address().to_string();
}
