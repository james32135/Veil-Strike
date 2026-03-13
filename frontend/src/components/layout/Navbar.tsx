import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogoIcon, MenuIcon, CloseIcon } from '@/components/icons';
import WalletButton from './WalletButton';

const navLinks = [
  { path: '/markets', label: 'Markets' },
  { path: '/lightning', label: 'Lightning' },
  { path: '/pools', label: 'Pools' },
  { path: '/portfolio', label: 'Portfolio' },
  { path: '/leaderboard', label: 'Leaderboard' },
  { path: '/create', label: 'Create' },
];

export default function Navbar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-dark/80 backdrop-blur-xl border-b border-dark-300/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <LogoIcon className="w-8 h-8" />
              <span className="font-heading font-bold text-lg text-white tracking-tight">
                VEIL<span className="text-teal">STRIKE</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 rounded-lg text-sm font-heading font-medium transition-all duration-200 ${
                    location.pathname === link.path || location.pathname.startsWith(link.path + '/')
                      ? 'text-teal bg-teal/10'
                      : 'text-gray-400 hover:text-white hover:bg-dark-200/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <WalletButton />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              {mobileOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-dark-300/40 bg-dark-50/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-heading font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'text-teal bg-teal/10'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
