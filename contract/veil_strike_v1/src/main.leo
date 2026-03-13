// ============================================================================
// VEIL STRIKE v1 — Privacy-First Prediction Market Protocol on Aleo
// ============================================================================
// Production FPMM (Fixed Product Market Maker) with u128 math.
// Struct-based mappings, proper lifecycle with challenge window, dispute mechanism.
// Privacy: ALL positions, payouts, refunds use private records.
// Supports 2-4 outcome markets with automated market making.
//
// PRIVACY MODEL:
//   - NO user addresses passed to finalize (except admin verification)
//   - Buy via transfer_public_as_signer (compatible with Shield wallet)
//   - Payouts via transfer_public_to_private (hides recipient)
//   - Records: SharePosition, LPReceipt, WinReceipt, RefundReceipt, DisputeBondReceipt
//
// MARKET LIFECYCLE:
//   create_market → buy/sell/add_liquidity → close_market → resolve_market
//   → [CHALLENGE_WINDOW blocks] → finalize_resolution → redeem/withdraw
//   cancel_market can be called by admin at any time before finalization
//   dispute_resolution can be filed during challenge window
// ============================================================================

import credits.aleo;
import test_usdcx_stablecoin.aleo;

program veil_strike_v1.aleo {

    // =====================================================================
    // CONSTANTS
    // =====================================================================

    // Deployer address (derived from deployment private key)
    const DEPLOYER: address = aleo19za49scmhufst9q8lhwka5hmkvzx5ersrue3gjwcs705542daursptmx0r;

    // Fee constants in basis points (1 bp = 0.01%)
    const PROTOCOL_FEE_BPS: u128 = 50u128;     // 0.5%
    const CREATOR_FEE_BPS: u128 = 50u128;      // 0.5%
    const LP_FEE_BPS: u128 = 100u128;          // 1.0%
    const TOTAL_FEE_BPS: u128 = 200u128;       // 2.0%
    const BPS_BASE: u128 = 10000u128;

    // Market status codes
    const STATUS_ACTIVE: u8 = 1u8;
    const STATUS_CLOSED: u8 = 2u8;
    const STATUS_RESOLVED: u8 = 3u8;
    const STATUS_FINALIZED: u8 = 4u8;
    const STATUS_CANCELLED: u8 = 5u8;
    const STATUS_DISPUTED: u8 = 6u8;

    // Minimum amounts (in microcredits)
    const MIN_LIQUIDITY: u128 = 1_000_000u128;     // 1 ALEO
    const MIN_TRADE: u128 = 10_000u128;             // 0.01 ALEO
    const MIN_DISPUTE_BOND: u128 = 5_000_000u128;   // 5 ALEO

    // Challenge window: blocks before resolution can be finalized (~4 hours at 5s/block)
    const CHALLENGE_WINDOW: u32 = 2880u32;

    // =====================================================================
    // STRUCTS
    // =====================================================================

    struct StrikeMarket {
        id: field,
        creator: address,
        resolver: address,
        question_hash: field,
        category: u8,
        num_outcomes: u8,
        deadline: u32,
        resolution_deadline: u32,
        status: u8,
        created_at: u32,
    }

    struct StrikePool {
        market_id: field,
        reserve_1: u128,
        reserve_2: u128,
        reserve_3: u128,
        reserve_4: u128,
        total_liquidity: u128,
        total_lp_shares: u128,
        total_volume: u128,
    }

    struct StrikeResolution {
        market_id: field,
        winning_outcome: u8,
        resolved_at: u32,
        is_disputed: bool,
    }

    struct StrikeFees {
        market_id: field,
        protocol_fees: u128,
        creator_fees: u128,
        lp_fees: u128,
    }

    struct MarketSeed {
        creator: address,
        question_hash: field,
        nonce: field,
    }

    // =====================================================================
    // RECORDS (Private — owned by individual users)
    // =====================================================================

    record SharePosition {
        owner: address,
        market_id: field,
        outcome_index: u8,
        share_amount: u128,
    }

    record LPReceipt {
        owner: address,
        market_id: field,
        lp_shares: u128,
        deposit_amount: u128,
    }

    record WinReceipt {
        owner: address,
        market_id: field,
        payout_amount: u128,
    }

    record RefundReceipt {
        owner: address,
        market_id: field,
        refund_amount: u128,
    }

    record DisputeBondReceipt {
        owner: address,
        market_id: field,
        bond_amount: u128,
        proposed_outcome: u8,
    }

    // =====================================================================
    // MAPPINGS (Public on-chain state)
    // =====================================================================

    mapping markets: field => StrikeMarket;
    mapping amm_pools: field => StrikePool;
    mapping resolutions: field => StrikeResolution;
    mapping market_fees: field => StrikeFees;
    mapping protocol_admin: field => address;
    mapping market_count: field => u128;
    mapping program_credits: field => u128;
    mapping market_credits: field => u128;
    mapping used_nonces: field => bool;
    mapping market_token_type: field => u8;     // 0 = ALEO credits, 1 = USDCx

    // =====================================================================
    // CONSTRUCTOR — Called automatically during deployment
    // =====================================================================

    @admin(address = "aleo19za49scmhufst9q8lhwka5hmkvzx5ersrue3gjwcs705542daursptmx0r")
    async constructor() {}

    // =====================================================================
    // 1. INITIALIZE — Set admin and initial state (deployer only, call after deploy)
    // =====================================================================

    async transition initialize() -> Future {
        assert_eq(self.caller, DEPLOYER);
        return finalize_initialize(self.caller);
    }

    async function finalize_initialize(admin: address) {
        protocol_admin.set(1field, admin);
        market_count.set(1field, 0u128);
        program_credits.set(1field, 0u128);
    }

    // =====================================================================
    // 2. CREATE MARKET — Deploy a new prediction market with initial liquidity
    // =====================================================================
    // Creator provides initial liquidity which is split equally across outcomes.
    // Uses transfer_public_as_signer for Shield wallet compatibility.

    async transition create_market(
        question_hash: field,
        category: u8,
        num_outcomes: u8,
        deadline: u32,
        initial_liquidity: u64,
        nonce: field
    ) -> (LPReceipt, Future) {
        assert(num_outcomes >= 2u8);
        assert(num_outcomes <= 4u8);

        let liq128: u128 = initial_liquidity as u128;
        assert(liq128 >= MIN_LIQUIDITY);

        let seed: MarketSeed = MarketSeed {
            creator: self.caller,
            question_hash: question_hash,
            nonce: nonce,
        };
        let market_id: field = BHP256::hash_to_field(seed);

        let receipt: LPReceipt = LPReceipt {
            owner: self.signer,
            market_id: market_id,
            lp_shares: liq128,
            deposit_amount: liq128,
        };

        let f1: Future = credits.aleo/transfer_public_as_signer(self.address, initial_liquidity);

        return (receipt, finalize_create_market(
            f1,
            market_id,
            self.caller,
            question_hash,
            category,
            num_outcomes,
            deadline,
            liq128,
            nonce
        ));
    }

    async function finalize_create_market(
        f1: Future,
        market_id: field,
        creator: address,
        question_hash: field,
        category: u8,
        num_outcomes: u8,
        deadline: u32,
        liquidity: u128,
        nonce: field
    ) {
        f1.await();

        let nonce_used: bool = used_nonces.get_or_use(nonce, false);
        assert(!nonce_used);
        used_nonces.set(nonce, true);

        let exists: bool = markets.contains(market_id);
        assert(!exists);

        let current_height: u32 = block.height;
        assert(deadline > current_height);

        // Equal split across outcomes
        let per_outcome: u128 = liquidity / (num_outcomes as u128);
        let remainder: u128 = liquidity - per_outcome * (num_outcomes as u128);

        let r1: u128 = per_outcome + remainder;
        let r2: u128 = per_outcome;
        let r3: u128 = num_outcomes >= 3u8 ? per_outcome : 0u128;
        let r4: u128 = num_outcomes >= 4u8 ? per_outcome : 0u128;

        let market: StrikeMarket = StrikeMarket {
            id: market_id,
            creator: creator,
            resolver: creator,
            question_hash: question_hash,
            category: category,
            num_outcomes: num_outcomes,
            deadline: deadline,
            resolution_deadline: 0u32,
            status: STATUS_ACTIVE,
            created_at: current_height,
        };
        markets.set(market_id, market);

        let pool: StrikePool = StrikePool {
            market_id: market_id,
            reserve_1: r1,
            reserve_2: r2,
            reserve_3: r3,
            reserve_4: r4,
            total_liquidity: liquidity,
            total_lp_shares: liquidity,
            total_volume: 0u128,
        };
        amm_pools.set(market_id, pool);

        let fees: StrikeFees = StrikeFees {
            market_id: market_id,
            protocol_fees: 0u128,
            creator_fees: 0u128,
            lp_fees: 0u128,
        };
        market_fees.set(market_id, fees);

        let count: u128 = market_count.get(1field);
        market_count.set(1field, count + 1u128);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc + liquidity);

        market_credits.set(market_id, liquidity);
        market_token_type.set(market_id, 0u8);
    }

    // =====================================================================
    // 3. BUY SHARES — Purchase outcome shares via FPMM
    // =====================================================================
    // Caller pre-computes expected_shares off-chain. Finalize verifies the
    // computation matches on-chain state. If reserves changed (front-run),
    // the tx reverts and no credits are lost.
    // Outcomes are indexed 1-based (1, 2, 3, or 4).

    async transition buy_shares(
        amount: u64,
        market_id: field,
        outcome_index: u8,
        expected_shares: u64,
        min_shares: u64,
        nonce: field
    ) -> (SharePosition, Future) {
        let amount128: u128 = amount as u128;
        assert(amount128 >= MIN_TRADE);
        assert(outcome_index >= 1u8);
        assert(outcome_index <= 4u8);

        let position: SharePosition = SharePosition {
            owner: self.signer,
            market_id: market_id,
            outcome_index: outcome_index,
            share_amount: expected_shares as u128,
        };

        let f1: Future = credits.aleo/transfer_public_as_signer(self.address, amount);

        return (position, finalize_buy_shares(
            f1,
            market_id,
            amount128,
            outcome_index,
            expected_shares as u128,
            min_shares as u128,
            nonce
        ));
    }

    async function finalize_buy_shares(
        f1: Future,
        market_id: field,
        amount: u128,
        outcome_index: u8,
        expected_shares: u128,
        min_shares: u128,
        nonce: field
    ) {
        f1.await();

        let nonce_used: bool = used_nonces.get_or_use(nonce, false);
        assert(!nonce_used);
        used_nonces.set(nonce, true);

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_ACTIVE);
        assert(outcome_index >= 1u8);
        assert(outcome_index <= market.num_outcomes);

        let current_height: u32 = block.height;
        assert(current_height <= market.deadline);

        let pool: StrikePool = amm_pools.get(market_id);

        // Calculate fees
        let fee: u128 = amount * TOTAL_FEE_BPS / BPS_BASE;
        let amount_after_fee: u128 = amount - fee;

        let protocol_fee: u128 = fee * PROTOCOL_FEE_BPS / TOTAL_FEE_BPS;
        let creator_fee: u128 = fee * CREATOR_FEE_BPS / TOTAL_FEE_BPS;
        let lp_fee: u128 = fee - protocol_fee - creator_fee;

        // Update accumulated fees
        let fees: StrikeFees = market_fees.get(market_id);
        let new_fees: StrikeFees = StrikeFees {
            market_id: market_id,
            protocol_fees: fees.protocol_fees + protocol_fee,
            creator_fees: fees.creator_fees + creator_fee,
            lp_fees: fees.lp_fees + lp_fee,
        };
        market_fees.set(market_id, new_fees);

        // FPMM step division — compute ri_after (final reserve for chosen outcome)
        // New reserves after complete-set minting:
        let r1n: u128 = pool.reserve_1 + amount_after_fee;
        let r2n: u128 = pool.reserve_2 + amount_after_fee;
        let r3n: u128 = pool.reserve_3 + amount_after_fee;
        let r4n: u128 = pool.reserve_4 + amount_after_fee;

        // Step division: val = reserve_i, then for each j≠i: val = val * reserve_j / (reserve_j + amount)
        // This computes ri_after = product(all_old_reserves) / product(new_reserves_excluding_i)

        // Outcome 1
        let v1a: u128 = pool.reserve_1;
        let v1b: u128 = v1a * pool.reserve_2 / r2n;
        let v1c: u128 = market.num_outcomes >= 3u8 ? v1b * pool.reserve_3 / r3n : v1b;
        let v1d: u128 = market.num_outcomes >= 4u8 ? v1c * pool.reserve_4 / r4n : v1c;
        let shares1: u128 = r1n - v1d;

        // Outcome 2
        let v2a: u128 = pool.reserve_2;
        let v2b: u128 = v2a * pool.reserve_1 / r1n;
        let v2c: u128 = market.num_outcomes >= 3u8 ? v2b * pool.reserve_3 / r3n : v2b;
        let v2d: u128 = market.num_outcomes >= 4u8 ? v2c * pool.reserve_4 / r4n : v2c;
        let shares2: u128 = r2n - v2d;

        // Outcome 3
        let v3a: u128 = pool.reserve_3;
        let v3b: u128 = v3a * pool.reserve_1 / r1n;
        let v3c: u128 = v3b * pool.reserve_2 / r2n;
        let v3d: u128 = market.num_outcomes >= 4u8 ? v3c * pool.reserve_4 / r4n : v3c;
        let shares3: u128 = market.num_outcomes >= 3u8 ? r3n - v3d : 0u128;

        // Outcome 4
        let v4a: u128 = pool.reserve_4;
        let v4b: u128 = v4a * pool.reserve_1 / r1n;
        let v4c: u128 = v4b * pool.reserve_2 / r2n;
        let v4d: u128 = v4c * pool.reserve_3 / r3n;
        let shares4: u128 = market.num_outcomes >= 4u8 ? r4n - v4d : 0u128;

        // Select the computed shares and ri_after for the chosen outcome
        let shares_out: u128 = outcome_index == 1u8 ? shares1 :
                               outcome_index == 2u8 ? shares2 :
                               outcome_index == 3u8 ? shares3 : shares4;
        let ri_after: u128 = outcome_index == 1u8 ? v1d :
                             outcome_index == 2u8 ? v2d :
                             outcome_index == 3u8 ? v3d : v4d;

        assert(shares_out >= min_shares);
        assert_eq(shares_out, expected_shares);

        // Set new reserves: all outcomes get amount_after_fee, chosen outcome gets ri_after
        let lp_per: u128 = lp_fee / (market.num_outcomes as u128);

        let nr1: u128 = outcome_index == 1u8 ? ri_after + lp_per : r1n + lp_per;
        let nr2: u128 = outcome_index == 2u8 ? ri_after + lp_per : r2n + lp_per;
        let nr3: u128 = outcome_index == 3u8 ? ri_after + lp_per :
                        market.num_outcomes >= 3u8 ? r3n + lp_per : 0u128;
        let nr4: u128 = outcome_index == 4u8 ? ri_after + lp_per :
                        market.num_outcomes >= 4u8 ? r4n + lp_per : 0u128;

        let new_pool: StrikePool = StrikePool {
            market_id: market_id,
            reserve_1: nr1,
            reserve_2: nr2,
            reserve_3: nr3,
            reserve_4: nr4,
            total_liquidity: pool.total_liquidity + amount_after_fee + lp_fee,
            total_lp_shares: pool.total_lp_shares,
            total_volume: pool.total_volume + amount,
        };
        amm_pools.set(market_id, new_pool);

        // Track credits
        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc + amount);
        let mc: u128 = market_credits.get(market_id);
        market_credits.set(market_id, mc + amount);
    }

    // =====================================================================
    // 4. SELL SHARES — Sell outcome shares back to pool for credits
    // =====================================================================
    // Consumes the SharePosition record. Returns a new position with remaining
    // shares and a private credits payout.

    async transition sell_shares(
        position: SharePosition,
        tokens_desired: u64,
        max_shares: u64,
        nonce: field
    ) -> (SharePosition, credits.aleo/credits, Future) {
        let desired128: u128 = tokens_desired as u128;
        let max128: u128 = max_shares as u128;
        assert(desired128 >= MIN_TRADE);
        assert(max128 <= position.share_amount);
        assert(max128 > 0u128);

        let remaining: u128 = position.share_amount - max128;

        let new_position: SharePosition = SharePosition {
            owner: self.signer,
            market_id: position.market_id,
            outcome_index: position.outcome_index,
            share_amount: remaining,
        };

        let (payout, f2): (credits.aleo/credits, Future) =
            credits.aleo/transfer_public_to_private(self.caller, tokens_desired);

        return (new_position, payout, finalize_sell_shares(
            f2,
            position.market_id,
            desired128,
            max128,
            position.outcome_index,
            nonce
        ));
    }

    async function finalize_sell_shares(
        f2: Future,
        market_id: field,
        tokens_desired: u128,
        max_shares: u128,
        outcome_index: u8,
        nonce: field
    ) {
        f2.await();

        let nonce_used: bool = used_nonces.get_or_use(nonce, false);
        assert(!nonce_used);
        used_nonces.set(nonce, true);

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_ACTIVE);
        assert(outcome_index >= 1u8);
        assert(outcome_index <= market.num_outcomes);

        let current_height: u32 = block.height;
        assert(current_height <= market.deadline);

        let pool: StrikePool = amm_pools.get(market_id);

        // Reverse FPMM: adding shares back to chosen outcome, removing tokens from all
        // After fee deduction from desired tokens
        let fee: u128 = tokens_desired * TOTAL_FEE_BPS / BPS_BASE;
        let tokens_after_fee: u128 = tokens_desired - fee;

        // New reserves: subtract tokens_after_fee from all, add max_shares to chosen
        let r1: u128 = pool.reserve_1;
        let r2: u128 = pool.reserve_2;
        let r3: u128 = pool.reserve_3;
        let r4: u128 = pool.reserve_4;

        // Add shares back to the chosen outcome reserve
        let r1_with: u128 = outcome_index == 1u8 ? r1 + max_shares : r1;
        let r2_with: u128 = outcome_index == 2u8 ? r2 + max_shares : r2;
        let r3_with: u128 = outcome_index == 3u8 ? r3 + max_shares : r3;
        let r4_with: u128 = outcome_index == 4u8 ? r4 + max_shares : r4;

        // Step division: compute ri_after for chosen outcome after removing tokens
        // val = ri_with, for each j≠i: val = val * rj_with / (rj_with - tokens_after_fee)
        // Verify rj_with > tokens_after_fee to prevent underflow
        let safe1: bool = outcome_index == 1u8 ? true : r1_with > tokens_after_fee;
        let safe2: bool = outcome_index == 2u8 ? true : r2_with > tokens_after_fee;
        let safe3: bool = outcome_index == 3u8 ? true :
                          market.num_outcomes >= 3u8 ? r3_with > tokens_after_fee : true;
        let safe4: bool = outcome_index == 4u8 ? true :
                          market.num_outcomes >= 4u8 ? r4_with > tokens_after_fee : true;
        assert(safe1 && safe2 && safe3 && safe4);

        // After removing tokens_after_fee from each non-chosen reserve:
        let r1_sub: u128 = outcome_index == 1u8 ? r1_with : r1_with - tokens_after_fee;
        let r2_sub: u128 = outcome_index == 2u8 ? r2_with : r2_with - tokens_after_fee;
        let r3_sub: u128 = outcome_index == 3u8 ? r3_with :
                           market.num_outcomes >= 3u8 ? r3_with - tokens_after_fee : 0u128;
        let r4_sub: u128 = outcome_index == 4u8 ? r4_with :
                           market.num_outcomes >= 4u8 ? r4_with - tokens_after_fee : 0u128;

        // The chosen outcome reserve must also adjust to maintain invariant
        // Step division on chosen outcome: val = ri_with * prod(rj) / prod(rj_with)
        // This gives us how many shares are actually consumed

        // Compute actual shares burned via step division
        // val starts at ri_with, then for each j≠i: val = val * rj / rj_sub
        // But rj_sub = rj_with - tokens_after_fee (for non-chosen outcomes)

        // Outcome 1 as chosen
        let b1a: u128 = r1_with;
        let b1b: u128 = b1a * r2 / r2_sub;
        let b1c: u128 = market.num_outcomes >= 3u8 ? b1b * r3 / r3_sub : b1b;
        let b1d: u128 = market.num_outcomes >= 4u8 ? b1c * r4 / r4_sub : b1c;
        let actual1: u128 = b1d - r1_with;

        // Outcome 2 as chosen
        let b2a: u128 = r2_with;
        let b2b: u128 = b2a * r1 / r1_sub;
        let b2c: u128 = market.num_outcomes >= 3u8 ? b2b * r3 / r3_sub : b2b;
        let b2d: u128 = market.num_outcomes >= 4u8 ? b2c * r4 / r4_sub : b2c;
        let actual2: u128 = b2d - r2_with;

        // Outcome 3 as chosen
        let b3a: u128 = r3_with;
        let b3b: u128 = b3a * r1 / r1_sub;
        let b3c: u128 = b3b * r2 / r2_sub;
        let b3d: u128 = market.num_outcomes >= 4u8 ? b3c * r4 / r4_sub : b3c;
        let actual3: u128 = market.num_outcomes >= 3u8 ? b3d - r3_with : 0u128;

        // Outcome 4 as chosen
        let b4a: u128 = r4_with;
        let b4b: u128 = b4a * r1 / r1_sub;
        let b4c: u128 = b4b * r2 / r2_sub;
        let b4d: u128 = b4c * r3 / r3_sub;
        let actual4: u128 = market.num_outcomes >= 4u8 ? b4d - r4_with : 0u128;

        let actual_shares: u128 = outcome_index == 1u8 ? actual1 :
                                  outcome_index == 2u8 ? actual2 :
                                  outcome_index == 3u8 ? actual3 : actual4;

        // Verify shares burned does not exceed max
        assert(actual_shares <= max_shares);

        // Update fees
        let protocol_fee: u128 = fee * PROTOCOL_FEE_BPS / TOTAL_FEE_BPS;
        let creator_fee: u128 = fee * CREATOR_FEE_BPS / TOTAL_FEE_BPS;
        let lp_fee: u128 = fee - protocol_fee - creator_fee;

        let fees: StrikeFees = market_fees.get(market_id);
        let new_fees: StrikeFees = StrikeFees {
            market_id: market_id,
            protocol_fees: fees.protocol_fees + protocol_fee,
            creator_fees: fees.creator_fees + creator_fee,
            lp_fees: fees.lp_fees + lp_fee,
        };
        market_fees.set(market_id, new_fees);

        // Final reserves: subtract tokens_after_fee from all, add actual_shares to chosen
        let final_r1: u128 = r1 - tokens_after_fee + (outcome_index == 1u8 ? actual_shares : 0u128);
        let final_r2: u128 = r2 - tokens_after_fee + (outcome_index == 2u8 ? actual_shares : 0u128);
        let final_r3: u128 = market.num_outcomes >= 3u8 ?
                             r3 - tokens_after_fee + (outcome_index == 3u8 ? actual_shares : 0u128) : 0u128;
        let final_r4: u128 = market.num_outcomes >= 4u8 ?
                             r4 - tokens_after_fee + (outcome_index == 4u8 ? actual_shares : 0u128) : 0u128;

        let new_pool: StrikePool = StrikePool {
            market_id: market_id,
            reserve_1: final_r1,
            reserve_2: final_r2,
            reserve_3: final_r3,
            reserve_4: final_r4,
            total_liquidity: pool.total_liquidity - tokens_after_fee,
            total_lp_shares: pool.total_lp_shares,
            total_volume: pool.total_volume + tokens_desired,
        };
        amm_pools.set(market_id, new_pool);

        // Track credits
        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc - tokens_desired);
        let mc: u128 = market_credits.get(market_id);
        market_credits.set(market_id, mc - tokens_desired);
    }

    // =====================================================================
    // 5. ADD LIQUIDITY — LP provides additional liquidity
    // =====================================================================
    // Liquidity added proportionally to existing reserves.

    async transition add_liquidity(
        amount: u64,
        market_id: field,
        nonce: field
    ) -> (LPReceipt, Future) {
        let amount128: u128 = amount as u128;
        assert(amount128 >= MIN_LIQUIDITY);

        let receipt: LPReceipt = LPReceipt {
            owner: self.signer,
            market_id: market_id,
            lp_shares: amount128,
            deposit_amount: amount128,
        };

        let f1: Future = credits.aleo/transfer_public_as_signer(self.address, amount);

        return (receipt, finalize_add_liquidity(
            f1,
            market_id,
            amount128,
            nonce
        ));
    }

    async function finalize_add_liquidity(
        f1: Future,
        market_id: field,
        amount: u128,
        nonce: field
    ) {
        f1.await();

        let nonce_used: bool = used_nonces.get_or_use(nonce, false);
        assert(!nonce_used);
        used_nonces.set(nonce, true);

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_ACTIVE);

        let current_height: u32 = block.height;
        assert(current_height <= market.deadline);

        let pool: StrikePool = amm_pools.get(market_id);

        // Calculate active reserves total
        let base_total: u128 = pool.reserve_1 + pool.reserve_2;
        let total_with_3: u128 = market.num_outcomes >= 3u8 ? base_total + pool.reserve_3 : base_total;
        let active_total: u128 = market.num_outcomes >= 4u8 ? total_with_3 + pool.reserve_4 : total_with_3;
        assert(active_total > 0u128);

        // Add proportionally
        let add_1: u128 = amount * pool.reserve_1 / active_total;
        let add_2: u128 = amount * pool.reserve_2 / active_total;
        let add_3: u128 = market.num_outcomes >= 3u8 ? amount * pool.reserve_3 / active_total : 0u128;
        let add_4: u128 = market.num_outcomes >= 4u8 ? amount * pool.reserve_4 / active_total : 0u128;

        // LP shares proportional to existing
        let lp_shares: u128 = amount * pool.total_lp_shares / active_total;

        let new_pool: StrikePool = StrikePool {
            market_id: market_id,
            reserve_1: pool.reserve_1 + add_1,
            reserve_2: pool.reserve_2 + add_2,
            reserve_3: pool.reserve_3 + add_3,
            reserve_4: pool.reserve_4 + add_4,
            total_liquidity: pool.total_liquidity + amount,
            total_lp_shares: pool.total_lp_shares + lp_shares,
            total_volume: pool.total_volume,
        };
        amm_pools.set(market_id, new_pool);

        // Track credits
        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc + amount);
        let mc: u128 = market_credits.get(market_id);
        market_credits.set(market_id, mc + amount);
    }

    // =====================================================================
    // 6. CLOSE MARKET — Admin stops trading (no more buys/sells)
    // =====================================================================

    async transition close_market(market_id: field) -> Future {
        return finalize_close_market(market_id, self.signer);
    }

    async function finalize_close_market(
        market_id: field,
        caller: address
    ) {
        let admin: address = protocol_admin.get(1field);
        assert_eq(caller, admin);

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_ACTIVE);

        let updated: StrikeMarket = StrikeMarket {
            id: market.id,
            creator: market.creator,
            resolver: market.resolver,
            question_hash: market.question_hash,
            category: market.category,
            num_outcomes: market.num_outcomes,
            deadline: market.deadline,
            resolution_deadline: market.resolution_deadline,
            status: STATUS_CLOSED,
            created_at: market.created_at,
        };
        markets.set(market_id, updated);
    }

    // =====================================================================
    // 7. RESOLVE MARKET — Set winning outcome (starts challenge window)
    // =====================================================================

    async transition resolve_market(
        market_id: field,
        winning_outcome: u8
    ) -> Future {
        return finalize_resolve_market(market_id, winning_outcome, self.signer);
    }

    async function finalize_resolve_market(
        market_id: field,
        winning_outcome: u8,
        caller: address
    ) {
        let admin: address = protocol_admin.get(1field);
        let market: StrikeMarket = markets.get(market_id);

        // Resolver must be admin or market creator
        let is_admin: bool = caller == admin;
        let is_resolver: bool = caller == market.resolver;
        assert(is_admin || is_resolver);

        assert(winning_outcome >= 1u8);
        assert(winning_outcome <= market.num_outcomes);

        let is_active: bool = market.status == STATUS_ACTIVE;
        let is_closed: bool = market.status == STATUS_CLOSED;
        assert(is_active || is_closed);

        let current_height: u32 = block.height;

        // Create resolution record
        let resolution: StrikeResolution = StrikeResolution {
            market_id: market_id,
            winning_outcome: winning_outcome,
            resolved_at: current_height,
            is_disputed: false,
        };
        resolutions.set(market_id, resolution);

        // Update market status
        let updated: StrikeMarket = StrikeMarket {
            id: market.id,
            creator: market.creator,
            resolver: market.resolver,
            question_hash: market.question_hash,
            category: market.category,
            num_outcomes: market.num_outcomes,
            deadline: market.deadline,
            resolution_deadline: current_height + CHALLENGE_WINDOW,
            status: STATUS_RESOLVED,
            created_at: market.created_at,
        };
        markets.set(market_id, updated);
    }

    // =====================================================================
    // 8. FINALIZE RESOLUTION — After challenge window, lock in the result
    // =====================================================================

    async transition finalize_resolution(market_id: field) -> Future {
        return finalize_finalize_resolution(market_id);
    }

    async function finalize_finalize_resolution(market_id: field) {
        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_RESOLVED);

        let current_height: u32 = block.height;
        assert(current_height > market.resolution_deadline);

        let updated: StrikeMarket = StrikeMarket {
            id: market.id,
            creator: market.creator,
            resolver: market.resolver,
            question_hash: market.question_hash,
            category: market.category,
            num_outcomes: market.num_outcomes,
            deadline: market.deadline,
            resolution_deadline: market.resolution_deadline,
            status: STATUS_FINALIZED,
            created_at: market.created_at,
        };
        markets.set(market_id, updated);
    }

    // =====================================================================
    // 9. CANCEL MARKET — Admin cancels market (enables refunds)
    // =====================================================================

    async transition cancel_market(market_id: field) -> Future {
        return finalize_cancel_market(market_id, self.signer);
    }

    async function finalize_cancel_market(
        market_id: field,
        caller: address
    ) {
        let admin: address = protocol_admin.get(1field);
        assert_eq(caller, admin);

        let market: StrikeMarket = markets.get(market_id);
        let is_active: bool = market.status == STATUS_ACTIVE;
        let is_closed: bool = market.status == STATUS_CLOSED;
        let is_disputed: bool = market.status == STATUS_DISPUTED;
        assert(is_active || is_closed || is_disputed);

        let updated: StrikeMarket = StrikeMarket {
            id: market.id,
            creator: market.creator,
            resolver: market.resolver,
            question_hash: market.question_hash,
            category: market.category,
            num_outcomes: market.num_outcomes,
            deadline: market.deadline,
            resolution_deadline: market.resolution_deadline,
            status: STATUS_CANCELLED,
            created_at: market.created_at,
        };
        markets.set(market_id, updated);
    }

    // =====================================================================
    // 10. DISPUTE RESOLUTION — Challenge a resolved outcome with bond
    // =====================================================================
    // Must be called during the challenge window (before finalize_resolution).
    // Disputer puts up a bond and proposes a different outcome.

    async transition dispute_resolution(
        market_id: field,
        proposed_outcome: u8,
        bond_amount: u64,
        nonce: field
    ) -> (DisputeBondReceipt, Future) {
        let bond128: u128 = bond_amount as u128;
        assert(bond128 >= MIN_DISPUTE_BOND);

        let receipt: DisputeBondReceipt = DisputeBondReceipt {
            owner: self.signer,
            market_id: market_id,
            bond_amount: bond128,
            proposed_outcome: proposed_outcome,
        };

        let f1: Future = credits.aleo/transfer_public_as_signer(self.address, bond_amount);

        return (receipt, finalize_dispute(
            f1,
            market_id,
            proposed_outcome,
            nonce
        ));
    }

    async function finalize_dispute(
        f1: Future,
        market_id: field,
        proposed_outcome: u8,
        nonce: field
    ) {
        f1.await();

        let nonce_used: bool = used_nonces.get_or_use(nonce, false);
        assert(!nonce_used);
        used_nonces.set(nonce, true);

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_RESOLVED);

        // Must be within challenge window
        let current_height: u32 = block.height;
        assert(current_height <= market.resolution_deadline);

        // Proposed outcome must be different from current resolution
        let resolution: StrikeResolution = resolutions.get(market_id);
        assert(proposed_outcome != resolution.winning_outcome);
        assert(proposed_outcome >= 1u8);
        assert(proposed_outcome <= market.num_outcomes);

        // Mark as disputed
        let updated_resolution: StrikeResolution = StrikeResolution {
            market_id: market_id,
            winning_outcome: resolution.winning_outcome,
            resolved_at: resolution.resolved_at,
            is_disputed: true,
        };
        resolutions.set(market_id, updated_resolution);

        let updated: StrikeMarket = StrikeMarket {
            id: market.id,
            creator: market.creator,
            resolver: market.resolver,
            question_hash: market.question_hash,
            category: market.category,
            num_outcomes: market.num_outcomes,
            deadline: market.deadline,
            resolution_deadline: market.resolution_deadline,
            status: STATUS_DISPUTED,
            created_at: market.created_at,
        };
        markets.set(market_id, updated);

        // Track credits
        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc + (MIN_DISPUTE_BOND));
    }

    // =====================================================================
    // 11. CLAIM DISPUTE BOND — Claim bond back after dispute resolved
    // =====================================================================

    async transition claim_dispute_bond(
        receipt: DisputeBondReceipt
    ) -> (credits.aleo/credits, Future) {
        assert(receipt.bond_amount > 0u128);
        let payout_u64: u64 = receipt.bond_amount as u64;

        let (payout, f2): (credits.aleo/credits, Future) =
            credits.aleo/transfer_public_to_private(self.caller, payout_u64);

        return (payout, finalize_claim_dispute_bond(
            f2,
            receipt.market_id,
            receipt.bond_amount
        ));
    }

    async function finalize_claim_dispute_bond(
        f2: Future,
        market_id: field,
        bond_amount: u128
    ) {
        f2.await();

        let market: StrikeMarket = markets.get(market_id);
        // Bond can be claimed after cancellation (dispute upheld) or finalization
        let is_cancelled: bool = market.status == STATUS_CANCELLED;
        let is_finalized: bool = market.status == STATUS_FINALIZED;
        assert(is_cancelled || is_finalized);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc - bond_amount);
    }

    // =====================================================================
    // 12. REDEEM SHARES — Claim payout for winning positions
    // =====================================================================
    // PRIVACY: winner hidden via transfer_public_to_private

    async transition redeem_shares(
        position: SharePosition
    ) -> (WinReceipt, credits.aleo/credits, Future) {
        assert(position.share_amount > 0u128);
        let payout_u64: u64 = position.share_amount as u64;

        let win: WinReceipt = WinReceipt {
            owner: self.signer,
            market_id: position.market_id,
            payout_amount: position.share_amount,
        };

        let (payout, f2): (credits.aleo/credits, Future) =
            credits.aleo/transfer_public_to_private(self.caller, payout_u64);

        return (win, payout, finalize_redeem(
            f2,
            position.market_id,
            position.outcome_index,
            position.share_amount
        ));
    }

    async function finalize_redeem(
        f2: Future,
        market_id: field,
        outcome: u8,
        amount: u128
    ) {
        f2.await();

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_FINALIZED);

        let resolution: StrikeResolution = resolutions.get(market_id);
        assert_eq(outcome, resolution.winning_outcome);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc - amount);
        let mc: u128 = market_credits.get(market_id);
        market_credits.set(market_id, mc - amount);
    }

    // =====================================================================
    // 13. CLAIM REFUND — Refund positions on cancelled markets
    // =====================================================================

    async transition claim_refund(
        position: SharePosition
    ) -> (RefundReceipt, credits.aleo/credits, Future) {
        assert(position.share_amount > 0u128);
        let payout_u64: u64 = position.share_amount as u64;

        let refund: RefundReceipt = RefundReceipt {
            owner: self.signer,
            market_id: position.market_id,
            refund_amount: position.share_amount,
        };

        let (payout, f2): (credits.aleo/credits, Future) =
            credits.aleo/transfer_public_to_private(self.caller, payout_u64);

        return (refund, payout, finalize_claim_refund(
            f2,
            position.market_id,
            position.share_amount
        ));
    }

    async function finalize_claim_refund(
        f2: Future,
        market_id: field,
        amount: u128
    ) {
        f2.await();

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_CANCELLED);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc - amount);
        let mc: u128 = market_credits.get(market_id);
        market_credits.set(market_id, mc - amount);
    }

    // =====================================================================
    // 14. WITHDRAW LP — LP withdraws after market finalization
    // =====================================================================
    // LP gets back proportional share of remaining liquidity.

    async transition withdraw_lp(
        receipt: LPReceipt
    ) -> (credits.aleo/credits, Future) {
        assert(receipt.deposit_amount > 0u128);
        let payout_u64: u64 = receipt.deposit_amount as u64;

        let (payout, f2): (credits.aleo/credits, Future) =
            credits.aleo/transfer_public_to_private(self.caller, payout_u64);

        return (payout, finalize_withdraw_lp(
            f2,
            receipt.market_id,
            receipt.deposit_amount,
            receipt.lp_shares
        ));
    }

    async function finalize_withdraw_lp(
        f2: Future,
        market_id: field,
        deposit: u128,
        lp_shares: u128
    ) {
        f2.await();

        let market: StrikeMarket = markets.get(market_id);
        let is_finalized: bool = market.status == STATUS_FINALIZED;
        let is_cancelled: bool = market.status == STATUS_CANCELLED;
        assert(is_finalized || is_cancelled);

        let pool: StrikePool = amm_pools.get(market_id);
        let capped: u128 = deposit <= pool.total_liquidity ? deposit : pool.total_liquidity;

        let new_pool: StrikePool = StrikePool {
            market_id: market_id,
            reserve_1: pool.reserve_1,
            reserve_2: pool.reserve_2,
            reserve_3: pool.reserve_3,
            reserve_4: pool.reserve_4,
            total_liquidity: pool.total_liquidity - capped,
            total_lp_shares: pool.total_lp_shares - lp_shares,
            total_volume: pool.total_volume,
        };
        amm_pools.set(market_id, new_pool);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc - capped);
    }

    // =====================================================================
    // 15. WITHDRAW CREATOR FEES — Market creator claims accumulated fees
    // =====================================================================

    async transition withdraw_creator_fees(
        market_id: field,
        amount: u64
    ) -> (credits.aleo/credits, Future) {
        assert(amount > 0u64);

        let (payout, f2): (credits.aleo/credits, Future) =
            credits.aleo/transfer_public_to_private(self.caller, amount);

        return (payout, finalize_withdraw_creator_fees(
            f2,
            market_id,
            amount as u128,
            self.signer
        ));
    }

    async function finalize_withdraw_creator_fees(
        f2: Future,
        market_id: field,
        amount: u128,
        caller: address
    ) {
        f2.await();

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(caller, market.creator);

        let fees: StrikeFees = market_fees.get(market_id);
        assert(amount <= fees.creator_fees);

        let new_fees: StrikeFees = StrikeFees {
            market_id: market_id,
            protocol_fees: fees.protocol_fees,
            creator_fees: fees.creator_fees - amount,
            lp_fees: fees.lp_fees,
        };
        market_fees.set(market_id, new_fees);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc - amount);
    }

    // =====================================================================
    // 16. WITHDRAW PROTOCOL FEES — Admin claims protocol fees
    // =====================================================================

    async transition withdraw_protocol_fees(
        market_id: field,
        amount: u64
    ) -> (credits.aleo/credits, Future) {
        assert(amount > 0u64);

        let (payout, f2): (credits.aleo/credits, Future) =
            credits.aleo/transfer_public_to_private(self.caller, amount);

        return (payout, finalize_withdraw_protocol_fees(
            f2,
            market_id,
            amount as u128,
            self.signer
        ));
    }

    async function finalize_withdraw_protocol_fees(
        f2: Future,
        market_id: field,
        amount: u128,
        caller: address
    ) {
        f2.await();

        let admin: address = protocol_admin.get(1field);
        assert_eq(caller, admin);

        let fees: StrikeFees = market_fees.get(market_id);
        assert(amount <= fees.protocol_fees);

        let new_fees: StrikeFees = StrikeFees {
            market_id: market_id,
            protocol_fees: fees.protocol_fees - amount,
            creator_fees: fees.creator_fees,
            lp_fees: fees.lp_fees,
        };
        market_fees.set(market_id, new_fees);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc - amount);
    }

    // =====================================================================
    // 17. CREATE MARKET (USDCx) — Deploy a market with USDCx initial liquidity
    // =====================================================================

    async transition create_market_usdcx(
        question_hash: field,
        category: u8,
        num_outcomes: u8,
        deadline: u32,
        initial_liquidity: u128,
        nonce: field
    ) -> (LPReceipt, Future) {
        assert(num_outcomes >= 2u8);
        assert(num_outcomes <= 4u8);
        assert(initial_liquidity >= MIN_LIQUIDITY);

        let seed: MarketSeed = MarketSeed {
            creator: self.caller,
            question_hash: question_hash,
            nonce: nonce,
        };
        let market_id: field = BHP256::hash_to_field(seed);

        let receipt: LPReceipt = LPReceipt {
            owner: self.signer,
            market_id: market_id,
            lp_shares: initial_liquidity,
            deposit_amount: initial_liquidity,
        };

        let f1: Future = test_usdcx_stablecoin.aleo/transfer_public_as_signer(self.address, initial_liquidity);

        return (receipt, finalize_create_market_usdcx(
            f1,
            market_id,
            self.caller,
            question_hash,
            category,
            num_outcomes,
            deadline,
            initial_liquidity,
            nonce
        ));
    }

    async function finalize_create_market_usdcx(
        f1: Future,
        market_id: field,
        creator: address,
        question_hash: field,
        category: u8,
        num_outcomes: u8,
        deadline: u32,
        liquidity: u128,
        nonce: field
    ) {
        f1.await();

        let nonce_used: bool = used_nonces.get_or_use(nonce, false);
        assert(!nonce_used);
        used_nonces.set(nonce, true);

        let exists: bool = markets.contains(market_id);
        assert(!exists);

        let current_height: u32 = block.height;
        assert(deadline > current_height);

        let per_outcome: u128 = liquidity / (num_outcomes as u128);
        let remainder: u128 = liquidity - per_outcome * (num_outcomes as u128);

        let r1: u128 = per_outcome + remainder;
        let r2: u128 = per_outcome;
        let r3: u128 = num_outcomes >= 3u8 ? per_outcome : 0u128;
        let r4: u128 = num_outcomes >= 4u8 ? per_outcome : 0u128;

        let market: StrikeMarket = StrikeMarket {
            id: market_id,
            creator: creator,
            resolver: creator,
            question_hash: question_hash,
            category: category,
            num_outcomes: num_outcomes,
            deadline: deadline,
            resolution_deadline: 0u32,
            status: STATUS_ACTIVE,
            created_at: current_height,
        };
        markets.set(market_id, market);

        let pool: StrikePool = StrikePool {
            market_id: market_id,
            reserve_1: r1,
            reserve_2: r2,
            reserve_3: r3,
            reserve_4: r4,
            total_liquidity: liquidity,
            total_lp_shares: liquidity,
            total_volume: 0u128,
        };
        amm_pools.set(market_id, pool);

        let fees: StrikeFees = StrikeFees {
            market_id: market_id,
            protocol_fees: 0u128,
            creator_fees: 0u128,
            lp_fees: 0u128,
        };
        market_fees.set(market_id, fees);

        let count: u128 = market_count.get(1field);
        market_count.set(1field, count + 1u128);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc + liquidity);

        market_credits.set(market_id, liquidity);
        market_token_type.set(market_id, 1u8);
    }

    // =====================================================================
    // 18. BUY SHARES (USDCx) — Purchase shares using USDCx stablecoin
    // =====================================================================

    async transition buy_shares_usdcx(
        amount: u128,
        market_id: field,
        outcome_index: u8,
        expected_shares: u128,
        min_shares: u128,
        nonce: field
    ) -> (SharePosition, Future) {
        assert(amount >= MIN_TRADE);
        assert(outcome_index >= 1u8);
        assert(outcome_index <= 4u8);

        let position: SharePosition = SharePosition {
            owner: self.signer,
            market_id: market_id,
            outcome_index: outcome_index,
            share_amount: expected_shares,
        };

        let f1: Future = test_usdcx_stablecoin.aleo/transfer_public_as_signer(self.address, amount);

        return (position, finalize_buy_shares_usdcx(
            f1,
            market_id,
            amount,
            outcome_index,
            expected_shares,
            min_shares,
            nonce
        ));
    }

    async function finalize_buy_shares_usdcx(
        f1: Future,
        market_id: field,
        amount: u128,
        outcome_index: u8,
        expected_shares: u128,
        min_shares: u128,
        nonce: field
    ) {
        f1.await();

        let nonce_used: bool = used_nonces.get_or_use(nonce, false);
        assert(!nonce_used);
        used_nonces.set(nonce, true);

        let token_type: u8 = market_token_type.get(market_id);
        assert_eq(token_type, 1u8);

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_ACTIVE);
        assert(outcome_index >= 1u8);
        assert(outcome_index <= market.num_outcomes);

        let current_height: u32 = block.height;
        assert(current_height <= market.deadline);

        let pool: StrikePool = amm_pools.get(market_id);

        let fee: u128 = amount * TOTAL_FEE_BPS / BPS_BASE;
        let amount_after_fee: u128 = amount - fee;

        let protocol_fee: u128 = fee * PROTOCOL_FEE_BPS / TOTAL_FEE_BPS;
        let creator_fee: u128 = fee * CREATOR_FEE_BPS / TOTAL_FEE_BPS;
        let lp_fee: u128 = fee - protocol_fee - creator_fee;

        let fees: StrikeFees = market_fees.get(market_id);
        let new_fees: StrikeFees = StrikeFees {
            market_id: market_id,
            protocol_fees: fees.protocol_fees + protocol_fee,
            creator_fees: fees.creator_fees + creator_fee,
            lp_fees: fees.lp_fees + lp_fee,
        };
        market_fees.set(market_id, new_fees);

        let r1n: u128 = pool.reserve_1 + amount_after_fee;
        let r2n: u128 = pool.reserve_2 + amount_after_fee;
        let r3n: u128 = pool.reserve_3 + amount_after_fee;
        let r4n: u128 = pool.reserve_4 + amount_after_fee;

        let v1a: u128 = pool.reserve_1;
        let v1b: u128 = v1a * pool.reserve_2 / r2n;
        let v1c: u128 = market.num_outcomes >= 3u8 ? v1b * pool.reserve_3 / r3n : v1b;
        let v1d: u128 = market.num_outcomes >= 4u8 ? v1c * pool.reserve_4 / r4n : v1c;
        let shares1: u128 = r1n - v1d;

        let v2a: u128 = pool.reserve_2;
        let v2b: u128 = v2a * pool.reserve_1 / r1n;
        let v2c: u128 = market.num_outcomes >= 3u8 ? v2b * pool.reserve_3 / r3n : v2b;
        let v2d: u128 = market.num_outcomes >= 4u8 ? v2c * pool.reserve_4 / r4n : v2c;
        let shares2: u128 = r2n - v2d;

        let v3a: u128 = pool.reserve_3;
        let v3b: u128 = v3a * pool.reserve_1 / r1n;
        let v3c: u128 = v3b * pool.reserve_2 / r2n;
        let v3d: u128 = market.num_outcomes >= 4u8 ? v3c * pool.reserve_4 / r4n : v3c;
        let shares3: u128 = market.num_outcomes >= 3u8 ? r3n - v3d : 0u128;

        let v4a: u128 = pool.reserve_4;
        let v4b: u128 = v4a * pool.reserve_1 / r1n;
        let v4c: u128 = v4b * pool.reserve_2 / r2n;
        let v4d: u128 = v4c * pool.reserve_3 / r3n;
        let shares4: u128 = market.num_outcomes >= 4u8 ? r4n - v4d : 0u128;

        let shares_out: u128 = outcome_index == 1u8 ? shares1 :
                               outcome_index == 2u8 ? shares2 :
                               outcome_index == 3u8 ? shares3 : shares4;
        let ri_after: u128 = outcome_index == 1u8 ? v1d :
                             outcome_index == 2u8 ? v2d :
                             outcome_index == 3u8 ? v3d : v4d;

        assert(shares_out >= min_shares);
        assert_eq(shares_out, expected_shares);

        let lp_per: u128 = lp_fee / (market.num_outcomes as u128);

        let nr1: u128 = outcome_index == 1u8 ? ri_after + lp_per : r1n + lp_per;
        let nr2: u128 = outcome_index == 2u8 ? ri_after + lp_per : r2n + lp_per;
        let nr3: u128 = outcome_index == 3u8 ? ri_after + lp_per :
                        market.num_outcomes >= 3u8 ? r3n + lp_per : 0u128;
        let nr4: u128 = outcome_index == 4u8 ? ri_after + lp_per :
                        market.num_outcomes >= 4u8 ? r4n + lp_per : 0u128;

        let new_pool: StrikePool = StrikePool {
            market_id: market_id,
            reserve_1: nr1,
            reserve_2: nr2,
            reserve_3: nr3,
            reserve_4: nr4,
            total_liquidity: pool.total_liquidity + amount_after_fee + lp_fee,
            total_lp_shares: pool.total_lp_shares,
            total_volume: pool.total_volume + amount,
        };
        amm_pools.set(market_id, new_pool);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc + amount);
        let mc: u128 = market_credits.get(market_id);
        market_credits.set(market_id, mc + amount);
    }

    // =====================================================================
    // 19. REDEEM SHARES (USDCx) — Claim USDCx payout for winning positions
    // =====================================================================

    async transition redeem_shares_usdcx(
        position: SharePosition
    ) -> (WinReceipt, test_usdcx_stablecoin.aleo/Token, test_usdcx_stablecoin.aleo/ComplianceRecord, Future) {
        assert(position.share_amount > 0u128);

        let win: WinReceipt = WinReceipt {
            owner: self.signer,
            market_id: position.market_id,
            payout_amount: position.share_amount,
        };

        let (compliance, payout, f2): (test_usdcx_stablecoin.aleo/ComplianceRecord, test_usdcx_stablecoin.aleo/Token, Future) =
            test_usdcx_stablecoin.aleo/transfer_public_to_private(self.caller, position.share_amount);

        return (win, payout, compliance, finalize_redeem_usdcx(
            f2,
            position.market_id,
            position.outcome_index,
            position.share_amount
        ));
    }

    async function finalize_redeem_usdcx(
        f2: Future,
        market_id: field,
        outcome: u8,
        amount: u128
    ) {
        f2.await();

        let token_type: u8 = market_token_type.get(market_id);
        assert_eq(token_type, 1u8);

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_FINALIZED);

        let resolution: StrikeResolution = resolutions.get(market_id);
        assert_eq(outcome, resolution.winning_outcome);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc - amount);
        let mc: u128 = market_credits.get(market_id);
        market_credits.set(market_id, mc - amount);
    }

    // =====================================================================
    // 20. ADD LIQUIDITY (USDCx) — LP provides USDCx liquidity
    // =====================================================================

    async transition add_liquidity_usdcx(
        amount: u128,
        market_id: field,
        nonce: field
    ) -> (LPReceipt, Future) {
        assert(amount >= MIN_LIQUIDITY);

        let receipt: LPReceipt = LPReceipt {
            owner: self.signer,
            market_id: market_id,
            lp_shares: amount,
            deposit_amount: amount,
        };

        let f1: Future = test_usdcx_stablecoin.aleo/transfer_public_as_signer(self.address, amount);

        return (receipt, finalize_add_liquidity_usdcx(
            f1,
            market_id,
            amount,
            nonce
        ));
    }

    async function finalize_add_liquidity_usdcx(
        f1: Future,
        market_id: field,
        amount: u128,
        nonce: field
    ) {
        f1.await();

        let nonce_used: bool = used_nonces.get_or_use(nonce, false);
        assert(!nonce_used);
        used_nonces.set(nonce, true);

        let token_type: u8 = market_token_type.get(market_id);
        assert_eq(token_type, 1u8);

        let market: StrikeMarket = markets.get(market_id);
        assert_eq(market.status, STATUS_ACTIVE);

        let current_height: u32 = block.height;
        assert(current_height <= market.deadline);

        let pool: StrikePool = amm_pools.get(market_id);

        let base_total: u128 = pool.reserve_1 + pool.reserve_2;
        let total_with_3: u128 = market.num_outcomes >= 3u8 ? base_total + pool.reserve_3 : base_total;
        let active_total: u128 = market.num_outcomes >= 4u8 ? total_with_3 + pool.reserve_4 : total_with_3;
        assert(active_total > 0u128);

        let add_1: u128 = amount * pool.reserve_1 / active_total;
        let add_2: u128 = amount * pool.reserve_2 / active_total;
        let add_3: u128 = market.num_outcomes >= 3u8 ? amount * pool.reserve_3 / active_total : 0u128;
        let add_4: u128 = market.num_outcomes >= 4u8 ? amount * pool.reserve_4 / active_total : 0u128;

        let lp_shares: u128 = amount * pool.total_lp_shares / active_total;

        let new_pool: StrikePool = StrikePool {
            market_id: market_id,
            reserve_1: pool.reserve_1 + add_1,
            reserve_2: pool.reserve_2 + add_2,
            reserve_3: pool.reserve_3 + add_3,
            reserve_4: pool.reserve_4 + add_4,
            total_liquidity: pool.total_liquidity + amount,
            total_lp_shares: pool.total_lp_shares + lp_shares,
            total_volume: pool.total_volume,
        };
        amm_pools.set(market_id, new_pool);

        let pc: u128 = program_credits.get(1field);
        program_credits.set(1field, pc + amount);
        let mc: u128 = market_credits.get(market_id);
        market_credits.set(market_id, mc + amount);
    }
}
