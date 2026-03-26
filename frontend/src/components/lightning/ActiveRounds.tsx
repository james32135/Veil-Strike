import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import { BoltIcon, ArrowUpIcon, ArrowDownIcon } from '@/components/icons';
import CryptoIcon from '@/components/shared/CryptoIcon';
import RefreshButton from '@/components/shared/RefreshButton';
import { useTransaction } from '@/hooks/useTransaction';
import type { ShareRecord } from '@/hooks/useTransaction';
import { buildBuySharesPrivateTx, buildBuySharesStableTx, buildRedeemSharesTx, buildSellSharesTx, generateNonce } from '@/utils/transactions';
import { getUsdcxProofs } from '@/utils/freezeListProof';
import { estimateBuySharesExact, estimateSellTokensOut, calculateFees } from '@/utils/fpmm';
import { formatUSD, formatAleo } from '@/utils/format';
import { useMarketStore } from '@/stores/marketStore';
import { useOracleStore } from '@/stores/oracleStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { API_BASE } from '@/constants';
import type { Market } from '@/types';

// Detect asset from market question text
function detectAsset(question: string): 'BTC' | 'ETH' | 'ALEO' {
  const upper = question.toUpperCase();
  if (upper.includes('BTC') || upper.includes('BITCOIN')) return 'BTC';
  if (upper.includes('ETH') || upper.includes('ETHEREUM')) return 'ETH';
  return 'ALEO';
}

// Detect duration label from question text
function detectDuration(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('30 day')) return '30 Days';
  if (q.includes('7 day')) return '7 Days';
  if (q.includes('2 day') || q.includes('48')) return '2 Days';
  if (q.includes('24 hour')) return '24 Hours';
  return '';
}

type TokenType = 'aleo' | 'usdcx' | 'usad';

function useCountdownSeconds(targetTime: number) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.floor((targetTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTime]);
  return seconds;
}

function StrikeRoundCard({ market, shareRecords, onClaimed }: { market: Market; shareRecords: ShareRecord[]; onClaimed: () => void }) {
  const asset = detectAsset(market.question);
  const durationLabel = detectDuration(market.question);
  const secondsLeft = useCountdownSeconds(market.endTime);
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  const countdownLabel = days > 0
    ? `${days}d ${hours}h ${minutes}m`
    : hours > 0
      ? `${hours}h ${minutes}m ${secs.toString().padStart(2, '0')}s`
      : `${minutes}:${secs.toString().padStart(2, '0')}`;

  const isExpired = secondsLeft === 0 && market.status === 'active';
  const isResolved = market.status === 'resolved';

  const { status: txStatus, execute, fetchCreditsRecord, fetchUsdcxRecord } = useTransaction();
  const [betAmount, setBetAmount] = useState('1');
  const marketToken = (market.tokenType || 'ALEO').toLowerCase() as TokenType;
  const [tokenType] = useState<TokenType>(marketToken);
  const [claiming, setClaiming] = useState(false);

  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const oraclePrices = useOracleStore((s) => s.prices);
  const addTrade = useTradeStore((s) => s.addTrade);
  const addBet = useLightningBetStore((s) => s.addBet);
  const allBets = useLightningBetStore((s) => s.bets);
  const roundBets = allBets.filter((b) => b.marketId === market.id);

  const liveReserves = market.reserves ?? [1_000_000, 1_000_000];
  const tokenLabel = tokenType === 'usdcx' ? 'USDCx' : tokenType === 'usad' ? 'USAD' : 'ALEO';

  // Oracle price for the asset
  const currentPrice = oraclePrices[asset.toLowerCase() as 'btc' | 'eth' | 'aleo'] || 0;

  const userBet = roundBets[0];

  // Claimable shares: market is resolved and user has winning shares
  const winningOutcome = market.resolvedOutcome !== undefined ? market.resolvedOutcome + 1 : 0;
  const claimableShares = isResolved && winningOutcome > 0
    ? shareRecords.filter((r) => r.marketId === market.id && r.outcome === winningOutcome)
    : [];

  // Shares available for AMM sell (when market is expired but not yet resolved on-chain)
  const sellableShares = isExpired && !isResolved
    ? shareRecords.filter((r) => r.marketId === market.id)
    : [];

  const handleClaim = async (record: ShareRecord) => {
    setClaiming(true);
    try {
      const tokenTypeStr = record.tokenType === 1 ? 'USDCX' : record.tokenType === 2 ? 'USAD' : undefined;
      const tx = buildRedeemSharesTx(record.plaintext, tokenTypeStr as 'USDCX' | 'USAD' | undefined);
      await execute(tx, onClaimed);
    } finally {
      setClaiming(false);
    }
  };

  const handleSellAMM = async (record: ShareRecord) => {
    setClaiming(true);
    try {
      const tokenTypeStr = record.tokenType === 1 ? 'USDCX' : record.tokenType === 2 ? 'USAD' : undefined;
      const outcomeIdx = record.outcome - 1;
      const { tokensOut } = estimateSellTokensOut(liveReserves, outcomeIdx, record.quantity);
      if (tokensOut <= 0) return;
      const tx = buildSellSharesTx(record.plaintext, `${tokensOut}u128`, `${record.quantity}u128`, tokenTypeStr as 'USDCX' | 'USAD' | undefined);
      await execute(tx, onClaimed);
    } finally {
      setClaiming(false);
    }
  };

  const handleBet = async (direction: 'up' | 'down') => {
    const amountMicro = Math.floor(parseFloat(betAmount) * 1_000_000);
    if (amountMicro < 1000) return;
    const outcome = direction === 'up' ? 0 : 1;
    const exactShares = estimateBuySharesExact(liveReserves, outcome, amountMicro);
    if (exactShares <= 0n) return;
    const minShares = exactShares * 95n / 100n;
    const nonce = generateNonce();

    let tx;
    if (tokenType === 'usdcx' || tokenType === 'usad') {
      const stableType = tokenType === 'usad' ? 'USAD' : 'USDCX';
      const tokenRecord = await fetchUsdcxRecord(amountMicro, stableType);
      if (!tokenRecord) return;
      const proofs = await getUsdcxProofs(stableType);
      tx = buildBuySharesStableTx(
        stableType,
        market.id, outcome,
        `${amountMicro}u128`, `${exactShares}u128`, `${minShares}u128`, nonce,
        tokenRecord, proofs
      );
    } else {
      const record = await fetchCreditsRecord(amountMicro);
      if (!record) return;
      tx = buildBuySharesPrivateTx(
        market.id, outcome,
        `${amountMicro}u128`, `${exactShares}u128`, `${minShares}u128`, nonce,
        record
      );
    }
    const refreshChain = () => fetch(`${API_BASE}/markets/refresh`, { method: 'POST' }).then(() => fetchMarkets()).catch(() => fetchMarkets());
    const txId = await execute(tx, refreshChain);
    if (txId) {
      addBet({
        roundId: market.id,
        marketId: market.id,
        asset,
        direction,
        amount: amountMicro,
        shares: Number(exactShares),
        timestamp: Date.now(),
        startPrice: currentPrice,
        tokenType,
      });
      addTrade({
        marketId: market.id,
        type: 'buy',
        outcome: direction === 'up' ? 'Up' : 'Down',
        amount: amountMicro,
        shares: Number(exactShares),
        price: 0.5,
        timestamp: Date.now(),
      });
      refreshChain();
    }
  };

  const assetColors: Record<string, string> = {
    BTC: 'text-amber-400',
    ETH: 'text-blue-400',
    ALEO: 'text-teal',
  };

  const cardStatus = isResolved ? 'resolved' : isExpired ? 'expired' : 'active';

  return (
    <Card className="p-0 relative overflow-hidden group/card">
      {/* Top accent bar */}
      <div className={`relative h-1 overflow-hidden ${
        isResolved
          ? market.resolvedOutcome === 0 ? 'bg-accent-green/30' : 'bg-accent-red/30'
          : 'bg-gradient-to-r from-amber-400/20 via-amber-500/30 to-orange-500/20'
      }`}>
        <div className={`absolute inset-0 ${
          isResolved
            ? market.resolvedOutcome === 0 ? 'bg-accent-green' : 'bg-accent-red'
            : 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500'
        } ${cardStatus === 'active' ? 'animate-pulse' : ''}`} style={{ width: '100%' }} />
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/10 to-amber-600/5 border border-amber-400/15 flex items-center justify-center">
                <CryptoIcon symbol={asset} size={20} />
              </div>
              <BoltIcon className="w-3 h-3 text-amber-400 absolute -bottom-0.5 -right-0.5 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" />
            </div>
            <div>
              <span className={`text-sm font-heading font-bold ${assetColors[asset]}`}>
                {asset} {durationLabel && <span className="text-gray-500 font-normal text-xs ml-1">{durationLabel}</span>}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={cardStatus === 'active' ? 'success' : cardStatus === 'expired' ? 'warning' : 'gray'} size="sm">
                  {cardStatus === 'active' ? 'LIVE' : cardStatus === 'expired' ? 'AWAITING RESOLVE' : 'RESOLVED'}
                </Badge>
                {market.tokenType && market.tokenType !== 'ALEO' && (
                  <Badge variant="gray" size="sm">{market.tokenType}</Badge>
                )}
              </div>
            </div>
          </div>
          {cardStatus === 'active' && (
            <div className={`px-3 py-1.5 rounded-xl border ${secondsLeft < 3600 ? 'border-accent-red/20 bg-accent-red/5' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              <span className={`text-xs font-mono font-bold tabular-nums ${secondsLeft < 3600 ? 'text-accent-red animate-pulse' : 'text-gray-300'}`}>
                {countdownLabel}
              </span>
            </div>
          )}
        </div>

        {/* Current Price */}
        <div className="grid grid-cols-1 gap-2 mb-4">
          <div className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-0.5">Current Price</div>
            <div className="text-lg font-mono font-bold text-white tabular-nums">
              {asset === 'ALEO' ? `$${currentPrice.toFixed(4)}` : formatUSD(currentPrice)}
            </div>
          </div>
        </div>

        {/* Pool info */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4 px-1">
          <span>Pool: {formatAleo(market.totalLiquidity)} {tokenLabel}</span>
          <span>Trades: {market.tradeCount}</span>
        </div>

        {/* Betting UI — only when active and user hasn't bet */}
        {cardStatus === 'active' && !userBet && (
          <>
            <div className="mb-4">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">Amount ({tokenLabel})</label>
              <div className="flex gap-1.5">
                {['1', '5', '10', '25'].map((val) => (
                  <button
                    key={val}
                    onClick={() => setBetAmount(val)}
                    className={`flex-1 py-2 text-xs font-mono font-medium rounded-xl border transition-all duration-300 ${
                      betAmount === val
                        ? 'border-teal/30 bg-teal/10 text-teal shadow-[0_0_10px_-4px_rgba(255,107,53,0.15)]'
                        : 'border-white/[0.04] bg-white/[0.01] text-gray-500 hover:text-gray-300 hover:border-white/[0.08]'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="primary"
                size="sm"
                className="!bg-gradient-to-r !from-accent-green/20 !to-accent-green/10 !text-accent-green !border !border-accent-green/20 hover:!from-accent-green/30 hover:!to-accent-green/15 hover:!shadow-[0_0_20px_-4px_rgba(34,197,94,0.3)] !rounded-xl !transition-all !duration-300"
                onClick={() => handleBet('up')}
                loading={txStatus === 'proving' || txStatus === 'broadcasting'}
              >
                <ArrowUpIcon className="w-4 h-4 mr-1" />
                {txStatus === 'proving' ? 'Proving...' : txStatus === 'broadcasting' ? 'Broadcasting...' : 'UP'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="!bg-gradient-to-r !from-accent-red/20 !to-accent-red/10 !text-accent-red !border !border-accent-red/20 hover:!from-accent-red/30 hover:!to-accent-red/15 hover:!shadow-[0_0_20px_-4px_rgba(239,68,68,0.3)] !rounded-xl !transition-all !duration-300"
                onClick={() => handleBet('down')}
                loading={txStatus === 'proving' || txStatus === 'broadcasting'}
              >
                <ArrowDownIcon className="w-4 h-4 mr-1" />
                {txStatus === 'proving' ? 'Proving...' : txStatus === 'broadcasting' ? 'Broadcasting...' : 'DOWN'}
              </Button>
            </div>
          </>
        )}

        {/* User's active bet */}
        {userBet && !isResolved && (
          <div className={`p-3.5 rounded-xl border backdrop-blur-sm ${
            userBet.direction === 'up'
              ? 'border-accent-green/20 bg-gradient-to-br from-accent-green/[0.06] to-accent-green/[0.02]'
              : 'border-accent-red/20 bg-gradient-to-br from-accent-red/[0.06] to-accent-red/[0.02]'
          }`}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400 font-heading">Your Bet</span>
              <Badge variant={userBet.direction === 'up' ? 'success' : 'danger'} size="sm">
                {userBet.direction === 'up' ? '↑ UP' : '↓ DOWN'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Amount</span>
              <span className="font-mono font-medium text-white">{formatAleo(userBet.amount)} {userBet.tokenType === 'usdcx' ? 'USDCx' : userBet.tokenType === 'usad' ? 'USAD' : 'ALEO'}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-0.5">
              <span className="text-gray-500">Potential Win</span>
              <span className="font-mono text-teal">{(() => {
                const out = userBet.direction === 'up' ? 0 : 1;
                const { tokensOut } = estimateSellTokensOut(liveReserves, out, userBet.shares);
                return formatAleo(calculateFees(tokensOut).amountAfterFee);
              })()} {userBet.tokenType === 'usdcx' ? 'USDCx' : userBet.tokenType === 'usad' ? 'USAD' : 'ALEO'}</span>
            </div>
          </div>
        )}

        {/* Resolved state */}
        {isResolved && (
          <div className={`text-center py-3 rounded-xl border ${
            market.resolvedOutcome === 0
              ? 'bg-gradient-to-r from-accent-green/[0.06] to-accent-green/[0.03] border-accent-green/15 text-accent-green'
              : 'bg-gradient-to-r from-accent-red/[0.06] to-accent-red/[0.03] border-accent-red/15 text-accent-red'
          }`}>
            <span className="text-sm font-heading font-bold">
              {market.resolvedOutcome === 0 ? '↑ UP WINS' : '↓ DOWN WINS'}
            </span>
          </div>
        )}

        {/* Claim section */}
        {isResolved && claimableShares.length > 0 && (
          <div className="mt-2 space-y-1">
            {claimableShares.map((record, idx) => {
              const tLabel = record.tokenType === 1 ? 'USDCx' : record.tokenType === 2 ? 'USAD' : 'ALEO';
              return (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-xs text-accent-green/80">
                    {formatAleo(record.quantity)} shares → {formatAleo(record.quantity)} {tLabel}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleClaim(record)}
                    loading={claiming || txStatus === 'proving' || txStatus === 'broadcasting'}
                    className="!text-xs !py-1 !px-3 !bg-accent-green !text-black !border-accent-green hover:!bg-accent-green/80"
                  >
                    {txStatus === 'proving' ? 'Proving...' : txStatus === 'broadcasting' ? 'Broadcasting...' : '💰 Claim'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Expired but not resolved — sell via AMM */}
        {isExpired && sellableShares.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs text-gray-400 font-heading">Sell shares via AMM:</p>
            {sellableShares.map((record, idx) => {
              const tLabel = record.tokenType === 1 ? 'USDCx' : record.tokenType === 2 ? 'USAD' : 'ALEO';
              const outcomeIdx = record.outcome - 1;
              const { tokensOut } = estimateSellTokensOut(liveReserves, outcomeIdx, record.quantity);
              const afterFee = calculateFees(tokensOut).amountAfterFee;
              return (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-xs text-teal/80">
                    ~{formatAleo(afterFee)} {tLabel}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSellAMM(record)}
                    loading={claiming || txStatus === 'proving' || txStatus === 'broadcasting'}
                    className="!text-xs !py-1 !px-3"
                  >
                    💸 Sell Now
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

interface ActiveRoundsProps {
  markets: never[];
}

export default function ActiveRounds({ }: ActiveRoundsProps) {
  const allMarkets = useMarketStore((s) => s.markets);
  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const [loading, setLoading] = useState(true);
  const { fetchShareRecords } = useTransaction();
  const [shareRecords, setShareRecords] = useState<ShareRecord[]>([]);

  const loadShareRecords = useCallback(async () => {
    const records = await fetchShareRecords();
    setShareRecords(records);
  }, [fetchShareRecords]);

  useEffect(() => {
    fetchMarkets().then(() => setLoading(false));
    loadShareRecords();
    const marketId = setInterval(fetchMarkets, 30_000);
    const shareId = setInterval(loadShareRecords, 30_000);
    return () => { clearInterval(marketId); clearInterval(shareId); };
  }, [fetchMarkets, loadShareRecords]);

  // Filter to only lightning/strike-round markets
  const strikeMarkets = allMarkets.filter((m) => m.isLightning && m.question.toLowerCase().includes('strike round'));
  const activeMarkets = strikeMarkets.filter((m) => m.status === 'active');
  const resolvedMarkets = strikeMarkets.filter((m) => m.status === 'resolved').slice(0, 6);

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Loading rounds...</div>;
  }

  if (activeMarkets.length === 0 && resolvedMarkets.length === 0) {
    return (
      <div className="text-center py-8">
        <BoltIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No active Strike Rounds</p>
        <p className="text-xs text-gray-600 mt-1">Create a Strike Round to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RefreshButton onRefresh={async () => { await fetchMarkets(); await loadShareRecords(); }} label="Refresh" />
      </div>

      {/* Active Strike Rounds */}
      {activeMarkets.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">Active Rounds</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMarkets.map((market) => (
              <StrikeRoundCard key={market.id} market={market} shareRecords={shareRecords} onClaimed={loadShareRecords} />
            ))}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolvedMarkets.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-3">Recently Resolved</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resolvedMarkets.map((market) => (
              <StrikeRoundCard key={market.id} market={market} shareRecords={shareRecords} onClaimed={loadShareRecords} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
