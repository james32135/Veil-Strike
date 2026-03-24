import { create } from 'zustand';
import type { Notification } from '@/types';

interface NotificationState {
  notifications: Notification[];
  addNotification: (type: Notification['type'], title: string, message: string, link?: string, linkLabel?: string) => string;
  updateNotification: (id: string, updates: Partial<Omit<Notification, 'id' | 'timestamp'>>) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (type, title, message, link, linkLabel) => {
    const id = crypto.randomUUID();
    const notification: Notification = {
      id,
      type,
      title,
      message,
      timestamp: Date.now(),
      link,
      linkLabel,
    };
    set((state) => ({
      notifications: [...state.notifications.slice(-4), notification],
    }));
    return id;
  },

  updateNotification: (id, updates) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, ...updates } : n
      ),
    })),

  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),
}));
