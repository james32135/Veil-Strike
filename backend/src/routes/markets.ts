import { Router } from 'express';
import { getCachedMarkets, fetchMarketsFromChain, setCachedMarkets, registerMarket } from '../services/indexer';

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

router.post('/register', async (req, res) => {
  const { marketId, question, outcomes, isLightning } = req.body;
  if (!marketId || !question || !Array.isArray(outcomes) || outcomes.length < 2) {
    res.status(400).json({ error: 'marketId, question, and outcomes (array) required' });
    return;
  }
  registerMarket(marketId, {
    questionHash: '',
    question,
    outcomes,
    isLightning: isLightning || false,
  });
  const markets = await fetchMarketsFromChain();
  setCachedMarkets(markets);
  res.json({ success: true, marketCount: markets.length });
});

export default router;
