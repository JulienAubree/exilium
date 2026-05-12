import { useEffect, useState } from 'react';
import { subscribeToClock } from '@/lib/clock';

/**
 * Renvoie le timestamp courant (ms epoch) mis à jour chaque seconde via
 * l'horloge globale partagée. Préférer ce hook à `setInterval(tick, 1000)`
 * inline dans chaque composant — voir `lib/clock.ts` pour la motivation.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => subscribeToClock(setNow), []);
  return now;
}
