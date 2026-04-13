import { useState } from 'react';
import type { Market } from '@/types';
import { calculatePrices, estimateBuySharesExact, estimateSellTokensOut, calculateFees } from '@/utils/fpmm';
import { formatAleo, parseAleoInput } from '@/utils/format';
import { PRECISION } from '@/constants';
import { useTransaction } from '@/hooks/useTransaction';
import { buildBuySharesPrivateTx, buildBuySharesStableTx, buildSellSharesTx, generateNonce } from '@/utils/transactions';
import { getUsdcxProofs } from '@/utils/freezeListProof';
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
  const [selectedShareRecord, setSelectedShareRecord] = useState<string | null>(null);
  const { status, execute, fetchCreditsRecord, fetchUsdcxRecord, fetchShareRecords } = useTransaction();
  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const addTrade = useTradeStore((s) => s.addTrade);

  const isStable = market.tokenType === 'USDCX' || market.tokenType === 'USAD';
  const tokenLabel = market.tokenType === 'USAD' ? 'USAD' : market.tokenType === 'USDCX' ? 'USDCx' : 'ALEO';

  const prices = calculatePrices(market.reserves);
  const amountMicro = parseAleoInput(amount);
  const { totalFee } = calculateFees(amountMicro);

  // For buy: amountMicro = tokens in, estimate shares out
  // For sell: amountMicro = shares to sell, estimate tokens out
  const exactShares = mode === 'buy'
    ? estimateBuySharesExact(market.reserves, selectedOutcome, amountMicro)
    : BigInt(amountMicro);
  const sellEstimate = mode === 'sell'
    ? estimateSellTokensOut(market.reserves, selectedOutcome, amountMicro)
    : { tokensOut: 0, sharesUsed: 0 };
  const estimatedShares = mode === 'buy' ? Number(exactShares) : sellEstimate.tokensOut;

  const priceImpact = amountMicro > 0 && market.totalLiquidity > 0
    ? (amountMicro / market.totalLiquidity) * 100
    : 0;

  const handleTrade = async () => {
    if (mode === 'buy') {
      if (amountMicro < 1000 || exactShares <= 0n) return;

      const minShares = exactShares * 95n / 100n;
      const typeSuffix = 'u128';

      // Helper: fetch record, build tx, execute. Returns txId or null.
      const attemptBuy = async (): Promise<string | null> => {
        const nonce = generateNonce();
        let tx;
        if (isStable) {
          const stableType = market.tokenType as 'USDCX' | 'USAD';
          const tokenRecord = await fetchUsdcxRecord(amountMicro, stableType);
          if (!tokenRecord) return null;
          const proofs = await getUsdcxProofs(stableType);
          tx = buildBuySharesStableTx(
            stableType,
            market.id, selectedOutcome,
            `${amountMicro}${typeSuffix}`, `${exactShares}${typeSuffix}`, `${minShares}${typeSuffix}`,
            nonce, tokenRecord, proofs
          );
        } else {
          const record = await fetchCreditsRecord(amountMicro);
          if (!record) return null;
          tx = buildBuySharesPrivateTx(
            market.id, selectedOutcome,
            `${amountMicro}${typeSuffix}`, `${exactShares}${typeSuffix}`, `${minShares}${typeSuffix}`,
            nonce, record
          );
        }
        // Capture values before async — they may change by the time callback fires
        const tradeOutcome = market.outcomes[selectedOutcome];
        const tradePrice = prices[selectedOutcome] / PRECISION;
        const tradeShares = Number(exactShares);
        const tradeIdx = selectedOutcome;
        return execute(tx, () => {
          addTrade({ marketId: market.id, type: 'buy', outcome: tradeOutcome, amount: amountMicro, shares: tradeShares, price: tradePrice, timestamp: Date.now() });
          const bgRefresh = () => fetchMarkets().catch(() => {});
          setTimeout(bgRefresh, 3000);
          setTimeout(bgRefresh, 8000);
          setTimeout(bgRefresh, 15000);
          setTimeout(bgRefresh, 25000);
        });
      };

      let txId = await attemptBuy();
      // Auto-retry once if the record was stale (blacklisted by execute)
      if (!txId && status === 'error') {
        console.log('[TradePanel] Auto-retrying buy with fresh record...');
        await new Promise(r => setTimeout(r, 1000));
        txId = await attemptBuy();
      }
      if (txId) {
        setAmount('');
      }
    } else {
      // Sell mode: user enters shares to sell, we find matching record
      if (amountMicro < 1000 || sellEstimate.tokensOut <= 0) return;

      // Find a share record for the selected outcome
      let shareRecord = selectedShareRecord;
      if (!shareRecord) {
        const records = await fetchShareRecords();
        const match = records.find(
          (r) => r.marketId === market.id && r.outcome === selectedOutcome + 1 && r.quantity >= amountMicro
        );
        if (!match) return;
        shareRecord = match.plaintext;
        setSelectedShareRecord(shareRecord);
      }

      const tokensDesired = `${sellEstimate.tokensOut}u128`;
      const maxShares = `${amountMicro}u128`;

      const tx = isStable
        ? buildSellSharesTx(shareRecord, tokensDesired, maxShares, market.tokenType as 'USDCX' | 'USAD')
        : buildSellSharesTx(shareRecord, tokensDesired, maxShares);

      const sellTradeOutcome = market.outcomes[selectedOutcome];
      const sellTradePrice = prices[selectedOutcome] / PRECISION;
      const sellTokensOut = sellEstimate.tokensOut;
      const txId = await execute(tx, () => {
        addTrade({ marketId: market.id, type: 'sell', outcome: sellTradeOutcome, amount: sellTokensOut, shares: amountMicro, price: sellTradePrice, timestamp: Date.now() });
        const bgRefresh = () => fetchMarkets().catch(() => {});
        setTimeout(bgRefresh, 3000);
        setTimeout(bgRefresh, 8000);
        setTimeout(bgRefresh, 15000);
        setTimeout(bgRefresh, 25000);
      });
      if (txId) {
        setAmount('');
        setSelectedShareRecord(null);
      }
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
          {mode === 'buy' ? `Amount (${tokenLabel})` : 'Shares to Sell'}
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
            {mode === 'buy' ? tokenLabel : 'Shares'}
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
            <span className="text-gray-500">{mode === 'buy' ? 'Est. Shares' : 'Est. Return'}</span>
            <span className="font-mono text-gray-300">
              {mode === 'buy' ? formatAleo(estimatedShares) : `${formatAleo(sellEstimate.tokensOut)} ${tokenLabel}`}
            </span>
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
            <span className="text-gray-400 font-medium">{mode === 'buy' ? 'Potential Payout' : 'You Receive'}</span>
            <span className="font-mono text-teal font-medium">
              {mode === 'buy' ? formatAleo(estimatedShares) : formatAleo(sellEstimate.tokensOut)} {tokenLabel}
            </span>
          </div>
        </div>
      )}

      <Button
        variant={mode === 'buy' ? 'primary' : 'danger'}
        className="w-full"
        size="lg"
        loading={status === 'preparing' || status === 'proving' || status === 'broadcasting'}
        disabled={amountMicro < 1000 || estimatedShares <= 0 || market.status !== 'active'}
        onClick={handleTrade}
      >
        {market.status !== 'active' ? 'Market Not Active' :
         status === 'preparing' ? 'Preparing Transaction...' :
         status === 'proving' ? 'Waiting for Wallet...' :
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
