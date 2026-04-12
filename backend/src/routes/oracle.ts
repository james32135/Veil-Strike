import { Router, Request, Response } from 'express';
import { getCachedPrices, fetchOraclePrices, getPriceHistory } from '../services/oracle';

const router = Router();

/* ---------- SSE price stream ---------- */
const sseClients = new Set<Response>();

router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseClients.add(res);
  req.on('close', () => { sseClients.delete(res); });

  // Send initial snapshot immediately
  const prices = getCachedPrices();
  res.write(`data: ${JSON.stringify({ ...prices, timestamp: Date.now() })}\n\n`);
});

/** Broadcast latest prices to all connected SSE clients */
export function broadcastPrices(): void {
  if (sseClients.size === 0) return;
  const prices = getCachedPrices();
  const payload = `data: ${JSON.stringify({ ...prices, timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

/* ---------- REST endpoints ---------- */
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
