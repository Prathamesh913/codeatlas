import { create } from 'zustand';
import { AuthClient } from '../services/AuthClient';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => {
    set({ isLoading: true });
    try {
      const user = await AuthClient.login();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },
  logout: () => {
    AuthClient.logout();
    set({ user: null, isAuthenticated: false });
  },
}));
