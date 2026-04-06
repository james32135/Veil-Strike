import { Router } from 'express';
import { getCachedMarkets, fetchMarketsFromChain, setCachedMarkets, registerMarket, updateMarketMeta, persistRegistry } from '../services/indexer';
import { savePendingMeta } from '../services/scanner';

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
  const { marketId, question, outcomes, isLightning, tokenType, imageUrl } = req.body;
  if (!marketId || !question || !Array.isArray(outcomes) || outcomes.length < 2) {
    res.status(400).json({ error: 'marketId, question, and outcomes (array) required' });
    return;
  }
  const registered = registerMarket(marketId, {
    questionHash: '',
    question,
    outcomes,
    isLightning: isLightning || false,
    tokenType: tokenType || undefined,
    imageUrl: imageUrl || undefined,
  });
  if (!registered) {
    // Market was already registered (e.g. by scanner) — update with real metadata
    updateMarketMeta(marketId, {
      question,
      outcomes,
      isLightning: isLightning || false,
      tokenType: tokenType || undefined,
      imageUrl: imageUrl || undefined,
    });
  }
  persistRegistry().catch(() => {});
  const markets = await fetchMarketsFromChain();
  setCachedMarkets(markets);
  res.json({ success: true, marketCount: markets.length });
});

// Save pending market metadata before tx confirms.
// Frontend sends question text + hash so the scanner can populate the
// market's metadata when it discovers the market_id on-chain.
router.post('/pending', (req, res) => {
  const { questionHash, question, outcomes, isLightning, imageUrl, tokenType } = req.body;
  if (!questionHash || !question) {
    res.status(400).json({ error: 'questionHash and question required' });
    return;
  }
  savePendingMeta(questionHash, {
    question,
    outcomes: Array.isArray(outcomes) ? outcomes : ['Yes', 'No'],
    isLightning: isLightning || false,
    createdAt: Date.now(),
    imageUrl: imageUrl || undefined,
    tokenType: tokenType || undefined,
  });
  res.json({ success: true });
});

export default router;
