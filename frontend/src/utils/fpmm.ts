// FPMM utility functions for frontend price estimation
// Mirrors the Leo contract's FPMM math for UI display.

const PRECISION = 1_000_000;

/**
 * Calculate the probability (price) for each outcome from reserves.
 * Price of outcome i = 1 / r_i / sum(1/r_k for all k)
 * Simplified: price_i = product(r_k, k!=i) / sum(product(r_k, k!=j) for all j)
 */
export function calculatePrices(reserves: number[]): number[] {
  const n = reserves.length;
  if (n < 2) return [PRECISION];

  const totalProduct = reserves.reduce((acc, r) => acc * r, 1);
  if (totalProduct === 0) return reserves.map(() => PRECISION / n);

  const inverses = reserves.map((r) => (r > 0 ? totalProduct / r : 0));
  const sumInverses = inverses.reduce((acc, v) => acc + v, 0);

  if (sumInverses === 0) return reserves.map(() => PRECISION / n);

  return inverses.map((inv) => Math.round((inv / sumInverses) * PRECISION));
}

/**
 * Estimate shares received for a buy order.
 * Uses the FPMM complete-set minting formula.
 */
export function estimateBuyShares(
  reserves: number[],
  outcomeIndex: number,
  amountToPool: number
): number {
  const n = reserves.length;
  if (outcomeIndex < 0 || outcomeIndex >= n) return 0;
  if (amountToPool <= 0) return 0;

  let step = reserves[outcomeIndex];

  for (let k = 0; k < n; k++) {
    if (k === outcomeIndex) continue;
    const rk = reserves[k];
    if (rk + amountToPool === 0) return 0;
    step = (step * rk) / (rk + amountToPool);
  }

  const riNew = step;
  const sharesOut = reserves[outcomeIndex] + amountToPool - riNew;
  return Math.floor(sharesOut);
}

/**
 * Estimate shares needed for a sell order (tokens-desired approach).
 */
export function estimateSellShares(
  reserves: number[],
  outcomeIndex: number,
  tokensDesired: number
): number {
  const n = reserves.length;
  if (outcomeIndex < 0 || outcomeIndex >= n) return 0;
  if (tokensDesired <= 0) return 0;

  let step = reserves[outcomeIndex];

  for (let k = 0; k < n; k++) {
    if (k === outcomeIndex) continue;
    const rk = reserves[k];
    const den = rk - tokensDesired;
    if (den <= 0) return Infinity; // Not enough liquidity
    step = (step * rk) / den;
  }

  const riNew = step;
  const sharesNeeded = riNew - reserves[outcomeIndex] + tokensDesired;
  return Math.ceil(sharesNeeded);
}

/**
 * Calculate fees for a trade.
 */
export function calculateFees(amount: number) {
  const protocolFee = Math.floor((amount * 5_000) / PRECISION);
  const creatorFee = Math.floor((amount * 5_000) / PRECISION);
  const lpFee = Math.floor((amount * 10_000) / PRECISION);
  const totalFee = protocolFee + creatorFee + lpFee;
  const amountToPool = amount - protocolFee - creatorFee;

  return { protocolFee, creatorFee, lpFee, totalFee, amountToPool };
}

/**
 * Calculate price impact of a trade.
 */
export function calculatePriceImpact(
  reserves: number[],
  outcomeIndex: number,
  amount: number,
  isBuy: boolean
): number {
  const pricesBefore = calculatePrices(reserves);
  const priceBefore = pricesBefore[outcomeIndex] / PRECISION;

  const newReserves = [...reserves];
  const { amountToPool } = calculateFees(amount);

  if (isBuy) {
    const n = reserves.length;
    let step = reserves[outcomeIndex];
    for (let k = 0; k < n; k++) {
      if (k === outcomeIndex) continue;
      step = (step * reserves[k]) / (reserves[k] + amountToPool);
      newReserves[k] = reserves[k] + amountToPool;
    }
    newReserves[outcomeIndex] = step;
  }

  const pricesAfter = calculatePrices(newReserves);
  const priceAfter = pricesAfter[outcomeIndex] / PRECISION;

  return Math.abs(priceAfter - priceBefore) / priceBefore;
}
