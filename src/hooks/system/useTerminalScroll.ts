// src/hooks/system/useTerminalScroll.ts
import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';

export const useTerminalScroll = (dependency: unknown, isCollapsed: boolean, streamingText?: string) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // 임계값 완화: 100px 이내면 바닥으로 간주
    const isBottom = scrollHeight - clientHeight - scrollTop < 100;
    setAutoScroll(isBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (autoScroll && scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [autoScroll, isCollapsed]);

  // DOM 업데이트 직후(화면에 그려지기 전)에 동기적으로 스크롤을 맨 아래로 내림 (깜빡임 방지)
  useLayoutEffect(() => {
    scrollToBottom();
  }, [dependency, streamingText, scrollToBottom]);

  return { scrollRef, autoScroll, setAutoScroll, handleScroll };
};