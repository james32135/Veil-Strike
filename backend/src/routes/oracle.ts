import { Router } from 'express';
import { getCachedPrices, fetchOraclePrices } from '../services/oracle';

const router = Router();

router.get('/', (_req, res) => {
  const prices = getCachedPrices();
  res.json({ prices });
});

router.post('/refresh', async (_req, res) => {
  const prices = await fetchOraclePrices();
  res.json({ prices, refreshed: true });
});

export default router;
