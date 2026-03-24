import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';

export default function Privacy() {
  return (
    <div>
      <PageHeader title="Privacy Policy" subtitle="How the Protocol handles your data" />
      <Card className="p-8 max-w-4xl prose prose-invert prose-sm">
        <div className="space-y-6 text-sm text-gray-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Privacy First Architecture</h2>
            <p>
              Veil Strike is built on Aleo, a blockchain designed for privacy. The Protocol leverages
              zero-knowledge proofs to enable private transactions. Your trading activity, positions, and
              balances are protected by cryptographic privacy by default.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">What We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-gray-300">No personal information:</strong> We do not collect names, emails, or identification documents.</li>
              <li><strong className="text-gray-300">No wallet tracking:</strong> Your wallet address is stored only locally in your browser.</li>
              <li><strong className="text-gray-300">Public blockchain data:</strong> On-chain transactions are public by nature of the blockchain, but Aleo's privacy features mask transaction details.</li>
              <li><strong className="text-gray-300">Local storage:</strong> Trade history and preferences are stored in your browser's local storage only.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Backend Data</h2>
            <p>
              The backend server caches publicly available on-chain market data (market IDs, pool states,
              resolutions) to improve performance. This data is already public on the Aleo blockchain.
              No user-specific data is stored on our servers.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Market metadata (questions, categories, outcomes) stored for indexing purposes.</li>
              <li>Oracle price feeds from public APIs (CoinGecko) cached temporarily.</li>
              <li>No IP addresses, cookies, or user analytics are collected.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Zero-Knowledge Proofs</h2>
            <p>
              All transactions on Veil Strike generate zero-knowledge proofs locally in your browser.
              These proofs verify the validity of your transaction without revealing the underlying data.
              Proof generation happens entirely client-side — no sensitive data leaves your device.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-gray-300">Aleo Network:</strong> Transactions are broadcast to the Aleo testnet. Aleo's privacy features protect transaction details.</li>
              <li><strong className="text-gray-300">Shield Wallet:</strong> Wallet interactions are handled by the Shield wallet extension. Refer to their privacy policy.</li>
              <li><strong className="text-gray-300">CoinGecko:</strong> Price data is fetched from CoinGecko's public API for oracle feeds.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Your Rights</h2>
            <p>
              Since we do not collect personal data, there is nothing to delete or export. Your on-chain
              records are controlled by your private key. You can clear local browser storage at any time
              to remove cached trade history and preferences.
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
}
