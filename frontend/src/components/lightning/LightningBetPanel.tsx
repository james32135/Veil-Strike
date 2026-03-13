import { useState } from 'react';
import type { Market } from '@/types';
import { useTransaction } from '@/hooks/useTransaction';
import { buildBuySharesPrivateTx, generateNonce } from '@/utils/transactions';
import { calculatePrices, estimateBuySharesExact, calculateFees } from '@/utils/fpmm';
import { formatAleo, parseAleoInput } from '@/utils/format';
import { PRECISION } from '@/constants';
import { useMarketStore } from '@/stores/marketStore';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';
import LightningTimer from './LightningTimer';

interface LightningBetPanelProps {
  market: Market;
}

export default function LightningBetPanel({ market }: LightningBetPanelProps) {
  const [selectedOutcome, setSelectedOutcome] = useState(0);
  const [amount, setAmount] = useState('');
  const { status, execute } = useTransaction();
  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);

  const prices = calculatePrices(market.reserves);
  const amountMicro = parseAleoInput(amount);
  const { totalFee } = calculateFees(amountMicro);
  const exactShares = estimateBuySharesExact(market.reserves, selectedOutcome, amountMicro);
  const estimatedShares = Number(exactShares);

  const handleBet = async () => {
    if (amountMicro < 1000 || exactShares <= 0n) return;
    const nonce = generateNonce();
    const minShares = exactShares * 95n / 100n;
    const tx = buildBuySharesPrivateTx(
      market.id,
      selectedOutcome,
      `${amountMicro}u128`,
      `${exactShares}u128`,
      `${minShares}u128`,
      nonce
    );
    await execute(tx);
    fetchMarkets();
  };

  return (
    <Card className="p-6 border-amber-400/10">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-heading font-semibold text-white">Quick Bet</h3>
        <LightningTimer endTime={market.endTime} compact />
      </div>

      {/* Outcome buttons */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {market.outcomes.map((outcome, i) => {
          const pct = (prices[i] / PRECISION) * 100;
          return (
            <button
              key={i}
              onClick={() => setSelectedOutcome(i)}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                selectedOutcome === i
                  ? i === 0
                    ? 'border-accent-green bg-accent-green/10'
                    : 'border-accent-red bg-accent-red/10'
                  : 'border-dark-400/50 hover:border-dark-400'
              }`}
            >
              <p className={`text-2xl font-mono font-bold mb-1 ${
                i === 0 ? 'text-accent-green' : 'text-accent-red'
              }`}>
                {pct.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400">{outcome}</p>
            </button>
          );
        })}
      </div>

      {/* Quick amount selection */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-2 block">
          Bet Amount
        </label>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {['0.5', '1', '5', '10'].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className={`py-2.5 text-sm font-mono rounded-lg border transition-all ${
                amount === val
                  ? 'border-teal/40 bg-teal/10 text-teal'
                  : 'border-dark-400/50 text-gray-500 hover:text-gray-300 hover:border-dark-400'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Custom amount..."
          min="0"
          step="0.1"
          className="input-field text-sm"
        />
      </div>

      {/* Summary */}
      {amountMicro > 0 && (
        <div className="flex justify-between text-xs text-gray-500 mb-4 px-1">
          <span>Est. Return: <span className="text-teal font-mono">{formatAleo(estimatedShares)} ALEO</span></span>
          <span>Fee: <span className="font-mono">{formatAleo(totalFee)}</span></span>
        </div>
      )}

      <Button
        variant="primary"
        className="w-full"
        size="lg"
        loading={status === 'proving' || status === 'broadcasting'}
        disabled={amountMicro < 1000 || estimatedShares <= 0}
        onClick={handleBet}
      >
        {status === 'proving' ? 'Generating ZK Proof...' :
         status === 'broadcasting' ? 'Broadcasting...' :
         `Bet ${market.outcomes[selectedOutcome]}`}
      </Button>
    </Card>
  );
}
