import { motion } from 'framer-motion';

const comparisons = [
  { feature: 'Bet Privacy', veilStrike: 'Full ZK', polymarket: 'Public', azuro: 'Public' },
  { feature: 'Identity Hidden', veilStrike: 'Yes', polymarket: 'No', azuro: 'Pseudo' },
  { feature: 'Position Privacy', veilStrike: 'Encrypted Records', polymarket: 'On-chain', azuro: 'On-chain' },
  { feature: 'Front-Running', veilStrike: 'Impossible', polymarket: 'Possible', azuro: 'Possible' },
  { feature: 'Lightning Rounds', veilStrike: 'Yes', polymarket: 'No', azuro: 'No' },
  { feature: 'Private Payouts', veilStrike: 'Yes', polymarket: 'No', azuro: 'No' },
  { feature: 'On-Chain FPMM', veilStrike: 'Yes', polymarket: 'No', azuro: 'Yes' },
];

export default function ComparisonSection() {
  return (
    <section className="py-28 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <h2 className="section-title mb-4">Privacy Comparison</h2>
          <p className="text-smoke/60 max-w-xl mx-auto">See how Veil Strike compares to existing prediction markets.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass-card overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal/20 to-transparent" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="px-6 py-5 text-left text-[10px] font-heading font-semibold text-smoke/40 uppercase tracking-wider">Feature</th>
                  <th className="px-6 py-5 text-center text-[10px] font-heading font-semibold text-teal uppercase tracking-wider">
                    <span className="flex items-center justify-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />Veil Strike</span>
                  </th>
                  <th className="px-6 py-5 text-center text-[10px] font-heading font-semibold text-smoke/30 uppercase tracking-wider">Polymarket</th>
                  <th className="px-6 py-5 text-center text-[10px] font-heading font-semibold text-smoke/30 uppercase tracking-wider">Azuro</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, i) => (
                  <motion.tr key={row.feature} className="border-b border-white/[0.03] last:border-0 hover:bg-teal/[0.02] transition-colors"
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 + 0.2 }}>
                    <td className="px-6 py-4 text-sm text-smoke">{row.feature}</td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-teal"><span className="text-accent-green text-xs mr-1">✓</span>{row.veilStrike}</td>
                    <td className="px-6 py-4 text-center text-sm text-smoke/40">{row.polymarket}</td>
                    <td className="px-6 py-4 text-center text-sm text-smoke/40">{row.azuro}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
