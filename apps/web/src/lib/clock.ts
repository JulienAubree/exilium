/**
 * Horloge globale partagée : un seul `setInterval` à 1Hz tick partagé par
 * tous les composants qui ont besoin d'un compte à rebours ou d'un timer.
 *
 * Auparavant chaque `<Timer>`, `<BuildingQueuePanel>`, hook countdown
 * démarrait son propre `setInterval(tick, 1000)`. Avec 20 timers à l'écran
 * = 20 callbacks/sec → CPU wakeups + memory churn. Ici on a 1 interval
 * qui notifie N subscribers, et il s'arrête automatiquement quand plus
 * personne n'écoute (économie batterie sur mobile).
 *
 * Usage typique : `useNow()` (cf. `hooks/useNow.ts`).
 */

type ClockListener = (now: number) => void;

const listeners = new Set<ClockListener>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function tick() {
  const now = Date.now();
  for (const fn of listeners) fn(now);
}

export function subscribeToClock(listener: ClockListener): () => void {
  listeners.add(listener);
  if (intervalId === null) {
    intervalId = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
