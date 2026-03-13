import { useEffect } from 'react';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useMarketStore } from '@/stores/marketStore';
import { PnLSummary, PositionList, TradeHistoryTable, LPPositions } from '@/components/portfolio';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/shared/Tabs';
import { useState } from 'react';

export default function Portfolio() {
  const { positions, lpReceipts, tradeHistory, totalPnL } = usePortfolioStore();
  const { markets, fetchMarkets } = useMarketStore();
  const [activeTab, setActiveTab] = useState('positions');

  useEffect(() => {
    if (markets.length === 0) fetchMarkets();
  }, [markets.length, fetchMarkets]);

  const totalInvested = positions.reduce((s, p) => s + p.costBasis, 0);
  const wins = tradeHistory.filter((t) => t.type === 'sell' && t.price > 0.5).length;
  const winRate = tradeHistory.length > 0 ? (wins / tradeHistory.length) * 100 : 0;

  const tabs = [
    { id: 'positions', label: `Positions (${positions.length})` },
    { id: 'history', label: `History (${tradeHistory.length})` },
    { id: 'lp', label: `LP (${lpReceipts.length})` },
  ];

  return (
    <div>
      <PageHeader
        title="Portfolio"
        subtitle="Track your positions, trade history, and LP receipts"
      />

      <div className="space-y-6 mt-6">
        <PnLSummary
          totalPnL={totalPnL}
          totalInvested={totalInvested}
          openPositions={positions.length}
          winRate={winRate}
        />

        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'positions' && (
          <PositionList positions={positions} markets={markets} />
        )}
        {activeTab === 'history' && (
          <TradeHistoryTable trades={tradeHistory} />
        )}
        {activeTab === 'lp' && (
          <LPPositions receipts={lpReceipts} />
        )}
      </div>
    </div>
  );
}
