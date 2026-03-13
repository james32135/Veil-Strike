interface ProgressBarProps {
  value: number; // 0-100
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

export default function ProgressBar({
  value,
  color = 'teal',
  size = 'sm',
  showLabel = false,
  label,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">{label}</span>
          <span className="text-xs font-mono text-gray-300">{clamped.toFixed(1)}%</span>
        </div>
      )}
      <div className={`w-full bg-dark-300 rounded-full overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}>
        <div
          className={`${colors[color]} rounded-full transition-all duration-500 ease-out ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
