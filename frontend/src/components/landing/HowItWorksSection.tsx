import { motion } from 'framer-motion';

const steps = [
  {
    step: '01',
    title: 'Connect Wallet',
    description: 'Connect your Shield Wallet with one click. Delegated proving handles all ZK computations.',
  },
  {
    step: '02',
    title: 'Choose a Market',
    description: 'Browse event predictions or lightning rounds. View real-time odds powered by FPMM.',
  },
  {
    step: '03',
    title: 'Place Your Bet',
    description: 'Buy outcome shares privately. Your position is stored as an encrypted Aleo record.',
  },
  {
    step: '04',
    title: 'Collect Winnings',
    description: 'Redeem winning shares for ALEO tokens. Payouts are sent to private records — fully anonymous.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-24 px-4 bg-dark-50/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="section-title mb-4">How It Works</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Four simple steps to start trading predictions with complete privacy.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-teal/10 border border-teal/20 flex items-center justify-center mx-auto mb-5">
                <span className="font-mono text-xl font-bold text-teal">{step.step}</span>
              </div>
              <h3 className="font-heading text-lg font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute right-0 top-1/2 w-8 h-px bg-dark-400" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
