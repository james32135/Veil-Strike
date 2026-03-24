// On-chain block scanner — discovers new markets automatically
// Scans recent blocks for open_market transitions across all 3 programs
// and auto-registers any new markets found with the indexer.

import { config } from '../config';
import { registerMarket, persistRegistry } from './indexer';

const CREATE_FUNCTION = 'open_market';
const PROGRAM_SET = new Set(config.allProgramIds);

// Track the last scanned block to avoid re-scanning
let lastScannedBlock = 0;

/**
 * Extract finalize arguments from a future output value string.
 * The future output contains nested structures — we strip child futures
 * and extract top-level field/address/u* values.
 *
 * For create_market finalize, the arguments are:
 *   [0] market_id (field)
 *   [1] creator (address)
 *   [2] question_hash (field)
 *   [3] category (u8)
 *   [4] num_outcomes (u8)
 *   [5] deadline (u32)
 *   [6] resolution_deadline (u32)
 *   [7] resolver (address)
 *   [8] initial_liquidity (u128)
 *   [9] token_type (u8) — only for init_market_stablecoin
 */
function extractFinalizeArguments(value: string): string[] {
  const args: string[] = [];

  // Find the OUTER arguments array
  const outerIdx = value.indexOf('arguments:');
  if (outerIdx === -1) return args;

  const bracketStart = value.indexOf('[', outerIdx);
  if (bracketStart === -1) return args;

  // Find matching closing bracket using depth counting
  let depth = 0;
  let bracketEnd = -1;
  for (let i = bracketStart; i < value.length; i++) {
    if (value[i] === '[') depth++;
    else if (value[i] === ']') {
      depth--;
      if (depth === 0) { bracketEnd = i; break; }
    }
  }
  if (bracketEnd === -1) return args;

  const argsContent = value.substring(bracketStart + 1, bracketEnd);

  // Strip nested { } content (child futures like transfer_private_to_public)
  let topLevel = '';
  let braceDepth = 0;
  for (let i = 0; i < argsContent.length; i++) {
    if (argsContent[i] === '{') braceDepth++;
    else if (argsContent[i] === '}') braceDepth--;
    else if (braceDepth === 0) topLevel += argsContent[i];
  }

  // Match field, address, u8, u32, u64, u128 values from top-level only
  const valuePattern = /(\d+field|\d+u\d+|aleo[a-z0-9]+)/g;
  let match;
  while ((match = valuePattern.exec(topLevel)) !== null) {
    args.push(match[1]);
  }

  return args;
}

/**
 * Scan a single block for create_market transitions from our program.
 * Returns an array of discovered { marketId, questionHash, numOutcomes, isUsdcx }.
 */
async function scanBlock(blockHeight: number): Promise<Array<{
  marketId: string;
  questionHash: string;
  numOutcomes: number;
  category: number;
  tokenType: string;
  transactionId: string;
}>> {
  const results: Array<{
    marketId: string;
    questionHash: string;
    numOutcomes: number;
    category: number;
    tokenType: string;
    transactionId: string;
  }> = [];

  try {
    const res = await fetch(`${config.aleoEndpoint}/testnet/block/${blockHeight}`);
    if (!res.ok) return results;

    const block: any = await res.json();
    const transactions = block.transactions || [];

    for (const txWrapper of transactions) {
      const tx = txWrapper.transaction || txWrapper;
      const txId: string = tx.id || txWrapper.id || '';
      const transitions = tx.execution?.transitions || [];

      for (const transition of transitions) {
        if (!PROGRAM_SET.has(transition.program)) continue;
        if (transition.function !== CREATE_FUNCTION) continue;

        const tokenType = transition.program === config.programIdCx ? 'USDCX'
          : transition.program === config.programIdSd ? 'USAD' : 'ALEO';

        // Extract market_id from the future output's finalize arguments
        for (const output of (transition.outputs || [])) {
          if (output.type !== 'future') continue;

          const args = extractFinalizeArguments(output.value || '');
          // args[0] = market_id, args[2] = question_hash (after creator address at [1])
          if (args.length >= 5) {
            const marketId = args[0];
            const questionHash = args[2];
            // Category is at index 3, num_outcomes at index 4
            const category = parseInt(args[3]?.replace(/u\d+$/, '') || '7', 10);
            const numOutcomes = parseInt(args[4]?.replace(/u\d+$/, '') || '2', 10);

            if (marketId && marketId.endsWith('field')) {
              results.push({ marketId, questionHash, numOutcomes, category, tokenType, transactionId: txId });
            }
          }
        }
      }
    }
  } catch (err) {
    // Silently skip failed blocks (API rate limiting, etc.)
  }

  return results;
}

/**
 * Scan recent blocks for new create_market transactions.
 * Discovers markets and auto-registers them with the indexer.
 * Returns count of newly discovered markets.
 */
export async function scanForNewMarkets(blocksToScan: number = 200): Promise<number> {
  try {
    // Get current block height
    const heightRes = await fetch(`${config.aleoEndpoint}/testnet/block/height/latest`);
    if (!heightRes.ok) return 0;
    const currentHeight = parseInt(await heightRes.text(), 10);

    // Determine scan range
    const startBlock = lastScannedBlock > 0
      ? Math.max(lastScannedBlock + 1, currentHeight - blocksToScan)
      : currentHeight - blocksToScan;

    if (startBlock >= currentHeight) {
      lastScannedBlock = currentHeight;
      return 0;
    }

    console.log(`[Scanner] Scanning blocks ${startBlock}..${currentHeight} for new markets`);

    let newMarkets = 0;
    const BATCH_SIZE = 5;

    // Scan in parallel batches (newest first for faster discovery)
    for (let offset = 0; offset < currentHeight - startBlock; offset += BATCH_SIZE) {
      const heights: number[] = [];
      for (let i = 0; i < BATCH_SIZE && startBlock + offset + i <= currentHeight; i++) {
        heights.push(currentHeight - offset - i);
      }

      const batchResults = await Promise.all(heights.map(h => scanBlock(h)));

      for (const blockResults of batchResults) {
        for (const found of blockResults) {
          // Generate default metadata for auto-discovered markets
          const outcomes = found.numOutcomes <= 2 ? ['Yes', 'No'] :
            Array.from({ length: found.numOutcomes }, (_, i) => `Outcome ${i + 1}`);

          // Check if question text is available from pending registry
          const pendingMeta = getPendingMeta(found.questionHash);

          const registered = registerMarket(found.marketId, {
            questionHash: found.questionHash,
            question: pendingMeta?.question || `Market ${found.marketId.slice(0, 16)}...`,
            outcomes: pendingMeta?.outcomes || outcomes,
            isLightning: pendingMeta?.isLightning || false,
            tokenType: found.tokenType as 'ALEO' | 'USDCX' | 'USAD',
          });

          if (registered) {
            console.log(`[Scanner] Discovered market ${found.marketId.slice(0, 20)}... (${found.tokenType}) tx=${found.transactionId.slice(0, 15)}...`);
            newMarkets++;
          }
        }
      }

      // Brief pause between batches to avoid API rate limiting
      if (offset + BATCH_SIZE < currentHeight - startBlock) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    lastScannedBlock = currentHeight;

    if (newMarkets > 0) {
      persistRegistry();
      console.log(`[Scanner] Found ${newMarkets} new market(s)`);
    }

    return newMarkets;
  } catch (err) {
    console.error('[Scanner] Error:', err);
    return 0;
  }
}

// ── Pending metadata registry ──
// Frontend POSTs question text + metadata before the tx confirms.
// Scanner uses this to populate the market question when it discovers the market_id.

interface PendingMeta {
  question: string;
  outcomes: string[];
  isLightning: boolean;
  createdAt: number;
}

const pendingMetaByHash: Record<string, PendingMeta> = {};

export function savePendingMeta(questionHash: string, meta: PendingMeta): void {
  pendingMetaByHash[questionHash] = meta;
  // Auto-cleanup entries older than 24 hours
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [hash, m] of Object.entries(pendingMetaByHash)) {
    if (m.createdAt < cutoff) delete pendingMetaByHash[hash];
  }
}

function getPendingMeta(questionHash: string): PendingMeta | undefined {
  return pendingMetaByHash[questionHash];
}
