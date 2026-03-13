import { useState, useEffect } from 'react';

interface CountdownProps {
  deadline: number; // block height or timestamp
  label?: string;
  variant?: 'default' | 'compact';
}

export default function Countdown({ deadline, label, variant = 'default' }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now() / 1000;
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft('Ended');
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = Math.floor(diff % 60);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (variant === 'compact') {
    return <span className="font-mono text-sm text-teal">{timeLeft}</span>;
  }

  return (
    <div className="text-center">
      {label && <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>}
      <p className="font-mono text-lg font-bold text-white">{timeLeft}</p>
    </div>
  );
}
