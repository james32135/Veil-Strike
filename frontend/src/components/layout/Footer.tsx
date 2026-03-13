import { Link } from 'react-router-dom';
import { LogoIcon, ExternalLinkIcon } from '@/components/icons';

export default function Footer() {
  return (
    <footer className="border-t border-dark-300/40 bg-dark-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <LogoIcon className="w-7 h-7" />
              <span className="font-heading font-bold text-lg text-white">
                VEIL<span className="text-teal">STRIKE</span>
              </span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Privacy-first prediction market protocol built on Aleo. 
              Trade predictions with zero-knowledge proofs.
            </p>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm text-gray-300 mb-3">Protocol</h4>
            <ul className="space-y-2">
              <li><Link to="/markets" className="text-sm text-gray-500 hover:text-teal transition-colors">Markets</Link></li>
              <li><Link to="/lightning" className="text-sm text-gray-500 hover:text-teal transition-colors">Lightning</Link></li>
              <li><Link to="/portfolio" className="text-sm text-gray-500 hover:text-teal transition-colors">Portfolio</Link></li>
              <li><Link to="/stats" className="text-sm text-gray-500 hover:text-teal transition-colors">Stats</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm text-gray-300 mb-3">Resources</h4>
            <ul className="space-y-2">
              <li><Link to="/docs" className="text-sm text-gray-500 hover:text-teal transition-colors">Documentation</Link></li>
              <li>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal transition-colors">
                  GitHub <ExternalLinkIcon className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm text-gray-300 mb-3">Powered by</h4>
            <ul className="space-y-2">
              <li>
                <a href="https://aleo.org" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal transition-colors">
                  Aleo <ExternalLinkIcon className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href="https://shieldwallet.io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-teal transition-colors">
                  Shield Wallet <ExternalLinkIcon className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-dark-300/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            Built for Aleo Privacy Buildathon Wave 3
          </p>
          <p className="text-xs text-gray-600">
            Zero-knowledge proofs powered by Aleo
          </p>
        </div>
      </div>
    </footer>
  );
}
