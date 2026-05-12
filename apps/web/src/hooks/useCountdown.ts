import { useEffect, useRef } from 'react';
import { useNow } from './useNow';

/**
 * Compte à rebours formaté en HH:MM:SS, mis à jour chaque seconde via
 * l'horloge globale partagée (`lib/clock.ts`).
 * Usage : `const display = useCountdownString(target)` → "02:15:30"
 */
export function useCountdownString(target: Date): string {
  const now = useNow();
  const diff = Math.max(0, Math.floor((target.getTime() - now) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Compte à rebours retournant le nombre de secondes restantes. Mis à jour
 * chaque seconde via l'horloge globale partagée.
 * Optionnel : `onComplete` est appelé une fois quand seconds <= 0.
 * Usage : `const seconds = useCountdownSeconds(endTime, () => refetch())`
 */
export function useCountdownSeconds(endTime: Date | null, onComplete?: () => void): number {
  const now = useNow();
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;
  const firedRef = useRef(false);

  const seconds = endTime ? Math.max(0, Math.floor((endTime.getTime() - now) / 1000)) : 0;

  useEffect(() => {
    if (!endTime) {
      firedRef.current = false;
      return;
    }
    if (seconds <= 0 && !firedRef.current) {
      firedRef.current = true;
      cbRef.current?.();
    } else if (seconds > 0 && firedRef.current) {
      firedRef.current = false;
    }
  }, [endTime, seconds]);

  return seconds;
}

/**
 * Format un nombre de secondes en composantes h/m/s.
 */
export function fmtCountdown(total: number): { h: number; m: number; s: number } {
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}
