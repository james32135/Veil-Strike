import { create } from 'zustand';
import type { Notification } from '@/types';

interface NotificationState {
  notifications: Notification[];
  addNotification: (type: Notification['type'], title: string, message: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (type, title, message) => {
    const notification: Notification = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      timestamp: Date.now(),
    };
    set((state) => ({
      notifications: [...state.notifications.slice(-4), notification],
    }));
  },

  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),
}));
