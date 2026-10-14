import type { ReactNode } from 'react';
import { Button } from './ds/Button';
import { EmptyState } from './ds/EmptyState';
import { SkeletonCard } from './Skeleton';

export type AsyncState = 'loading' | 'empty' | 'error' | 'ready';

interface AsyncBoundaryProps {
  state: AsyncState;
  /** Shown for the empty state. */
  emptyMessage?: string;
  /** Shown for the error state; defaults to a generic message. */
  errorMessage?: string;
  onRetry?: () => void;
  /** Optional replacement for the default loading skeleton. */
  loading?: ReactNode;
  children?: ReactNode;
}

/**
 * Every screen is rendered through this: it is never blank. Loading shows a skeleton, empty shows a short
 * message, error shows what went wrong with Retry. The navigation bar is outside it and stays in place.
 */
export function AsyncBoundary({
  state,
  emptyMessage = 'Nothing to show yet.',
  errorMessage = 'Something went wrong while loading this page.',
  onRetry,
  loading,
  children,
}: AsyncBoundaryProps) {
  if (state === 'loading') {
    return (
      <div role="status" aria-live="polite" aria-label="Loading">
        {loading ?? (
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
      </div>
    );
  }
  if (state === 'empty') {
    return <EmptyState message={emptyMessage} />;
  }
  if (state === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-md border border-danger bg-danger/10 px-6 py-4 font-sans text-sm"
      >
        <div className="font-semibold text-danger">{errorMessage}</div>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }
  return <>{children}</>;
}
