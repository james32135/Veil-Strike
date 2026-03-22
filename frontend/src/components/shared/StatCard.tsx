import { ReactNode } from 'react';
import { motion } from 'framer-motion';

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
    <motion.div
      className="glass-card p-5 relative overflow-hidden group"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1.5">{value}{suffix && <span className="text-sm text-smoke/50 ml-1">{suffix}</span>}</p>
          {subValue && <p className="text-xs text-smoke/50 mt-0.5">{subValue}</p>}
          {trend && trendValue && (
            <p className={`text-xs mt-1.5 font-mono flex items-center gap-1 ${trend === 'up' ? 'text-accent-green' : trend === 'down' ? 'text-accent-red' : 'text-smoke/50'
              }`}>
              {trend === 'up' && '▲'}
              {trend === 'down' && '▼'}
              {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}{trendValue}
            </p>
          )}
        </div>
        {icon && (
          <motion.div
            className="text-teal/30 group-hover:text-teal/50 transition-colors duration-300"
            whileHover={{ scale: 1.1, rotate: 5 }}
          >
            {icon}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
