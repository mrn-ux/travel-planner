import { AsyncBoundary } from './AsyncBoundary';

/**
 * Temporary body for routes whose feature has not been built yet. Later plans replace the page and feed
 * real data into AsyncBoundary; the loading, empty and error states stay.
 */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-text">{title}</h1>
      <AsyncBoundary state="empty" emptyMessage={`${title} is not available yet.`} />
    </div>
  );
}
