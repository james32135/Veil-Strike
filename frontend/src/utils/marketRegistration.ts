import { ALEO_TESTNET_API, API_BASE, ALL_PROGRAM_IDS } from '@/constants';

/**
 * Resolve a Shield wallet internal ID to a real Aleo at1... transaction ID.
 * Shield returns IDs like "shield_XXXXX" where XXXXX is a transition ID.
 */
export async function resolveShieldTxId(walletTxId: string): Promise<string | null> {
  if (walletTxId.startsWith('at1')) return walletTxId;

  const transitionId = walletTxId.startsWith('shield_')
    ? walletTxId.replace('shield_', '')
    : walletTxId;

  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise(r => setTimeout(r, 10_000));
      const res = await fetch(
        `${ALEO_TESTNET_API}/find/transactionID/from_transition/${transitionId}`
      );
      if (res.ok) {
        const realTxId = (await res.json()) as string;
        if (typeof realTxId === 'string' && realTxId.startsWith('at1')) {
          console.log(`[MarketReg] Resolved Shield ID → ${realTxId.slice(0, 20)}...`);
          return realTxId;
        }
      }
    } catch { /* retry */ }
  }
  return null;
}

/**
 * Extract finalize arguments from a future output value string.
 * Returns top-level field/address/u* values after stripping nested child futures.
 */
export function extractFinalizeArgs(value: string): string[] {
  const args: string[] = [];
  const outerIdx = value.indexOf('arguments:');
  if (outerIdx === -1) return args;
  const bracketStart = value.indexOf('[', outerIdx);
  if (bracketStart === -1) return args;

  let depth = 0, bracketEnd = -1;
  for (let i = bracketStart; i < value.length; i++) {
    if (value[i] === '[') depth++;
    else if (value[i] === ']') { depth--; if (depth === 0) { bracketEnd = i; break; } }
  }
  if (bracketEnd === -1) return args;

  const content = value.substring(bracketStart + 1, bracketEnd);
  let topLevel = '';
  let braceDepth = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') braceDepth++;
    else if (content[i] === '}') braceDepth--;
    else if (braceDepth === 0) topLevel += content[i];
  }

  const pattern = /(\d+field|\d+u\d+|aleo[a-z0-9]+)/g;
  let match;
  while ((match = pattern.exec(topLevel)) !== null) args.push(match[1]);
  return args;
}

export interface MarketRegistrationParams {
  txId: string;
  questionText: string;
  questionHash: string;
  outcomeLabels: string[];
  isLightning: boolean;
  tokenType?: string;
  imageUrl?: string;
  onRegistered?: () => void;
}

/**
 * Three-phase market registration after a create_market tx.
 * 1. Save pending metadata so the scanner can match question text
 * 2. Resolve Shield wallet ID to real Aleo tx ID
 * 3. Poll chain, extract market_id from future args, register with backend
 */
export async function registerMarketFromTx(params: MarketRegistrationParams): Promise<void> {
  const { txId, questionText, questionHash, outcomeLabels, isLightning, tokenType, imageUrl, onRegistered } = params;

  // Phase 1: Save pending metadata
  try {
    await fetch(`${API_BASE}/markets/pending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionHash, question: questionText, outcomes: outcomeLabels, isLightning }),
    });
    console.log(`[MarketReg] Saved pending metadata for hash ${questionHash.slice(0, 20)}...`);
  } catch { /* non-critical */ }

  // Phase 2: Resolve Shield wallet ID
  let realTxId = txId;
  if (!txId.startsWith('at1')) {
    console.log(`[MarketReg] Resolving Shield wallet ID: ${txId.slice(0, 30)}...`);
    const resolved = await resolveShieldTxId(txId);
    if (!resolved) {
      console.warn('[MarketReg] Could not resolve Shield tx ID — backend scanner will auto-discover the market.');
      return;
    }
    realTxId = resolved;
  }

  // Phase 3: Poll chain and extract market_id from future output
  const maxRetries = 12;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise(r => setTimeout(r, 10_000));
      const res = await fetch(`${ALEO_TESTNET_API}/transaction/${realTxId}`);
      if (!res.ok) continue;

      const txData = await res.json();
      const transition = txData?.execution?.transitions?.find(
        (t: { program: string; function: string }) =>
          ALL_PROGRAM_IDS.includes(t.program as typeof ALL_PROGRAM_IDS[number]) &&
          t.function === 'open_market'
      );
      if (!transition) continue;

      // Extract market_id from future output finalize arguments (arg[0])
      let marketId: string | null = null;
      for (const output of (transition.outputs || [])) {
        if (output.type === 'future') {
          const args = extractFinalizeArgs(output.value || '');
          if (args.length > 0 && args[0].endsWith('field')) {
            marketId = args[0];
            break;
          }
        }
      }

      // Fallback: first private output (LPToken record has market_id field)
      if (!marketId && transition.outputs?.[0]?.value) {
        const val = transition.outputs[0].value as string;
        const match = val.match(/(\d+field)/);
        if (match) marketId = match[1];
      }

      if (!marketId) continue;

      console.log(`[MarketReg] Extracted market_id: ${marketId}`);

      // Register with backend
      await fetch(`${API_BASE}/markets/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId,
          question: questionText,
          outcomes: outcomeLabels,
          isLightning,
          tokenType: tokenType || undefined,
          imageUrl: imageUrl || undefined,
        }),
      });
      console.log(`[MarketReg] Registered market ${marketId.slice(0, 20)}... with backend`);
      onRegistered?.();
      return;
    } catch (err) {
      console.warn(`[MarketReg] Retry ${i + 1}/${maxRetries} failed:`, err);
    }
  }
  console.warn('[MarketReg] Frontend auto-registration timed out — backend scanner will auto-discover the market.');
}
