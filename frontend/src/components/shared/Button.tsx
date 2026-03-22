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
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'bg-accent-red/10 text-accent-red border border-accent-red/20 hover:bg-accent-red/20 rounded-full',
};

const sizes = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-3.5 text-base',
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
        transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${variant === 'primary' || variant === 'secondary' || variant === 'ghost' ? '' : sizes[size]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
