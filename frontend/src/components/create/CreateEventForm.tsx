import { useState } from 'react';
import { useTransaction } from '@/hooks/useTransaction';
import { buildCreateMarketTx, buildCreateMarketUsdcxTx, generateNonce } from '@/utils/transactions';
import { getUsdcxProofs } from '@/utils/freezeListProof';
import { parseAleoInput } from '@/utils/format';
import { CATEGORIES } from '@/constants';
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
  const [tokenType, setTokenType] = useState<'ALEO' | 'USDCX'>('USDCX');
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
    const isUsdcx = tokenType === 'USDCX';
    let tx;
    if (isUsdcx) {
      const tokenRecord = await fetchUsdcxRecord(liquidityMicro);
      if (!tokenRecord) return;
      const proofs = await getUsdcxProofs();
      tx = buildCreateMarketUsdcxTx(
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
    await execute(tx);
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
          {(['USDCX', 'ALEO'] as const).map((t) => (
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
