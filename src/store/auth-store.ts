import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: string;
  status: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSetupComplete: boolean;
  loginError: string;
  init: () => Promise<void>;
  setup: (username: string, displayName: string, password: string, email?: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isSetupComplete: false,
  loginError: '',

  /** Single init call: check session token first, then check setup status */
  init: async () => {
    try {
      // 1. Check existing session
      const token = sessionStorage.getItem('session_token');
      if (token) {
        try {
          const res = await apiFetch('/api/auth/session');
          if (!res.error && res.data) {
            set({ user: res.data as User, isAuthenticated: true, isLoading: false, isSetupComplete: true });
            return;
          }
        } catch {
          // Session invalid, continue to setup check
        }
        sessionStorage.removeItem('session_token');
      }

      // 2. Check if setup is complete
      const setupRes = await fetch('/api/auth/setup');
      const setupJson = await setupRes.json();
      const isSetupComplete = setupJson?.data?.isSetupComplete === true;
      set({ isSetupComplete, isLoading: false, isAuthenticated: false, user: null });
    } catch (err) {
      // On any error, assume setup not complete so user can set up
      console.error('Init error:', err);
      set({ isLoading: false, isSetupComplete: false, isAuthenticated: false, user: null });
    }
  },

  setup: async (username, displayName, password, email) => {
    set({ loginError: '' });
    const res = await apiFetch('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username, displayName, password, recoveryEmail: email }),
    });
    if (res.error) { set({ loginError: res.error }); return false; }
    sessionStorage.setItem('session_token', (res.data as any).token);
    set({ user: (res.data as any).user, isAuthenticated: true, isSetupComplete: true, loginError: '' });
    return true;
  },

  login: async (username, password) => {
    set({ loginError: '', isLoading: true });
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.error) { set({ loginError: res.error, isLoading: false }); return false; }
    sessionStorage.setItem('session_token', (res.data as any).token);
    set({ user: (res.data as any).user, isAuthenticated: true, isLoading: false, loginError: '' });
    return true;
  },

  logout: async () => {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
    sessionStorage.removeItem('session_token');
    set({ user: null, isAuthenticated: false, isSetupComplete: true });
  },

  clearError: () => set({ loginError: '' }),
}));
