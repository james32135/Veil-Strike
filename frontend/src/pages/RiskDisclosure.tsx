import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';

export default function RiskDisclosure() {
  return (
    <div>
      <PageHeader title="Risk Disclosure" subtitle="Important information about trading risks" />
      <Card className="p-8 max-w-4xl prose prose-invert prose-sm">
        <div className="space-y-6 text-sm text-gray-400 leading-relaxed">
          <div className="p-4 rounded-xl bg-accent-red/5 border border-accent-red/20">
            <p className="text-accent-red font-heading font-semibold text-sm mb-2">Warning</p>
            <p>
              Prediction markets carry significant financial risk. You should not trade with funds you
              cannot afford to lose. This disclosure outlines key risks but is not exhaustive.
            </p>
          </div>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Market Risk</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Outcome share prices can fluctuate rapidly and unpredictably.</li>
              <li>Markets may resolve against your position, resulting in total loss of your stake.</li>
              <li>Low-liquidity markets may have high slippage, making it difficult to exit positions.</li>
              <li>Lightning markets have very short time horizons and amplified volatility risk.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Smart Contract Risk</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Smart contracts may contain undiscovered bugs or vulnerabilities.</li>
              <li>Interactions between multiple programs (ALEO, USDCx, USAD) add complexity and risk.</li>
              <li>The Aleo blockchain and Leo language are still evolving; protocol behavior may change.</li>
              <li>Zero-knowledge proof generation can fail or produce unexpected results under edge cases.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Liquidity Risk</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Automated Market Maker (AMM) pools may have insufficient liquidity for large trades.</li>
              <li>Liquidity providers face impermanent loss if outcome probabilities shift significantly.</li>
              <li>Withdrawal of liquidity may be impacted by active positions and market state.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Oracle Risk</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Market resolution depends on oracle data feeds for price information.</li>
              <li>Oracle data may be delayed, inaccurate, or manipulated.</li>
              <li>Disputes over oracle-based resolutions are subject to the challenge window mechanism.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Stablecoin Risk</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>USDCx and USAD are stablecoins on Aleo and may not maintain their intended peg.</li>
              <li>Stablecoin transfers involve compliance records and merkle proofs that add complexity.</li>
              <li>Dispute bonds are always denominated in ALEO credits regardless of market token type.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">Regulatory Risk</h2>
            <p>
              Prediction markets may be subject to regulatory scrutiny in various jurisdictions. Laws and
              regulations may change, potentially affecting the legality or operation of the Protocol.
              Users are responsible for understanding and complying with applicable laws.
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
}
