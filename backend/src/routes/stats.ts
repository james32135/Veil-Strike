import { Router } from 'express';
import { getCachedMarkets } from '../services/indexer';
import type { ProtocolStats } from '../types';

const router = Router();

router.get('/', (_req, res) => {
  const markets = getCachedMarkets();
  const active = markets.filter((m) => m.status === 'active');
  const resolved = markets.filter((m) => m.status === 'resolved');

  const stats: ProtocolStats = {
    totalMarkets: markets.length,
    activeMarkets: active.length,
    resolvedMarkets: resolved.length,
    totalVolume: markets.reduce((s, m) => s + m.totalVolume, 0),
    totalLiquidity: markets.reduce((s, m) => s + m.totalLiquidity, 0),
    totalTrades: markets.reduce((s, m) => s + m.tradeCount, 0),
    uniqueTraders: 0,
    protocolFees: Math.floor(markets.reduce((s, m) => s + m.totalVolume, 0) * 0.005),
  };

  res.json({ stats });
});

export default router;
