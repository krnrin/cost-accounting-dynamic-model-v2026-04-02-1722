import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  activeTab: string;
  theme: 'dark' | 'light';
  
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarCollapsed: false,
        activeTab: 'overview',
        theme: 'light',
        
        toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
        setActiveTab: (tab) => set({ activeTab: tab }),
        setTheme: (theme) => set({ theme }),
      }),
      {
        name: 'ui-storage',
      }
    ),
    { name: 'ui-store' }
  )
);
