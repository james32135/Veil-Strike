interface BadgeProps {
  children: React.ReactNode;
  variant?: 'teal' | 'green' | 'red' | 'gray' | 'success' | 'warning' | 'info' | 'danger';
  size?: 'sm' | 'md';
  pulse?: boolean;
}

const variants: Record<string, string> = {
  teal: 'bg-teal/10 text-teal border-teal/20',
  green: 'bg-accent-green/10 text-accent-green border-accent-green/20',
  red: 'bg-accent-red/10 text-accent-red border-accent-red/20',
  gray: 'bg-white/[0.04] text-smoke border-white/[0.06]',
  success: 'bg-accent-green/10 text-accent-green border-accent-green/20',
  warning: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  info: 'bg-teal/10 text-teal border-teal/20',
  danger: 'bg-accent-red/10 text-accent-red border-accent-red/20',
};

export default function Badge({ children, variant = 'teal', size = 'sm', pulse = false }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center border rounded-full font-medium
        ${variants[variant]}
        ${size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3.5 py-1 text-sm'}
        ${pulse ? 'animate-pulse-slow' : ''}
      `}
    >
      {children}
    </span>
  );
}
