import { Routes, Route } from 'react-router-dom';
import { WalletProvider } from '@/components/providers/WalletProvider';
import MainLayout from '@/components/layout/MainLayout';
import Landing from '@/pages/Landing';
import Markets from '@/pages/Markets';
import MarketDetail from '@/pages/MarketDetail';
import Lightning from '@/pages/Lightning';
import Pools from '@/pages/Pools';
import Portfolio from '@/pages/Portfolio';
import Leaderboard from '@/pages/Leaderboard';
import CreateMarket from '@/pages/CreateMarket';
import Stats from '@/pages/Stats';
import Docs from '@/pages/Docs';

export default function App() {
  return (
    <WalletProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<MainLayout />}>
          <Route path="/markets" element={<Markets />} />
          <Route path="/markets/:id" element={<MarketDetail />} />
          <Route path="/lightning" element={<Lightning />} />
          <Route path="/pools" element={<Pools />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/create" element={<CreateMarket />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/docs" element={<Docs />} />
        </Route>
      </Routes>
    </WalletProvider>
  );
}
