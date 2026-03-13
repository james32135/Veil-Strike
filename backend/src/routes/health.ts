import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '1.0.0',
    program: 'veil_strike_v3.aleo',
  });
});

export default router;
