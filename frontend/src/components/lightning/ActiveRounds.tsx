import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import { BoltIcon, ArrowUpIcon, ArrowDownIcon } from '@/components/icons';
import { useTransaction } from '@/hooks/useTransaction';
import { buildBuySharesPrivateTx, generateNonce } from '@/utils/transactions';
import { estimateBuySharesExact } from '@/utils/fpmm';
import { formatUSD, formatAleo } from '@/utils/format';
import { useMarketStore } from '@/stores/marketStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useLightningBetStore } from '@/stores/lightningBetStore';

// Map lightning assets to real on-chain market IDs
const ASSET_MARKET_MAP: Record<string, { id: string; reserves: number[] }> = {
  BTC: {
    id: '1453931991308580475428975090349277804251679422043348343263566005521045252998field',
    reserves: [1_000_000, 1_000_000],
  },
  ETH: {
    id: '8292926655901621437805687927045387826605222498023779464600572253470472422042field',
    reserves: [1_000_000, 1_000_000],
  },
  ALEO: {
    id: '875462563816638972930909946596281093653347951171132855649321634026236611657field',
    reserves: [1_000_000, 1_000_000],
  },
};

interface LightningRound {
  id: string;
  asset: 'BTC' | 'ETH' | 'ALEO';
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

function RoundCard({ round }: { round: LightningRound }) {
  const secondsLeft = useCountdownSeconds(round.endTime);
  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const { status: txStatus, execute } = useTransaction();
  const [betAmount, setBetAmount] = useState('1');

  const fetchMarkets = useMarketStore((s) => s.fetchMarkets);
  const allMarkets = useMarketStore((s) => s.markets);
  const addTrade = useTradeStore((s) => s.addTrade);
  const addBet = useLightningBetStore((s) => s.addBet);
  const resolveBets = useLightningBetStore((s) => s.resolveBets);
  const roundBets = useLightningBetStore((s) => s.getBetsForRound(round.id));

  // Auto-resolve user bets when round resolves
  useEffect(() => {
    if (round.status === 'resolved' && round.result && round.endPrice) {
      resolveBets(round.id, round.result, round.endPrice);
    }
  }, [round.status, round.result, round.endPrice, round.id, resolveBets]);

  // Get live reserves from store for this asset's market
  const chainMarket = ASSET_MARKET_MAP[round.asset];
  const liveMarket = allMarkets.find((m) => m.id === chainMarket?.id);
  const liveReserves = liveMarket?.reserves ?? chainMarket?.reserves ?? [2_000_000, 2_000_000];

  const userBet = roundBets[0]; // Most recent bet for this round

  const handleBet = async (direction: 'up' | 'down') => {
    const amountMicro = Math.floor(parseFloat(betAmount) * 1_000_000);
    if (amountMicro < 1000 || !chainMarket) return;
    const outcome = direction === 'up' ? 0 : 1;
    const exactShares = estimateBuySharesExact(liveReserves, outcome, amountMicro);
    if (exactShares <= 0n) return;
    const minShares = exactShares * 95n / 100n;
    const nonce = generateNonce();
    const tx = buildBuySharesPrivateTx(
      chainMarket.id,
      outcome,
      `${amountMicro}u128`,
      `${exactShares}u128`,
      `${minShares}u128`,
      nonce
    );
    const txId = await execute(tx);
    if (txId) {
      // Track lightning bet
      addBet({
        roundId: round.id,
        asset: round.asset,
        direction,
        amount: amountMicro,
        shares: Number(exactShares),
        timestamp: Date.now(),
        startPrice: round.startPrice,
      });

      addTrade({
        marketId: chainMarket.id,
        type: 'buy',
        outcome: direction === 'up' ? 'Up' : 'Down',
        amount: amountMicro,
        shares: Number(exactShares),
        price: 0.5,
        timestamp: Date.now(),
      });
      const refreshChain = () => fetch('/api/markets/refresh', { method: 'POST' }).then(() => fetchMarkets()).catch(() => fetchMarkets());
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
    <Card className="p-5 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-0.5 ${
        round.status === 'resolved'
          ? round.result === 'up' ? 'bg-accent-green' : 'bg-accent-red'
          : 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500'
      }`} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BoltIcon className="w-4 h-4 text-amber-400" />
          <span className={`text-sm font-heading font-bold ${assetColors[round.asset]}`}>
            {round.asset}
          </span>
          <Badge variant={round.status === 'open' ? 'success' : round.status === 'locked' ? 'warning' : 'gray'}>
            {round.status === 'open' ? 'LIVE' : round.status === 'locked' ? 'LOCKED' : 'ENDED'}
          </Badge>
        </div>
        {round.status !== 'resolved' && (
          <span className={`text-xs font-mono ${secondsLeft < 60 ? 'text-accent-red animate-pulse' : 'text-gray-400'}`}>
            {minutes}:{secs.toString().padStart(2, '0')}
          </span>
        )}
      </div>

      <div className="text-xs text-gray-500 mb-1">Start Price</div>
      <div className="text-lg font-mono font-bold text-white mb-3">
        {round.asset === 'ALEO' ? `$${round.startPrice.toFixed(4)}` : formatUSD(round.startPrice)}
      </div>

      {round.status === 'resolved' && round.endPrice && (
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">End Price</div>
          <div className={`text-lg font-mono font-bold ${
            round.result === 'up' ? 'text-accent-green' : 'text-accent-red'
          }`}>
            {round.asset === 'ALEO' ? `$${round.endPrice.toFixed(4)}` : formatUSD(round.endPrice)}
            <span className="text-sm ml-2">
              ({priceChange !== null ? `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(3)}%` : ''})
            </span>
          </div>
        </div>
      )}

      {round.status === 'open' && !userBet && (
        <>
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Amount (ALEO)</label>
            <div className="flex gap-2">
              {['1', '5', '10', '25'].map((val) => (
                <button
                  key={val}
                  onClick={() => setBetAmount(val)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                    betAmount === val
                      ? 'border-teal/40 bg-teal/10 text-teal'
                      : 'border-dark-400/50 text-gray-500 hover:text-gray-300'
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
              className="!bg-accent-green/10 !text-accent-green !border-accent-green/20 hover:!bg-accent-green/20"
              onClick={() => handleBet('up')}
              loading={txStatus === 'proving'}
            >
              <ArrowUpIcon className="w-4 h-4 mr-1" />
              UP
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleBet('down')}
              loading={txStatus === 'proving'}
            >
              <ArrowDownIcon className="w-4 h-4 mr-1" />
              DOWN
            </Button>
          </div>
        </>
      )}

      {/* Show user's active bet */}
      {userBet && round.status !== 'resolved' && (
        <div className={`p-3 rounded-xl border ${
          userBet.direction === 'up'
            ? 'border-accent-green/30 bg-accent-green/5'
            : 'border-accent-red/30 bg-accent-red/5'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">Your Bet</span>
            <Badge variant={userBet.direction === 'up' ? 'success' : 'danger'}>
              {userBet.direction === 'up' ? '↑ UP' : '↓ DOWN'}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Amount</span>
            <span className="font-mono text-white">{formatAleo(userBet.amount)} ALEO</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-0.5">
            <span className="text-gray-500">Potential Win</span>
            <span className="font-mono text-teal">{formatAleo(userBet.shares)} ALEO</span>
          </div>
        </div>
      )}

      {round.status === 'resolved' && (
        <div className={`text-center py-2 rounded-xl ${
          round.result === 'up' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
        }`}>
          <span className="text-sm font-heading font-bold">
            {round.result === 'up' ? '↑ UP WINS' : '↓ DOWN WINS'}
          </span>
        </div>
      )}

      {/* Show user's result when round resolved */}
      {userBet && round.status === 'resolved' && (
        <div className={`mt-2 p-3 rounded-xl border ${
          userBet.won
            ? 'border-accent-green/30 bg-accent-green/5'
            : 'border-accent-red/30 bg-accent-red/5'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-heading font-bold ${
              userBet.won ? 'text-accent-green' : 'text-accent-red'
            }`}>
              {userBet.won ? '🎉 YOU WON!' : '😞 YOU LOST'}
            </span>
            <span className="text-xs font-mono text-gray-400">
              Bet {userBet.direction.toUpperCase()} • {formatAleo(userBet.amount)} ALEO
            </span>
          </div>
          {userBet.won && (
            <p className="text-xs text-accent-green/80 mt-1">
              Payout: {formatAleo(userBet.payout || 0)} ALEO (shares redeemable on-chain)
            </p>
          )}
          {!userBet.won && (
            <p className="text-xs text-accent-red/60 mt-1">
              Your {formatAleo(userBet.amount)} ALEO went to the liquidity pool
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

interface ActiveRoundsProps {
  markets: never[];
}

export default function ActiveRounds({ }: ActiveRoundsProps) {
  const [rounds, setRounds] = useState<LightningRound[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch('/api/lightning');
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRounds();
    const id = setInterval(fetchRounds, 10_000);
    return () => clearInterval(id);
  }, [fetchRounds]);

  const activeRounds = rounds.filter((r) => r.status === 'open' || r.status === 'locked');

  if (loading) {
    return <div className="text-center text-gray-500 py-8">Loading rounds...</div>;
  }

  if (activeRounds.length === 0) {
    return (
      <div className="text-center py-8">
        <BoltIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">Waiting for next round...</p>
        <p className="text-xs text-gray-600 mt-1">Rounds start every 5 minutes</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {activeRounds.map((round) => (
        <RoundCard key={round.id} round={round} />
      ))}
    </div>
  );
}
