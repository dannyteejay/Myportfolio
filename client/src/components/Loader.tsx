export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent ${className}`}
    />
  );
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-ink-900/60 ring-1 ring-line/10">
      <div className="aspect-[16/10] animate-pulse bg-line/5" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-2/3 animate-pulse rounded bg-line/5" />
        <div className="h-4 w-full animate-pulse rounded bg-line/5" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-line/5" />
      </div>
    </div>
  );
}
