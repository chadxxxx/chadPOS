import { create } from 'zustand';

export type ViewId =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'inventory'
  | 'sales'
  | 'reports'
  | 'expenses'
  | 'suppliers'
  | 'users'
  | 'utang'
  | 'settings'
  | 'audit';

interface NavState {
  currentView: ViewId;
  sidebarOpen: boolean;
  setView: (view: ViewId) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useNavStore = create<NavState>((set) => ({
  currentView: 'dashboard',
  sidebarOpen: false,
  setView: (view) => set({ currentView: view, sidebarOpen: false }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
