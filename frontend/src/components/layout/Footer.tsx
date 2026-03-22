import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogoIcon, ExternalLinkIcon } from '@/components/icons';

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Footer() {
  return (
    <footer className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-radial from-teal/[0.03] to-transparent rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-10"
        >
          <motion.div variants={fadeUp} className="col-span-1">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-5 group">
              <LogoIcon className="w-7 h-7" />
              <span className="font-heading font-bold text-lg text-white">
                VEIL<span className="gradient-text">STRIKE</span>
              </span>
            </Link>
            <p className="text-sm text-smoke/70 leading-relaxed max-w-xs">
              Privacy-first prediction market protocol built on Aleo.
              Trade predictions with zero-knowledge proofs.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              <span className="text-[10px] text-smoke/50 font-mono uppercase tracking-wider">Testnet Live</span>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <h4 className="font-heading font-semibold text-[11px] text-smoke/60 mb-5 tracking-[0.2em] uppercase">Protocol</h4>
            <ul className="space-y-3">
              {[
                { to: '/markets', label: 'Markets' },
                { to: '/lightning', label: 'Lightning' },
                { to: '/portfolio', label: 'Portfolio' },
                { to: '/stats', label: 'Stats' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-smoke/60 hover:text-teal transition-all duration-300 hover:translate-x-1 inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={fadeUp}>
            <h4 className="font-heading font-semibold text-[11px] text-smoke/60 mb-5 tracking-[0.2em] uppercase">Resources</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/docs" className="text-sm text-smoke/60 hover:text-teal transition-all duration-300 hover:translate-x-1 inline-block">
                  Documentation
                </Link>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-smoke/60 hover:text-teal transition-all duration-300 hover:translate-x-1">
                  GitHub <ExternalLinkIcon className="w-3 h-3 opacity-40" />
                </a>
              </li>
            </ul>
          </motion.div>

          <motion.div variants={fadeUp}>
            <h4 className="font-heading font-semibold text-[11px] text-smoke/60 mb-5 tracking-[0.2em] uppercase">Powered by</h4>
            <ul className="space-y-3">
              <li>
                <a href="https://aleo.org" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-smoke/60 hover:text-teal transition-all duration-300 hover:translate-x-1">
                  Aleo <ExternalLinkIcon className="w-3 h-3 opacity-40" />
                </a>
              </li>
              <li>
                <a href="https://shieldwallet.io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-smoke/60 hover:text-teal transition-all duration-300 hover:translate-x-1">
                  Shield Wallet <ExternalLinkIcon className="w-3 h-3 opacity-40" />
                </a>
              </li>
            </ul>
          </motion.div>
        </motion.div>

        <div className="mt-14 pt-7 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-smoke/30">
            Built for Aleo Privacy Buildathon Wave 3
          </p>
          <p className="text-xs text-smoke/30 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-teal/40" />
            Zero-knowledge proofs powered by Aleo
          </p>
        </div>
      </div>
    </footer>
  );
}
