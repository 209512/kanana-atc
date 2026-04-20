import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { useATCStore } from '@/store/useATCStore';
import { useUIStore } from '@/store/useUIStore';

const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div role="alert">
    <p>Something went wrong:</p>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Explosion');
  }
  return <div>Safe</div>;
};

describe('ErrorBoundary & Store Reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useATCStore.setState({ isAiMode: true, agents: [{ id: '1' } as any] });
    useUIStore.setState({ isDark: true });
  });

  it('리셋 시 Zustand 스토어들이 초기화되어야 한다', () => {
    let thrown = false;
    
    const handleReset = () => {
      // 리셋 시 전역 상태 초기화 시뮬레이션
      useATCStore.setState({ isAiMode: false, agents: [] });
      useUIStore.setState({ isDark: false });
      thrown = false;
    };

    const { rerender } = render(
      <ErrorBoundary FallbackComponent={ErrorFallback} onReset={handleReset}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText(/Try again/i));
    
    expect(useATCStore.getState().isAiMode).toBe(false);
    expect(useATCStore.getState().agents).toHaveLength(0);
    expect(useUIStore.getState().isDark).toBe(false);
  });
});
