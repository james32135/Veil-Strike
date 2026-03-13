import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function CTASection() {
  return (
    <section className="py-24 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-3xl mx-auto text-center"
      >
        <div className="glass-card p-12 relative overflow-hidden">
          {/* Glow effect */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-teal/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-teal/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Trade Privately?
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto mb-8">
              Join the first prediction market where your bets, your positions, 
              and your identity are protected by zero-knowledge proofs.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/markets" className="btn-primary text-base px-8 py-3.5">
                Start Trading
              </Link>
              <Link to="/docs" className="btn-ghost text-base">
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
