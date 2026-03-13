import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { config } from './config';
import { fetchOraclePrices, recordPriceSnapshot } from './services/oracle';
import { fetchMarketsFromChain, setCachedMarkets } from './services/indexer';
import { resolveExpiredMarkets } from './services/resolver';
import marketsRouter from './routes/markets';
import oracleRouter from './routes/oracle';
import statsRouter from './routes/stats';
import healthRouter from './routes/health';
import lightningRouter from './routes/lightning';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/oracle', oracleRouter);
app.use('/api/stats', statsRouter);
app.use('/api/lightning', lightningRouter);

// Initialize data
async function initialize() {
  console.log('[Init] Fetching initial data...');
  const [markets] = await Promise.all([
    fetchMarketsFromChain(),
    fetchOraclePrices(),
  ]);
  setCachedMarkets(markets);
  recordPriceSnapshot();
  console.log(`[Init] Loaded ${markets.length} markets`);
}

// Cron jobs
cron.schedule(`*/${config.oracleIntervalMinutes} * * * *`, async () => {
  await fetchOraclePrices();
  recordPriceSnapshot();
});

cron.schedule(`*/${config.resolverIntervalMinutes} * * * *`, async () => {
  await resolveExpiredMarkets();
});

// Refresh market data from chain every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    const markets = await fetchMarketsFromChain();
    setCachedMarkets(markets);
    console.log(`[Cron] Refreshed ${markets.length} markets from chain`);
  } catch (err) {
    console.error('[Cron] Market refresh failed:', err);
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
