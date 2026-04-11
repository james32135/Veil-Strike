import SpotlightCursor from '@/components/landing/SpotlightCursor';
import HeroSection from '@/components/landing/HeroSection';
import LiveMarketsSection from '@/components/landing/LiveMarketsSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import WhyAleoSection from '@/components/landing/WhyAleoSection';
import StablecoinsSection from '@/components/landing/StablecoinsSection';
import LightningSection from '@/components/landing/LightningSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import PrivacySection from '@/components/landing/PrivacySection';
import ComparisonSection from '@/components/landing/ComparisonSection';
import ArchitectureSection from '@/components/landing/ArchitectureSection';
import TechStackSection from '@/components/landing/TechStackSection';
import CTASection from '@/components/landing/CTASection';

export default function Landing() {
  return (
    <div className="-mt-20 relative">
      <SpotlightCursor />
      <HeroSection />
      <LiveMarketsSection />
      <FeaturesSection />
      <WhyAleoSection />
      <StablecoinsSection />
      <LightningSection />
      <HowItWorksSection />
      <PrivacySection />
      <ComparisonSection />
      <ArchitectureSection />
      <TechStackSection />
      <CTASection />
    </div>
  );
}
