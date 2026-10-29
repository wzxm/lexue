import { create } from 'zustand';
import type { WishHomeData, WishQuickItem } from '../types/index';

interface WishState {
  homeData: WishHomeData | null;
  quickItems: WishQuickItem[];
  currentStudentId: string | null;

  setHomeData: (data: WishHomeData | null) => void;
  setQuickItems: (items: WishQuickItem[]) => void;
  setCurrentStudentId: (studentId: string | null) => void;
  clearAll: () => void;
}

export const useWishStore = create<WishState>((set) => ({
  homeData: null,
  quickItems: [],
  currentStudentId: null,

  setHomeData: (data) => set({ homeData: data }),
  setQuickItems: (items) => set({ quickItems: items }),
  setCurrentStudentId: (studentId) => set({ currentStudentId: studentId }),
  clearAll: () => set({ homeData: null, quickItems: [], currentStudentId: null }),
}));
