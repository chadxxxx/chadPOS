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
  checkSetup: () => Promise<void>;
  setup: (username: string, displayName: string, password: string, email?: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isSetupComplete: true,
  loginError: '',

  checkSetup: async () => {
    try {
      const res = await fetch('/api/auth/setup');
      const json = await res.json();
      set({ isSetupComplete: json.data?.isSetupComplete ?? false, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setup: async (username, displayName, password, email) => {
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
    await apiFetch('/api/auth/logout', { method: 'POST' });
    sessionStorage.removeItem('session_token');
    set({ user: null, isAuthenticated: false });
  },

  checkSession: async () => {
    const token = sessionStorage.getItem('session_token');
    if (!token) { set({ isLoading: false, isAuthenticated: false }); return false; }
    const res = await apiFetch('/api/auth/session');
    if (res.error || !res.data) {
      sessionStorage.removeItem('session_token');
      set({ user: null, isAuthenticated: false, isLoading: false });
      return false;
    }
    set({ user: res.data as User, isAuthenticated: true, isLoading: false });
    return true;
  },

  clearError: () => set({ loginError: '' }),
}));