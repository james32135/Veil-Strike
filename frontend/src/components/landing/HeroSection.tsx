import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ShieldIcon, BoltIcon } from '@/components/icons';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="/images/bg.jpg"
          alt=""
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-dark/60 via-dark/80 to-dark" />
      </div>

      {/* Animated grid overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full"
          style={{
            backgroundImage: `linear-gradient(rgba(0,212,184,0.15) 1px, transparent 1px), 
                             linear-gradient(90deg, rgba(0,212,184,0.15) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal/10 border border-teal/20 rounded-full mb-8">
            <ShieldIcon className="w-4 h-4 text-teal" />
            <span className="text-sm text-teal font-heading font-medium">Built on Aleo — Zero-Knowledge Privacy</span>
          </div>

          <h1 className="font-heading text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight mb-6">
            Predict.{' '}
            <span className="text-teal">Strike.</span>
            <br />
            Stay <span className="text-teal">Veiled.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            The first privacy-preserving prediction market protocol. 
            Trade with complete anonymity using zero-knowledge proofs on Aleo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/markets"
              className="btn-primary text-base px-8 py-3.5 flex items-center gap-2"
            >
              Launch App
            </Link>
            <Link
              to="/lightning"
              className="btn-secondary text-base px-8 py-3.5 flex items-center gap-2"
            >
              <BoltIcon className="w-5 h-5 text-teal" />
              Try Lightning
            </Link>
          </div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
        >
          {[
            { label: 'Total Volume', value: '$2.4M' },
            { label: 'Active Markets', value: '156' },
            { label: 'Unique Traders', value: '1.2K' },
            { label: 'ZK Proofs', value: '45K+' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-mono text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-dark to-transparent" />
    </section>
  );
}
