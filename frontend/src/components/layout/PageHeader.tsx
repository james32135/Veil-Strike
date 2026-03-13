import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
    >
      <div>
        <h1 className="font-heading text-3xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && (
        action.href ? (
          <Link to={action.href} className="btn-primary px-4 py-2 text-sm">
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className="btn-primary px-4 py-2 text-sm">
            {action.label}
          </button>
        )
      )}
    </motion.div>
  );
}
