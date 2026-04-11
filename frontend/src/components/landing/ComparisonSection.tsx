import { motion } from 'framer-motion';

const columns = ['Feature', 'Veil Strike', 'Polymarket', 'Azuro'];

const rows = [
  { feature: 'Privacy', vs: ['Full ZK privacy', 'None — public', 'None — public'] },
  { feature: 'Identity', vs: ['No KYC required', 'KYC required', 'Wallet-linked'] },
  { feature: 'Blockchain', vs: ['Aleo (ZK-native)', 'Polygon', 'Gnosis Chain'] },
  { feature: 'Bet Visibility', vs: ['Encrypted on-chain', 'Public on-chain', 'Public on-chain'] },
  { feature: 'Balance Privacy', vs: ['Hidden by default', 'Visible to all', 'Visible to all'] },
  { feature: 'Fast Rounds', vs: ['15-min Strike Rounds', 'None', 'None'] },
  { feature: 'Stablecoins', vs: ['USDCx + USAD (private)', 'USDC (public)', 'xDAI (public)'] },
  { feature: 'Market Maker', vs: ['FPMM on-chain', 'Central order book', 'FPMM on-chain'] },
  { feature: 'Proof System', vs: ['Delegated ZK proofs', 'N/A', 'N/A'] },
  { feature: 'Governance', vs: ['On-chain DAO', 'Off-chain', 'Off-chain'] },
];

export default function ComparisonSection() {
  return (
    <section className="py-28 px-4 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-14">
          <span className="inline-block text-[11px] font-heading text-teal uppercase tracking-[0.3em] mb-4">Comparison</span>
          <h2 className="section-title mb-4">
            Why <span className="gradient-text">Veil Strike</span>?
          </h2>
          <p className="text-smoke/55 max-w-lg mx-auto leading-relaxed">
            Every prediction market reveals your bets, balance, and identity. Veil Strike is the only protocol where all of that is encrypted.
          </p>
        </motion.div>

        {/* Table */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {columns.map((col, i) => (
                    <th key={col}
                      className={`px-6 py-4 text-xs font-heading uppercase tracking-wider ${
                        i === 1 ? 'text-teal bg-teal/[0.03]' : 'text-smoke/40'
                      }`}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <motion.tr key={row.feature}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-3.5 text-sm font-heading font-medium text-white/60">{row.feature}</td>
                    <td className="px-6 py-3.5 text-sm text-accent-green bg-teal/[0.02]">{row.vs[0]}</td>
                    <td className="px-6 py-3.5 text-sm text-smoke/35">{row.vs[1]}</td>
                    <td className="px-6 py-3.5 text-sm text-smoke/35">{row.vs[2]}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center text-xs text-smoke/25 mt-6">
          Comparison based on publicly available documentation and on-chain data. Updated June 2025.
        </motion.p>
      </div>
    </section>
  );
}
