import { Router } from 'express';
import { getCachedMarkets, fetchMarketsFromChain, setCachedMarkets } from '../services/indexer';

const router = Router();

router.get('/', (_req, res) => {
  const markets = getCachedMarkets();
  res.json({ markets });
});

router.get('/:id', (req, res) => {
  const market = getCachedMarkets().find((m) => m.id === req.params.id);
  if (!market) {
    res.status(404).json({ error: 'Market not found' });
    return;
  }
  res.json({ market });
});

router.post('/refresh', async (_req, res) => {
  const markets = await fetchMarketsFromChain();
  setCachedMarkets(markets);
  res.json({ markets, refreshed: true });
});

export default router;
