import Card from '@/components/shared/Card';
import PageHeader from '@/components/layout/PageHeader';
import { ShieldIcon, BoltIcon, LockIcon, ChartIcon, PoolIcon, ZKProofIcon } from '@/components/icons';

export default function Docs() {
  return (
    <div>
      <PageHeader
        title="Documentation"
        subtitle="Learn how Veil Strike works under the hood"
      />

      <div className="space-y-8 mt-6 max-w-4xl">
        {/* Overview */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShieldIcon className="w-6 h-6 text-teal" />
            <h2 className="text-lg font-heading font-bold text-white">What is Veil Strike?</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
            <p>
              Veil Strike is a privacy-first prediction market protocol built on the Aleo blockchain.
              It uses zero-knowledge proofs to protect trader identities while maintaining transparent market mechanics.
            </p>
            <p>
              Unlike traditional prediction markets (Polymarket, Augur), Veil Strike ensures that no one &mdash;
              not even the protocol operators &mdash; can see who is trading, how much they hold, or their
              profit/loss history.
            </p>
            <p>
              <span className="text-white font-medium">v7 Architecture:</span> Three independent Leo programs &mdash;
              <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">veil_strike_v7.aleo</code> (ALEO + Governance + Resolver Registry),
              <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">veil_strike_v7_cx.aleo</code> (USDCx), and
              <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">veil_strike_v7_sd.aleo</code> (USAD). Total: 53 transitions across 3 deployed programs.
            </p>
          </div>
        </Card>

        {/* How FPMM Works */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <ChartIcon className="w-6 h-6 text-teal" />
            <h2 className="text-lg font-heading font-bold text-white">How FPMM Works</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
            <p>
              Veil Strike uses a <span className="text-teal">Fixed Product Market Maker (FPMM)</span> — the same
              model used by Uniswap. Each market has reserves for each outcome, and prices are determined
              by the ratio of reserves.
            </p>
            <p>
              <span className="text-white font-medium">Buy formula:</span> When you buy shares of outcome i,
              the protocol calculates: shares_out = (reserve_i + amount) - reserve_i × ∏(reserve_k / (reserve_k + amount))
            </p>
            <p>
              <span className="text-white font-medium">Price discovery:</span> Price of outcome i =
              ∏(reserve_k for k≠i) / Σ(∏(reserve_k for k≠j) for all j). Prices always sum to 1.0.
            </p>
            <p>
              <span className="text-white font-medium">Fees:</span> 0.5% protocol fee + 0.5% creator fee +
              1% LP fee = 2% total. Fees are deducted before shares are minted.
            </p>
          </div>
        </Card>

        {/* Privacy Model */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <LockIcon className="w-6 h-6 text-teal" />
            <h2 className="text-lg font-heading font-bold text-white">Privacy Model</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
            <p>
              Veil Strike achieves privacy through Aleo&apos;s record model and careful program design:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">•</span>
                <span><span className="text-white">Deposits:</span> Credits are transferred using <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">credits.aleo/transfer_private_to_public</code>, which hides the depositor&apos;s address.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">•</span>
                <span><span className="text-white">Positions:</span> Share positions are stored as private records visible only to the holder. No on-chain mapping links addresses to positions.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">•</span>
                <span><span className="text-white">Payouts:</span> Redemptions use <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">credits.aleo/transfer_public_to_private</code>, which hides the recipient.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">•</span>
                <span><span className="text-white">Market creation:</span> Market IDs are derived from BHP256 hashing of a nonce — no creator address in the hash.</span>
              </li>
            </ul>
          </div>
        </Card>

        {/* Lightning Markets */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <BoltIcon className="w-6 h-6 text-amber-400" />
            <h2 className="text-lg font-heading font-bold text-white">Strike Rounds</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
            <p>
              Strike Rounds are 15-minute price prediction markets where you bet UP or DOWN
              on BTC, ETH, or ALEO prices. Three concurrent slots run — all denominated in USDCx.
            </p>
            <p>
              The <strong className="text-white">Round Bot</strong> automates the full lifecycle using
              <strong className="text-teal"> delegated proving</strong> (~30s per transaction via Provable API).
              Every 15 minutes the bot creates 3 markets (BTC-USDCx, ETH-USDCx, ALEO-USDCx), waits for the
              timer to expire, compares oracle start vs end price, and calls
              <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs mx-1">flash_settle</code>
              on-chain for every market — including empty ones (ensures clean on-chain state). After settlement
              the bot immediately creates the next round. Admin can still override any round manually from
              the Admin page.
            </p>
            <p>
              <span className="text-white font-medium">Smart Recovery:</span> On restart, the bot detects
              live rounds that haven&apos;t expired and keeps them running. Expired or transient rounds are
              reset to idle and the bot creates fresh markets. A settle retry limit (max 3) prevents
              permanent stuck states.
            </p>
          </div>
        </Card>

        {/* Prediction Pools */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <PoolIcon className="w-6 h-6 text-teal" />
            <h2 className="text-lg font-heading font-bold text-white">Prediction Pools</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
            <p>
              Prediction pools allow multiple traders to combine capital and trade collaboratively.
              Pool creators define target size, minimum entry, and target markets.
            </p>
            <p>
              Pool members receive <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">PoolMembership</code> records
              proportional to their contribution. When markets resolve, winnings are distributed
              pro-rata to all members.
            </p>
          </div>
        </Card>

        {/* Shield Wallet */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <ZKProofIcon className="w-6 h-6 text-teal" />
            <h2 className="text-lg font-heading font-bold text-white">Shield Wallet Integration</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
            <p>
              Veil Strike integrates with Provable&apos;s Shield Wallet for seamless ZK proof generation
              via delegated proving. Proofs are generated server-side (~14 seconds) instead of
              in-browser, dramatically improving UX.
            </p>
            <p>
              All transactions use <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">privateFee: false</code> to
              ensure compatibility with Shield&apos;s proving infrastructure. The smart contract is
              designed so that only the user&apos;s records require private input, while all global
              state updates happen in finalize.
            </p>
          </div>
        </Card>

        {/* Stablecoins */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <ShieldIcon className="w-6 h-6 text-teal" />
            <h2 className="text-lg font-heading font-bold text-white">Stablecoins &mdash; USDCx &amp; USAD</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
            <p>
              Veil Strike supports two privacy-native stablecoins on Aleo, both backed 1:1 by real-world reserves:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span><span className="text-white">USDCx</span> &mdash; Backed 1:1 by USDC held in Circle xReserve. Bridge USDC from Ethereum to Aleo at <a href="https://usdcx.aleo.org" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">usdcx.aleo.org</a>. Program: <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">usdcx_stablecoin.aleo</code></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span><span className="text-white">USAD</span> &mdash; Backed 1:1 by USDG (Global Dollar Network) via Paxos Trust Company. Bridge USDG from Ethereum at <a href="https://usad.aleo.org" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">usad.aleo.org</a>. Program: <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">usad_stablecoin.aleo</code></span>
              </li>
            </ul>
            <p>
              Both stablecoins have <span className="text-white">encrypted balances and transfers by default</span> on Aleo. Your holdings are invisible to everyone except you. Strike Rounds use USDCx for all bets.
            </p>
          </div>
        </Card>

        {/* Governance */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <PoolIcon className="w-6 h-6 text-teal" />
            <h2 className="text-lg font-heading font-bold text-white">On-Chain Governance</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
            <p>
              Veil Strike features fully on-chain governance with executable proposals:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">1.</span>
                <span><span className="text-white">Submit Proposal</span> &mdash; Bond 5 ALEO to create a governance proposal (fee change, resolver approval, treasury withdrawal)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">2.</span>
                <span><span className="text-white">Vote</span> &mdash; Community members cast votes. Minimum quorum: 3 votes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">3.</span>
                <span><span className="text-white">Timelock</span> &mdash; 480 blocks (~2 hours) must pass after vote deadline before execution</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">4.</span>
                <span><span className="text-white">Execute</span> &mdash; <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">execute_proposal</code> or <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">execute_treasury</code> applies the approved action on-chain</span>
              </li>
            </ul>
            <p>
              <span className="text-white font-medium">Resolver Registry:</span> Resolvers must stake 10 ALEO via <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">register_resolver</code> to be authorized for market settlement. They can withdraw via <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">withdraw_resolver_stake</code>.
            </p>
            <p>
              <span className="text-white font-medium">Dispute System:</span> Any user can dispute a resolution by bonding 5 ALEO via <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">contest_verdict</code> within the 12-hour challenge window. Bonds are recoverable via <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">recover_bond</code> after finalization.
            </p>
          </div>
        </Card>

        {/* Token Flow */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <ChartIcon className="w-6 h-6 text-teal" />
            <h2 className="text-lg font-heading font-bold text-white">Token Flow &amp; Bridge</h2>
          </div>
          <div className="text-sm text-gray-400 space-y-3 leading-relaxed">
            <p>
              <span className="text-white font-medium">Getting Tokens:</span>
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">•</span>
                <span><span className="text-white">ALEO</span> &mdash; Purchase on exchanges (Coinbase, OKX, Gate.io) and send to your Shield Wallet address</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">•</span>
                <span><span className="text-white">USDCx</span> &mdash; Deposit USDC on Ethereum → mint USDCx on Aleo via <a href="https://usdcx.aleo.org" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">Circle xReserve bridge</a></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal mt-1">•</span>
                <span><span className="text-white">USAD</span> &mdash; Deposit USDG on Ethereum → mint USAD on Aleo via <a href="https://usad.aleo.org" target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">Paxos bridge</a></span>
              </li>
            </ul>
            <p>
              <span className="text-white font-medium">On Veil Strike:</span> When you bet, your tokens flow through <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">transfer_private_to_public</code> into the market pool. Your transaction generates a ZK proof &mdash; only you hold the private <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">OutcomeShare</code> record. When you win, <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">harvest_winnings</code> sends tokens back via <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">transfer_public_to_private</code> &mdash; the recipient is hidden.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
