# ⚔️ VEIL STRIKE — Privacy-First Prediction Markets on Aleo

> **Wave 4 Submission · Aleo Developer Program**
> 🌐 Live: https://veil-strike.netlify.app · ⚡ API: https://veil-strike-api.onrender.com/api/health

---

## 🧠 The Problem

Every major prediction market — Polymarket, Augur, Azuro — leaks everything on-chain: your wallet, position, bet size, payout, strategy. This enables front-running, whale-watching, and identity correlation. **Financial privacy is a fundamental right.**

---

## 💡 The Solution — Veil Strike

Veil Strike is a **zero-knowledge prediction market protocol** on **Aleo**. Every trade, every position, and every payout is protected by ZK proofs. No one — not even the protocol — can see what you bet, how much you hold, or what you won.

**What makes it different:**
- 🔒 Positions stored as **encrypted on-chain records** — only the holder can decrypt
- 📊 **FPMM AMM** — no order books, no front-running possible
- ⚡ **Strike Rounds** — 24h to 30-day price prediction rounds (UP/DOWN on BTC, ETH, ALEO)
- 🏛️ **On-chain Governance** — propose, vote, and execute protocol changes
- 🎯 **Multi-outcome markets** — 2, 3, or 4 outcomes per market
- 💰 **Triple token support** — ALEO, USDCx, USAD
- ⚖️ **Admin resolution** — oracle shows start vs end price, admin calls `flash_settle` via wallet

---

## 📜 Smart Contracts (Wave 4)

**3 Leo programs deployed on Aleo Testnet** — split to overcome Aleo's 2.1M variable limit:

| Program | Token | TX |
|---------|-------|----|
| `veil_strike_v6.aleo` | ALEO + Governance (17 transitions) | `at1459u3ehmatrnk8huk5wj4dtfw668fml6kga62rkw0m4wpnfrxvqs79ey84` |
| `veil_strike_v6_cx.aleo` | USDCx (15 transitions) | `at1g4py5xd8htpnalkm07axnahp5gyxj57jgm5cj9dqfxeeqckdzs8qpguzw9` |
| `veil_strike_v6_sd.aleo` | USAD (15 transitions) | `at1yupukl8wynnu748u95scnqztqk33nwema3lxy7dfw7jm694cucyshswksx` |

**Total: 47 transitions · 3,110,926 variables · 2,856 statements**

**Key transitions:** `open_market` (create) · `acquire_shares` (private buy) · `dispose_shares` (private sell) · `fund_pool` (LP) · `flash_settle` (instant Strike resolution) · `render_verdict` / `ratify_verdict` (event resolution) · `contest_verdict` (dispute with 5 ALEO bond) · `harvest_winnings` (private payout) · `submit_proposal` + `cast_vote` (governance)

---

## 🔒 Privacy Architecture

```
Buy:   private credits → transfer_private_to_public → encrypted OutcomeShare record
Sell:  OutcomeShare record → AMM → transfer_public_to_private → private credits
Claim: OutcomeShare (winning) → harvest_winnings → private credits
```

| Layer | Privacy |
|-------|---------|
| Trader identity | 🟢 Fully private (ZK-encrypted) |
| Position sizes | 🟢 Encrypted record — invisible on-chain |
| LP + Dispute bonds | 🟢 Encrypted LPToken / DisputeBondReceipt records |
| All payouts | 🟢 Private credits via ZK transfer |
| Market state / outcome | 🔴 Public (required for fair AMM) |

---

## 🏗️ Full-Stack Architecture

```
Frontend  →  React 18 + Vite + TypeScript + Tailwind + Zustand + Shield Wallet
Backend   →  Express + Node.js
               ├── 7-source oracle fallback (CoinGecko → OKX → Binance → CoinCap → ...)
               ├── Auto-indexer + chain scanner (new market detection every 60s)
               ├── Persistent proof-worker (Aleo SDK, key-cached for fast re-runs)
               └── Lightning Manager (tracks rounds, auto-creates replacement after admin resolve)
Contracts →  3 Leo programs on Aleo Testnet (47 transitions)
```

---

## 🖥️ All Working Pages (14 total)

`/` Landing · `/markets` Browse · `/markets/:id` Trade · `/rounds` Strike Rounds · `/portfolio` Positions · `/create` Create Market · `/governance` Proposals+Voting · `/leaderboard` · `/pools` LP · `/stats` Analytics · `/admin` Resolver · `/docs` · `/faq` · `/privacy`

---

## ⚡ Strike Rounds — Full Flow

1. Admin creates `BTC Strike Round` via `open_market`. Oracle records start price at that moment.
2. User bets UP or DOWN → private `OutcomeShare` record on-chain.
3. Round expires (24h / 2d / 7d / 30d).
4. Admin visits `/admin` — sees oracle startPrice (at creation) vs live endPrice for each round.
5. Admin reads price direction and calls `flash_settle(market_id, winner)` via wallet. Instant. No dispute window.
6. Admin visits `/create` and opens the next Strike Round manually (new nonce, fresh start price).
7. Winner calls `harvest_winnings` → receives private credits 1:1.

---

## 🏛️ Governance (Live, Evolving)

On-chain via `submit_proposal` + `cast_vote`. Supported: approve resolvers, treasury withdrawals, fee updates, market overrides. Governance receipts are encrypted on-chain. Quorum, timelock, and stronger execution guards planned for future waves.

---

## 🚀 Wave 4 New Features

- 🆕 3-program v6 architecture (v5 was single-program, hit variable limit at 2.1M)
- 🆕 USAD stablecoin — 3rd token with own program
- 🆕 On-chain governance (`submit_proposal` + `cast_vote` with `GovernanceReceipt`)
- 🆕 Strike Rounds redesigned: 24h / 2d / 7d / 30d (removed 5-min lightning)
- 🆕 Admin panel: oracle startPrice vs endPrice comparison, resolve via wallet with `flash_settle`
- 🆕 7-source oracle fallback chain (CoinGecko → OKX → Binance → CoinCap → ...)
- 🆕 Portfolio PnL visualization + history
- 🆕 Full UI/UX redesign (glassmorphism, 3D cards, animated landing)

---

> 🔮 **Roadmap:** Stronger USDCx/USAD deposit privacy · Governance quorum + timelock · Mainnet deployment

---

*Aleo Developer Program — Wave 4 · All tokens are testnet tokens with no real-world value.*
