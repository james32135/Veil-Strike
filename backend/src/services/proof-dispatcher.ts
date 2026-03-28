// Proof Dispatcher — routes proving to Provable delegated proving (fast, ~30s)
// or falls back to a PERSISTENT local prove-worker thread (slow, 2-5 min).
// Delegated proving is preferred when PROVABLE_API_KEY is configured.

import { Worker } from 'worker_threads';
import { join } from 'path';
import { config } from '../config';
import { delegatedSettle, delegatedCreateMarket, isDelegatedProvingAvailable } from './delegated-prover';

const PRIVATE_KEY = process.env.RESOLVER_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const TASK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (first key synthesis is slow)

function getProgramId(tokenType?: string): string {
  if (tokenType === 'USDCX') return config.programIdCx;
  if (tokenType === 'USAD') return config.programIdSd;
  return config.programId;
}

interface TaskResult {
  taskId: string;
  success: boolean;
  txId?: string;
  error?: string;
}

let worker: Worker | null = null;
let taskCounter = 0;
const pendingTasks = new Map<string, {
  resolve: (r: TaskResult) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

function ensureWorker(): Worker {
  if (worker) return worker;

  const workerPath = join(__dirname, '../workers/prove-worker.ts');
  const w = new Worker(workerPath, {
    execArgv: ['--require', 'tsx/cjs'],
  });

  w.on('message', (result: TaskResult) => {
    const pending = pendingTasks.get(result.taskId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingTasks.delete(result.taskId);
      if (result.success) {
        console.log(`[ProofDispatcher] Task ${result.taskId} succeeded tx=${result.txId}`);
      } else {
        console.error(`[ProofDispatcher] Task ${result.taskId} failed: ${result.error}`);
      }
      pending.resolve(result);
    }
  });

  w.on('error', (err) => {
    console.error(`[ProofDispatcher] Worker error:`, err.message);
    for (const [id, pending] of pendingTasks) {
      clearTimeout(pending.timer);
      pending.resolve({ taskId: id, success: false, error: err.message });
    }
    pendingTasks.clear();
    worker = null;
  });

  w.on('exit', (code) => {
    console.log(`[ProofDispatcher] Worker exited with code ${code}`);
    for (const [id, pending] of pendingTasks) {
      clearTimeout(pending.timer);
      pending.resolve({ taskId: id, success: false, error: `Worker exited (${code})` });
    }
    pendingTasks.clear();
    worker = null;
  });

  worker = w;
  console.log('[ProofDispatcher] Persistent worker spawned');
  return w;
}

function dispatch(action: string, params: Record<string, any>, programId: string): Promise<TaskResult> {
  if (!PRIVATE_KEY) {
    return Promise.resolve({ taskId: '', success: false, error: 'No RESOLVER_PRIVATE_KEY set' });
  }

  const taskId = `${action}-${++taskCounter}`;
  const w = ensureWorker();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingTasks.delete(taskId);
      console.error(`[ProofDispatcher] Task ${taskId} timed out after ${TASK_TIMEOUT_MS / 60000}m`);
      resolve({ taskId, success: false, error: 'Task timeout' });
    }, TASK_TIMEOUT_MS);

    pendingTasks.set(taskId, { resolve, timer });

    w.postMessage({
      taskId,
      action,
      privateKey: PRIVATE_KEY,
      aleoEndpoint: config.aleoEndpoint,
      programId,
      params,
    });
  });
}

/**
 * Dispatch flash_settle — uses delegated proving if available, falls back to local worker.
 */
export async function dispatchSettle(
  marketId: string,
  winningOutcome: number,
  tokenType?: string,
): Promise<string | null> {
  console.log(`[ProofDispatcher] Dispatching flash_settle market=${marketId.slice(0, 20)}... outcome=${winningOutcome} token=${tokenType || 'ALEO'}`);

  // Try delegated proving first (fast, ~30s)
  if (isDelegatedProvingAvailable()) {
    const result = await delegatedSettle(marketId, winningOutcome, tokenType);
    if (result.success && result.txId) return result.txId;
    console.warn(`[ProofDispatcher] Delegated settle failed, falling back to local: ${result.error}`);
  }

  // Fallback to local worker (slow, 2-5 min)
  const result = await dispatch('flash_settle', { marketId, winningOutcome }, getProgramId(tokenType));
  return result.success ? (result.txId ?? null) : null;
}

/**
 * Dispatch open_market — uses delegated proving if available, falls back to local worker.
 */
export async function dispatchCreateMarket(
  questionHash: string,
  category: number,
  numOutcomes: number,
  deadline: number,
  resolutionDeadline: number,
  resolver: string,
  initialLiquidity: number,
  nonce: string,
  tokenType?: string,
): Promise<string | null> {
  console.log(`[ProofDispatcher] Dispatching open_market hash=${questionHash.slice(0, 20)}...`);

  // Try delegated proving first (fast, ~30s)
  if (isDelegatedProvingAvailable()) {
    const result = await delegatedCreateMarket(
      questionHash, category, numOutcomes, deadline, resolutionDeadline,
      resolver, initialLiquidity, nonce, tokenType,
    );
    if (result.success && result.txId) return result.txId;
    console.warn(`[ProofDispatcher] Delegated create failed, falling back to local: ${result.error}`);
  }

  // Fallback to local worker (slow, 2-5 min)
  const result = await dispatch('open_market', {
    questionHash, category, numOutcomes, deadline, resolutionDeadline,
    resolver, initialLiquidity, nonce,
  }, getProgramId(tokenType));
  return result.success ? (result.txId ?? null) : null;
}

/**
 * Get the number of pending tasks for monitoring.
 */
export function getActiveWorkerCount(): number {
  return pendingTasks.size;
}

/**
 * Warm up the persistent worker by initializing ProgramManagers for all programs.
 * This pre-loads the SDK so first settlement is faster.
 */
export function warmupWorker(): void {
  if (!PRIVATE_KEY) return;
  const programs = [config.programId, config.programIdCx, config.programIdSd];
  for (const pid of programs) {
    dispatch('warmup', {}, pid).then((r) => {
      if (r.success) console.log(`[ProofDispatcher] Warmup OK: ${pid}`);
      else console.error(`[ProofDispatcher] Warmup failed for ${pid}: ${r.error}`);
    });
  }
}
