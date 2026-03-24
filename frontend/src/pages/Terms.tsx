import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';

export default function Terms() {
  return (
    <div>
      <PageHeader title="Terms of Service" subtitle="Last updated: June 2025" />
      <Card className="p-8 max-w-4xl prose prose-invert prose-sm">
        <div className="space-y-6 text-sm text-gray-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Veil Strike protocol ("Protocol"), you agree to be bound by these Terms of
              Service. If you do not agree, you must not access or use the Protocol. The Protocol is a decentralized
              prediction market built on the Aleo blockchain.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">2. Eligibility</h2>
            <p>
              You must be at least 18 years old and in a jurisdiction where prediction markets are legally permitted.
              It is your responsibility to comply with all applicable laws in your jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">3. Protocol Description</h2>
            <p>
              Veil Strike is a privacy-preserving prediction market protocol utilizing zero-knowledge proofs on the
              Aleo blockchain. Users can create markets, provide liquidity, trade outcome shares, and participate in
              governance. All transactions are executed on-chain through smart contracts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">4. User Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You are solely responsible for safeguarding your private keys and wallet credentials.</li>
              <li>You understand that blockchain transactions are irreversible once confirmed.</li>
              <li>You will not use the Protocol for any illegal, fraudulent, or manipulative activity.</li>
              <li>You are responsible for reporting and paying any applicable taxes on your activities.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">5. Risk Acknowledgement</h2>
            <p>
              Prediction markets involve financial risk. You may lose some or all of your deposited assets.
              The Protocol operates on experimental blockchain technology and smart contracts that may contain
              bugs or vulnerabilities. Past performance does not guarantee future results.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">6. Fees</h2>
            <p>
              The Protocol charges fees on trades: 0.5% protocol fee, 0.5% creator fee, and 1.0% LP fee (2% total).
              Additionally, Aleo network transaction fees apply. Fee structures may be updated through governance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">7. Dispute Resolution</h2>
            <p>
              Market resolutions can be disputed within a challenge window. Disputes require a bond deposit.
              If the dispute is successful, the bond is returned; otherwise, it is forfeited. Governance proposals
              can modify dispute parameters.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>
              The Protocol is provided "as is" without warranties of any kind. The developers shall not be
              liable for any direct, indirect, incidental, or consequential damages arising from your use of
              the Protocol, including loss of funds, data, or profits.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-heading font-semibold text-white mb-3">9. Modifications</h2>
            <p>
              These terms may be updated at any time. Continued use of the Protocol after changes constitutes
              acceptance of the updated terms. Material changes will be communicated through the Protocol interface.
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
}
