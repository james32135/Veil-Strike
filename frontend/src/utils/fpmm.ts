// FPMM utility functions for frontend price estimation
// Mirrors the Leo contract's FPMM math exactly using BigInt.

const PRECISION = 1_000_000;

// Contract-matching constants (BigInt) — must match deployed main.leo
const PROTOCOL_FEE_BPS = 50n;   // 0.5%
const CREATOR_FEE_BPS = 50n;    // 0.5%
const BPS_BASE = 10000n;

/**
 * Calculate the probability (price) for each outcome from reserves.
 * Uses reciprocal approach to avoid overflow with 3-4 outcomes.
 */
export function calculatePrices(reserves: number[]): number[] {
  const n = reserves.length;
  if (n < 2) return [PRECISION];
  if (reserves.some((r) => r <= 0)) return reserves.map(() => Math.round(PRECISION / n));

  const reciprocals = reserves.map((r) => 1 / r);
  const sumReciprocals = reciprocals.reduce((acc, v) => acc + v, 0);
  if (sumReciprocals === 0) return reserves.map(() => Math.round(PRECISION / n));

  return reciprocals.map((inv) => Math.round((inv / sumReciprocals) * PRECISION));
}

/**
 * Compute EXACT shares matching the deployed contract's u128 integer division.
 * Takes raw amount (before fees) — the same value sent as `amount` to the contract.
 * outcomeIndex is 0-based (frontend convention).
 */
export function estimateBuySharesExact(
  reserves: number[],
  outcomeIndex: number,
  amount: number
): bigint {
  const n = reserves.length;
  if (outcomeIndex < 0 || outcomeIndex >= n || amount <= 0) return 0n;

  const amountBig = BigInt(Math.floor(amount));

  // Fee calculation matching contract: protocol + creator fees deducted before pool
  const protocolFee = amountBig * PROTOCOL_FEE_BPS / BPS_BASE;
  const creatorFee = amountBig * CREATOR_FEE_BPS / BPS_BASE;
  const amountAfterFee = amountBig - protocolFee - creatorFee;

  const r = reserves.map(v => BigInt(v));
  const rn = r.map(v => v + amountAfterFee);

  // Step division matching contract order:
  // For outcome i, iterate j in {0..n-1}\{i} in ascending order
  // val = reserve_i, then val = val * reserve_j / rn_j
  let val = r[outcomeIndex];
  for (let j = 0; j < n; j++) {
    if (j === outcomeIndex) continue;
    val = val * r[j] / rn[j]; // BigInt truncation matches Leo u128 division
  }

  return rn[outcomeIndex] - val;
}

/**
 * Estimate shares received for a buy order (number version for UI display).
 * Takes raw amount (before fees).
 */
export function estimateBuyShares(
  reserves: number[],
  outcomeIndex: number,
  amount: number
): number {
  return Number(estimateBuySharesExact(reserves, outcomeIndex, amount));
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
    if (den <= 0) return Infinity;
    step = (step * rk) / den;
  }

  const riNew = step;
  const sharesNeeded = riNew - reserves[outcomeIndex] + tokensDesired;
  return Math.ceil(sharesNeeded);
}

/**
 * Calculate fees for a trade — matches contract's fee math.
 * fee = amount * 200 / 10000 (2% total)
 */
export function calculateFees(amount: number) {
  const totalFee = Math.floor(amount * 200 / 10000);
  const protocolFee = Math.floor(totalFee * 50 / 200);
  const creatorFee = Math.floor(totalFee * 50 / 200);
  const lpFee = totalFee - protocolFee - creatorFee;
  const amountAfterFee = amount - totalFee;

  return { protocolFee, creatorFee, lpFee, totalFee, amountAfterFee };
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
  const { amountAfterFee } = calculateFees(amount);

  if (isBuy) {
    const n = reserves.length;
    let step = reserves[outcomeIndex];
    for (let k = 0; k < n; k++) {
      if (k === outcomeIndex) continue;
      step = (step * reserves[k]) / (reserves[k] + amountAfterFee);
      newReserves[k] = reserves[k] + amountAfterFee;
    }
    newReserves[outcomeIndex] = step;
  }

  const pricesAfter = calculatePrices(newReserves);
  const priceAfter = pricesAfter[outcomeIndex] / PRECISION;

  return Math.abs(priceAfter - priceBefore) / priceBefore;
}
