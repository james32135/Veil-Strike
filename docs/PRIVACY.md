# Privacy Model

## Overview

Veil Strike provides **partial privacy** for prediction market traders on Aleo. The protocol uses Aleo's record system to keep position ownership private, while market mechanics remain transparent for fair pricing.

## What IS Private

### 1. Position Ownership (Private Records)

All user-facing assets are stored as Aleo **private records**, encrypted and visible only to the record owner:

- `SharePosition` — your shares (market, outcome, amount) — only YOU can see
- `LPReceipt` — your LP deposit proof — only YOU can see
- `WinReceipt` — your winning payout proof — only YOU can see
- `RefundReceipt` — your refund claim — only YOU can see
- `DisputeBondReceipt` — your dispute collateral — only YOU can see

### 2. Payout Privacy

Winnings are paid via `credits.aleo/transfer_public_to_private`:

```
transition redeem_shares(position: SharePosition) -> (WinReceipt, credits.aleo/credits, Future) {
    // Payout goes to a PRIVATE credits record
    // Nobody on-chain can see who received the payout
    let (payout, f2) = credits.aleo/transfer_public_to_private(self.caller, payout_u64);
}
```

This means **nobody can see who won or how much they redeemed**.

### 3. Address Pseudonymity

Your Aleo address is visible on the deposit transaction, but:
- Aleo addresses are pseudonymous (not linked to real identity)
- You can generate new addresses for different bets
- Position records are encrypted — observers can't see what you bet on

## What IS Public (Transparent)

### 1. Deposit Amount

The `buy_shares` function uses `credits.aleo/transfer_public_as_signer`:
- **Visible**: that address X sent Y amount to the contract
- **Required**: Shield Wallet requires public signing for transaction authorization
- **Mitigation**: The amount alone doesn't reveal your position

### 2. Finalize Parameters

The on-chain finalize function receives these parameters publicly:
- `market_id` — which market you're trading on
- `amount` — how much you're paying
- `outcome_index` — which outcome you chose
- `expected_shares` — how many shares you expect

**This means an on-chain observer CAN see what outcome you bet on.**

### 3. Market State

By design, these are public for fair pricing:
- Pool reserves (needed for FPMM pricing)
- Total volume per market
- Fee accumulation
- Market status and deadlines

## Privacy Comparison

| Privacy Aspect | Veil Strike | Polymarket | Augur |
|---|---|---|---|
| Position Records | ✅ Private (encrypted records) | ❌ Public ERC-1155 | ❌ Public |
| Payout Privacy | ✅ Private (transfer_public_to_private) | ❌ Public | ❌ Public |
| Bet Direction | ⚠️ Visible in finalize | ❌ Public | ❌ Public |
| Deposit Amount | ⚠️ Public (transfer_public_as_signer) | ❌ Public | ❌ Public |
| Portfolio View | ✅ Only owner can decrypt | ❌ Anyone can view | ❌ Anyone can view |
| Market State | Public (for fair pricing) | Public | Public |

## Future Privacy Improvements

To achieve full privacy, the contract would need:

1. **Private deposits**: Use `transfer_private_to_public` instead of `transfer_public_as_signer` (requires wallet support for private credits)
2. **Hidden outcome selection**: Use a commit-reveal scheme or pass outcome via encrypted record input rather than as a finalize parameter
3. **Homomorphic reserve updates**: Update reserves without revealing which outcome was traded

## Summary

Veil Strike is **more private than any EVM prediction market** (Polymarket, Augur, etc.) because:
- Your share positions are encrypted records — only you can see your portfolio
- Your payouts go to private records — nobody sees who won
- Your address is pseudonymous

However, it's not fully private: the deposit transaction and finalize parameters reveal your bet direction to on-chain observers. This is a trade-off for Shield Wallet compatibility and FPMM mechanics.
