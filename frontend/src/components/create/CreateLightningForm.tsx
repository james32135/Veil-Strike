import { useState } from 'react';
import { useTransaction } from '@/hooks/useTransaction';
import { buildCreateMarketTx, buildCreateMarketUsdcxTx, generateNonce } from '@/utils/transactions';
import { getUsdcxProofs } from '@/utils/freezeListProof';
import { parseAleoInput } from '@/utils/format';
import { LIGHTNING_DURATIONS, API_BASE, ALEO_TESTNET_API, PROGRAM_ID, PROGRAM_ID_CX, PROGRAM_ID_SD, ALL_PROGRAM_IDS } from '@/constants';
import { useWalletStore } from '@/stores/walletStore';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';
import { BoltIcon } from '@/components/icons';

interface CreateLightningFormProps {
  onSuccess?: () => void;
}

export default function CreateLightningForm({ onSuccess }: CreateLightningFormProps) {
  const [asset, setAsset] = useState<'btc' | 'eth' | 'aleo'>('btc');
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [duration, setDuration] = useState<typeof LIGHTNING_DURATIONS[number]>(LIGHTNING_DURATIONS[0]);
  const [initialLiquidity, setInitialLiquidity] = useState('5');
  const [tokenType, setTokenType] = useState<'ALEO' | 'USDCX'>('ALEO');
  const { status, execute, fetchUsdcxRecord } = useTransaction();
  const walletAddress = useWalletStore((s) => s.address);

  const assetLabels: Record<string, string> = {
    btc: 'Bitcoin (BTC)',
    eth: 'Ethereum (ETH)',
    aleo: 'Aleo (ALEO)',
  };

  const assetIndex: Record<string, number> = { btc: 0, eth: 1, aleo: 2 };

  const registerMarketFromTx = async (txId: string, questionText: string, outcomeLabels: string[], isLightning: boolean, tokenHint?: string) => {
    const maxRetries = 12;
    const delay = 10_000;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await new Promise((r) => setTimeout(r, delay));
        const res = await fetch(`${ALEO_TESTNET_API}/transaction/${txId}`);
        if (!res.ok) continue;
        const txData = await res.json();
        const transition = txData?.execution?.transitions?.find(
          (t: { program: string; function: string }) => ALL_PROGRAM_IDS.includes(t.program as any) && t.function === 'open_market'
        );
        if (!transition?.outputs?.[0]?.value) continue;
        const marketId = transition.outputs[0].value as string;
        console.log(`[CreateLightning] Extracted market_id: ${marketId}`);
        await fetch(`${API_BASE}/markets/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketId, question: questionText, outcomes: outcomeLabels, isLightning, tokenType: tokenHint }),
        });
        console.log(`[CreateLightning] Registered market ${marketId.slice(0, 20)}... with backend`);
        return;
      } catch (err) {
        console.warn(`[CreateLightning] Retry ${i + 1}/${maxRetries}:`, err);
      }
    }
  };

  const handleCreate = async () => {
    const liquidityMicro = parseAleoInput(initialLiquidity);
    if (liquidityMicro < 1_000_000) return;

    const nonce = generateNonce();
    const question = `${asset.toUpperCase()} Lightning Round`;
    const questionHash = `${BigInt(Array.from(new TextEncoder().encode(question)).reduce((h, b) => h * 31n + BigInt(b), 0n)) % BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001')}field`;
    const currentBlock = Math.floor(Date.now() / 15000) + 15044000;
    const deadline = `${currentBlock + 1_000_000}u32`;
    const resolutionDeadline = `${currentBlock + 1_000_000 + 2880}u32`;
    const resolver = walletAddress || '';

    let tx;
    if (tokenType === 'USDCX') {
      const tokenRecord = await fetchUsdcxRecord(liquidityMicro);
      if (!tokenRecord) return;
      const proofs = await getUsdcxProofs();
      tx = buildCreateMarketUsdcxTx(
        questionHash, 1, 2, deadline, resolutionDeadline, resolver,
        `${liquidityMicro}u128`, nonce, tokenRecord, proofs
      );
    } else {
      tx = buildCreateMarketTx(
        questionHash, 1, 2, deadline, resolutionDeadline, resolver,
        `${liquidityMicro}u128`, nonce
      );
    }
    const txId = await execute(tx);
    if (txId) {
      registerMarketFromTx(txId, question, ['Up', 'Down'], true, tokenType);
    }
    onSuccess?.();
  };

  return (
    <div className="space-y-5">
      {/* Asset Selection */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Asset
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['btc', 'eth', 'aleo'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              className={`py-3 text-sm font-heading rounded-xl border transition-all ${
                asset === a
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-400'
                  : 'border-dark-400/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              {a.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Question Preview */}
      <Card className="p-4 border-amber-400/10">
        <div className="flex items-center gap-2 mb-2">
          <BoltIcon className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400 font-heading">Lightning Market</span>
        </div>
        <p className="text-sm text-white font-heading">
          Will {assetLabels[asset]} price go {direction} in the next {duration.label}?
        </p>
      </Card>

      {/* Token Type */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Token
        </label>
        <div className="flex gap-2">
          {(['ALEO', 'USDCX'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTokenType(t)}
              className={`px-4 py-2 text-xs rounded-lg border font-heading font-medium transition-all ${
                tokenType === t
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-400'
                  : 'border-dark-400/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Duration
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {LIGHTNING_DURATIONS.map((d) => (
            <button
              key={d.seconds}
              onClick={() => setDuration(d)}
              className={`py-2.5 text-sm rounded-lg border transition-all ${
                duration.seconds === d.seconds
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-400'
                  : 'border-dark-400/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Direction */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Direction
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setDirection('up')}
            className={`py-4 rounded-xl border-2 text-center transition-all ${
              direction === 'up'
                ? 'border-accent-green bg-accent-green/10'
                : 'border-dark-400/50 hover:border-dark-400'
            }`}
          >
            <p className={`text-lg font-heading font-bold ${
              direction === 'up' ? 'text-accent-green' : 'text-gray-500'
            }`}>↑ UP</p>
          </button>
          <button
            onClick={() => setDirection('down')}
            className={`py-4 rounded-xl border-2 text-center transition-all ${
              direction === 'down'
                ? 'border-accent-red bg-accent-red/10'
                : 'border-dark-400/50 hover:border-dark-400'
            }`}
          >
            <p className={`text-lg font-heading font-bold ${
              direction === 'down' ? 'text-accent-red' : 'text-gray-500'
            }`}>↓ DOWN</p>
          </button>
        </div>
      </div>

      {/* Liquidity */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Initial Liquidity ({tokenType})
        </label>
        <input
          type="number"
          value={initialLiquidity}
          onChange={(e) => setInitialLiquidity(e.target.value)}
          placeholder="5"
          min="1"
          className="input-field"
        />
      </div>

      <Button
        variant="primary"
        className="w-full"
        size="lg"
        loading={status === 'proving' || status === 'broadcasting'}
        disabled={parseAleoInput(initialLiquidity) < 1_000_000}
        onClick={handleCreate}
      >
        {status === 'proving' ? 'Generating ZK Proof...' :
         status === 'broadcasting' ? 'Broadcasting...' :
         '⚡ Create Lightning Market'}
      </Button>
    </div>
  );
}
