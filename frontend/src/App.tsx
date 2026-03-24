import { Routes, Route } from 'react-router-dom';
import { WalletProvider } from '@/components/providers/WalletProvider';
import MainLayout from '@/components/layout/MainLayout';
import Landing from '@/pages/Landing';
import Markets from '@/pages/Markets';
import MarketDetail from '@/pages/MarketDetail';
import Lightning from '@/pages/Lightning';
import Portfolio from '@/pages/Portfolio';
import CreateMarket from '@/pages/CreateMarket';
import Stats from '@/pages/Stats';
import Governance from '@/pages/Governance';
import Docs from '@/pages/Docs';
import Terms from '@/pages/Terms';
import RiskDisclosure from '@/pages/RiskDisclosure';
import Privacy from '@/pages/Privacy';
import FAQ from '@/pages/FAQ';

export default function App() {
  return (
    <WalletProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<MainLayout />}>
          <Route path="/markets" element={<Markets />} />
          <Route path="/markets/:id" element={<MarketDetail />} />
          <Route path="/lightning" element={<Lightning />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/create" element={<CreateMarket />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/governance" element={<Governance />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/risk" element={<RiskDisclosure />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/faq" element={<FAQ />} />
        </Route>
      </Routes>
    </WalletProvider>
  );
}
