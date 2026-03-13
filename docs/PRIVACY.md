# Privacy Model

## Design Principles

Veil Strike achieves end-to-end privacy for prediction market traders on Aleo. The core principle: **no user address should ever appear in public on-chain state** (except the protocol admin for admin-only operations).

## Privacy Mechanisms

### 1. Private Records

All user-facing data is stored as Aleo **private records**, visible only to the record owner:

- `SharePosition` — outcome shares with market ID, outcome index, and amount
- `PoolMembership` — pool contribution with share percentage
- `LPReceipt` — liquidity provider deposit receipt
- `WinReceipt` — proof of winning redemption
- `RefundReceipt` — proof of refund claim
- `StreakRecord` — personal win streak counter
- `DisputeBond` — dispute collateral receipt

### 2. Deposit Privacy

Credits are deposited using `credits.aleo/transfer_private_to_public`:

```
transition buy_shares_private(
    payment: credits.aleo/credits,
    ...
) -> (..., Future) {
    // Deposits credits to the program's public balance
    // The depositor's address is NOT revealed on-chain
    let deposit: Future = credits.aleo/transfer_private_to_public(
        payment, self.address, amount
    );
    ...
}
```

This function takes a **private** credits record as input and transfers to a **public** balance. The sender's address is hidden by the ZK proof.

### 3. Payout Privacy

Winnings are paid out using `credits.aleo/transfer_public_to_private`:

```
transition redeem_shares(
    position: SharePosition,
    ...
) -> (credits.aleo/credits, ..., Future) {
    // Pays from program's public balance to user's private record
    // The recipient's address is NOT revealed on-chain
    let payout: Future = credits.aleo/transfer_public_to_private(
        self.caller, payout_amount
    );
    ...
}
```

### 4. Market ID Generation

Market IDs are derived from a nonce only — never from the creator's address:

```
let market_id: field = BHP256::hash_to_field(nonce);
```

This prevents anyone from linking a market back to its creator.

### 5. Finalize Isolation

The `finalize` functions update global state (reserves, volumes, fees) but never receive user addresses as inputs. The only exception is the admin address verification in admin-only transitions like `update_oracle_prices`.

### 6. What IS Public

The following data IS visible on-chain (by design, for market functionality):

- Market reserves (needed for FPMM pricing)
- Total volume and trade counts per market
- Oracle prices (needed for lightning resolution)
- Protocol fee accumulation
- Market end times and status

### 7. What is NOT Public

The following data is NEVER visible on-chain:

- Who bought/sold shares
- How many shares any individual holds
- Profit/loss of any individual
- Who created a market
- Who deposited or withdrew credits
- Trading history of any address

## Attack Vectors Considered

### Timing Analysis
An observer could try to correlate transaction timing with real-world events. Mitigation: Aleo's network-level transaction batching provides some protection.

### Amount Analysis
Large trades could be identifiable by their on-chain reserve changes. Mitigation: reserves update atomically in finalize, and multiple trades in the same block are indistinguishable.

### Creator Deanonymization
Market creation could reveal the creator. Mitigation: Market IDs use nonce-only hashing, and creator addresses never appear in finalize.

## Comparison with Other Platforms

| Feature | Veil Strike | Polymarket | Augur |
|---|---|---|---|
| Deposit Privacy | ✅ Hidden | ❌ Public | ❌ Public |
| Position Privacy | ✅ Private records | ❌ Public ERC-1155 | ❌ Public |
| Payout Privacy | ✅ Hidden | ❌ Public | ❌ Public |
| Creator Privacy | ✅ Hidden | ❌ Public | ❌ Public |
| Market Transparency | ✅ Reserves public | ✅ Full | ✅ Full |
