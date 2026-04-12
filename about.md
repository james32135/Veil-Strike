# ⚔️ VEIL STRIKE

> 🌐 **Live on Aleo Mainnet** · [Launch App](https://veil-strike.netlify.app) · [Explorer](https://explorer.provable.com/program/veil_strike_v7.aleo)

---

## 💡 What Is Veil Strike?

Veil Strike is a **zero-knowledge prediction market protocol** deployed on **Aleo Mainnet**. Users trade outcomes on real-world events — crypto prices, sports, politics, science, entertainment — with **complete on-chain privacy** powered by zero-knowledge proofs.

Unlike existing prediction markets (Polymarket, Azuro), **every bet, position, and payout on Veil Strike is encrypted**. No one can see what you bet, how much you bet, or how much you won. The protocol uses Aleo's native ZK architecture so privacy isn't an add-on — it's the foundation.

**No KYC. No wallet tracking. No public bet history. Just markets and privacy.**

---

## 🔒 Privacy Architecture

Veil Strike delivers **four layers of privacy** that no other prediction market offers:

| Layer | Privacy Level | How It Works |
|-------|:---:|---|
| 🟢 **Identity** | Private | ZK-encrypted — your address never appears on-chain |
| 🟢 **Positions** | Private | Encrypted `OutcomeShare` records only you can decrypt |
| 🟢 **Payouts** | Private | Winnings delivered via ZK private transfer |
| 🟢 **LP Tokens** | Private | Encrypted `LPToken` records for liquidity providers |
| 🔴 **Market State** | Public | Required for fair AMM pricing and transparency |

**Why does this matter?** On Polymarket, anyone can see your wallet, your bets, and your PnL. Whales get front-run. Positions get copied. On Veil Strike, you're invisible.

---

## 🔗 Why Aleo?

Aleo is the only Layer-1 blockchain built natively for zero-knowledge proofs. Unlike Ethereum rollups or privacy mixers, Aleo encrypts **all state by default**. Every record, every transfer, every computation happens inside a ZK circuit.

Veil Strike leverages this to deliver:
- **Encrypted records** — bets and payouts stored as private Aleo records
- **No front-running** — position data is invisible to validators and MEV bots
- **Compliance-ready** — users can optionally share view keys for auditing
- **Sub-minute proving** — delegated proving via Provable API (~15-30s per tx)

---

## 📜 Smart Contracts — 53 On-Chain Transitions

Three Leo v4 programs deployed on Aleo Mainnet, split to stay under the 2.1M variable limit:

| Program | Purpose | Transitions |
|---------|---------|:-----------:|
| `veil_strike_v7.aleo` | ALEO markets + Governance + Resolver Registry | 23 |
| `veil_strike_v7_cx.aleo` | USDCx stablecoin markets | 15 |
| `veil_strike_v7_sd.aleo` | USAD stablecoin markets | 15 |

**Key transitions:** `open_market` · `acquire_shares` · `dispose_shares` · `flash_settle` · `harvest_winnings` · `submit_proposal` · `cast_vote` · `execute_proposal` · `register_resolver` · `contest_verdict` · `emergency_pause`

---

## 💵 Stablecoins — USDCx & USAD

Trade with **privacy-native stablecoins** on Aleo:

🔵 **USDCx** — Backed 1:1 by USDC via Circle xReserve. Bridge USDC from Ethereum to Aleo.
Mint at [usdcx.aleo.org](https://usdcx.aleo.org) · [Learn more](https://aleo.org/usdcx/)

🟢 **USAD** — Backed 1:1 by USDG via Paxos Labs (Global Dollar Network). Bridge USDG from Ethereum.
Mint at [usad.aleo.org](https://usad.aleo.org) · [Learn more](https://aleo.org/usad/)

Both stablecoins feature **encrypted balances and transfers** by default on Aleo. Your holdings are invisible to everyone except you.

---

## ⚡ Strike Rounds — 5-Minute Lightning Markets

The flagship feature: **automated 5-minute prediction rounds** on BTC, ETH, and ALEO prices.

- 🤖 Bot creates 3 concurrent USDCx rounds automatically
- ⏱️ Each round locks after 5 minutes, settles via oracle price comparison
- 🔄 Settlement + next round creation is fully automated 24/7
- 🛡️ Delegated proving handles ZK proofs (~15-30s per transaction)
- 📊 Oracle feeds from 7 sources with automatic fallback chain
- 📡 Real-time SSE price streaming for instant chart updates

**How it works:** Bet UP or DOWN on whether BTC/ETH/ALEO price will rise or fall in 5 minutes. If you're right, claim your encrypted winnings instantly.

---

## 🏛️ On-Chain Governance

Fully decentralized governance with on-chain execution:

- 📝 Submit proposals with 5 ALEO bond
- 🗳️ Community votes with quorum of 3
- ⏳ 2-hour timelock after vote deadline before execution
- ⚙️ Execute approved actions: fee changes, resolver approvals, treasury withdrawals
- 🔒 Emergency pause/unpause for deployer-only circuit breaker

---

## 🏗️ Architecture

```
Frontend  → React 18 + Vite + TypeScript + Tailwind + Framer Motion
Backend   → Express + PostgreSQL (10 tables) + 7-source oracle
Services  → Delegated Prover · Round Bot · Record Scanner · Chain Executor
Contracts → 3 Leo v4 programs on Aleo Mainnet (53 transitions)
Wallet    → Shield Wallet (Aleo native)
```

## 🖥️ Platform (14+ Pages)

Landing · Markets · Trade · Strike Rounds · Series Charts · Portfolio · Create Market · Governance · Leaderboard · Pools · Stats · Admin · Docs · FAQ

## ✅ What's Working

- 53 on-chain transitions on Aleo Mainnet (Leo v4)
- USDCx Strike Rounds — 5-min auto cycles with delegated proving
- FPMM AMM with complete-set minting and dynamic fees
- 12-hour dispute window with 5 ALEO bond
- Executable governance (quorum 3, timelock 2h)
- Resolver registry with 10 ALEO staking requirement
- Emergency pause/unpause controls
- Polymarket-style series with live candlestick charts
- 7-source oracle fallback chain (CoinGecko → OKX → KuCoin → Gate.io → Binance → CoinCap → CryptoCompare)
- Delegated proving via Provable API (~15-30s per tx)
- Production stability hardening (fetch timeouts, WASM cache, graceful recovery)
- Elite animated landing page with parallax, spotlight cursor, glass-morphism

---

*⚔️ Aleo Mainnet · Real tokens · Trade responsibly*
