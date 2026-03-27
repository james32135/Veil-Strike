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
              <span className="text-white font-medium">v6 Architecture:</span> Three independent Leo programs &mdash;
              <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">veil_strike_v6.aleo</code> (ALEO + Governance),
              <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">veil_strike_v6_cx.aleo</code> (USDCx), and
              <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs">veil_strike_v6_sd.aleo</code> (USAD). Total: 47 transitions across 3 deployed programs.
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
              Strike Rounds are price prediction markets (24h, 2-day, 7-day, or 30-day durations)
              where users bet UP or DOWN on BTC, ETH, or ALEO prices.
            </p>
            <p>
              The oracle records the start price when the market opens. When the round expires,
              the admin views the oracle price comparison on the Admin page and calls
              <code className="text-teal/80 bg-dark-200 px-1 rounded text-xs mx-1">flash_settle</code>
              directly from their wallet, committing the winning outcome on-chain instantly
              with no challenge window. After resolving, the admin creates the next round
              manually.
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
      </div>
    </div>
  );
}
