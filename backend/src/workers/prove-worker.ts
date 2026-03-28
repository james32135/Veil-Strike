// Prove Worker — PERSISTENT worker_thread that keeps @provablehq/sdk alive
// so proving key cache persists across settlements (first synthesis is slow, then cached).
//
// Communicates via parentPort messages: receives TaskInput, sends TaskResult.

import { parentPort } from 'worker_threads';

interface TaskInput {
  taskId: string;
  action: 'flash_settle' | 'open_market' | 'warmup';
  privateKey: string;
  aleoEndpoint: string;
  programId: string;
  params: Record<string, any>;
}

interface TaskResult {
  taskId: string;
  success: boolean;
  txId?: string;
  error?: string;
}

const PRIORITY_FEE = 10_000; // 0.01 ALEO

// Real ESM import() — TSC compiles dynamic import() to require() in CJS mode
const importESM = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>;

// Persistent ProgramManager cache — key cache survives across tasks
const pmCache = new Map<string, any>();

async function getOrCreatePM(privateKey: string, aleoEndpoint: string, programId: string) {
  const cacheKey = `${programId}:${aleoEndpoint}`;
  if (pmCache.has(cacheKey)) return pmCache.get(cacheKey);

  const sdk = await importESM('@provablehq/sdk');
  const { ProgramManager, AleoNetworkClient, AleoKeyProvider, NetworkRecordProvider, Account } = sdk;

  const account = new Account({ privateKey });
  const networkClient = new AleoNetworkClient(aleoEndpoint);
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);

  const pm = new ProgramManager(aleoEndpoint, keyProvider, recordProvider);
  pm.setAccount(account);

  pmCache.set(cacheKey, pm);
  console.log(`[ProveWorker] Initialized ProgramManager for ${programId}`);
  return pm;
}

async function executeTask(input: TaskInput): Promise<TaskResult> {
  try {
    const pm = await getOrCreatePM(input.privateKey, input.aleoEndpoint, input.programId);
    let txId: string;

    if (input.action === 'warmup') {
      // Pre-initialize ProgramManager + fetch/synthesize keys (no transaction)
      console.log(`[ProveWorker] Warmed up ProgramManager for ${input.programId}`);
      return { taskId: input.taskId, success: true };
    } else if (input.action === 'flash_settle') {
      const { marketId, winningOutcome } = input.params;
      console.log(`[ProveWorker] Executing flash_settle for ${input.programId}...`);
      txId = await pm.execute({
        programName: input.programId,
        functionName: 'flash_settle',
        inputs: [marketId, `${winningOutcome}u8`],
        priorityFee: PRIORITY_FEE,
        privateFee: false,
      });
    } else if (input.action === 'open_market') {
      const p = input.params;
      console.log(`[ProveWorker] Executing open_market for ${input.programId}...`);
      txId = await pm.execute({
        programName: input.programId,
        functionName: 'open_market',
        inputs: [
          p.questionHash,
          `${p.category}u8`,
          `${p.numOutcomes}u8`,
          `${p.deadline}u32`,
          `${p.resolutionDeadline}u32`,
          p.resolver,
          `${p.initialLiquidity}u128`,
          p.nonce,
        ],
        priorityFee: PRIORITY_FEE,
        privateFee: false,
      });
    } else {
      return { taskId: input.taskId, success: false, error: `Unknown action: ${input.action}` };
    }

    return { taskId: input.taskId, success: true, txId };
  } catch (err: any) {
    return { taskId: input.taskId, success: false, error: err?.message || String(err) };
  }
}

// Sequential task queue — prevents concurrent SDK usage issues
const taskQueue: TaskInput[] = [];
let busy = false;

async function drainQueue() {
  if (busy) return;
  busy = true;
  while (taskQueue.length > 0) {
    const task = taskQueue.shift()!;
    const result = await executeTask(task);
    parentPort!.postMessage(result);
  }
  busy = false;
}

// Listen for messages from the main thread (persistent worker)
if (parentPort) {
  parentPort.on('message', (task: TaskInput) => {
    taskQueue.push(task);
    drainQueue();
  });
  console.log('[ProveWorker] Persistent worker ready');
}
