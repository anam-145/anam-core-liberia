import { create } from 'zustand';

type Role = 'SYSTEM_ADMIN' | 'STAFF';

interface SessionState {
  role: Role | null;
  isLoaded: boolean;
  fetchSession: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  role: null,
  isLoaded: false,
  fetchSession: async () => {
    try {
      const res = await fetch('/api/admin/auth/session', { cache: 'no-store' });
      const data = await res.json();
      set({
        role: data?.isLoggedIn ? (data.role as Role) : null,
        isLoaded: true,
      });
    } catch {
      set({ role: null, isLoaded: true });
    }
  },
}));
