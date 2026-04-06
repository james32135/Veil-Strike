import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { config } from './config';
import { initializeDatabase, seedDefaultSeries } from './services/db';
import { fetchOraclePrices, recordPriceSnapshot, loadPriceHistory } from './services/oracle';
import { fetchMarketsFromChain, setCachedMarkets, loadRegistryFromDB } from './services/indexer';
import { resolveExpiredMarkets } from './services/resolver';
import { scanForNewMarkets, loadScannerState } from './services/scanner';
import { autoResolveMarkets } from './services/auto-resolver';
import { initSeedLightningRounds } from './services/lightning-manager';
import { warmupWorker } from './services/proof-dispatcher';
import { startRoundBot } from './services/round-bot';
import marketsRouter from './routes/markets';
import oracleRouter from './routes/oracle';
import statsRouter from './routes/stats';
import healthRouter from './routes/health';
import lightningRouter from './routes/lightning';
import governanceRouter from './routes/governance';
import seriesRouter from './routes/series';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/oracle', oracleRouter);
app.use('/api/stats', statsRouter);
app.use('/api/lightning', lightningRouter);
app.use('/api/governance', governanceRouter);
app.use('/api/series', seriesRouter);

// ── SSE (Server-Sent Events) for real-time market updates ──
import type { Response as ExpressResponse } from 'express';
const sseClients = new Set<ExpressResponse>();

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);
  req.on('close', () => { sseClients.delete(res); });
});

export function broadcastSSE(eventType: string, data: unknown): void {
  const payload = `data: ${JSON.stringify({ type: eventType, data, ts: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// Initialize data
async function initialize() {
  // 1. Connect to database and create tables
  console.log('[Init] Connecting to database...');
  await initializeDatabase();
  await seedDefaultSeries();

  // 2. Load persisted data from DB
  await loadRegistryFromDB();
  await loadScannerState();
  await loadPriceHistory();

  // 3. Fetch live data from chain + oracle
  console.log('[Init] Fetching initial data...');
  const [markets] = await Promise.all([
    fetchMarketsFromChain(),
    fetchOraclePrices(),
  ]);
  setCachedMarkets(markets);
  recordPriceSnapshot();
  initSeedLightningRounds();
  warmupWorker(); // Pre-initialize SDK in worker thread

  // Start automated round bot (delegated proving required)
  startRoundBot().catch((err) => {
    console.error('[Init] Round bot failed to start:', err);
  });
  console.log(`[Init] Loaded ${markets.length} markets`);

  // Run initial block scan in background (non-blocking)
  scanForNewMarkets(500).then(found => {
    if (found > 0) {
      fetchMarketsFromChain().then(m => {
        setCachedMarkets(m);
        console.log(`[Init] Post-scan: ${m.length} markets`);
      });
    }
  }).catch(() => {});
}

// Cron jobs
cron.schedule(`*/${config.oracleIntervalMinutes} * * * *`, async () => {
  await fetchOraclePrices();
  recordPriceSnapshot();
});

cron.schedule(`*/${config.resolverIntervalMinutes} * * * *`, async () => {
  await resolveExpiredMarkets();
});

// Refresh market data from chain every 15 seconds (keeps frontend data fresh via SSE)
cron.schedule('*/15 * * * * *', async () => {
  try {
    const markets = await fetchMarketsFromChain();
    setCachedMarkets(markets);
    broadcastSSE('markets', markets);
  } catch (err) {
    console.error('[Cron] Market refresh failed:', err);
  }
});

// Scan blockchain for new create_market transactions every 15 seconds
cron.schedule('*/15 * * * * *', async () => {
  try {
    const found = await scanForNewMarkets(20);
    if (found > 0) {
      const markets = await fetchMarketsFromChain();
      setCachedMarkets(markets);
      broadcastSSE('markets', markets);
    }
  } catch (err) {
    console.error('[Cron] Market scan failed:', err);
  }
});

// Auto-resolve event markets (seal → judge → confirm_verdict) every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    await autoResolveMarkets();
  } catch (err) {
    console.error('[Cron] Auto-resolve failed:', err);
  }
});

// Start server
initialize().then(() => {
  app.listen(config.port, () => {
    console.log(`[Server] Veil Strike backend running on port ${config.port}`);
    console.log(`[Server] Oracle interval: ${config.oracleIntervalMinutes}m`);
    console.log(`[Server] Resolver interval: ${config.resolverIntervalMinutes}m`);
  });
});
