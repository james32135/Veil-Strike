export default function LogoIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Dark rounded square background */}
      <rect width="40" height="40" rx="10" fill="#0D1117" />
      {/* Outer glow ring */}
      <rect x="1" y="1" width="38" height="38" rx="9" stroke="url(#logoGrad)" strokeWidth="1.5" />
      {/* V shape — bold strike */}
      <path d="M11 12L20 30L29 12" stroke="url(#logoGrad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Horizontal strike line */}
      <path d="M14 18H26" stroke="#E2B33E" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* Top diamond accent */}
      <path d="M20 8L22 11L20 14L18 11Z" fill="#E2B33E" opacity="0.9" />
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E2B33E" />
          <stop offset="1" stopColor="#C99A2E" />
        </linearGradient>
      </defs>
    </svg>
  );
}
