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
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10"
    >
      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-smoke/70 mt-2 text-sm"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {action && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {action.href ? (
            <Link to={action.href} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2">
              {action.label}
            </Link>
          ) : (
            <button onClick={action.onClick} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2">
              {action.label}
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
