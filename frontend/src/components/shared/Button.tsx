import { ButtonHTMLAttributes, ReactNode } from 'react';
import SpinnerIcon from '@/components/icons/SpinnerIcon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variants = {
  primary: 'bg-teal text-dark font-semibold hover:bg-teal-400 active:scale-[0.98]',
  secondary: 'border border-dark-300 text-gray-300 hover:border-teal/40 hover:text-teal',
  ghost: 'text-gray-400 hover:text-teal hover:bg-dark-200/50',
  danger: 'bg-accent-red/10 text-accent-red border border-accent-red/20 hover:bg-accent-red/20',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 font-heading font-medium
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <SpinnerIcon className="w-4 h-4" /> : icon}
      {children}
    </button>
  );
}
