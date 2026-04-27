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

  it('should reset Zustand stores when reset is triggered', () => {
    let thrown = false;
    
    const handleReset = () => {
      
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
