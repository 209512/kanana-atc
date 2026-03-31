// src/App.tsx
import React from 'react';
import clsx from 'clsx';
import { useUI } from '@/hooks/system/useUI';
import { Dashboard } from '@/components/layout/Dashboard';
import { SidebarContainer } from '@/components/layout/SidebarContainer';

const App = () => {
  const { isDark } = useUI();

  return (
    <div className={clsx(
      "h-screen w-screen font-sans relative overflow-hidden select-none", 
      isDark ? "bg-[#05090a] text-gray-300" : "bg-[#f1f5f9] text-slate-800"
    )}>
      {/* 1. 메인 뷰 (전체 배경) */}
      <Dashboard />
      
      {/* 2. 우측 사이드바 (Dashboard 위에 고정) */}
      <div className="fixed top-0 right-0 h-full z-50">
        <SidebarContainer />
      </div>
    </div>
  );
};

export default App;