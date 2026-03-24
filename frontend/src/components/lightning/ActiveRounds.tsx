import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import { BoltIcon, ArrowUpIcon, ArrowDownIcon } from '@/components/icons';
import CryptoIcon from '@/components/shared/CryptoIcon';
import { useTransaction } from '@/hooks/useTransaction';
import type { ShareRecord } from '@/hooks/useTransaction';
import { buildBuySharesPrivateTx, buildBuySharesStableTx, buildSellSharesTx, generateNonce } from '@/utils/transactions';
import { getUsdcxProofs } from '@/utils/freezeListProof';
import { estimateBuySharesExact, estimateSellTokensOut, calculateFees } from '@/utils/fpmm';
import { formatUSD, formatAleo } from '@/utils/format';
import { useMarketStore } from '@/stores/marketStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useLightningBetStore } from '@/stores/lightningBetStore';
import { API_BASE } from '@/constants';

// Asset matching terms for dynamic market detection
const ASSET_TERMS: Record<string, string[]> = {
  BTC: ['BTC', 'BITCOIN'],
  ETH: ['ETH', 'ETHEREUM'],
  ALEO: ['ALEO'],
};

function matchesAsset(question: string, asset: string): boolean {
  const upper = question.toUpperCase();
  return (ASSET_TERMS[asset] || [asset]).some((term) => upper.includes(term));
}

/** Find the best lightning market for a given asset + token type from the store.
 *  When multiple matches exist, prefer smallest totalLiquidity (better payouts). */
function findLightningMarket(
  markets: { id: string; tokenType?: string; isLightning: boolean; outcomes: string[]; question: string; totalLiquidity: number }[],
  asset: string,
  token: 'ALEO' | 'USDCX' | 'USAD',
) {
  return markets
    .filter((m) => m.isLightning && m.tokenType === token && m.outcomes.length === 2 && matchesAsset(m.question, asset))
    .sort((a, b) => a.totalLiquidity - b.totalLiquidity)[0] ?? null;
}

type TokenType = 'aleo' | 'usdcx' | 'usad';

interface LightningRound {
  id: string;
  asset: 'BTC' | 'ETH' | 'ALEO';
  tokenType?: string;
  startTime: number;
  lockTime: number;
  endTime: number;
  startPrice: number;
  lockPrice: number | null;
  endPrice: number | null;
  status: 'open' | 'locked' | 'resolved';
  result: 'up' | 'down' | null;
}

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

function RoundCard({ round, shareRecords, onClaimed }: { round: LightningRound; shareRecords: ShareRecord[]; onClaimed: () => void }) {
  const secondsLeft = useCountdownSeconds(round.endTime);
  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const { status: txStatus, execute, fetchCreditsRecord, fetchUsdcxRecord } = useTransaction();
  const [betAmount, setBetAmount] = useState('1');
  const roundToken = (round.tokenType || 'ALEO').toLowerCase() as TokenType;
  const [tokenType, setTokenType] = useState<TokenType>(roundToken);
  const [claiming, setClaiming] = useState(false);

  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const allMarkets = useMarketStore((s) => s.markets);
  const addTrade = useTradeStore((s) => s.addTrade);
  const addBet = useLightningBetStore((s) => s.addBet);
  const allBets = useLightningBetStore((s) => s.bets);
  const roundBets = allBets.filter((b) => b.roundId === round.id);

  // Dynamically find lightning markets for this asset from the store
  const aleoMarket = findLightningMarket(allMarkets, round.asset, 'ALEO');
  const usdcxMarket = findLightningMarket(allMarkets, round.asset, 'USDCX');
  const usadMarket = findLightningMarket(allMarkets, round.asset, 'USAD');
  const chainMarketId = tokenType === 'usdcx' ? usdcxMarket?.id : tokenType === 'usad' ? usadMarket?.id : aleoMarket?.id;
  const hasUsdcxMarket = !!usdcxMarket;
  const hasUsadMarket = !!usadMarket;
  const hasStableMarket = hasUsdcxMarket || hasUsadMarket;
  const liveMarket = allMarkets.find((m) => m.id === chainMarketId);
  const liveReserves = liveMarket?.reserves ?? [1_000_000, 1_000_000];

  const tokenLabel = tokenType === 'usdcx' ? 'USDCx' : tokenType === 'usad' ? 'USAD' : 'ALEO';

  const userBet = roundBets[0]; // Most recent bet for this round

  // Find claimable shares for this round's market + winning outcome
  // Only allow claiming after round is resolved and result is known
  const winningOutcomeOnChain = round.result === 'up' ? 1 : (round.result === 'down' ? 2 : 0);
  const bothMarketIds = [aleoMarket?.id, usdcxMarket?.id, usadMarket?.id].filter(Boolean) as string[];
  const claimableShares = round.status === 'resolved' && winningOutcomeOnChain > 0
    ? shareRecords.filter(
        (r) => bothMarketIds.includes(r.marketId) && r.outcome === winningOutcomeOnChain
      )
    : [];

  const handleClaim = async (record: ShareRecord) => {
    setClaiming(true);
    try {
      const market = allMarkets.find((m) => m.id === record.marketId);
      const reserves = market?.reserves ?? [1_000_000, 1_000_000];
      const outcomeIdx = record.outcome - 1;
      const { tokensOut } = estimateSellTokensOut(reserves, outcomeIdx, record.quantity);
      if (tokensOut <= 0) return;
      const tokenTypeStr = record.tokenType === 1 ? 'USDCX' : record.tokenType === 2 ? 'USAD' : undefined;
      const tx = buildSellSharesTx(record.plaintext, `${tokensOut}u128`, `${record.quantity}u128`, tokenTypeStr as 'USDCX' | 'USAD' | undefined);
      const txId = await execute(tx);
      if (txId) {
        setTimeout(onClaimed, 5000);
        setTimeout(onClaimed, 15000);
      }
    } finally {
      setClaiming(false);
    }
  };

  const handleBet = async (direction: 'up' | 'down') => {
    const amountMicro = Math.floor(parseFloat(betAmount) * 1_000_000);
    if (amountMicro < 1000 || !chainMarketId) return;
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
        chainMarketId, outcome,
        `${amountMicro}u128`, `${exactShares}u128`, `${minShares}u128`, nonce,
        tokenRecord, proofs
      );
    } else {
      // Fetch a credits record from the wallet for the 7th input
      const record = await fetchCreditsRecord(amountMicro);
      if (!record) {
        return; // notification handled inside fetchCreditsRecord or user has no records
      }
      tx = buildBuySharesPrivateTx(
        chainMarketId, outcome,
        `${amountMicro}u128`, `${exactShares}u128`, `${minShares}u128`, nonce,
        record
      );
    }
    const txId = await execute(tx);
    if (txId) {
      addBet({
        roundId: round.id,
        asset: round.asset,
        direction,
        amount: amountMicro,
        shares: Number(exactShares),
        timestamp: Date.now(),
        startPrice: round.startPrice,
        tokenType,
      });

      addTrade({
        marketId: chainMarketId,
        type: 'buy',
        outcome: direction === 'up' ? 'Up' : 'Down',
        amount: amountMicro,
        shares: Number(exactShares),
        price: 0.5,
        timestamp: Date.now(),
      });
      const refreshChain = () => fetch(`${API_BASE}/markets/refresh`, { method: 'POST' }).then(() => fetchMarkets()).catch(() => fetchMarkets());
      refreshChain();
      setTimeout(refreshChain, 15000);
      setTimeout(refreshChain, 30000);
    }
  };

  const priceChange = round.endPrice && round.startPrice
    ? ((round.endPrice - round.startPrice) / round.startPrice) * 100
    : null;

  const assetColors = {
    BTC: 'text-amber-400',
    ETH: 'text-blue-400',
    ALEO: 'text-teal',
  };

  return (
    <Card className="p-0 relative overflow-hidden group/card">
      {/* Animated top accent bar */}
      <div className={`relative h-1 overflow-hidden ${
        round.status === 'resolved'
          ? round.result === 'up' ? 'bg-accent-green/30' : 'bg-accent-red/30'
          : 'bg-gradient-to-r from-amber-400/20 via-amber-500/30 to-orange-500/20'
      }`}>
        <div className={`absolute inset-0 ${
          round.status === 'resolved'
            ? round.result === 'up' ? 'bg-accent-green' : 'bg-accent-red'
            : 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500'
        } ${round.status === 'open' ? 'animate-pulse' : ''}`} style={{ width: round.status === 'open' ? `${Math.max(10, (secondsLeft / 300) * 100)}%` : '100%' }} />
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/10 to-amber-600/5 border border-amber-400/15 flex items-center justify-center">
                <CryptoIcon symbol={round.asset} size={20} />
              </div>
              <BoltIcon className="w-3 h-3 text-amber-400 absolute -bottom-0.5 -right-0.5 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" />
            </div>
            <div>
              <span className={`text-sm font-heading font-bold ${assetColors[round.asset]}`}>
                {round.asset}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={round.status === 'open' ? 'success' : round.status === 'locked' ? 'warning' : 'gray'} size="sm">
                  {round.status === 'open' ? 'LIVE' : round.status === 'locked' ? 'LOCKED' : 'ENDED'}
                </Badge>
              </div>
            </div>
          </div>
          {round.status !== 'resolved' && (
            <div className={`px-3 py-1.5 rounded-xl border ${secondsLeft < 60 ? 'border-accent-red/20 bg-accent-red/5' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              <span className={`text-xs font-mono font-bold tabular-nums ${secondsLeft < 60 ? 'text-accent-red animate-pulse' : 'text-gray-300'}`}>
                {minutes}:{secs.toString().padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {/* Price Section */}
        <div className="grid grid-cols-1 gap-2 mb-4">
          <div className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-0.5">Start Price</div>
            <div className="text-lg font-mono font-bold text-white tabular-nums">
              {round.asset === 'ALEO' ? `$${round.startPrice.toFixed(4)}` : formatUSD(round.startPrice)}
            </div>
          </div>

          {round.status === 'resolved' && round.endPrice && (
            <div className={`px-3 py-2.5 rounded-xl border ${
              round.result === 'up' ? 'bg-accent-green/[0.04] border-accent-green/10' : 'bg-accent-red/[0.04] border-accent-red/10'
            }`}>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-0.5">End Price</div>
              <div className={`text-lg font-mono font-bold tabular-nums ${
                round.result === 'up' ? 'text-accent-green' : 'text-accent-red'
              }`}>
                {round.asset === 'ALEO' ? `$${round.endPrice.toFixed(4)}` : formatUSD(round.endPrice)}
                <span className="text-xs ml-2 font-normal">
                  ({priceChange !== null ? `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(3)}%` : ''})
                </span>
              </div>
            </div>
          )}
        </div>

      {round.status === 'open' && !userBet && (
        <>
          <div className="mb-4">
            {/* Token Selector */}
            {hasStableMarket && (
            <div className="mb-3">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-1.5 block">Token</label>
              <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <button
                  onClick={() => setTokenType('aleo')}
                  className={`flex items-center justify-center gap-1.5 flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-300 ${
                    tokenType === 'aleo'
                      ? 'bg-teal/15 text-teal border border-teal/20 shadow-[0_0_12px_-4px_rgba(255,107,53,0.2)]'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] border border-transparent'
                  }`}
                >
                  <CryptoIcon symbol="ALEO" size={14} />ALEO
                </button>
                {hasUsdcxMarket && (
                <button
                  onClick={() => setTokenType('usdcx')}
                  className={`flex items-center justify-center gap-1.5 flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-300 ${
                    tokenType === 'usdcx'
                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_-4px_rgba(59,130,246,0.2)]'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] border border-transparent'
                  }`}
                >
                  <CryptoIcon symbol="USDCX" size={14} />USDCx
                </button>
                )}
                {hasUsadMarket && (
                <button
                  onClick={() => setTokenType('usad')}
                  className={`flex items-center justify-center gap-1.5 flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-300 ${
                    tokenType === 'usad'
                      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20 shadow-[0_0_12px_-4px_rgba(168,85,247,0.2)]'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] border border-transparent'
                  }`}
                >
                  <CryptoIcon symbol="USAD" size={14} />USAD
                </button>
                )}
              </div>
            </div>
            )}

            {/* Amount Chips */}
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

          {/* UP / DOWN Buttons */}
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

      {/* Show user's active bet */}
      {userBet && round.status !== 'resolved' && (
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
              const outcome = userBet.direction === 'up' ? 0 : 1;
              const { tokensOut } = estimateSellTokensOut(liveReserves, outcome, userBet.shares);
              return formatAleo(calculateFees(tokensOut).amountAfterFee);
            })()} {userBet.tokenType === 'usdcx' ? 'USDCx' : userBet.tokenType === 'usad' ? 'USAD' : 'ALEO'}</span>
          </div>
        </div>
      )}

      {round.status === 'resolved' && (
        <div className={`text-center py-3 rounded-xl border ${
          round.result === 'up'
            ? 'bg-gradient-to-r from-accent-green/[0.06] to-accent-green/[0.03] border-accent-green/15 text-accent-green'
            : 'bg-gradient-to-r from-accent-red/[0.06] to-accent-red/[0.03] border-accent-red/15 text-accent-red'
        }`}>
          <span className="text-sm font-heading font-bold">
            {round.result === 'up' ? '↑ UP WINS' : '↓ DOWN WINS'}
          </span>
        </div>
      )}

      {/* Show user's result when round resolved */}
      {userBet && round.status === 'resolved' && (
        <div className={`mt-2 p-3.5 rounded-xl border ${
          userBet.won
            ? 'border-accent-green/20 bg-gradient-to-br from-accent-green/[0.06] to-accent-green/[0.02]'
            : 'border-accent-red/20 bg-gradient-to-br from-accent-red/[0.06] to-accent-red/[0.02]'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-heading font-bold ${
              userBet.won ? 'text-accent-green' : 'text-accent-red'
            }`}>
              {userBet.won ? '🎉 YOU WON!' : '😞 YOU LOST'}
            </span>
            <span className="text-xs font-mono text-gray-400">
              Bet {userBet.direction.toUpperCase()} • {formatAleo(userBet.amount)} {userBet.tokenType === 'usdcx' ? 'USDCx' : userBet.tokenType === 'usad' ? 'USAD' : 'ALEO'}
            </span>
          </div>
          {userBet.won && claimableShares.length > 0 && (
            <div className="mt-2 space-y-1">
              {claimableShares.map((record, idx) => {
                const tLabel = record.tokenType === 1 ? 'USDCx' : record.tokenType === 2 ? 'USAD' : 'ALEO';
                const market = allMarkets.find((m) => m.id === record.marketId);
                const reserves = market?.reserves ?? [1_000_000, 1_000_000];
                const { tokensOut } = estimateSellTokensOut(reserves, record.outcome - 1, record.quantity);
                const net = calculateFees(tokensOut).amountAfterFee;
                return (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-accent-green/80">
                      {formatAleo(record.quantity)} shares → ~{formatAleo(net)} {tLabel}
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
          {userBet.won && claimableShares.length === 0 && (
            <p className="text-xs text-accent-green/80 mt-1">
              ✓ Shares already claimed or go to Portfolio to sell
            </p>
          )}
          {!userBet.won && (
            <p className="text-xs text-accent-red/60 mt-1">
              Your {formatAleo(userBet.amount)} {userBet.tokenType === 'usdcx' ? 'USDCx' : userBet.tokenType === 'usad' ? 'USAD' : 'ALEO'} went to the liquidity pool
            </p>
          )}
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
  const [rounds, setRounds] = useState<LightningRound[]>([]);
  const [loading, setLoading] = useState(true);
  const { fetchShareRecords } = useTransaction();
  const [shareRecords, setShareRecords] = useState<ShareRecord[]>([]);

  const loadShareRecords = useCallback(async () => {
    const records = await fetchShareRecords();
    setShareRecords(records);
  }, [fetchShareRecords]);

  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/lightning`);
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRounds();
    loadShareRecords();
    const roundId = setInterval(fetchRounds, 10_000);
    const shareId = setInterval(loadShareRecords, 30_000);
    return () => { clearInterval(roundId); clearInterval(shareId); };
  }, [fetchRounds, loadShareRecords]);

  const activeRounds = rounds.filter((r) => r.status === 'open' || r.status === 'locked');
  const recentResolved = rounds.filter((r) => r.status === 'resolved').slice(0, 3);

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Loading rounds...</div>;
  }

  if (activeRounds.length === 0 && recentResolved.length === 0) {
    return (
      <div className="text-center py-8">
        <BoltIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">Waiting for next round...</p>
        <p className="text-xs text-gray-600 mt-1">Rounds start every 5 minutes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeRounds.map((round) => (
          <RoundCard key={round.id} round={round} shareRecords={shareRecords} onClaimed={loadShareRecords} />
        ))}
      </div>
      {/* Show recently resolved rounds that user bet on (for claim) */}
      {recentResolved.some((r) => useLightningBetStore.getState().bets.some((b) => b.roundId === r.id && b.won)) && (
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading mb-2">
            Claim Your Winnings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentResolved
              .filter((r) => useLightningBetStore.getState().bets.some((b) => b.roundId === r.id && b.won))
              .map((round) => (
                <RoundCard key={round.id} round={round} shareRecords={shareRecords} onClaimed={loadShareRecords} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
