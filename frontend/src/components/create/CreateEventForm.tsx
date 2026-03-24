import { useState } from 'react';
import { useTransaction } from '@/hooks/useTransaction';
import { buildCreateMarketTx, buildCreateMarketStableTx, generateNonce } from '@/utils/transactions';
import { getUsdcxProofs } from '@/utils/freezeListProof';
import { parseAleoInput } from '@/utils/format';
import { CATEGORIES, API_BASE, ALEO_TESTNET_API, PROGRAM_ID, PROGRAM_ID_CX, PROGRAM_ID_SD, ALL_PROGRAM_IDS } from '@/constants';
import { useWalletStore } from '@/stores/walletStore';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';

interface CreateEventFormProps {
  onSuccess?: () => void;
}

export default function CreateEventForm({ onSuccess }: CreateEventFormProps) {
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('crypto');
  const [outcomes, setOutcomes] = useState(['Yes', 'No']);
  const [initialLiquidity, setInitialLiquidity] = useState('10');
  const [durationDays, setDurationDays] = useState('7');
  const [tokenType, setTokenType] = useState<'ALEO' | 'USDCX' | 'USAD'>('ALEO');
  const { status, execute, fetchUsdcxRecord } = useTransaction();
  const walletAddress = useWalletStore((s) => s.address);

  const handleAddOutcome = () => {
    if (outcomes.length < 6) {
      setOutcomes([...outcomes, '']);
    }
  };

  const handleRemoveOutcome = (index: number) => {
    if (outcomes.length > 2) {
      setOutcomes(outcomes.filter((_, i) => i !== index));
    }
  };

  const handleOutcomeChange = (index: number, value: string) => {
    const updated = [...outcomes];
    updated[index] = value;
    setOutcomes(updated);
  };

  /**
   * After a create_market tx is confirmed, fetch the tx from chain,
   * extract the market_id from outputs, and register it with the backend.
   */
  /**
   * Resolve a Shield wallet internal ID to a real Aleo at1... transaction ID.
   * Shield returns IDs like "shield_XXXXX" where XXXXX is a transition ID.
   * We use the Aleo API to look up the real tx ID from the transition.
   */
  const resolveShieldTxId = async (walletTxId: string): Promise<string | null> => {
    if (walletTxId.startsWith('at1')) return walletTxId;

    // Extract transition ID: "shield_XXXXX" → "XXXXX"
    const transitionId = walletTxId.startsWith('shield_')
      ? walletTxId.replace('shield_', '')
      : walletTxId;

    // Aleo API: find real tx ID from transition ID
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
            console.log(`[CreateMarket] Resolved Shield ID → ${realTxId.slice(0, 20)}...`);
            return realTxId;
          }
        }
      } catch { /* retry */ }
    }
    return null;
  };

  /**
   * Extract finalize arguments from a future output value string.
   * Returns top-level field/address/u* values after stripping nested child futures.
   */
  const extractFinalizeArgs = (value: string): string[] => {
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
  };

  /**
   * After a create_market tx is confirmed on-chain, extract market_id
   * from the future output and register with the backend.
   */
  const registerMarketFromTx = async (
    txId: string,
    questionText: string,
    questionHash: string,
    outcomeLabels: string[],
    isLightning: boolean,
  ) => {
    // Step 1: Immediately save pending metadata with backend so the
    // block scanner can match question text when it finds the market.
    try {
      await fetch(`${API_BASE}/markets/pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionHash, question: questionText, outcomes: outcomeLabels, isLightning }),
      });
      console.log(`[CreateMarket] Saved pending metadata for hash ${questionHash.slice(0, 20)}...`);
    } catch { /* non-critical */ }

    // Step 2: Resolve the real on-chain tx ID (Shield wallet returns internal IDs)
    let realTxId = txId;
    if (!txId.startsWith('at1')) {
      console.log(`[CreateMarket] Resolving Shield wallet ID: ${txId.slice(0, 30)}...`);
      const resolved = await resolveShieldTxId(txId);
      if (!resolved) {
        console.warn('[CreateMarket] Could not resolve Shield tx ID — backend scanner will auto-discover the market.');
        return;
      }
      realTxId = resolved;
    }

    // Step 3: Fetch the confirmed tx and extract market_id from future output
    const maxRetries = 12;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await new Promise(r => setTimeout(r, 10_000));
        const res = await fetch(`${ALEO_TESTNET_API}/transaction/${realTxId}`);
        if (!res.ok) continue;

        const txData = await res.json();
        const transition = txData?.execution?.transitions?.find(
          (t: { program: string; function: string }) =>
            t.program === PROGRAM_ID &&
            t.function === 'open_market') || txData?.execution?.transitions?.find(
          (t: { program: string; function: string }) =>
            (t.program === PROGRAM_ID_CX || t.program === PROGRAM_ID_SD) &&
            t.function === 'open_market'
        );
        if (!transition) continue;

        // Extract market_id from the future output's finalize arguments (arg[0])
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

        console.log(`[CreateMarket] Extracted market_id: ${marketId}`);

        // Register with backend (this also persists to disk)
        await fetch(`${API_BASE}/markets/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketId,
            question: questionText,
            outcomes: outcomeLabels,
            isLightning,
          }),
        });
        console.log(`[CreateMarket] Registered market ${marketId.slice(0, 20)}... with backend`);
        return;
      } catch (err) {
        console.warn(`[CreateMarket] Retry ${i + 1}/${maxRetries} failed:`, err);
      }
    }
    console.warn('[CreateMarket] Frontend auto-registration timed out — backend scanner will auto-discover the market.');
  };

  const handleCreate = async () => {
    const liquidityMicro = parseAleoInput(initialLiquidity);
    if (!question || liquidityMicro < 1_000_000 || outcomes.some((o) => !o.trim())) return;

    const nonce = generateNonce();
    const endTime = Date.now() + parseInt(durationDays) * 86_400_000;

    const questionHash = `${BigInt(Array.from(new TextEncoder().encode(question)).reduce((h, b) => h * 31n + BigInt(b), 0n)) % BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001')}field`;
    const categoryMap: Record<string, number> = { Crypto: 1, Sports: 3, Politics: 4, Science: 5, Entertainment: 6, Other: 7 };
    const catNum = categoryMap[category] || 7;
    const blockDeadline = `${Math.floor(endTime / 15000) + 15044000}u32`;
    const resolutionBlock = `${Math.floor(endTime / 15000) + 15044000 + 120960}u32`;
    const resolver = walletAddress || '';
    const isStable = tokenType === 'USDCX' || tokenType === 'USAD';
    let tx;
    if (isStable) {
      const tokenRecord = await fetchUsdcxRecord(liquidityMicro, tokenType);
      if (!tokenRecord) return;
      const proofs = await getUsdcxProofs(tokenType);
      tx = buildCreateMarketStableTx(
        tokenType,
        questionHash,
        catNum,
        outcomes.length,
        blockDeadline,
        resolutionBlock,
        resolver,
        `${liquidityMicro}u128`,
        nonce,
        tokenRecord,
        proofs
      );
    } else {
      tx = buildCreateMarketTx(
        questionHash,
        catNum,
        outcomes.length,
        blockDeadline,
        resolutionBlock,
        resolver,
        `${liquidityMicro}u128`,
        nonce
      );
    }
    const txId = await execute(tx);
    if (txId) {
      // Extract market_id from on-chain transaction and register with backend
      const isLightning = /lightning|round/i.test(question);
      registerMarketFromTx(txId, question, questionHash, outcomes, isLightning);
    }
    onSuccess?.();
  };

  const isValid = question.trim() &&
    parseAleoInput(initialLiquidity) >= 1_000_000 &&
    outcomes.every((o) => o.trim()) &&
    parseInt(durationDays) > 0;

  return (
    <div className="space-y-5">
      {/* Question */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Market Question
        </label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g., Will Bitcoin reach $100k by March 2025?"
          className="input-field"
          maxLength={200}
        />
        <p className="text-[10px] text-gray-600 mt-1">{question.length}/200 characters</p>
      </div>

      {/* Category */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c !== 'all').map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs rounded-lg border capitalize transition-all ${
                category === cat
                  ? 'border-teal/40 bg-teal/10 text-teal'
                  : 'border-dark-400/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Token Type */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Token
        </label>
        <div className="flex gap-2">
          {(['ALEO', 'USDCX', 'USAD'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTokenType(t)}
              className={`px-4 py-2 text-xs rounded-lg border font-heading font-medium transition-all ${
                tokenType === t
                  ? 'border-teal/40 bg-teal/10 text-teal'
                  : 'border-dark-400/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Outcomes */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Outcomes
        </label>
        <div className="space-y-2">
          {outcomes.map((outcome, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={outcome}
                onChange={(e) => handleOutcomeChange(i, e.target.value)}
                placeholder={`Outcome ${i + 1}`}
                className="input-field flex-1"
                maxLength={50}
              />
              {outcomes.length > 2 && (
                <button
                  onClick={() => handleRemoveOutcome(i)}
                  className="px-3 text-gray-600 hover:text-accent-red transition-colors"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {outcomes.length < 6 && (
          <button
            onClick={handleAddOutcome}
            className="mt-2 text-xs text-teal hover:text-teal/80 transition-colors"
          >
            + Add Outcome
          </button>
        )}
      </div>

      {/* Duration & Liquidity */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
            Duration (Days)
          </label>
          <select
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            className="input-field"
          >
            <option value="1">1 day</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
            Initial Liquidity ({tokenType})
          </label>
          <input
            type="number"
            value={initialLiquidity}
            onChange={(e) => setInitialLiquidity(e.target.value)}
            placeholder="10"
            min="1"
            className="input-field"
          />
        </div>
      </div>

      {/* Preview */}
      {question && (
        <Card className="p-4 border-teal/10">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Preview</p>
          <p className="text-sm font-heading text-white mb-2">{question}</p>
          <div className="flex gap-2 flex-wrap">
            {outcomes.filter((o) => o.trim()).map((o, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-dark-200 rounded-md text-gray-400">
                {o} — {(100 / outcomes.length).toFixed(0)}%
              </span>
            ))}
          </div>
        </Card>
      )}

      <Button
        variant="primary"
        className="w-full"
        size="lg"
        loading={status === 'proving' || status === 'broadcasting'}
        disabled={!isValid}
        onClick={handleCreate}
      >
        {status === 'proving' ? 'Generating ZK Proof...' :
         status === 'broadcasting' ? 'Broadcasting...' :
         'Create Market'}
      </Button>
    </div>
  );
}
