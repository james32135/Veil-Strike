import { useState, useEffect } from 'react';
import { useTransaction } from '@/hooks/useTransaction';
import { buildCreateMarketTx, buildCreateMarketStableTx, generateNonce } from '@/utils/transactions';
import { registerMarketFromTx } from '@/utils/marketRegistration';
import { getUsdcxProofs } from '@/utils/freezeListProof';
import { parseAleoInput } from '@/utils/format';
import { STRIKE_ROUND_DURATIONS, ALEO_TESTNET_API } from '@/constants';
import { useWalletStore } from '@/stores/walletStore';
import { useMarketStore } from '@/stores/marketStore';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';
import CryptoIcon from '@/components/shared/CryptoIcon';
import { BoltIcon } from '@/components/icons';

interface CreateLightningFormProps {
  onSuccess?: () => void;
}

export default function CreateLightningForm({ onSuccess }: CreateLightningFormProps) {
  const [asset, setAsset] = useState<'btc' | 'eth' | 'aleo'>('btc');
  const [duration, setDuration] = useState<typeof STRIKE_ROUND_DURATIONS[number]>(STRIKE_ROUND_DURATIONS[0]);
  const [initialLiquidity, setInitialLiquidity] = useState('5');
  const [tokenType, setTokenType] = useState<'ALEO' | 'USDCX' | 'USAD'>('ALEO');
  const { status, execute, fetchUsdcxRecord } = useTransaction();
  const walletAddress = useWalletStore((s) => s.address);
  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);

  useEffect(() => {
    const fetchHeight = async () => {
      try {
        const res = await fetch(`${ALEO_TESTNET_API}/latest/height`);
        if (res.ok) {
          const h = await res.json();
          setCurrentBlock(typeof h === 'number' ? h : parseInt(h, 10));
        }
      } catch { /* will retry on create */ }
    };
    fetchHeight();
  }, []);

  const assetLabels: Record<string, string> = {
    btc: 'Bitcoin (BTC)',
    eth: 'Ethereum (ETH)',
    aleo: 'Aleo (ALEO)',
  };

  const assetIndex: Record<string, number> = { btc: 0, eth: 1, aleo: 2 };

  const handleCreate = async () => {
    const liquidityMicro = parseAleoInput(initialLiquidity);
    if (liquidityMicro < 1_000_000) return;

    // Fetch latest block height if not already loaded
    let block = currentBlock;
    if (!block) {
      try {
        const res = await fetch(`${ALEO_TESTNET_API}/latest/height`);
        if (res.ok) {
          const h = await res.json();
          block = typeof h === 'number' ? h : parseInt(h, 10);
          setCurrentBlock(block);
        }
      } catch { /* fall through */ }
    }
    if (!block) return; // can't create without real block height

    const nonce = generateNonce();
    const question = `${asset.toUpperCase()} ${duration.label} Strike Round`;
    const questionHash = `${BigInt(Array.from(new TextEncoder().encode(question)).reduce((h, b) => h * 31n + BigInt(b), 0n)) % BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001')}field`;
    const deadline = `${block + duration.blocks}u32`;
    const resolutionDeadline = `${block + duration.blocks + 2880}u32`;
    const resolver = walletAddress || '';

    let tx;
    if (tokenType === 'USDCX' || tokenType === 'USAD') {
      const tokenRecord = await fetchUsdcxRecord(liquidityMicro, tokenType);
      if (!tokenRecord) return;
      const proofs = await getUsdcxProofs(tokenType);
      tx = buildCreateMarketStableTx(
        tokenType, questionHash, 1, 2, deadline, resolutionDeadline, resolver,
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
      registerMarketFromTx({
        txId,
        questionText: question,
        questionHash,
        outcomeLabels: ['Up', 'Down'],
        isLightning: true,
        tokenType,
        onRegistered: fetchMarkets,
      });
      onSuccess?.();
    }
  };

  return (
    <div className="space-y-5">
      {/* Asset Selection */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Asset
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          {(['btc', 'eth', 'aleo'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              className={`flex items-center justify-center gap-2 py-3 text-sm font-heading rounded-lg transition-all ${
                asset === a
                  ? 'bg-gradient-to-b from-amber-400/20 to-amber-400/10 text-amber-400 shadow-[0_0_12px_-3px_rgba(251,191,36,0.3)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
              }`}
            >
              <CryptoIcon symbol={a} size={18} />{a.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Question Preview */}
      <Card className="p-4 border-amber-400/10">
        <div className="flex items-center gap-2 mb-2">
          <BoltIcon className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400 font-heading">Strike Round</span>
        </div>
        <p className="text-sm text-white font-heading">
          Will {assetLabels[asset]} price go UP or DOWN in {duration.label}?
        </p>
      </Card>

      {/* Token Type */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">
          Token
        </label>
        <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          {(['ALEO', 'USDCX', 'USAD'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTokenType(t)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-heading font-medium transition-all ${
                tokenType === t
                  ? 'bg-gradient-to-b from-amber-400/20 to-amber-400/10 text-amber-400 shadow-[0_0_12px_-3px_rgba(251,191,36,0.3)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
              }`}
            >
              <CryptoIcon symbol={t} size={14} />{t}
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
          {STRIKE_ROUND_DURATIONS.map((d) => (
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
         '⚡ Create Strike Round'}
      </Button>
    </div>
  );
}
