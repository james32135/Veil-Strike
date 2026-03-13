const parseCorsOrigin = (origin?: string): string | string[] => {
  if (!origin) return 'http://localhost:5173';
  if (origin.includes(',')) return origin.split(',').map(o => o.trim());
  return origin;
};

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  aleoEndpoint: process.env.ALEO_ENDPOINT || 'https://api.explorer.provable.com/v1',
  programId: 'veil_strike_v3.aleo',
  coingeckoUrl: 'https://api.coingecko.com/api/v3',
  oracleIntervalMinutes: 1,
  resolverIntervalMinutes: 5,
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
};
