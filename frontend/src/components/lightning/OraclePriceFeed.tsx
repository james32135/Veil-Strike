import { useOracleStore } from '@/stores/oracleStore';
import { formatPrice } from '@/utils/format';
import Card from '@/components/shared/Card';
import { ChartIcon, ArrowUpIcon, ArrowDownIcon } from '@/components/icons';
import CryptoIcon from '@/components/shared/CryptoIcon';

export default function OraclePriceFeed() {
  const { prices, lastUpdated } = useOracleStore();

  const assets = [
    { symbol: 'BTC', price: prices.btc, change: 2.4 },
    { symbol: 'ETH', price: prices.eth, change: -0.8 },
    { symbol: 'ALEO', price: prices.aleo, change: 5.1 },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider font-heading">
          Oracle Price Feed
        </h3>
        <span className="text-[10px] text-gray-600 font-mono">
          {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '--:--'}
        </span>
      </div>

      <div className="space-y-3">
        {assets.map((asset) => (
          <div key={asset.symbol} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-dark-200 flex items-center justify-center">
                <CryptoIcon symbol={asset.symbol} size={18} />
              </div>
              <span className="text-sm font-heading font-medium text-gray-300">{asset.symbol}</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono text-white">{formatPrice(asset.price)}</p>
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
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-dark-400/20">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
          <span className="text-[10px] text-gray-600">On-chain oracle · CoinGecko API</span>
        </div>
      </div>
    </Card>
  );
}
