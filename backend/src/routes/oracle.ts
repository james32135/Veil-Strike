import { Router } from 'express';
import { getCachedPrices, fetchOraclePrices, getPriceHistory } from '../services/oracle';

const router = Router();

router.get('/', (_req, res) => {
  const prices = getCachedPrices();
  res.json({ prices });
});

router.get('/history', (req, res) => {
  const asset = ((req.query.asset as string) || 'btc').toLowerCase();
  const history = getPriceHistory();
  const mapped = history
    .filter((h: any) => h[asset] !== undefined)
    .map((h: any) => ({ time: h.timestamp, price: h[asset] }));
  res.json({ history: mapped });
});

router.post('/refresh', async (_req, res) => {
  const prices = await fetchOraclePrices();
  res.json({ prices, refreshed: true });
});

export default router;
