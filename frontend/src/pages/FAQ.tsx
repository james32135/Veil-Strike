import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
  {
    q: 'What tokens can I trade with?',
    a: 'Veil Strike v6 supports three tokens: ALEO (native Aleo credits), USDCx (USD-pegged stablecoin), and USAD (algorithmic stablecoin). Each token runs on its own dedicated Leo smart contract — veil_strike_v6.aleo, veil_strike_v6_cx.aleo, and veil_strike_v6_sd.aleo respectively.',
  },
  {
    q: 'What is Veil Strike?',
    a: 'Veil Strike is a privacy-first prediction market protocol on the Aleo blockchain. Using zero-knowledge proofs, it keeps trader identities, position sizes, and payouts fully encrypted on-chain. Supports event prediction markets and Strike Rounds across 3 token types.',
  },
  {
    q: 'How does governance work?',
    a: 'Any user can submit governance proposals: approve resolvers, request treasury withdrawals, update fees, or override markets. Others vote for or against. Governance is live on-chain via submit_proposal and cast_vote transitions but is still evolving — more voting mechanisms, quorum rules, and timelock controls are planned.',
  },
  {
    q: 'What are Strike Rounds?',
    a: 'Strike Rounds are time-based prediction markets where you bet UP or DOWN on crypto prices (BTC, ETH, ALEO). Durations range from 24 hours to 30 days. The admin oracle compares the opening and closing prices — if price rose, UP wins; if it fell, DOWN wins. Your position and payout are fully private.',
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
    q: 'Is this on mainnet?',
    a: 'Veil Strike is currently deployed on Aleo testnet (Wave 4). All tokens are testnet tokens with no real-world value. Mainnet deployment is planned after governance and privacy improvements are finalized.',
  },
  {
    q: 'How do I provide liquidity?',
    a: 'On any market detail page, use the "Add Liquidity" panel to deposit tokens. You receive an encrypted LP token record representing your share. LPs earn the 1% LP fee on all trades. You can withdraw when the market resolves.',
  },
  {
    q: 'What happens if I disagree with a market resolution?',
    a: 'You can contest an event market resolution within the 12-hour challenge window using contest_verdict. A minimum 5 ALEO bond is required. If the market is re-resolved in your favor, you recover the bond. Strike Rounds resolved via flash_settle bypass the challenge window by design.',
  },
  {
    q: 'Can I create my own market?',
    a: 'Yes! Go to the Create page, fill in your question, outcomes, deadline, and initial liquidity. You can create event markets (any topic) or Strike Rounds. The market is created on-chain and appears in the list once confirmed by the indexer.',
  },
  {
    q: 'How does admin resolution work?',
    a: 'For Strike Rounds, the admin visits the Admin page, sees the oracle start price vs the current price for each round, then calls flash_settle directly from their wallet — choosing UP (outcome 1) or DOWN (outcome 2). After resolving, the admin creates the next round manually on the Create page. For event markets, the resolver calls render_verdict then ratify_verdict after a 12-hour challenge window.',
  },
  {
    q: 'How do I get started?',
    a: 'Install the Shield Wallet browser extension, connect to Aleo testnet, get testnet ALEO from the faucet, then navigate to Markets for event predictions or Rounds for Strike Rounds.',
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
