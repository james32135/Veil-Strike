import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className = '', hover = false, onClick }: CardProps) {
  return (
    <div
      className={`
        bg-dark-100/60 backdrop-blur-xl border border-dark-300/50 rounded-2xl
        ${hover ? 'transition-all duration-300 hover:border-teal/30 hover:shadow-lg hover:shadow-teal/5 cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
