import { motion } from 'framer-motion';

const comparisons = [
  { feature: 'Bet Privacy', veilStrike: 'Full ZK', polymarket: 'Public', azuro: 'Public' },
  { feature: 'Identity Hidden', veilStrike: 'Yes', polymarket: 'No', azuro: 'Pseudo' },
  { feature: 'Position Privacy', veilStrike: 'Encrypted Records', polymarket: 'On-chain', azuro: 'On-chain' },
  { feature: 'Front-Running', veilStrike: 'Impossible', polymarket: 'Possible', azuro: 'Possible' },
  { feature: 'Lightning Rounds', veilStrike: 'Yes', polymarket: 'No', azuro: 'No' },
  { feature: 'ZK Streaks', veilStrike: 'Yes', polymarket: 'No', azuro: 'No' },
  { feature: 'Prediction Pools', veilStrike: 'Yes', polymarket: 'No', azuro: 'No' },
];

export default function ComparisonSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="section-title mb-4">Privacy Comparison</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            See how Veil Strike compares to existing prediction markets.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-dark-300/50">
                  <th className="px-6 py-4 text-left text-xs font-heading font-semibold text-gray-400 uppercase tracking-wider">Feature</th>
                  <th className="px-6 py-4 text-center text-xs font-heading font-semibold text-teal uppercase tracking-wider">Veil Strike</th>
                  <th className="px-6 py-4 text-center text-xs font-heading font-semibold text-gray-500 uppercase tracking-wider">Polymarket</th>
                  <th className="px-6 py-4 text-center text-xs font-heading font-semibold text-gray-500 uppercase tracking-wider">Azuro</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row) => (
                  <tr key={row.feature} className="border-b border-dark-300/20 last:border-0">
                    <td className="px-6 py-3.5 text-sm text-gray-300">{row.feature}</td>
                    <td className="px-6 py-3.5 text-center text-sm font-medium text-teal">{row.veilStrike}</td>
                    <td className="px-6 py-3.5 text-center text-sm text-gray-500">{row.polymarket}</td>
                    <td className="px-6 py-3.5 text-center text-sm text-gray-500">{row.azuro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
