import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "firebase/auth";

interface UserStore {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  setLoading: (v: boolean) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: "debrief-user",
      partialize: (state) => ({ user: state.user }),
    }
  )
);
