import { useOracleStore } from '@/stores/oracleStore';
import { formatPrice } from '@/utils/format';
import Card from '@/components/shared/Card';
import { ArrowUpIcon, ArrowDownIcon } from '@/components/icons';
import CryptoIcon from '@/components/shared/CryptoIcon';
import { motion } from 'framer-motion';

export default function OraclePriceFeed() {
  const { prices, lastUpdated } = useOracleStore();

  const assets = [
    { symbol: 'BTC', price: prices.btc, change: 2.4 },
    { symbol: 'ETH', price: prices.eth, change: -0.8 },
    { symbol: 'ALEO', price: prices.aleo, change: 5.1 },
  ];

  return (
    <Card className="p-5" glow>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
          <h3 className="text-xs text-gray-400 uppercase tracking-widest font-heading font-semibold">
            Oracle Price Feed
          </h3>
        </div>
        <span className="text-[10px] text-gray-600 font-mono tabular-nums">
          {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '--:--'}
        </span>
      </div>

      <div className="space-y-1">
        {assets.map((asset, i) => (
          <motion.div
            key={asset.symbol}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-300 hover:bg-white/[0.02] group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.06] flex items-center justify-center group-hover:border-teal/20 group-hover:shadow-[0_0_12px_-4px_rgba(255,107,53,0.15)] transition-all duration-300">
                <CryptoIcon symbol={asset.symbol} size={20} />
              </div>
              <div>
                <span className="text-sm font-heading font-semibold text-white">{asset.symbol}</span>
                <div className={`flex items-center gap-0.5 text-[10px] ${
                  asset.change >= 0 ? 'text-accent-green' : 'text-accent-red'
                }`}>
                  {asset.change >= 0
                    ? <ArrowUpIcon className="w-2.5 h-2.5" />
                    : <ArrowDownIcon className="w-2.5 h-2.5" />
                  }
                  <span className="font-mono">{Math.abs(asset.change).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <p className="text-sm font-mono font-bold text-white tabular-nums">{formatPrice(asset.price)}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-white/[0.04]">
        <div className="flex items-center justify-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
          <span className="text-[10px] text-gray-600 font-mono">On-chain oracle · CoinGecko API</span>
        </div>
      </div>
    </Card>
  );
}
