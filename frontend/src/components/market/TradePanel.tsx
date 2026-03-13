import { useState } from 'react';
import type { Market } from '@/types';
import { calculatePrices, estimateBuySharesExact, calculateFees } from '@/utils/fpmm';
import { formatAleo, parseAleoInput } from '@/utils/format';
import { PRECISION } from '@/constants';
import { useTransaction } from '@/hooks/useTransaction';
import { buildBuySharesPrivateTx, buildBuySharesUsdcxTx, generateNonce } from '@/utils/transactions';
import { useMarketStore } from '@/stores/marketStore';
import { useTradeStore } from '@/stores/tradeStore';
import Button from '@/components/shared/Button';
import Card from '@/components/shared/Card';

interface TradePanelProps {
  market: Market;
}

export default function TradePanel({ market }: TradePanelProps) {
  const [selectedOutcome, setSelectedOutcome] = useState(0);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const { status, execute } = useTransaction();
  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const addTrade = useTradeStore((s) => s.addTrade);

  const isUsdcx = market.tokenType === 'USDCX';
  const tokenLabel = isUsdcx ? 'USDCx' : 'ALEO';

  const prices = calculatePrices(market.reserves);
  const amountMicro = parseAleoInput(amount);
  const { totalFee } = calculateFees(amountMicro);
  const exactShares = mode === 'buy'
    ? estimateBuySharesExact(market.reserves, selectedOutcome, amountMicro)
    : 0n;
  const estimatedShares = Number(exactShares);

  const priceImpact = amountMicro > 0 && market.totalLiquidity > 0
    ? (amountMicro / market.totalLiquidity) * 100
    : 0;

  const handleTrade = async () => {
    if (amountMicro < 1000 || exactShares <= 0n) return;

    const nonce = generateNonce();
    const minShares = exactShares * 95n / 100n;
    const typeSuffix = isUsdcx ? 'u128' : 'u64';

    const buildFn = isUsdcx ? buildBuySharesUsdcxTx : buildBuySharesPrivateTx;
    const tx = buildFn(
      market.id,
      selectedOutcome,
      `${amountMicro}${typeSuffix}`,
      `${exactShares}${typeSuffix}`,
      `${minShares}${typeSuffix}`,
      nonce
    );
    const txId = await execute(tx);
    if (txId) {
      addTrade({
        marketId: market.id,
        type: 'buy',
        outcome: market.outcomes[selectedOutcome],
        amount: amountMicro,
        shares: estimatedShares,
        price: prices[selectedOutcome] / PRECISION,
        timestamp: Date.now(),
      });
      setAmount('');
      // Wait for chain finalization then refresh reserves
      const refreshChain = () => fetch('/api/markets/refresh', { method: 'POST' }).then(() => fetchMarkets()).catch(() => fetchMarkets());
      refreshChain();
      setTimeout(refreshChain, 15000);
      setTimeout(refreshChain, 30000);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setMode('buy')}
          className={`flex-1 py-2 text-sm font-heading font-medium rounded-lg transition-all ${
            mode === 'buy'
              ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
              : 'text-gray-500 border border-transparent hover:text-gray-300'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setMode('sell')}
          className={`flex-1 py-2 text-sm font-heading font-medium rounded-lg transition-all ${
            mode === 'sell'
              ? 'bg-accent-red/10 text-accent-red border border-accent-red/20'
              : 'text-gray-500 border border-transparent hover:text-gray-300'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Outcome selection */}
      <div className="space-y-2 mb-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-heading">Select Outcome</p>
        {market.outcomes.map((outcome, i) => (
          <button
            key={i}
            onClick={() => setSelectedOutcome(i)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
              selectedOutcome === i
                ? 'border-teal/40 bg-teal/5'
                : 'border-dark-400/50 hover:border-dark-400'
            }`}
          >
            <span className="text-sm text-gray-300">{outcome}</span>
            <span className={`text-sm font-mono font-medium ${
              i === 0 ? 'text-accent-green' : i === 1 ? 'text-accent-red' : 'text-teal'
            }`}>
              {((prices[i] / PRECISION) * 100).toFixed(1)}%
            </span>
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="mb-5">
        <label className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-2 block">
          Amount ({tokenLabel})
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.1"
            className="input-field pr-16"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono">
            {tokenLabel}
          </span>
        </div>
        <div className="flex gap-2 mt-2">
          {['1', '5', '10', '25'].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className="flex-1 py-1 text-xs text-gray-500 border border-dark-400/50 rounded-lg hover:text-teal hover:border-teal/30 transition-all"
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Trade summary */}
      {amountMicro > 0 && (
        <div className="space-y-2 mb-5 p-3 bg-dark-200/50 rounded-xl">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Est. Shares</span>
            <span className="font-mono text-gray-300">{formatAleo(estimatedShares)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Fee (2%)</span>
            <span className="font-mono text-gray-300">{formatAleo(totalFee)} {tokenLabel}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Price Impact</span>
            <span className={`font-mono ${priceImpact > 5 ? 'text-accent-red' : 'text-gray-300'}`}>
              {priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-xs pt-2 border-t border-dark-400/30">
            <span className="text-gray-400 font-medium">Potential Payout</span>
            <span className="font-mono text-teal font-medium">{formatAleo(estimatedShares)} {tokenLabel}</span>
          </div>
        </div>
      )}

      <Button
        variant={mode === 'buy' ? 'primary' : 'danger'}
        className="w-full"
        size="lg"
        loading={status === 'proving' || status === 'broadcasting'}
        disabled={amountMicro < 1000 || estimatedShares <= 0 || market.status !== 'active'}
        onClick={handleTrade}
      >
        {market.status !== 'active' ? 'Market Not Active' :
         status === 'proving' ? 'Generating ZK Proof...' :
         status === 'broadcasting' ? 'Broadcasting...' :
         mode === 'buy' ? `Buy ${market.outcomes[selectedOutcome]}` :
         `Sell ${market.outcomes[selectedOutcome]}`}
      </Button>

      <p className="text-[10px] text-gray-600 text-center mt-3">
        Pays with {tokenLabel} via Shield Wallet. ~14s proof time.
      </p>
    </Card>
  );
}
