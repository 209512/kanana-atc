// src/hooks/system/useTerminalScroll.ts
import { useRef, useState, useEffect, useCallback } from 'react';

export const useTerminalScroll = (dependencies: any[], isCollapsed: boolean) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isBottom = scrollHeight - clientHeight - scrollTop < 50;
    setAutoScroll(isBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (autoScroll && scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [autoScroll, isCollapsed]);

  useEffect(() => {
    scrollToBottom();
  }, [dependencies, scrollToBottom]);

  return { scrollRef, autoScroll, setAutoScroll, handleScroll };
};