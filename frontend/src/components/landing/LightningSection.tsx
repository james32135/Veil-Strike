import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BoltIcon, ClockIcon, FireIcon } from '@/components/icons';

export default function LightningSection() {
  return (
    <section className="py-24 px-4 bg-dark-50/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-teal/5 rounded-full blur-3xl" />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal/10 border border-teal/20 rounded-full mb-4">
                <BoltIcon className="w-4 h-4 text-teal" />
                <span className="text-sm text-teal font-heading font-medium">Lightning Markets</span>
              </div>
              <h2 className="font-heading text-3xl font-bold text-white mb-4">
                5-Minute Price Predictions
              </h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                Predict whether BTC, ETH, or ALEO will be above or below a target price.
                Rounds resolve automatically via oracle feeds. Fast trades, instant results.
              </p>
              <Link to="/lightning" className="btn-primary inline-flex items-center gap-2">
                <BoltIcon className="w-4 h-4" />
                Try Lightning
              </Link>
            </div>

            <div className="space-y-4">
              {[
                { icon: <ClockIcon className="w-5 h-5" />, label: '5-min / 15-min / 1-hr / 4-hr', desc: 'Choose your timeframe' },
                { icon: <FireIcon className="w-5 h-5" />, label: 'Live Oracle Prices', desc: 'BTC, ETH, ALEO from CoinGecko' },
                { icon: <BoltIcon className="w-5 h-5" />, label: 'Auto Resolution', desc: 'Oracle resolves at expiry' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 p-4 bg-dark-200/50 rounded-xl">
                  <div className="text-teal mt-0.5">{item.icon}</div>
                  <div>
                    <p className="text-sm font-heading font-medium text-white">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
