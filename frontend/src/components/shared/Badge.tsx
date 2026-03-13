interface BadgeProps {
  children: React.ReactNode;
  variant?: 'teal' | 'green' | 'red' | 'gray' | 'success' | 'warning' | 'info' | 'danger';
  size?: 'sm' | 'md';
}

const variants = {
  teal: 'bg-teal/10 text-teal border-teal/20',
  green: 'bg-accent-green/10 text-accent-green border-accent-green/20',
  red: 'bg-accent-red/10 text-accent-red border-accent-red/20',
  gray: 'bg-dark-300/50 text-gray-400 border-dark-400/50',
  success: 'bg-accent-green/10 text-accent-green border-accent-green/20',
  warning: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  info: 'bg-teal/10 text-teal border-teal/20',
  danger: 'bg-accent-red/10 text-accent-red border-accent-red/20',
};

export default function Badge({ children, variant = 'teal', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center border rounded-full font-medium
        ${variants[variant]}
        ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
      `}
    >
      {children}
    </span>
  );
}
