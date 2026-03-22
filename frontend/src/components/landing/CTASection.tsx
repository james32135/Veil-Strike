import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function CTASection() {
  return (
    <section className="py-28 px-4 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-3xl mx-auto text-center"
      >
        <div className="glass-card p-14 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal/30 to-transparent" />

          <motion.div
            className="absolute -top-32 -right-32 w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255, 107, 53, 0.12), transparent 70%)', filter: 'blur(60px)' }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255, 61, 0, 0.06), transparent 70%)', filter: 'blur(40px)' }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 8, repeat: Infinity, delay: 2 }}
          />

          <div className="relative z-10">
            <h2 className="font-heading text-3xl md:text-5xl font-bold text-white mb-5">
              Ready to Trade{' '}
              <span className="gradient-text">Privately?</span>
            </h2>
            <p className="text-smoke/60 max-w-lg mx-auto mb-10">
              Join the first prediction market where your bets, your positions, and your identity are protected by zero-knowledge proofs.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/markets" className="btn-primary text-base px-10 py-4 group">
                Start Trading
                <motion.span className="inline-block ml-2" animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>→</motion.span>
              </Link>
              <Link to="/docs" className="btn-ghost text-base px-6 py-3">Read the Docs</Link>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
