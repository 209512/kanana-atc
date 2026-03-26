// src/contexts/UIProvider.tsx
import React, { createContext, useState, useContext, useMemo } from 'react';

interface UIContextType {
  isDark: boolean;
  setIsDark: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarWidth: number;
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  selectedAgentId: string | null;
  setSelectedAgentId: React.Dispatch<React.SetStateAction<string | null>>;
  viewMode: 'detached' | 'attached';
  setViewMode: React.Dispatch<React.SetStateAction<'detached' | 'attached'>>;
  areTooltipsEnabled: boolean;
  setAreTooltipsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}

export const UIContext = createContext<UIContextType | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'detached' | 'attached'>('detached');
  const [areTooltipsEnabled, setAreTooltipsEnabled] = useState(true);
  
  const value = useMemo(() => ({
    isDark, setIsDark,
    sidebarWidth, setSidebarWidth,
    selectedAgentId, setSelectedAgentId,
    viewMode, setViewMode,
    areTooltipsEnabled, setAreTooltipsEnabled
  }), [isDark, sidebarWidth, selectedAgentId, viewMode, areTooltipsEnabled]);

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
};