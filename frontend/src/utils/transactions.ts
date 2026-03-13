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

// ========== ALEO Credit Transactions (Privacy-first) ==========

export function buildCreateMarketTx(
  questionHash: string,
  category: number,
  numOutcomes: number,
  deadline: string,
  resolutionDeadline: string,
  resolver: string,
  initialLiquidity: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.CREATE_MARKET, [
    questionHash,
    `${category}u8`,
    `${numOutcomes}u8`,
    deadline,
    resolutionDeadline,
    resolver,
    initialLiquidity,
    nonce,
  ], 2_000_000);
}

export function buildBuySharesPrivateTx(
  marketId: string,
  outcome: number,
  amount: string,
  expectedShares: string,
  minShares: string,
  nonce: string,
  creditsRecord: string
): AleoTransaction {
  // Contract uses 1-based outcome indices (1-4)
  const outcomeOnChain = outcome + 1;
  return buildTransaction(TRANSITIONS.BUY_SHARES_PRIVATE, [
    marketId,
    `${outcomeOnChain}u8`,
    amount,
    expectedShares,
    minShares,
    nonce,
    creditsRecord,
  ], 1_000_000);
}

export function buildSellSharesTx(
  sharesRecord: string,
  tokensDesired: string,
  maxSharesUsed: string
): AleoTransaction {
  // sell_shares(shares: OutcomeShare, tokens_desired: u128, max_shares_used: u128)
  return buildTransaction(TRANSITIONS.SELL_SHARES, [
    sharesRecord,
    tokensDesired,
    maxSharesUsed,
  ], 1_000_000);
}

export function buildSellSharesUsdcxTx(
  sharesRecord: string,
  tokensDesired: string,
  maxSharesUsed: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.SELL_SHARES_USDCX, [
    sharesRecord,
    tokensDesired,
    maxSharesUsed,
  ], 1_000_000);
}

export function buildAddLiquidityTx(
  marketId: string,
  amount: string,
  expectedLpShares: string,
  nonce: string,
  creditsRecord: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.ADD_LIQUIDITY, [
    marketId,
    amount,
    expectedLpShares,
    nonce,
    creditsRecord,
  ], 1_000_000);
}

// ========== USDCx Transactions ==========

export function buildCreateMarketUsdcxTx(
  questionHash: string,
  category: number,
  numOutcomes: number,
  deadline: string,
  resolutionDeadline: string,
  resolver: string,
  initialLiquidity: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.CREATE_MARKET_USDCX, [
    questionHash,
    `${category}u8`,
    `${numOutcomes}u8`,
    deadline,
    resolutionDeadline,
    resolver,
    initialLiquidity,
    nonce,
  ], 2_000_000);
}

export function buildBuySharesUsdcxTx(
  marketId: string,
  outcome: number,
  amount: string,
  expectedShares: string,
  minShares: string,
  nonce: string
): AleoTransaction {
  const outcomeOnChain = outcome + 1;
  return buildTransaction(TRANSITIONS.BUY_SHARES_USDCX, [
    marketId,
    `${outcomeOnChain}u8`,
    amount,
    expectedShares,
    minShares,
    nonce,
  ], 1_000_000);
}

export function buildAddLiquidityUsdcxTx(
  marketId: string,
  amount: string,
  expectedLpShares: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.ADD_LIQUIDITY_USDCX, [
    marketId,
    amount,
    expectedLpShares,
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
