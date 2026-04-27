import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';

export const useTerminalScroll = (dependency: unknown, isCollapsed: boolean, streamingText?: string) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    const isBottom = scrollHeight - clientHeight - scrollTop < 100;
    setAutoScroll(isBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (autoScroll && scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [autoScroll, isCollapsed]);

  
  useLayoutEffect(() => {
    scrollToBottom();
  }, [dependency, streamingText, scrollToBottom]);

  return { scrollRef, autoScroll, setAutoScroll, handleScroll };
};