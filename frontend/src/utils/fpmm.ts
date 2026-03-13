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
 * Must match contract math: p = tokens_desired - lp_fee, where lp_fee = tokens_desired * 100 / 10000
 */
export function estimateSellShares(
  reserves: number[],
  outcomeIndex: number,
  tokensDesired: number
): number {
  const n = reserves.length;
  if (outcomeIndex < 0 || outcomeIndex >= n) return 0;
  if (tokensDesired <= 0) return 0;

  // Contract: pool_tokens_out = tokens_desired - lp_fee
  const lpFee = Math.floor(tokensDesired * 100 / 10000);
  const p = tokensDesired - lpFee;

  let step = reserves[outcomeIndex];

  for (let k = 0; k < n; k++) {
    if (k === outcomeIndex) continue;
    const rk = reserves[k];
    const den = rk - p;
    if (den <= 0) return Infinity;
    step = Math.floor((step * rk) / den);
  }

  const riNew = step;
  const sharesNeeded = riNew - reserves[outcomeIndex] + p;
  return Math.ceil(sharesNeeded);
}

/**
 * Estimate the maximum tokens you can receive for selling `sharesToSell` shares.
 * Uses binary search since FPMM sell is not easily invertible.
 * Returns { tokensOut, sharesUsed } where tokensOut is the safe tokens_desired
 * and sharesUsed is how many shares the AMM will consume.
 */
export function estimateSellTokensOut(
  reserves: number[],
  outcomeIndex: number,
  sharesToSell: number
): { tokensOut: number; sharesUsed: number } {
  const n = reserves.length;
  if (outcomeIndex < 0 || outcomeIndex >= n || sharesToSell <= 0) {
    return { tokensOut: 0, sharesUsed: 0 };
  }

  // Contract fees: protocol 0.5% + creator 0.5% + LP 1.0% = 2% total
  // pool_tokens_out = tokens_desired - lp_fee = tokens_desired * (1 - 100/10000)
  // The constraint is: pool_tokens_out < min(non-target reserves)

  // Max pool_tokens_out must be < smallest non-target reserve
  let minNonTargetReserve = Infinity;
  for (let k = 0; k < n; k++) {
    if (k === outcomeIndex) continue;
    minNonTargetReserve = Math.min(minNonTargetReserve, reserves[k]);
  }
  // pool_tokens_out = tokens_desired - (tokens_desired * 100 / 10000) = tokens_desired * 0.99
  // So tokens_desired < minReserve / 0.99. Use 90% as safety margin.
  const maxTokensDesired = Math.floor((minNonTargetReserve / 0.99) * 0.90);

  // Binary search for the largest tokens_desired where sharesNeeded <= sharesToSell
  let lo = 0;
  let hi = maxTokensDesired;
  let bestTokens = 0;
  let bestShares = 0;

  for (let iter = 0; iter < 60; iter++) {
    if (lo > hi) break;
    const mid = Math.floor((lo + hi) / 2);
    if (mid <= 0) break;
    const needed = estimateSellShares(reserves, outcomeIndex, mid);
    if (needed <= sharesToSell && isFinite(needed)) {
      bestTokens = mid;
      bestShares = needed;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return { tokensOut: bestTokens, sharesUsed: bestShares };
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
