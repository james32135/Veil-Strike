import { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string;
  suffix?: string;
  subValue?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export default function StatCard({ label, value, suffix, subValue, icon, trend, trendValue }: StatCardProps) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1">{value}{suffix && <span className="text-sm text-gray-500 ml-1">{suffix}</span>}</p>
          {subValue && <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>}
          {trend && trendValue && (
            <p
              className={`text-xs mt-1.5 font-mono ${
                trend === 'up' ? 'text-accent-green' : trend === 'down' ? 'text-accent-red' : 'text-gray-500'
              }`}
            >
              {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}{trendValue}
            </p>
          )}
        </div>
        {icon && <div className="text-teal/60">{icon}</div>}
      </div>
    </div>
  );
}
