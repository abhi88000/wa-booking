export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function CardSkeleton({ count = 5 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg p-4 border border-gray-100">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 flex gap-8">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 w-16" />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-t border-gray-50 flex gap-8">
          {Array.from({ length: cols }).map((_, j) => <Skeleton key={j} className="h-3 w-20" />)}
        </div>
      ))}
    </div>
  );
}
