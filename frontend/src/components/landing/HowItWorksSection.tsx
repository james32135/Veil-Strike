import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const steps = [
  {
    num: '01',
    title: 'Connect Wallet',
    desc: 'Connect your Shield Wallet. Your address stays encrypted — no one sees your identity on-chain.',
    detail: 'Aleo wallets use zero-knowledge proofs. Your address, balances, and activity are private by default.',
  },
  {
    num: '02',
    title: 'Choose a Market',
    desc: 'Browse live prediction markets — crypto, sports, world events, politics, and more. Or try 5-minute Strike Rounds.',
    detail: 'All markets are powered by FPMM (Fixed-Product Market Maker) with automated price discovery.',
  },
  {
    num: '03',
    title: 'Place Your Bet',
    desc: 'Bet with ALEO, USDCx, or USAD. Our delegated prover generates the ZK proof for you — just sign and send.',
    detail: 'Your bet amount, position, and identity are invisible on-chain. Only the market pool totals are visible.',
  },
  {
    num: '04',
    title: 'Collect Winnings',
    desc: 'When the market resolves, claim your payout instantly. Winnings arrive as encrypted Aleo records in your wallet.',
    detail: 'Oracles verify outcomes. Payouts are calculated by the smart contract and delivered as private records.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-28 px-4 relative">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-16">
          <span className="inline-block text-[11px] font-heading text-teal uppercase tracking-[0.3em] mb-4">How It Works</span>
          <h2 className="section-title mb-4">
            Start Trading in{' '}
            <span className="gradient-text">4 Steps</span>
          </h2>
          <p className="text-smoke/55 max-w-lg mx-auto leading-relaxed">
            No KYC. No sign-up. Connect a wallet and start betting on predictions with full privacy.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent -translate-x-px" />

          <div className="space-y-8 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-16 lg:gap-y-8">
            {steps.map((step, i) => (
              <motion.div key={step.num}
                initial={{ opacity: 0, y: 25, filter: 'blur(6px)' }}
                whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={`glass-card p-6 relative group hover:border-white/[0.08] transition-colors ${i % 2 === 1 ? 'lg:mt-12' : ''}`}>
                
                {/* Step number */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl font-heading font-black text-teal/20">{step.num}</span>
                  <h3 className="font-heading text-lg font-bold text-white/85">{step.title}</h3>
                </div>

                <p className="text-smoke/55 leading-relaxed mb-3">{step.desc}</p>
                <p className="text-xs text-smoke/30 leading-relaxed">{step.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="text-center mt-12">
          <Link to="/markets" className="btn-primary inline-flex items-center gap-2">
            Browse Markets
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
