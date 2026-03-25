import { PROGRAM_ID, PROGRAM_ID_CX, PROGRAM_ID_SD, TRANSITIONS } from '@/constants';
import type { TokenType } from '@/constants';
import type { AleoTransaction } from '@/types';

/**
 * Get program ID for a given token type.
 * ALEO → main, USDCX → cx, USAD → sd
 */
function getProgramId(tokenType: TokenType = 'ALEO'): string {
  switch (tokenType) {
    case 'USDCX': return PROGRAM_ID_CX;
    case 'USAD': return PROGRAM_ID_SD;
    default: return PROGRAM_ID;
  }
}

/**
 * Build an Aleo transaction input object for Shield Wallet.
 * privateFee: false is CRITICAL for Shield compatibility.
 */
function buildTransaction(
  functionName: string,
  inputs: string[],
  fee: number = 500_000,
  tokenType: TokenType = 'ALEO'
): AleoTransaction {
  return {
    programId: getProgramId(tokenType),
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

export function buildBuySharesTx(
  marketId: string,
  outcome: number,
  amount: string,
  expectedShares: string,
  minShares: string,
  nonce: string,
  creditsRecord: string
): AleoTransaction {
  const outcomeOnChain = outcome + 1;
  return buildTransaction(TRANSITIONS.BUY_SHARES, [
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
  maxSharesUsed: string,
  tokenType: TokenType = 'ALEO'
): AleoTransaction {
  return buildTransaction(TRANSITIONS.SELL_SHARES, [
    sharesRecord,
    tokensDesired,
    maxSharesUsed,
  ], 1_000_000, tokenType);
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

// ========== Stablecoin Transactions (USDCx / USAD) ==========

export function buildCreateMarketStableTx(
  tokenType: 'USDCX' | 'USAD',
  questionHash: string,
  category: number,
  numOutcomes: number,
  deadline: string,
  resolutionDeadline: string,
  resolver: string,
  initialLiquidity: string,
  nonce: string,
  tokenRecord: string,
  proofs: string
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
    tokenRecord,
    proofs,
  ], 2_000_000, tokenType);
}

export function buildBuySharesStableTx(
  tokenType: 'USDCX' | 'USAD',
  marketId: string,
  outcome: number,
  amount: string,
  expectedShares: string,
  minShares: string,
  nonce: string,
  tokenRecord: string,
  proofs: string
): AleoTransaction {
  const outcomeOnChain = outcome + 1;
  return buildTransaction(TRANSITIONS.BUY_SHARES, [
    marketId,
    `${outcomeOnChain}u8`,
    amount,
    expectedShares,
    minShares,
    nonce,
    tokenRecord,
    proofs,
  ], 1_000_000, tokenType);
}

export function buildAddLiquidityStableTx(
  tokenType: 'USDCX' | 'USAD',
  marketId: string,
  amount: string,
  expectedLpShares: string,
  nonce: string,
  tokenRecord: string,
  proofs: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.ADD_LIQUIDITY, [
    marketId,
    amount,
    expectedLpShares,
    nonce,
    tokenRecord,
    proofs,
  ], 1_000_000, tokenType);
}

// ========== Market Lifecycle (token-type-aware) ==========

export function buildCloseMarketTx(marketId: string, tokenType: TokenType = 'ALEO'): AleoTransaction {
  return buildTransaction(TRANSITIONS.CLOSE_MARKET, [marketId], 500_000, tokenType);
}

export function buildResolveMarketTx(marketId: string, winningOutcome: number, tokenType: TokenType = 'ALEO'): AleoTransaction {
  return buildTransaction(TRANSITIONS.RESOLVE_MARKET, [marketId, `${winningOutcome}u8`], 500_000, tokenType);
}

export function buildFinalizeResolutionTx(marketId: string, tokenType: TokenType = 'ALEO'): AleoTransaction {
  return buildTransaction(TRANSITIONS.FINALIZE_RESOLUTION, [marketId], 500_000, tokenType);
}

export function buildCancelMarketTx(marketId: string, tokenType: TokenType = 'ALEO'): AleoTransaction {
  return buildTransaction(TRANSITIONS.CANCEL_MARKET, [marketId], 500_000, tokenType);
}

export function buildFlashSettleTx(marketId: string, winningOutcome: number, tokenType: TokenType = 'ALEO'): AleoTransaction {
  return buildTransaction(TRANSITIONS.SETTLE_ROUND, [marketId, `${winningOutcome}u8`], 500_000, tokenType);
}

// ========== Dispute (bond always in ALEO credits, but sent to correct program) ==========

export function buildDisputeResolutionTx(
  marketId: string,
  proposedOutcome: number,
  nonce: string,
  creditsRecord: string,
  tokenType: TokenType = 'ALEO'
): AleoTransaction {
  return buildTransaction(TRANSITIONS.DISPUTE, [
    marketId,
    `${proposedOutcome}u8`,
    nonce,
    creditsRecord,
  ], 1_000_000, tokenType);
}

export function buildClaimDisputeBondTx(receiptRecord: string, tokenType: TokenType = 'ALEO'): AleoTransaction {
  return buildTransaction(TRANSITIONS.CLAIM_DISPUTE_BOND, [receiptRecord], 500_000, tokenType);
}

// ========== Redemption (token-type-aware) ==========

export function buildRedeemSharesTx(sharesRecord: string, tokenType: TokenType = 'ALEO'): AleoTransaction {
  return buildTransaction(TRANSITIONS.REDEEM, [sharesRecord], 1_000_000, tokenType);
}

export function buildClaimRefundTx(sharesRecord: string, tokenType: TokenType = 'ALEO'): AleoTransaction {
  return buildTransaction(TRANSITIONS.CLAIM_REFUND, [sharesRecord], 1_000_000, tokenType);
}

export function buildWithdrawLpTx(lpTokenRecord: string, minTokensOut: string, tokenType: TokenType = 'ALEO'): AleoTransaction {
  return buildTransaction(TRANSITIONS.WITHDRAW_LP, [lpTokenRecord, minTokensOut], 1_000_000, tokenType);
}

export function buildWithdrawCreatorFeesTx(marketId: string, expectedAmount: string, tokenType: TokenType = 'ALEO'): AleoTransaction {
  return buildTransaction(TRANSITIONS.WITHDRAW_CREATOR_FEES, [marketId, expectedAmount], 500_000, tokenType);
}

// ========== Governance (main program only) ==========

export function buildSubmitProposalTx(
  actionType: number,
  targetMarket: string,
  amount: string,
  recipient: string,
  tokenType: number,
  voteDeadline: string,
  nonce: string
): AleoTransaction {
  return buildTransaction(TRANSITIONS.SUBMIT_PROPOSAL, [
    `${actionType}u8`,
    targetMarket,
    `${amount}u128`,
    recipient,
    `${tokenType}u8`,
    `${voteDeadline}u32`,
    nonce,
  ], 500_000);
}

export function buildCastVoteTx(
  proposalId: string,
  support: boolean
): AleoTransaction {
  return buildTransaction(TRANSITIONS.CAST_VOTE, [
    proposalId,
    `${support}`,
  ], 500_000);
}

// ========== Legacy compat aliases ==========
export const buildBuySharesPrivateTx = buildBuySharesTx;
export const buildCreateMarketUsdcxTx = (
  questionHash: string, category: number, numOutcomes: number,
  deadline: string, resolutionDeadline: string, resolver: string,
  initialLiquidity: string, nonce: string, tokenRecord: string, proofs: string
) => buildCreateMarketStableTx('USDCX', questionHash, category, numOutcomes, deadline, resolutionDeadline, resolver, initialLiquidity, nonce, tokenRecord, proofs);
export const buildBuySharesUsdcxTx = (
  marketId: string, outcome: number, amount: string, expectedShares: string,
  minShares: string, nonce: string, tokenRecord: string, proofs: string
) => buildBuySharesStableTx('USDCX', marketId, outcome, amount, expectedShares, minShares, nonce, tokenRecord, proofs);
export const buildSellSharesUsdcxTx = (sharesRecord: string, tokensDesired: string, maxSharesUsed: string) => buildSellSharesTx(sharesRecord, tokensDesired, maxSharesUsed, 'USDCX');
export const buildAddLiquidityUsdcxTx = (
  marketId: string, amount: string, expectedLpShares: string,
  nonce: string, tokenRecord: string, proofs: string
) => buildAddLiquidityStableTx('USDCX', marketId, amount, expectedLpShares, nonce, tokenRecord, proofs);
export const buildRedeemSharesUsdcxTx = (sharesRecord: string) => buildRedeemSharesTx(sharesRecord, 'USDCX');
export const buildClaimRefundUsdcxTx = (sharesRecord: string) => buildClaimRefundTx(sharesRecord, 'USDCX');
export const buildWithdrawLpResolvedTx = (lpTokenRecord: string, minTokensOut: string) => buildWithdrawLpTx(lpTokenRecord, minTokensOut);
export const buildWithdrawLpResolvedUsdcxTx = (lpTokenRecord: string, minTokensOut: string) => buildWithdrawLpTx(lpTokenRecord, minTokensOut, 'USDCX');
export const buildClaimLpRefundTx = (lpTokenRecord: string, minTokensOut: string) => buildWithdrawLpTx(lpTokenRecord, minTokensOut);
export const buildClaimLpRefundUsdcxTx = (lpTokenRecord: string, minTokensOut: string) => buildWithdrawLpTx(lpTokenRecord, minTokensOut, 'USDCX');
export const buildWithdrawFeesUsdcxTx = (marketId: string, expectedAmount: string) => buildWithdrawCreatorFeesTx(marketId, expectedAmount, 'USDCX');

/**
 * Generate a random nonce for transactions.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${BigInt('0x' + hex) % BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001')}field`;
}
