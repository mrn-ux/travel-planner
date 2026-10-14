// Loading placeholders built only from design tokens.
const block = 'animate-pulse rounded-sm bg-surface-muted';

export function SkeletonLine({ wide = false }: { wide?: boolean }) {
  return <div className={`${block} h-4 ${wide ? 'w-full' : 'w-1/2'}`} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-6" aria-hidden="true">
      <SkeletonLine />
      <SkeletonLine wide />
      <SkeletonLine wide />
    </div>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${block} h-control w-full`} />
      ))}
    </div>
  );
}
