interface OutcomeBarProps {
  outcomes: { name: string; probability: number; color: string }[];
}

export default function OutcomeBar({ outcomes }: OutcomeBarProps) {
  return (
    <div className="w-full">
      <div className="flex w-full h-2 rounded-full overflow-hidden bg-dark-300">
        {outcomes.map((outcome, i) => (
          <div
            key={i}
            className="h-full transition-all duration-500"
            style={{
              width: `${outcome.probability}%`,
              backgroundColor: outcome.color,
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        {outcomes.map((outcome, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: outcome.color }} />
            <span className="text-xs text-gray-400">{outcome.name}</span>
            <span className="text-xs font-mono text-gray-300">{outcome.probability.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
