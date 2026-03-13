import { PROGRAM_ID, TRANSITIONS } from '@/constants';
import type { AleoTransaction } from '@/types';

/**
 * Build an Aleo transaction input object for Shield Wallet.
 * privateFee: false is CRITICAL for Shield compatibility.
 */
function buildTransaction(
  functionName: string,
  inputs: string[],
  fee: number = 500_000
): AleoTransaction {
  return {
    programId: PROGRAM_ID,
    functionName,
    inputs,
    fee,
    privateFee: false,
  };
}

// ========== ALEO Credit Transactions ==========

export function buildCreateMarketTx(
  questionHash: string,
  category: number,
  numOutcomes: number,
  deadline: string,
  initialLiquidity: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.CREATE_MARKET, [
    questionHash,
    `${category}u8`,
    `${numOutcomes}u8`,
    deadline,
    initialLiquidity,
    nonce,
  ], 2_000_000);
}

export function buildBuySharesTx(
  amount: string,
  marketId: string,
  outcome: number,
  expectedShares: string,
  minShares: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.BUY_SHARES, [
    amount,
    marketId,
    `${outcome}u8`,
    expectedShares,
    minShares,
    nonce,
  ], 1_000_000);
}

export function buildSellSharesTx(
  tokensDesired: string,
  maxSharesUsed: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.SELL_SHARES, [
    tokensDesired,
    maxSharesUsed,
  ], 1_000_000);
}

export function buildAddLiquidityTx(
  amount: string,
  marketId: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.ADD_LIQUIDITY, [
    amount,
    marketId,
    nonce,
  ], 1_000_000);
}

export function buildRedeemSharesTx(
  marketId: string,
  outcomeIndex: number,
  shareAmount: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.REDEEM, [
    marketId,
    `${outcomeIndex}u8`,
    shareAmount,
    nonce,
  ], 1_000_000);
}

// ========== USDCx Transactions ==========

export function buildCreateMarketUsdcxTx(
  questionHash: string,
  category: number,
  numOutcomes: number,
  deadline: string,
  initialLiquidity: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.CREATE_MARKET_USDCX, [
    questionHash,
    `${category}u8`,
    `${numOutcomes}u8`,
    deadline,
    initialLiquidity,
    nonce,
  ], 2_000_000);
}

export function buildBuySharesUsdcxTx(
  amount: string,
  marketId: string,
  outcome: number,
  expectedShares: string,
  minShares: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.BUY_SHARES_USDCX, [
    amount,
    marketId,
    `${outcome}u8`,
    expectedShares,
    minShares,
    nonce,
  ], 1_000_000);
}

export function buildAddLiquidityUsdcxTx(
  amount: string,
  marketId: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.ADD_LIQUIDITY_USDCX, [
    amount,
    marketId,
    nonce,
  ], 1_000_000);
}

export function buildRedeemSharesUsdcxTx(
  marketId: string,
  outcomeIndex: number,
  shareAmount: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.REDEEM_USDCX, [
    marketId,
    `${outcomeIndex}u8`,
    shareAmount,
    nonce,
  ], 1_000_000);
}

/**
 * Generate a random nonce for transactions.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${BigInt('0x' + hex) % BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001')}field`;
}
