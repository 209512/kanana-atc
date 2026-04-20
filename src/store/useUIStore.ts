// src/store/useUIStore.ts
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
}

export const useUIStore = create<UIStore>((set) => ({
  isDark: true,
  setIsDark: (value) => set((state) => ({ isDark: typeof value === 'function' ? value(state.isDark) : value })),
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
    // 드래그 중 일정 너비 이하로 가면 자동으로 collapsed 처리
    return { 
      sidebarWidth: newWidth,
      isSidebarCollapsed: newWidth < 150 
    };
  }),
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ 
    isSidebarCollapsed: !state.isSidebarCollapsed,
    // 펼칠 때 이전 너비가 너무 작았다면 기본값 450으로 복원
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
