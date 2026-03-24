// ============================================================================
// VEIL STRIKE v6 CX — USDCx Stablecoin Prediction Market Module
// ============================================================================
// USDCx-native markets with full FPMM AMM, dispute system, lightning rounds.
// Companion to veil_strike_v6.aleo (ALEO main + governance).
//
// PRIVACY MODEL:
//   - Buy: transfer_private_to_public hides sender identity
//   - Sell/Redeem/Refund: transfer_public_to_private hides recipient
//   - Dispute bonds use ALEO credits for universal compatibility
//
// 15 transitions
// ============================================================================

import credits.aleo;
import test_usdcx_stablecoin.aleo;

program veil_strike_v6_cx.aleo {

    // ========================================================================
    // CONSTANTS
    // ========================================================================

    const DEPLOYER: address = aleo19za49scmhufst9q8lhwka5hmkvzx5ersrue3gjwcs705542daursptmx0r;

    const PROTOCOL_FEE_BPS: u128 = 50u128;
    const CREATOR_FEE_BPS: u128 = 50u128;
    const LP_FEE_BPS: u128 = 100u128;
    const FEE_DENOMINATOR: u128 = 10000u128;

    const STATUS_ACTIVE: u8 = 1u8;
    const STATUS_CLOSED: u8 = 2u8;
    const STATUS_RESOLVED: u8 = 3u8;
    const STATUS_CANCELLED: u8 = 4u8;
    const STATUS_PENDING_RESOLUTION: u8 = 5u8;

    const TOKEN_USDCX: u8 = 1u8;
    const CHALLENGE_WINDOW: u32 = 2880u32;
    const MIN_TRADE_AMOUNT: u128 = 10_000u128;
    const MIN_LIQUIDITY: u128 = 1_000_000u128;
    const MIN_DISPUTE_BOND: u128 = 5_000_000u128;

    // ========================================================================
    // RECORDS
    // ========================================================================

    record OutcomeShare {
        owner: address,
        market_id: field,
        outcome: u8,
        quantity: u128,
        share_nonce: field,
        token_type: u8,
    }

    record LPToken {
        owner: address,
        market_id: field,
        lp_shares: u128,
        lp_nonce: field,
        token_type: u8,
    }

    record DisputeBondReceipt {
        owner: address,
        market_id: field,
        proposed_outcome: u8,
        bond_amount: u128,
        dispute_nonce: field,
    }

    record RefundClaim {
        owner: address,
        market_id: field,
        amount: u128,
        claim_nonce: field,
        token_type: u8,
    }

    // ========================================================================
    // STRUCTS
    // ========================================================================

    struct Market {
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
        token_type: u8,
    }

    struct AMMPool {
        market_id: field,
        reserve_1: u128,
        reserve_2: u128,
        reserve_3: u128,
        reserve_4: u128,
        total_liquidity: u128,
        total_lp_shares: u128,
        total_volume: u128,
    }

    struct MarketResolution {
        market_id: field,
        winning_outcome: u8,
        resolved_at: u32,
        challenge_deadline: u32,
        finalized: bool,
    }

    struct MarketFees {
        market_id: field,
        protocol_fees: u128,
        creator_fees: u128,
    }

    struct MarketSeed {
        creator: address,
        question_hash: field,
        nonce: field,
    }

    struct ShareClaimKey {
        market_id: field,
        claimer: address,
        share_nonce: field,
    }

    struct LPClaimKey {
        market_id: field,
        claimer: address,
        lp_nonce: field,
    }

    struct DisputeClaimKey {
        market_id: field,
        claimer: address,
        dispute_nonce: field,
    }

    // ========================================================================
    // MAPPINGS
    // ========================================================================

    mapping markets: field => Market;
    mapping amm_pools: field => AMMPool;
    mapping market_resolutions: field => MarketResolution;
    mapping market_fees: field => MarketFees;
    mapping share_redeemed: field => bool;
    mapping creator_fees_claimed: field => bool;
    mapping program_credits: u8 => u128;
    mapping market_credits: field => u128;
    mapping lp_positions: field => bool;

    @noupgrade
    async constructor() {}

    // ========================================================================
    // 1. CREATE MARKET (USDCX)
    // ========================================================================

    async transition open_market(
        public question_hash: field,
        public category: u8,
        public num_outcomes: u8,
        public deadline: u32,
        public resolution_deadline: u32,
        public resolver: address,
        private initial_liquidity: u128,
        private nonce: field,
        private token_in: test_usdcx_stablecoin.aleo/Token,
        private proofs: [MerkleProof; 2],
    ) -> (field, LPToken, test_usdcx_stablecoin.aleo/ComplianceRecord, test_usdcx_stablecoin.aleo/Token, Future) {
        assert(num_outcomes >= 2u8 && num_outcomes <= 4u8);
        assert(initial_liquidity >= MIN_LIQUIDITY);

        let market_id: field = BHP256::hash_to_field(
            MarketSeed { creator: self.signer, question_hash: question_hash, nonce: nonce }
        );
        let lp_nonce: field = BHP256::hash_to_field(LPClaimKey {
            market_id: market_id, claimer: self.signer, lp_nonce: 0field,
        });
        let lp_token: LPToken = LPToken {
            owner: self.signer, market_id: market_id, lp_shares: initial_liquidity,
            lp_nonce: lp_nonce, token_type: TOKEN_USDCX,
        };

        let (compliance_rec, change_token, transfer_future): (
            test_usdcx_stablecoin.aleo/ComplianceRecord,
            test_usdcx_stablecoin.aleo/Token, Future
        ) = test_usdcx_stablecoin.aleo/transfer_private_to_public(
            self.address, initial_liquidity, token_in, proofs
        );

        return (market_id, lp_token, compliance_rec, change_token, open_market_finalize(
            transfer_future, market_id, self.signer, question_hash, category,
            num_outcomes, deadline, resolution_deadline, resolver, initial_liquidity, TOKEN_USDCX
        ));
    }

    async function open_market_finalize(
        transfer_future: Future, market_id: field, creator: address,
        question_hash: field, category: u8, num_outcomes: u8, deadline: u32,
        resolution_deadline: u32, resolver: address, initial_liquidity: u128, token_type: u8,
    ) {
        transfer_future.await();
        let market_exists: bool = markets.contains(market_id);
        assert(!market_exists);
        let current_height: u32 = block.height;
        assert(deadline > current_height);
        assert(resolution_deadline > deadline);

        let per_outcome: u128 = initial_liquidity / (num_outcomes as u128);
        let r3: u128 = num_outcomes >= 3u8 ? per_outcome : 0u128;
        let r4: u128 = num_outcomes >= 4u8 ? per_outcome : 0u128;

        markets.set(market_id, Market {
            id: market_id, creator: creator, resolver: resolver,
            question_hash: question_hash, category: category, num_outcomes: num_outcomes,
            deadline: deadline, resolution_deadline: resolution_deadline,
            status: STATUS_ACTIVE, created_at: current_height, token_type: token_type,
        });
        amm_pools.set(market_id, AMMPool {
            market_id: market_id, reserve_1: per_outcome, reserve_2: per_outcome,
            reserve_3: r3, reserve_4: r4, total_liquidity: initial_liquidity,
            total_lp_shares: initial_liquidity, total_volume: 0u128,
        });
        market_fees.set(market_id, MarketFees {
            market_id: market_id, protocol_fees: 0u128, creator_fees: 0u128,
        });
        program_credits.set(token_type, program_credits.get_or_use(token_type, 0u128) + initial_liquidity);
        market_credits.set(market_id, initial_liquidity);
    }

    // ========================================================================
    // 2. BUY SHARES (USDCX)
    // ========================================================================

    async transition acquire_shares(
        private market_id: field, private outcome: u8, private amount_in: u128,
        private expected_shares: u128, private min_shares_out: u128,
        private share_nonce: field,
        private token_in: test_usdcx_stablecoin.aleo/Token,
        private proofs: [MerkleProof; 2],
    ) -> (OutcomeShare, test_usdcx_stablecoin.aleo/ComplianceRecord, test_usdcx_stablecoin.aleo/Token, Future) {
        assert(outcome >= 1u8 && outcome <= 4u8);
        assert(amount_in >= MIN_TRADE_AMOUNT);

        let share: OutcomeShare = OutcomeShare {
            owner: self.signer, market_id: market_id, outcome: outcome,
            quantity: expected_shares, share_nonce: share_nonce, token_type: TOKEN_USDCX,
        };

        let (compliance_rec, change_token, transfer_future): (
            test_usdcx_stablecoin.aleo/ComplianceRecord,
            test_usdcx_stablecoin.aleo/Token, Future
        ) = test_usdcx_stablecoin.aleo/transfer_private_to_public(
            self.address, amount_in, token_in, proofs
        );

        return (share, compliance_rec, change_token, acquire_shares_finalize(
            transfer_future, market_id, outcome, amount_in, expected_shares, min_shares_out, TOKEN_USDCX
        ));
    }

    async function acquire_shares_finalize(
        transfer_future: Future, market_id: field, outcome: u8,
        amount_in: u128, expected_shares: u128, min_shares_out: u128, token_type: u8,
    ) {
        transfer_future.await();
        let market: Market = markets.get(market_id);
        assert(market.status == STATUS_ACTIVE);
        assert(market.token_type == token_type);
        assert(outcome >= 1u8 && outcome <= market.num_outcomes);
        let current_height: u32 = block.height;
        assert(current_height <= market.deadline);

        let protocol_fee: u128 = (amount_in * PROTOCOL_FEE_BPS) / FEE_DENOMINATOR;
        let creator_fee: u128 = (amount_in * CREATOR_FEE_BPS) / FEE_DENOMINATOR;
        let amount_to_pool: u128 = amount_in - protocol_fee - creator_fee;

        let fees: MarketFees = market_fees.get(market_id);
        market_fees.set(market_id, MarketFees {
            market_id: market_id,
            protocol_fees: fees.protocol_fees + protocol_fee,
            creator_fees: fees.creator_fees + creator_fee,
        });

        let pool: AMMPool = amm_pools.get(market_id);
        let n: u8 = market.num_outcomes;
        let r1: u128 = pool.reserve_1;
        let r2: u128 = pool.reserve_2;
        let r3: u128 = pool.reserve_3;
        let r4: u128 = pool.reserve_4;
        let a: u128 = amount_to_pool;

        let r_i: u128 = outcome == 1u8 ? r1 : (outcome == 2u8 ? r2 : (outcome == 3u8 ? r3 : r4));
        let step0: u128 = r_i;
        let step1: u128 = outcome != 1u8 ? (step0 * r1) / (r1 + a) : step0;
        let step2: u128 = outcome != 2u8 ? (step1 * r2) / (r2 + a) : step1;
        let step3: u128 = (outcome != 3u8 && n >= 3u8) ? (step2 * r3) / (r3 + a) : step2;
        let step4: u128 = (outcome != 4u8 && n >= 4u8) ? (step3 * r4) / (r4 + a) : step3;

        let r_i_new: u128 = step4;
        let shares_out: u128 = (r_i + a) - r_i_new;
        assert(shares_out >= min_shares_out);
        assert(shares_out >= expected_shares);
        assert(shares_out > 0u128);

        let new_r1: u128 = outcome == 1u8 ? r_i_new : (r1 + a);
        let new_r2: u128 = outcome == 2u8 ? r_i_new : (r2 + a);
        let nr3_active: u128 = outcome == 3u8 ? r_i_new : (r3 + a);
        let new_r3: u128 = n >= 3u8 ? nr3_active : 0u128;
        let nr4_active: u128 = outcome == 4u8 ? r_i_new : (r4 + a);
        let new_r4: u128 = n >= 4u8 ? nr4_active : 0u128;

        amm_pools.set(market_id, AMMPool {
            market_id: market_id, reserve_1: new_r1, reserve_2: new_r2,
            reserve_3: new_r3, reserve_4: new_r4,
            total_liquidity: pool.total_liquidity + amount_to_pool,
            total_lp_shares: pool.total_lp_shares, total_volume: pool.total_volume + amount_in,
        });
        program_credits.set(token_type, program_credits.get_or_use(token_type, 0u128) + amount_in);
        market_credits.set(market_id, market_credits.get_or_use(market_id, 0u128) + amount_in);
    }

    // ========================================================================
    // 3. SELL SHARES (USDCX)
    // ========================================================================

    async transition dispose_shares(
        private shares: OutcomeShare, private tokens_desired: u128, private max_shares_used: u128,
    ) -> (OutcomeShare, test_usdcx_stablecoin.aleo/ComplianceRecord, test_usdcx_stablecoin.aleo/Token, Future) {
        assert(shares.owner == self.signer);
        assert(shares.token_type == TOKEN_USDCX);
        assert(tokens_desired >= MIN_TRADE_AMOUNT);
        assert(max_shares_used > 0u128);
        assert(max_shares_used <= shares.quantity);

        let protocol_fee: u128 = (tokens_desired * PROTOCOL_FEE_BPS) / FEE_DENOMINATOR;
        let creator_fee: u128 = (tokens_desired * CREATOR_FEE_BPS) / FEE_DENOMINATOR;
        let lp_fee: u128 = (tokens_desired * LP_FEE_BPS) / FEE_DENOMINATOR;
        let net_tokens: u128 = tokens_desired - protocol_fee - creator_fee - lp_fee;

        let (compliance_rec, payout_token, transfer_future): (
            test_usdcx_stablecoin.aleo/ComplianceRecord,
            test_usdcx_stablecoin.aleo/Token, Future
        ) = test_usdcx_stablecoin.aleo/transfer_public_to_private(self.signer, net_tokens);

        let remainder: OutcomeShare = OutcomeShare {
            owner: self.signer, market_id: shares.market_id, outcome: shares.outcome,
            quantity: shares.quantity - max_shares_used, share_nonce: shares.share_nonce,
            token_type: TOKEN_USDCX,
        };

        return (remainder, compliance_rec, payout_token, dispose_shares_finalize(
            transfer_future, shares.market_id, shares.outcome,
            tokens_desired, max_shares_used, TOKEN_USDCX
        ));
    }

    async function dispose_shares_finalize(
        transfer_future: Future, market_id: field, outcome: u8,
        tokens_desired: u128, max_shares_used: u128, token_type: u8,
    ) {
        transfer_future.await();
        let market: Market = markets.get(market_id);
        assert(market.status == STATUS_ACTIVE);
        assert(market.token_type == token_type);
        assert(outcome >= 1u8 && outcome <= market.num_outcomes);
        let current_height: u32 = block.height;
        assert(current_height <= market.deadline);

        let protocol_fee: u128 = (tokens_desired * PROTOCOL_FEE_BPS) / FEE_DENOMINATOR;
        let creator_fee: u128 = (tokens_desired * CREATOR_FEE_BPS) / FEE_DENOMINATOR;
        let lp_fee: u128 = (tokens_desired * LP_FEE_BPS) / FEE_DENOMINATOR;
        let pool_tokens_out: u128 = tokens_desired - lp_fee;
        let net_tokens: u128 = tokens_desired - protocol_fee - creator_fee - lp_fee;

        let fees: MarketFees = market_fees.get(market_id);
        market_fees.set(market_id, MarketFees {
            market_id: market_id,
            protocol_fees: fees.protocol_fees + protocol_fee,
            creator_fees: fees.creator_fees + creator_fee,
        });

        let pool: AMMPool = amm_pools.get(market_id);
        let n: u8 = market.num_outcomes;
        let r1: u128 = pool.reserve_1;
        let r2: u128 = pool.reserve_2;
        let r3: u128 = pool.reserve_3;
        let r4: u128 = pool.reserve_4;
        let p: u128 = pool_tokens_out;

        let r_i: u128 = outcome == 1u8 ? r1 : (outcome == 2u8 ? r2 : (outcome == 3u8 ? r3 : r4));

        let sub1: u128 = outcome != 1u8 ? p : 0u128;
        assert(r1 >= sub1);
        let den1: u128 = r1 - sub1;
        let step0: u128 = r_i;
        let step1: u128 = outcome != 1u8 ? (step0 * r1) / den1 : step0;

        let sub2: u128 = outcome != 2u8 ? p : 0u128;
        assert(r2 >= sub2);
        let den2: u128 = r2 - sub2;
        let step2: u128 = outcome != 2u8 ? (step1 * r2) / den2 : step1;

        let apply3: bool = outcome != 3u8 && n >= 3u8;
        let sub3: u128 = apply3 ? p : 0u128;
        assert(r3 >= sub3);
        let den3_raw: u128 = r3 - sub3;
        let safe_den3: u128 = den3_raw == 0u128 ? 1u128 : den3_raw;
        let step3: u128 = apply3 ? (step2 * r3) / safe_den3 : step2;

        let apply4: bool = outcome != 4u8 && n >= 4u8;
        let sub4: u128 = apply4 ? p : 0u128;
        assert(r4 >= sub4);
        let den4_raw: u128 = r4 - sub4;
        let safe_den4: u128 = den4_raw == 0u128 ? 1u128 : den4_raw;
        let step4: u128 = apply4 ? (step3 * r4) / safe_den4 : step3;

        let r_i_new: u128 = step4;
        let shares_needed: u128 = r_i_new - r_i + p;
        assert(shares_needed <= max_shares_used);
        assert(shares_needed > 0u128);

        let new_r1: u128 = outcome == 1u8 ? r_i_new : (r1 - sub1);
        let new_r2: u128 = outcome == 2u8 ? r_i_new : (r2 - sub2);
        let nr3_act: u128 = outcome == 3u8 ? r_i_new : (r3 - sub3);
        let new_r3: u128 = n >= 3u8 ? nr3_act : 0u128;
        let nr4_act: u128 = outcome == 4u8 ? r_i_new : (r4 - sub4);
        let new_r4: u128 = n >= 4u8 ? nr4_act : 0u128;

        amm_pools.set(market_id, AMMPool {
            market_id: market_id, reserve_1: new_r1, reserve_2: new_r2,
            reserve_3: new_r3, reserve_4: new_r4,
            total_liquidity: pool.total_liquidity - pool_tokens_out,
            total_lp_shares: pool.total_lp_shares, total_volume: pool.total_volume + tokens_desired,
        });

        let market_held: u128 = market_credits.get_or_use(market_id, 0u128);
        assert(market_held >= pool_tokens_out);
        market_credits.set(market_id, market_held - pool_tokens_out);
        let current_held: u128 = program_credits.get_or_use(token_type, 0u128);
        assert(current_held >= net_tokens);
        program_credits.set(token_type, current_held - net_tokens);
    }

    // ========================================================================
    // 4. ADD LIQUIDITY (USDCX)
    // ========================================================================

    async transition fund_pool(
        private market_id: field, private amount: u128,
        private expected_lp_shares: u128, private lp_nonce: field,
        private token_in: test_usdcx_stablecoin.aleo/Token,
        private proofs: [MerkleProof; 2],
    ) -> (LPToken, test_usdcx_stablecoin.aleo/ComplianceRecord, test_usdcx_stablecoin.aleo/Token, Future) {
        assert(amount >= MIN_LIQUIDITY);
        let lp_token: LPToken = LPToken {
            owner: self.signer, market_id: market_id, lp_shares: expected_lp_shares,
            lp_nonce: lp_nonce, token_type: TOKEN_USDCX,
        };
        let (compliance_rec, change_token, transfer_future): (
            test_usdcx_stablecoin.aleo/ComplianceRecord,
            test_usdcx_stablecoin.aleo/Token, Future
        ) = test_usdcx_stablecoin.aleo/transfer_private_to_public(
            self.address, amount, token_in, proofs
        );
        return (lp_token, compliance_rec, change_token, fund_pool_finalize(
            transfer_future, market_id, amount, expected_lp_shares, TOKEN_USDCX
        ));
    }

    async function fund_pool_finalize(
        transfer_future: Future, market_id: field, amount: u128,
        expected_lp_shares: u128, token_type: u8,
    ) {
        transfer_future.await();
        let market: Market = markets.get(market_id);
        assert(market.status == STATUS_ACTIVE);
        assert(market.token_type == token_type);
        let current_height: u32 = block.height;
        assert(current_height <= market.deadline);

        let pool: AMMPool = amm_pools.get(market_id);
        let total_reserves: u128 = pool.reserve_1 + pool.reserve_2 + pool.reserve_3 + pool.reserve_4;
        assert(total_reserves > 0u128);
        let computed_shares: u128 = (amount * pool.total_lp_shares) / total_reserves;
        assert(computed_shares >= expected_lp_shares);
        assert(expected_lp_shares > 0u128);

        let add_1: u128 = (amount * pool.reserve_1) / total_reserves;
        let add_2: u128 = (amount * pool.reserve_2) / total_reserves;
        let add_3: u128 = (amount * pool.reserve_3) / total_reserves;
        let add_4: u128 = amount - add_1 - add_2 - add_3;

        amm_pools.set(market_id, AMMPool {
            market_id: market_id,
            reserve_1: pool.reserve_1 + add_1, reserve_2: pool.reserve_2 + add_2,
            reserve_3: pool.reserve_3 + add_3, reserve_4: pool.reserve_4 + add_4,
            total_liquidity: pool.total_liquidity + amount,
            total_lp_shares: pool.total_lp_shares + expected_lp_shares,
            total_volume: pool.total_volume,
        });
        program_credits.set(token_type, program_credits.get_or_use(token_type, 0u128) + amount);
        market_credits.set(market_id, market_credits.get_or_use(market_id, 0u128) + amount);
    }

    // ========================================================================
    // 5. CLOSE MARKET
    // ========================================================================

    async transition lock_market(public market_id: field) -> Future {
        return lock_market_finalize(market_id);
    }

    async function lock_market_finalize(market_id: field) {
        let market: Market = markets.get(market_id);
        assert(market.status == STATUS_ACTIVE);
        let current_height: u32 = block.height;
        assert(current_height > market.deadline);
        markets.set(market_id, Market {
            id: market.id, creator: market.creator, resolver: market.resolver,
            question_hash: market.question_hash, category: market.category,
            num_outcomes: market.num_outcomes, deadline: market.deadline,
            resolution_deadline: market.resolution_deadline, status: STATUS_CLOSED,
            created_at: market.created_at, token_type: market.token_type,
        });
    }

    // ========================================================================
    // 6. RESOLVE MARKET
    // ========================================================================

    async transition render_verdict(public market_id: field, public winning_outcome: u8) -> Future {
        return render_verdict_finalize(market_id, winning_outcome, self.signer);
    }

    async function render_verdict_finalize(market_id: field, winning_outcome: u8, resolver: address) {
        let market: Market = markets.get(market_id);
        assert(market.resolver == resolver);
        assert(winning_outcome >= 1u8 && winning_outcome <= market.num_outcomes);
        let current_height: u32 = block.height;
        let is_closed: bool = market.status == STATUS_CLOSED;
        let is_past_deadline: bool = market.status == STATUS_ACTIVE && current_height > market.deadline;
        assert(is_closed || is_past_deadline);
        assert(current_height <= market.resolution_deadline);
        let challenge_deadline: u32 = current_height + CHALLENGE_WINDOW;
        market_resolutions.set(market_id, MarketResolution {
            market_id: market_id, winning_outcome: winning_outcome,
            resolved_at: current_height, challenge_deadline: challenge_deadline, finalized: false,
        });
        markets.set(market_id, Market {
            id: market.id, creator: market.creator, resolver: market.resolver,
            question_hash: market.question_hash, category: market.category,
            num_outcomes: market.num_outcomes, deadline: market.deadline,
            resolution_deadline: market.resolution_deadline, status: STATUS_PENDING_RESOLUTION,
            created_at: market.created_at, token_type: market.token_type,
        });
    }

    // ========================================================================
    // 7. FINALIZE RESOLUTION
    // ========================================================================

    async transition ratify_verdict(public market_id: field) -> Future {
        return ratify_verdict_finalize(market_id);
    }

    async function ratify_verdict_finalize(market_id: field) {
        let market: Market = markets.get(market_id);
        assert(market.status == STATUS_PENDING_RESOLUTION);
        let resolution: MarketResolution = market_resolutions.get(market_id);
        assert(!resolution.finalized);
        let current_height: u32 = block.height;
        assert(current_height > resolution.challenge_deadline);
        market_resolutions.set(market_id, MarketResolution {
            market_id: market_id, winning_outcome: resolution.winning_outcome,
            resolved_at: resolution.resolved_at, challenge_deadline: resolution.challenge_deadline,
            finalized: true,
        });
        markets.set(market_id, Market {
            id: market.id, creator: market.creator, resolver: market.resolver,
            question_hash: market.question_hash, category: market.category,
            num_outcomes: market.num_outcomes, deadline: market.deadline,
            resolution_deadline: market.resolution_deadline, status: STATUS_RESOLVED,
            created_at: market.created_at, token_type: market.token_type,
        });
    }

    // ========================================================================
    // 8. CANCEL MARKET
    // ========================================================================

    async transition void_market(public market_id: field) -> Future {
        return void_market_finalize(market_id, self.signer);
    }

    async function void_market_finalize(market_id: field, caller: address) {
        let market: Market = markets.get(market_id);
        let current_height: u32 = block.height;
        let is_creator_cancel: bool = market.creator == caller && market.status == STATUS_ACTIVE;
        let is_emergency: bool = current_height > market.resolution_deadline
            && market.status != STATUS_RESOLVED && market.status != STATUS_CANCELLED
            && market.status != STATUS_PENDING_RESOLUTION;
        assert(is_creator_cancel || is_emergency);
        let pool: AMMPool = amm_pools.get(market_id);
        assert(!is_creator_cancel || pool.total_volume == 0u128);
        markets.set(market_id, Market {
            id: market.id, creator: market.creator, resolver: market.resolver,
            question_hash: market.question_hash, category: market.category,
            num_outcomes: market.num_outcomes, deadline: market.deadline,
            resolution_deadline: market.resolution_deadline, status: STATUS_CANCELLED,
            created_at: market.created_at, token_type: market.token_type,
        });
    }

    // ========================================================================
    // 9. LIGHTNING SETTLE
    // ========================================================================

    async transition flash_settle(public market_id: field, public winning_outcome: u8) -> Future {
        return flash_settle_finalize(market_id, winning_outcome, self.signer);
    }

    async function flash_settle_finalize(market_id: field, winning_outcome: u8, caller: address) {
        let market: Market = markets.get(market_id);
        assert(market.resolver == caller);
        let is_active: bool = market.status == STATUS_ACTIVE;
        let is_closed: bool = market.status == STATUS_CLOSED;
        assert(is_active || is_closed);
        assert(winning_outcome >= 1u8 && winning_outcome <= market.num_outcomes);
        let current_height: u32 = block.height;
        market_resolutions.set(market_id, MarketResolution {
            market_id: market_id, winning_outcome: winning_outcome,
            resolved_at: current_height, challenge_deadline: current_height, finalized: true,
        });
        markets.set(market_id, Market {
            id: market.id, creator: market.creator, resolver: market.resolver,
            question_hash: market.question_hash, category: market.category,
            num_outcomes: market.num_outcomes, deadline: market.deadline,
            resolution_deadline: market.resolution_deadline, status: STATUS_RESOLVED,
            created_at: market.created_at, token_type: market.token_type,
        });
    }

    // ========================================================================
    // 10. DISPUTE (bond in ALEO)
    // ========================================================================

    async transition contest_verdict(
        private market_id: field, private proposed_outcome: u8,
        private dispute_nonce: field, private credits_in: credits.aleo/credits,
    ) -> (DisputeBondReceipt, credits.aleo/credits, Future) {
        let receipt: DisputeBondReceipt = DisputeBondReceipt {
            owner: self.signer, market_id: market_id, proposed_outcome: proposed_outcome,
            bond_amount: MIN_DISPUTE_BOND, dispute_nonce: dispute_nonce,
        };
        let bond_u64: u64 = MIN_DISPUTE_BOND as u64;
        let (change, transfer_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(credits_in, self.address, bond_u64);
        return (receipt, change, contest_verdict_finalize(
            transfer_future, market_id, proposed_outcome, self.signer
        ));
    }

    async function contest_verdict_finalize(
        transfer_future: Future, market_id: field, proposed_outcome: u8, disputer: address,
    ) {
        transfer_future.await();
        let market: Market = markets.get(market_id);
        assert(market.status == STATUS_PENDING_RESOLUTION);
        let resolution: MarketResolution = market_resolutions.get(market_id);
        assert(!resolution.finalized);
        let current_height: u32 = block.height;
        assert(current_height <= resolution.challenge_deadline);
        assert(proposed_outcome != resolution.winning_outcome);
        assert(proposed_outcome >= 1u8 && proposed_outcome <= market.num_outcomes);
        markets.set(market_id, Market {
            id: market.id, creator: market.creator, resolver: market.resolver,
            question_hash: market.question_hash, category: market.category,
            num_outcomes: market.num_outcomes, deadline: market.deadline,
            resolution_deadline: market.resolution_deadline, status: STATUS_CLOSED,
            created_at: market.created_at, token_type: market.token_type,
        });
        market_resolutions.remove(market_id);
        let current_held: u128 = program_credits.get_or_use(0u8, 0u128);
        program_credits.set(0u8, current_held + MIN_DISPUTE_BOND);
    }

    // ========================================================================
    // 11. RECOVER DISPUTE BOND
    // ========================================================================

    async transition recover_bond(private receipt: DisputeBondReceipt) -> (credits.aleo/credits, Future) {
        assert(receipt.owner == self.signer);
        let claim_key: field = BHP256::hash_to_field(DisputeClaimKey {
            market_id: receipt.market_id, claimer: self.signer, dispute_nonce: receipt.dispute_nonce,
        });
        let bond_u64: u64 = receipt.bond_amount as u64;
        let (payout, transfer_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_public_to_private(self.signer, bond_u64);
        return (payout, recover_bond_finalize(transfer_future, claim_key, receipt.market_id, receipt.bond_amount));
    }

    async function recover_bond_finalize(
        transfer_future: Future, claim_key: field, market_id: field, bond_amount: u128,
    ) {
        transfer_future.await();
        let market: Market = markets.get(market_id);
        let is_resolved: bool = market.status == STATUS_RESOLVED;
        let is_cancelled: bool = market.status == STATUS_CANCELLED;
        assert(is_resolved || is_cancelled);
        let already_claimed: bool = share_redeemed.get_or_use(claim_key, false);
        assert(!already_claimed);
        share_redeemed.set(claim_key, true);
        let current_held: u128 = program_credits.get_or_use(0u8, 0u128);
        assert(current_held >= bond_amount);
        program_credits.set(0u8, current_held - bond_amount);
    }

    // ========================================================================
    // 12. REDEEM WINNING SHARES (USDCX)
    // ========================================================================

    async transition harvest_winnings(
        private shares: OutcomeShare,
    ) -> (test_usdcx_stablecoin.aleo/ComplianceRecord, test_usdcx_stablecoin.aleo/Token, Future) {
        assert(shares.owner == self.signer);
        assert(shares.token_type == TOKEN_USDCX);
        assert(shares.quantity > 0u128);
        let claim_key: field = BHP256::hash_to_field(ShareClaimKey {
            market_id: shares.market_id, claimer: self.signer, share_nonce: shares.share_nonce,
        });
        let (compliance_rec, payout_token, transfer_future): (
            test_usdcx_stablecoin.aleo/ComplianceRecord,
            test_usdcx_stablecoin.aleo/Token, Future
        ) = test_usdcx_stablecoin.aleo/transfer_public_to_private(self.signer, shares.quantity);
        return (compliance_rec, payout_token, harvest_winnings_finalize(
            transfer_future, claim_key, shares.market_id, shares.outcome, shares.quantity, TOKEN_USDCX
        ));
    }

    async function harvest_winnings_finalize(
        transfer_future: Future, claim_key: field, market_id: field,
        outcome: u8, quantity: u128, token_type: u8,
    ) {
        transfer_future.await();
        let market: Market = markets.get(market_id);
        assert(market.status == STATUS_RESOLVED);
        assert(market.token_type == token_type);
        let resolution: MarketResolution = market_resolutions.get(market_id);
        assert(resolution.finalized);
        assert(outcome == resolution.winning_outcome);
        let already_claimed: bool = share_redeemed.get_or_use(claim_key, false);
        assert(!already_claimed);
        share_redeemed.set(claim_key, true);
        let market_held: u128 = market_credits.get_or_use(market_id, 0u128);
        assert(market_held >= quantity);
        market_credits.set(market_id, market_held - quantity);
        let current_held: u128 = program_credits.get_or_use(token_type, 0u128);
        assert(current_held >= quantity);
        program_credits.set(token_type, current_held - quantity);
    }

    // ========================================================================
    // 13. CLAIM REFUND (USDCX)
    // ========================================================================

    async transition harvest_refund(
        private shares: OutcomeShare,
    ) -> (RefundClaim, test_usdcx_stablecoin.aleo/ComplianceRecord, test_usdcx_stablecoin.aleo/Token, Future) {
        assert(shares.owner == self.signer);
        assert(shares.token_type == TOKEN_USDCX);
        assert(shares.quantity > 0u128);
        let claim_key: field = BHP256::hash_to_field(ShareClaimKey {
            market_id: shares.market_id, claimer: self.signer, share_nonce: shares.share_nonce,
        });
        let refund: RefundClaim = RefundClaim {
            owner: self.signer, market_id: shares.market_id, amount: shares.quantity,
            claim_nonce: shares.share_nonce, token_type: TOKEN_USDCX,
        };
        let (compliance_rec, payout_token, transfer_future): (
            test_usdcx_stablecoin.aleo/ComplianceRecord,
            test_usdcx_stablecoin.aleo/Token, Future
        ) = test_usdcx_stablecoin.aleo/transfer_public_to_private(self.signer, shares.quantity);
        return (refund, compliance_rec, payout_token, harvest_refund_finalize(
            transfer_future, claim_key, shares.market_id, shares.quantity, TOKEN_USDCX
        ));
    }

    async function harvest_refund_finalize(
        transfer_future: Future, claim_key: field, market_id: field,
        amount: u128, token_type: u8,
    ) {
        transfer_future.await();
        let market: Market = markets.get(market_id);
        assert(market.status == STATUS_CANCELLED);
        assert(market.token_type == token_type);
        let already_claimed: bool = share_redeemed.get_or_use(claim_key, false);
        assert(!already_claimed);
        share_redeemed.set(claim_key, true);
        let market_held: u128 = market_credits.get_or_use(market_id, 0u128);
        assert(market_held >= amount);
        market_credits.set(market_id, market_held - amount);
        let current_held: u128 = program_credits.get_or_use(token_type, 0u128);
        assert(current_held >= amount);
        program_credits.set(token_type, current_held - amount);
    }

    // ========================================================================
    // 14. WITHDRAW LP (USDCX)
    // ========================================================================

    async transition withdraw_pool(
        private lp_token: LPToken, private min_tokens_out: u128,
    ) -> (test_usdcx_stablecoin.aleo/ComplianceRecord, test_usdcx_stablecoin.aleo/Token, Future) {
        assert(lp_token.owner == self.signer);
        assert(lp_token.token_type == TOKEN_USDCX);
        assert(lp_token.lp_shares > 0u128);
        assert(min_tokens_out > 0u128);
        let claim_key: field = BHP256::hash_to_field(LPClaimKey {
            market_id: lp_token.market_id, claimer: self.signer, lp_nonce: lp_token.lp_nonce,
        });
        let (compliance_rec, payout_token, transfer_future): (
            test_usdcx_stablecoin.aleo/ComplianceRecord,
            test_usdcx_stablecoin.aleo/Token, Future
        ) = test_usdcx_stablecoin.aleo/transfer_public_to_private(self.signer, min_tokens_out);
        return (compliance_rec, payout_token, withdraw_pool_finalize(
            transfer_future, claim_key, lp_token.market_id, lp_token.lp_shares, min_tokens_out, TOKEN_USDCX
        ));
    }

    async function withdraw_pool_finalize(
        transfer_future: Future, claim_key: field, market_id: field,
        lp_shares: u128, min_tokens_out: u128, token_type: u8,
    ) {
        transfer_future.await();
        let market: Market = markets.get(market_id);
        let is_resolved: bool = market.status == STATUS_RESOLVED;
        let is_cancelled: bool = market.status == STATUS_CANCELLED;
        assert(is_resolved || is_cancelled);
        assert(market.token_type == token_type);
        if (is_resolved) {
            let resolution: MarketResolution = market_resolutions.get(market_id);
            assert(resolution.finalized);
        }
        let already_claimed: bool = lp_positions.get_or_use(claim_key, false);
        assert(!already_claimed);
        lp_positions.set(claim_key, true);
        let pool: AMMPool = amm_pools.get(market_id);
        let market_held: u128 = market_credits.get_or_use(market_id, 0u128);
        let tokens_out: u128 = is_resolved ?
            (lp_shares * market_held) / pool.total_lp_shares :
            (lp_shares * (pool.reserve_1 + pool.reserve_2 + pool.reserve_3 + pool.reserve_4)) / pool.total_lp_shares;
        assert(tokens_out >= min_tokens_out);
        assert(tokens_out > 0u128);
        market_credits.set(market_id, market_held - tokens_out);
        let current_held: u128 = program_credits.get_or_use(token_type, 0u128);
        assert(current_held >= tokens_out);
        program_credits.set(token_type, current_held - tokens_out);
        amm_pools.set(market_id, AMMPool {
            market_id: market_id, reserve_1: pool.reserve_1, reserve_2: pool.reserve_2,
            reserve_3: pool.reserve_3, reserve_4: pool.reserve_4,
            total_liquidity: pool.total_liquidity,
            total_lp_shares: pool.total_lp_shares - lp_shares, total_volume: pool.total_volume,
        });
    }

    // ========================================================================
    // 15. WITHDRAW CREATOR FEES (USDCX)
    // ========================================================================

    async transition harvest_fees(public market_id: field, public expected_amount: u128) -> Future {
        assert(expected_amount > 0u128);
        let transfer_future: Future = test_usdcx_stablecoin.aleo/transfer_public(self.signer, expected_amount);
        return harvest_fees_finalize(transfer_future, market_id, self.signer, expected_amount);
    }

    async function harvest_fees_finalize(
        transfer_future: Future, market_id: field, caller: address, expected_amount: u128,
    ) {
        transfer_future.await();
        let market: Market = markets.get(market_id);
        assert(market.status == STATUS_RESOLVED);
        assert(market.creator == caller);
        let resolution: MarketResolution = market_resolutions.get(market_id);
        assert(resolution.finalized);
        let already_claimed: bool = creator_fees_claimed.get_or_use(market_id, false);
        assert(!already_claimed);
        creator_fees_claimed.set(market_id, true);
        let fees: MarketFees = market_fees.get(market_id);
        assert(fees.creator_fees >= expected_amount);
        let market_held: u128 = market_credits.get_or_use(market_id, 0u128);
        assert(market_held >= expected_amount);
        market_credits.set(market_id, market_held - expected_amount);
        let token_type: u8 = market.token_type;
        let current_held: u128 = program_credits.get_or_use(token_type, 0u128);
        assert(current_held >= expected_amount);
        program_credits.set(token_type, current_held - expected_amount);
    }
}
