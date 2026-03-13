import { useCountdown } from '@/hooks/useCountdown';
import { BoltIcon } from '@/components/icons';

interface LightningTimerProps {
  endTime: number;
  compact?: boolean;
}

export default function LightningTimer({ endTime, compact = false }: LightningTimerProps) {
  const { days, hours, minutes, seconds } = useCountdown(endTime);
  const isExpired = days === 0 && hours === 0 && minutes === 0 && seconds === 0;
  const isUrgent = days === 0 && hours === 0 && minutes < 5;

  if (isExpired) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-gray-500">Expired</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-1 text-xs font-mono ${
        isUrgent ? 'text-accent-red animate-pulse' : 'text-amber-400'
      }`}>
        <BoltIcon className="w-3 h-3" />
        {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
        <BoltIcon className="w-5 h-5 text-amber-400" />
      </div>
      <div className="flex gap-2">
        {hours > 0 && (
          <TimeUnit value={hours} label="HRS" urgent={isUrgent} />
        )}
        <TimeUnit value={minutes} label="MIN" urgent={isUrgent} />
        <TimeUnit value={seconds} label="SEC" urgent={isUrgent} />
      </div>
    </div>
  );
}

function TimeUnit({ value, label, urgent }: { value: number; label: string; urgent: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-mono font-bold ${
        urgent ? 'text-accent-red' : 'text-amber-400'
      }`}>
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-[9px] text-gray-600 uppercase tracking-widest">{label}</div>
    </div>
  );
}
