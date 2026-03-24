import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import type { Notification as NotificationType } from '@/types';
import { CheckIcon, CloseIcon, InfoIcon } from '@/components/icons';

interface ToastProps {
  notification: NotificationType;
  onDismiss: (id: string) => void;
}

const typeStyles = {
  success: { bg: 'border-accent-green/30 bg-accent-green/5', icon: 'text-accent-green' },
  error: { bg: 'border-accent-red/30 bg-accent-red/5', icon: 'text-accent-red' },
  warning: { bg: 'border-yellow-500/30 bg-yellow-500/5', icon: 'text-yellow-500' },
  info: { bg: 'border-teal/30 bg-teal/5', icon: 'text-teal' },
};

export default function Toast({ notification, onDismiss }: ToastProps) {
  useEffect(() => {
    const duration = notification.link ? 12000 : 5000;
    const timer = setTimeout(() => onDismiss(notification.id), duration);
    return () => clearTimeout(timer);
  }, [notification.id, notification.link, onDismiss]);

  const style = typeStyles[notification.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl ${style.bg}`}
    >
      <div className={style.icon}>
        {notification.type === 'success' ? <CheckIcon className="w-5 h-5" /> : <InfoIcon className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{notification.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{notification.message}</p>
        {notification.link && (
          <a
            href={notification.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-teal hover:text-teal/80 mt-1 underline underline-offset-2"
          >
            {notification.linkLabel || 'View on Explorer'} ↗
          </a>
        )}
      </div>
      <button onClick={() => onDismiss(notification.id)} className="text-gray-500 hover:text-gray-300">
        <CloseIcon className="w-4 h-4" />
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
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
      <AnimatePresence>
        {notifications.map((n) => (
          <Toast key={n.id} notification={n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
