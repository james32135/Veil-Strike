import { create } from 'zustand';
import type { Series } from '@/types';
import { API_BASE } from '@/constants';

interface SeriesState {
  allSeries: Series[];
  currentSeries: Series | null;
  loading: boolean;
  fetchAllSeries: () => Promise<void>;
  fetchSeriesBySlug: (slug: string) => Promise<void>;
}

export const useSeriesStore = create<SeriesState>((set, get) => ({
  allSeries: [],
  currentSeries: null,
  loading: false,

  fetchAllSeries: async () => {
    const isFirstLoad = get().allSeries.length === 0;
    if (isFirstLoad) set({ loading: true });
    try {
      const res = await fetch(`${API_BASE}/series`);
      if (res.ok) {
        const data = await res.json();
        set({ allSeries: data.series || [], loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  fetchSeriesBySlug: async (slug: string) => {
    set({ loading: true });
    try {
      const res = await fetch(`${API_BASE}/series/${slug}`);
      if (res.ok) {
        const data = await res.json();
        set({ currentSeries: data.series || null, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },
}));
