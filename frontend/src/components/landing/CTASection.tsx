import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function CTASection() {
  return (
    <section className="py-28 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-teal/[0.06] rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-64 h-64 bg-accent-green/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="max-w-3xl mx-auto relative z-10 text-center">
        <motion.div initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          
          <span className="inline-block text-[11px] font-heading text-teal uppercase tracking-[0.3em] mb-6">Live on Aleo Mainnet</span>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black text-white leading-[1.05] mb-6">
            Predict the Future.{' '}
            <span className="gradient-text">Privately.</span>
          </h2>
          
          <p className="text-smoke/50 text-lg md:text-xl leading-relaxed mb-10 max-w-xl mx-auto">
            The only prediction market where your bets, balance, and identity are completely invisible. Start trading now on Aleo mainnet.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/markets" className="btn-primary px-8 py-4 text-base font-heading font-bold">
              Launch App
            </Link>
            <Link to="/rounds" className="btn-secondary px-8 py-4 text-base font-heading font-bold inline-flex items-center gap-2">
              <span>⚡</span> Strike Rounds
            </Link>
          </div>

          {/* Trust badges */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-6 mt-12 text-xs text-smoke/25 font-heading">
            <span>No KYC Required</span>
            <span className="text-white/[0.06]">|</span>
            <span>Zero-Knowledge Proofs</span>
            <span className="text-white/[0.06]">|</span>
            <span>Open Source</span>
            <span className="text-white/[0.06]">|</span>
            <span>Aleo Mainnet</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
