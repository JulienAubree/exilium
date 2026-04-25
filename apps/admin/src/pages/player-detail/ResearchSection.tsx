export function ResearchSection({ research }: { research: Record<string, unknown> }) {
  return (
    <div className="admin-card p-4 mb-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {Object.entries(research)
          .filter(([key]) => key !== 'id' && key !== 'userId')
          .map(([key, value]) => (
            <div key={key} className="flex items-center justify-between bg-panel rounded px-2 py-1">
              <span className="text-xs text-gray-400">{key}</span>
              <span className="font-mono text-xs text-gray-200">{String(value)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
