interface ProbabilityGaugeProps {
  upProbability: number; // 0-100
  size?: number;
}

export default function ProbabilityGauge({ upProbability, size = 120 }: ProbabilityGaugeProps) {
  const clamped = Math.max(0, Math.min(100, upProbability));
  const downProbability = 100 - clamped;

  // SVG semicircle arc
  const cx = size / 2;
  const cy = size / 2 + 4;
  const r = (size - 16) / 2;
  const startAngle = Math.PI;
  const upAngle = startAngle + (clamped / 100) * Math.PI;

  const arcPath = (from: number, to: number) => {
    const x1 = cx + r * Math.cos(from);
    const y1 = cy + r * Math.sin(from);
    const x2 = cx + r * Math.cos(to);
    const y2 = cy + r * Math.sin(to);
    const large = to - from > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 16}`}>
        {/* Background arc */}
        <path
          d={arcPath(startAngle, 2 * Math.PI)}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* Up arc (green) */}
        {clamped > 0 && (
          <path
            d={arcPath(startAngle, upAngle)}
            fill="none"
            stroke="#22C55E"
            strokeWidth={8}
            strokeLinecap="round"
          />
        )}
        {/* Down arc (red) */}
        {downProbability > 0 && (
          <path
            d={arcPath(upAngle, 2 * Math.PI)}
            fill="none"
            stroke="#EF4444"
            strokeWidth={8}
            strokeLinecap="round"
          />
        )}
        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-white text-lg font-bold font-mono">
          {clamped}%
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" className="fill-gray-500 text-[9px] font-heading uppercase tracking-wider">
          Up
        </text>
      </svg>
      {/* Labels below */}
      <div className="flex items-center justify-between w-full px-2 -mt-1">
        <span className="text-[10px] font-mono text-accent-green">{clamped}% Up</span>
        <span className="text-[10px] font-mono text-accent-red">{downProbability}% Down</span>
      </div>
    </div>
  );
}
