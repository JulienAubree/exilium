import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-16 left-4 right-4 z-50 lg:bottom-4 lg:left-auto lg:right-4 lg:w-80">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-card/95 p-3 shadow-lg backdrop-blur-lg">
        <span className="text-sm">Nouvelle version disponible</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Mettre à jour
        </button>
      </div>
    </div>
  );
}
