import { useState, useEffect, useRef } from 'react';

export function useCountdown(deadline: number) {
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setTimeLeft(diff);
    };
    calc();
    intervalRef.current = setInterval(calc, 1000);
    return () => clearInterval(intervalRef.current);
  }, [deadline]);

  const days = Math.floor(timeLeft / 86400);
  const hours = Math.floor((timeLeft % 86400) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const isExpired = timeLeft <= 0;

  return { days, hours, minutes, seconds, timeLeft, isExpired };
}
