import { Router } from 'express';
import { getAllSeries, getSeriesBySlug, query } from '../services/db';
import { getCachedMarkets } from '../services/indexer';
import { getCachedPrices, getPriceHistory } from '../services/oracle';
import type { SeriesInfo, MarketInfo } from '../types';

const router = Router();

/** Map a DB series row + live market data into a SeriesInfo API response */
function buildSeriesInfo(row: any, allMarkets: MarketInfo[]): SeriesInfo {
  const seriesId = row.id;
  // Find markets belonging to this series
  const seriesMarkets = allMarkets
    .filter((m) => m.seriesId === seriesId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const currentRound = seriesMarkets.find((m) => m.status === 'active') || undefined;
  const pastRounds = seriesMarkets
    .filter((m) => m.status !== 'active')
    .slice(0, 20);

  // Generate upcoming time slot labels (next 4 slots after current)
  const now = Date.now();
  const dur = (row.duration_seconds || 900) * 1000;
  const upcomingSlots: string[] = [];
  const base = currentRound ? currentRound.endTime : now;
  for (let i = 0; i < 4; i++) {
    const start = base + dur * i;
    const end = start + dur;
    const fmt = (d: Date) => {
      let h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return { time: `${h}:${m}`, ampm };
    };
    const s = fmt(new Date(start));
    const e = fmt(new Date(end));
    upcomingSlots.push(`${s.time} – ${e.time} ${e.ampm}`);
  }

  return {
    id: seriesId,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || undefined,
    asset: row.asset,
    iconUrl: row.icon_url || undefined,
    description: row.description || undefined,
    category: row.category,
    durationSeconds: row.duration_seconds,
    tokenType: row.token_type,
    totalVolume: Number(row.total_volume) || 0,
    totalRounds: row.total_rounds || 0,
    isActive: row.is_active,
    createdAt: new Date(row.created_at).getTime(),
    currentRound,
    pastRounds,
    upcomingSlots,
  };
}

/**
 * GET /api/series
 * List all active series with their current round and stats.
 */
router.get('/', async (_req, res) => {
  try {
    const rows = await getAllSeries();
    const allMarkets = getCachedMarkets();

    // Enrich markets with series linkage from DB
    const enriched = await enrichMarketsWithSeries(allMarkets);
    const series = rows.map((row) => buildSeriesInfo(row, enriched));
    res.json({ series });
  } catch (err) {
    console.error('[Series] List failed:', err);
    res.status(500).json({ error: 'Failed to fetch series' });
  }
});

/**
 * GET /api/series/:slug
 * Full series detail: current round, past rounds, price history, stats.
 */
router.get('/:slug', async (req, res) => {
  try {
    const row = await getSeriesBySlug(req.params.slug);
    if (!row) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    const allMarkets = getCachedMarkets();
    const enriched = await enrichMarketsWithSeries(allMarkets);
    const info = buildSeriesInfo(row, enriched);

    // Add price data for the live chart
    const prices = getCachedPrices();
    const history = getPriceHistory();
    const assetKey = row.asset.toLowerCase() as 'btc' | 'eth' | 'aleo';

    res.json({
      series: info,
      currentPrice: prices[assetKey] || 0,
      priceHistory: history.map((p: any) => ({
        timestamp: p.timestamp,
        price: p[assetKey] || 0,
      })),
    });
  } catch (err) {
    console.error('[Series] Detail failed:', err);
    res.status(500).json({ error: 'Failed to fetch series detail' });
  }
});

/**
 * GET /api/series/:slug/rounds
 * Paginated rounds history for a series.
 */
router.get('/:slug/rounds', async (req, res) => {
  try {
    const row = await getSeriesBySlug(req.params.slug);
    if (!row) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const { rows } = await query(
      `SELECT id FROM markets WHERE series_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [row.id, limit, offset],
    );

    const allMarkets = getCachedMarkets();
    const enriched = await enrichMarketsWithSeries(allMarkets);
    const ids = new Set(rows.map((r: any) => r.id));
    const rounds = enriched.filter((m) => ids.has(m.id));

    res.json({ rounds, limit, offset });
  } catch (err) {
    console.error('[Series] Rounds failed:', err);
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
});

/**
 * Enrich cached MarketInfo[] with series_id, round_number, start_price, time_slot from DB.
 * This merges DB-stored series linkage into in-memory market cache.
 */
async function enrichMarketsWithSeries(markets: MarketInfo[]): Promise<MarketInfo[]> {
  try {
    const { rows } = await query(
      'SELECT id, series_id, round_number, start_price, time_slot FROM markets WHERE series_id IS NOT NULL',
    );
    const map = new Map<string, any>();
    for (const r of rows) map.set(r.id, r);

    return markets.map((m) => {
      const db = map.get(m.id);
      if (db) {
        return {
          ...m,
          seriesId: db.series_id,
          roundNumber: db.round_number,
          startPrice: db.start_price,
          timeSlot: db.time_slot,
        };
      }
      return m;
    });
  } catch {
    return markets;
  }
}

export default router;
