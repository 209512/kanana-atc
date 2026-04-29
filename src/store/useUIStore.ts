import { create } from 'zustand';

interface UIStore {
  isDark: boolean;
  setIsDark: (isDark: boolean | ((prev: boolean) => boolean)) => void;
  isKananaKeyModalOpen: boolean;
  openKananaKeyModal: () => void;
  closeKananaKeyModal: () => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number | ((prev: number) => number)) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null | ((prev: string | null) => string | null)) => void;
  viewMode: 'detached' | 'attached';
  setViewMode: (mode: 'detached' | 'attached' | ((prev: 'detached' | 'attached') => 'detached' | 'attached')) => void;
  areTooltipsEnabled: boolean;
  setAreTooltipsEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  terminalFontSize: number;
  setTerminalFontSize: (size: number | ((prev: number) => number)) => void;
  isVisualHapticActive: boolean;
  triggerVisualHaptic: () => void;
  isTacticalPanelOpen: boolean;
  setTacticalPanelOpen: (isOpen: boolean) => void;
  isTerminalOpen: boolean;
  setTerminalOpen: (isOpen: boolean) => void;
  isQueueOpen: boolean;
  setQueueOpen: (isOpen: boolean) => void;
  isTourRunning: boolean;
  startTour: () => void;
  stopTour: () => void;
  startupMode: 'simulation' | 'connect' | null;
  setStartupMode: (mode: 'simulation' | 'connect' | null) => void;
}

const readStartupMode = (): UIStore['startupMode'] => {
  try {
    const v = window.localStorage.getItem('kanana_startup_mode');
    if (v === 'simulation' || v === 'connect') return v;
  } catch {
  }
  return null;
};

export const useUIStore = create<UIStore>((set) => ({
  isDark: true,
  setIsDark: (value) => set((state) => ({ isDark: typeof value === 'function' ? value(state.isDark) : value })),
  isTourRunning: false,
  startTour: () => set({ 
    isTourRunning: true,
    isSidebarCollapsed: false, // Ensure sidebar is open so targets are visible
    isTacticalPanelOpen: true // Ensure tactical panel is open
  }),
  stopTour: () => set({ isTourRunning: false }),
  startupMode: readStartupMode(),
  setStartupMode: (startupMode) => {
    try {
      if (startupMode) window.localStorage.setItem('kanana_startup_mode', startupMode);
      else window.localStorage.removeItem('kanana_startup_mode');
    } catch {
    }
    set({ startupMode });
  },
  isKananaKeyModalOpen: false,
  openKananaKeyModal: () => set({ isKananaKeyModalOpen: true }),
  closeKananaKeyModal: () => set({ isKananaKeyModalOpen: false }),
  sidebarWidth: 450,
  isTacticalPanelOpen: true,
  setTacticalPanelOpen: (isOpen) => set({ isTacticalPanelOpen: isOpen }),
  isTerminalOpen: true,
  setTerminalOpen: (isOpen) => set({ isTerminalOpen: isOpen }),
  isQueueOpen: true,
  setQueueOpen: (isOpen) => set({ isQueueOpen: isOpen }),
  setSidebarWidth: (value) => set((state) => {
    const newWidth = typeof value === 'function' ? value(state.sidebarWidth) : value;
    
    return { 
      sidebarWidth: newWidth,
      isSidebarCollapsed: newWidth < 150 
    };
  }),
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ 
    isSidebarCollapsed: !state.isSidebarCollapsed,
    
    sidebarWidth: state.isSidebarCollapsed ? (state.sidebarWidth < 150 ? 450 : state.sidebarWidth) : state.sidebarWidth
  })),
  selectedAgentId: null,
  setSelectedAgentId: (value) => set((state) => ({ selectedAgentId: typeof value === 'function' ? value(state.selectedAgentId) : value })),
  viewMode: 'detached',
  setViewMode: (value) => set((state) => ({ viewMode: typeof value === 'function' ? value(state.viewMode) : value })),
  areTooltipsEnabled: true,
  setAreTooltipsEnabled: (value) => set((state) => ({ areTooltipsEnabled: typeof value === 'function' ? value(state.areTooltipsEnabled) : value })),
  terminalFontSize: 12,
  setTerminalFontSize: (value) => set((state) => ({ terminalFontSize: typeof value === 'function' ? value(state.terminalFontSize) : value })),
  isVisualHapticActive: false,
  triggerVisualHaptic: () => {
    set({ isVisualHapticActive: true });
    setTimeout(() => set({ isVisualHapticActive: false }), 500);
  }
}));
