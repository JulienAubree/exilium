export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="w-6 h-6 border-2 border-hull-700 border-t-hull-400 rounded-full animate-spin" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-panel-light rounded" />
      <div className="admin-card">
        <div className="h-10 bg-panel rounded-t-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 border-b border-panel-border/30 bg-panel-light" />
        ))}
      </div>
    </div>
  );
}
