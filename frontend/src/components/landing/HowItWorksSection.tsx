import { motion } from 'framer-motion';

const steps = [
  { step: '01', title: 'Connect Wallet', description: 'Connect your Shield Wallet with one click. Delegated proving handles all ZK computations.' },
  { step: '02', title: 'Choose a Market', description: 'Browse event predictions or lightning rounds. View real-time odds powered by FPMM.' },
  { step: '03', title: 'Place Your Bet', description: 'Buy outcome shares privately. Your position is stored as an encrypted Aleo record.' },
  { step: '04', title: 'Collect Winnings', description: 'Redeem winning shares for ALEO tokens. Payouts are sent to private records — fully anonymous.' },
];

export default function HowItWorksSection() {
  return (
    <section className="py-28 px-4 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="section-title mb-4">How It Works</h2>
          <p className="text-smoke/60 max-w-xl mx-auto">Four simple steps to start trading predictions with complete privacy.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          <div className="hidden md:block absolute top-[52px] left-[12%] right-[12%] h-px">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5 }}
              className="w-full h-full origin-left"
              style={{ background: 'linear-gradient(to right, rgba(255, 107, 53, 0.3), rgba(255, 61, 0, 0.15), rgba(255, 107, 53, 0.3))' }}
            />
          </div>

          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center"
            >
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(255, 107, 53, 0.03))',
                  border: '1px solid rgba(255, 107, 53, 0.15)',
                }}
                whileHover={{ scale: 1.08, boxShadow: '0 0 30px -5px rgba(255, 107, 53, 0.2)' }}
              >
                <span className="font-mono text-xl font-bold text-teal">{step.step}</span>
              </motion.div>
              <h3 className="font-heading text-lg font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-smoke/50 leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
