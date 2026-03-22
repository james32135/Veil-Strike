interface ProgressBarProps {
  value: number;
  color?: 'teal' | 'green' | 'red';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  label?: string;
}

const colors = {
  teal: 'bg-teal',
  green: 'bg-accent-green',
  red: 'bg-accent-red',
};

const glowColors = {
  teal: 'rgba(255, 107, 53, 0.4)',
  green: 'rgba(34, 197, 94, 0.4)',
  red: 'rgba(239, 68, 68, 0.4)',
};

export default function ProgressBar({ value, color = 'teal', size = 'sm', showLabel = false, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-smoke/60">{label}</span>
          <span className="text-xs font-mono text-smoke">{clamped.toFixed(1)}%</span>
        </div>
      )}
      <div className={`w-full bg-white/[0.04] rounded-full overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}>
        <div
          className={`${colors[color]} rounded-full transition-all duration-700 ease-out progress-shimmer ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}
          style={{ width: `${clamped}%`, boxShadow: `0 0 10px -2px ${glowColors[color]}` }}
        />
      </div>
    </div>
  );
}
