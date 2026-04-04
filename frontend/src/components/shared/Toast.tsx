import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import type { Notification as NotificationType } from '@/types';
import { CheckIcon, CloseIcon, InfoIcon } from '@/components/icons';

interface ToastProps {
  notification: NotificationType;
  onDismiss: (id: string) => void;
}

const typeStyles = {
  success: { bg: 'border-accent-green/30 bg-accent-green/5', icon: 'text-accent-green', glow: 'shadow-[0_0_20px_rgba(0,212,184,0.1)]' },
  error: { bg: 'border-accent-red/30 bg-accent-red/5', icon: 'text-accent-red', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.1)]' },
  warning: { bg: 'border-yellow-500/30 bg-yellow-500/5', icon: 'text-yellow-500', glow: '' },
  info: { bg: 'border-teal/30 bg-teal/5', icon: 'text-teal', glow: '' },
  pending: { bg: 'border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5', icon: 'text-amber-400', glow: 'shadow-[0_0_30px_rgba(245,158,11,0.08)]' },
};

function StepIndicator({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="mt-3 space-y-1.5">
      {steps.map((label, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        const isPending = i > currentStep;
        return (
          <div key={i} className="flex items-center gap-2.5">
            {/* Step circle */}
            <div className="relative flex-shrink-0">
              {isDone ? (
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5 rounded-full bg-accent-green/20 flex items-center justify-center"
                >
                  <CheckIcon className="w-3 h-3 text-accent-green" />
                </motion.div>
              ) : isActive ? (
                <div className="w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-2.5 h-2.5 rounded-full border-2 border-amber-400 border-t-transparent"
                  />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-gray-600/50 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-600/50" />
                </div>
              )}
            </div>
            {/* Step label */}
            <span className={`text-xs font-medium transition-colors ${
              isDone ? 'text-accent-green/80' :
              isActive ? 'text-amber-300' :
              'text-gray-600'
            }`}>
              {label}
              {isDone && ' ✓'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Toast({ notification, onDismiss }: ToastProps) {
  useEffect(() => {
    if (notification.type === 'pending') return;
    const duration = notification.link ? 15000 : notification.type === 'success' ? 8000 : 5000;
    const timer = setTimeout(() => onDismiss(notification.id), duration);
    return () => clearTimeout(timer);
  }, [notification.id, notification.type, notification.link, onDismiss]);

  const style = typeStyles[notification.type] ?? typeStyles.info;
  const hasSteps = notification.steps && notification.steps.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-xl ${style.bg} ${style.glow}`}
    >
      <div className={`mt-0.5 ${style.icon}`}>
        {notification.type === 'pending' ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : notification.type === 'success' ? (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
            <CheckIcon className="w-5 h-5" />
          </motion.div>
        ) : notification.type === 'error' ? (
          <CloseIcon className="w-5 h-5" />
        ) : (
          <InfoIcon className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-heading font-bold text-white">{notification.title}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{notification.message}</p>

        {/* Multi-step progress */}
        {hasSteps && (
          <StepIndicator steps={notification.steps!} currentStep={notification.currentStep ?? 0} />
        )}

        {notification.link && (
          <a
            href={notification.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-teal hover:text-teal/80 mt-2 font-medium"
          >
            <span className="underline underline-offset-2">{notification.linkLabel || 'View on Explorer'}</span>
            <span>↗</span>
          </a>
        )}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="text-gray-600 hover:text-gray-300 transition-colors mt-0.5"
      >
        <CloseIcon className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export function ToastContainer({
  notifications,
  onDismiss,
}: {
  notifications: NotificationType[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5 w-[340px]">
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <Toast key={n.id} notification={n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
