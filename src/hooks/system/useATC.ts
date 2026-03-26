// src/hooks/system/useATC.ts
import { useContext } from 'react';
import { ATCContext, ATCContextType } from '@/contexts/ATCProvider';

export const useATC = (): ATCContextType => {
  const context = useContext(ATCContext);
  
  if (!context) {
    throw new Error("useATC must be used within an ATCProvider");
  }
  
  return context;
};