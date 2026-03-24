import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    q: 'What is Veil Strike?',
    a: 'Veil Strike is a privacy-preserving prediction market protocol on the Aleo blockchain. It uses zero-knowledge proofs to keep your trades private while enabling transparent market mechanics.',
  },
  {
    q: 'How do prediction markets work?',
    a: 'Prediction markets let you buy and sell outcome shares for real-world events. If you buy "Yes" shares and the event happens, you can redeem them at full value. Prices reflect the crowd\'s probability estimate for each outcome.',
  },
  {
    q: 'What tokens can I trade with?',
    a: 'Veil Strike supports three tokens: ALEO (native credits), USDCx (USD-pegged stablecoin), and USAD (algorithmic stablecoin). Each runs on its own dedicated smart contract for optimal performance.',
  },
  {
    q: 'What are Lightning markets?',
    a: 'Lightning markets are short-duration prediction rounds (5 min to 4 hours) based on real-time asset prices. They use oracle price feeds for automatic resolution — perfect for quick trading on market direction.',
  },
  {
    q: 'How is privacy maintained?',
    a: 'All transactions generate zero-knowledge proofs locally in your browser. Your positions, balances, and trading activity are hidden from other users and observers. Only the aggregate market state (prices, liquidity) is public.',
  },
  {
    q: 'What fees does the protocol charge?',
    a: 'Total trading fee is 2%: 0.5% protocol fee, 0.5% market creator fee, and 1.0% liquidity provider fee. Aleo network gas fees also apply to each transaction.',
  },
  {
    q: 'How do I provide liquidity?',
    a: 'On any market detail page, use the "Add Liquidity" panel to deposit tokens. You receive LP tokens representing your share. Liquidity providers earn the 1% LP fee on all trades. You can withdraw anytime.',
  },
  {
    q: 'What happens if I disagree with a market resolution?',
    a: 'You can file a dispute within the challenge window (approximately 12 hours). Disputes require a bond deposit. If the community agrees the resolution was wrong, you get your bond back and the market is re-resolved.',
  },
  {
    q: 'How does governance work?',
    a: 'Any user can submit governance proposals (approve resolvers, update fees, treasury withdrawals). Other users vote for or against. Proposals with sufficient votes can be executed to change protocol parameters.',
  },
  {
    q: 'Is this on mainnet?',
    a: 'Currently Veil Strike is deployed on Aleo testnet. All tokens are testnet tokens with no real-world value. This is a demonstration and competition entry for Aleo\'s developer program.',
  },
  {
    q: 'How do I get started?',
    a: 'Install the Shield wallet browser extension, connect to Aleo testnet, get testnet ALEO from the faucet, then navigate to Markets or Lightning to start trading.',
  },
  {
    q: 'Can I create my own market?',
    a: 'Yes! Go to the Create page, fill in your question, outcomes, deadline, and initial liquidity. The market will be created on-chain and appear in the Markets list once confirmed.',
  },
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div>
      <PageHeader title="FAQ" subtitle="Frequently asked questions about Veil Strike" />
      <div className="max-w-3xl space-y-2">
        {faqs.map((faq, idx) => (
          <Card key={idx} className="overflow-hidden">
            <button
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <span className="text-sm font-heading font-semibold text-white pr-4">{faq.q}</span>
              <span className={`text-gray-500 transition-transform duration-300 shrink-0 ${openIdx === idx ? 'rotate-180' : ''}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
            <AnimatePresence>
              {openIdx === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed border-t border-dark-400/20 pt-3">
                    {faq.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
      </div>
    </div>
  );
}
