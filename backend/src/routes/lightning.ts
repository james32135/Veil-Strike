import { Router } from 'express';
import { getLightningRounds } from '../services/oracle';

const router = Router();

router.get('/', (_req, res) => {
  const rounds = getLightningRounds();
  res.json({ rounds });
});

export default router;
