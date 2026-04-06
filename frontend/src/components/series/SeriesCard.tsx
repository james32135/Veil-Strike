import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Series } from '@/types';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import CryptoIcon from '@/components/shared/CryptoIcon';
import ProbabilityGauge from '@/components/shared/ProbabilityGauge';
import { useCountdown } from '@/hooks/useCountdown';
import { useOracleStore } from '@/stores/oracleStore';

interface SeriesCardProps {
  series: Series;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

function formatAleo(micro: number): string {
  return (micro / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const assetColors: Record<string, string> = {
  BTC: 'from-amber-400/20 to-amber-600/5',
  ETH: 'from-blue-400/20 to-blue-600/5',
  ALEO: 'from-teal/20 to-teal/5',
};

const assetTextColors: Record<string, string> = {
  BTC: 'text-amber-400',
  ETH: 'text-blue-400',
  ALEO: 'text-teal',
};

export default function SeriesCard({ series }: SeriesCardProps) {
  const prices = useOracleStore((s) => s.prices);
  const round = series.currentRound;
  const hasLiveRound = !!round && round.status === 'active';

  const endTime = round?.endTime ?? 0;
  const { minutes, seconds, isExpired } = useCountdown(endTime);

  // Calculate up probability from reserves
  let upProbability = 50;
  if (round && round.reserves && round.reserves.length === 2) {
    const [rUp, rDown] = round.reserves;
    const total = rUp + rDown;
    if (total > 0) {
      upProbability = Math.round((rDown / total) * 100); // inverse for CPMM
    }
  }

  const asset = series.asset.toUpperCase();
  const currentPrice = asset === 'BTC' ? prices.btc : asset === 'ETH' ? prices.eth : prices.aleo;
  const tokenLabel = series.tokenType === 'USDCX' ? 'USDCx' : series.tokenType === 'USAD' ? 'USAD' : 'ALEO';
  const durationLabel = series.durationSeconds < 3600
    ? `${series.durationSeconds / 60} Min`
    : `${series.durationSeconds / 3600} Hr`;

  return (
    <Link to={`/series/${series.slug}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card hover className="p-0 relative overflow-hidden group/series">
          {/* Top accent */}
          <div className={`h-1 bg-gradient-to-r ${assetColors[asset] || 'from-gray-400/20 to-gray-600/5'} ${hasLiveRound ? 'animate-pulse' : ''}`} />

          <div className="p-5">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${assetColors[asset] || 'from-gray-400/10 to-gray-600/5'} border border-white/[0.06] flex items-center justify-center`}>
                  <CryptoIcon symbol={asset} size={24} />
                </div>
                <div>
                  <h3 className={`text-sm font-heading font-bold ${assetTextColors[asset] || 'text-white'}`}>
                    {series.title}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {durationLabel} rounds · {series.totalRounds} played
                  </p>
                </div>
              </div>
              <Badge variant={hasLiveRound ? 'success' : 'gray'} size="sm" pulse={hasLiveRound}>
                {hasLiveRound ? 'LIVE' : 'NEXT SOON'}
              </Badge>
            </div>

            {/* Probability gauge */}
            <div className="flex justify-center mb-3">
              <ProbabilityGauge upProbability={upProbability} size={130} />
            </div>

            {/* Current price */}
            <div className="text-center mb-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-heading mb-0.5">Current Price</div>
              <div className="text-xl font-mono font-bold text-white tabular-nums">
                ${asset === 'ALEO' ? currentPrice.toFixed(4) : currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Countdown + volume row */}
            <div className="flex items-center justify-between text-xs mb-4">
              {hasLiveRound && !isExpired ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                  <span className="font-mono text-gray-300 tabular-nums">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </span>
                </div>
              ) : (
                <span className="text-gray-600">--:--</span>
              )}
              <span className="text-gray-500">
                Vol: {formatAleo(series.totalVolume)} {tokenLabel}
              </span>
            </div>

            {/* Up / Down buttons */}
            <div className="grid grid-cols-2 gap-2">
              <div className="py-2.5 rounded-xl border border-accent-green/20 bg-accent-green/[0.06] text-center">
                <span className="text-xs font-heading font-bold text-accent-green">↑ Up</span>
                <span className="text-[10px] text-gray-500 ml-1.5">{upProbability}¢</span>
              </div>
              <div className="py-2.5 rounded-xl border border-accent-red/20 bg-accent-red/[0.06] text-center">
                <span className="text-xs font-heading font-bold text-accent-red">↓ Down</span>
                <span className="text-[10px] text-gray-500 ml-1.5">{100 - upProbability}¢</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </Link>
  );
}
