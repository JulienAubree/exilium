import { useEffect } from 'react';
import { trpc } from '@/trpc';
import { useIsQuart } from '@/stores/theme.store';

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 24) return `${Math.floor(h / 24)}j ${h % 24}h`;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useDocumentTitle() {
  const { data } = trpc.gameEvent.unreadCount.useQuery();
  const utils = trpc.useUtils();
  const isQuart = useIsQuart();
  const count = data?.count ?? 0;

  useEffect(() => {
    const base = count > 0 ? `(${count}) Exilium` : 'Exilium';
    document.title = base;
    if (!isQuart) return;

    // « Quart de nuit » S0 — commandement n°4 : onglet en arrière-plan, le
    // titre devient le compte à rebours du prochain événement (lecture du
    // cache empire uniquement, aucun fetch déclenché).
    let interval: number | null = null;

    const nextEndTime = (): number | null => {
      const empire = utils.planet.empire.getData();
      if (!empire) return null;
      const now = Date.now();
      let best: number | null = null;
      for (const p of empire.planets) {
        const times = [
          p.activeBuild?.endTime,
          p.activeResearch?.endTime,
          p.activeShipyard?.endTime,
          p.activeDefense?.endTime,
          p.inboundAttack?.arrivalTime,
        ];
        for (const t of times) {
          if (!t) continue;
          const ts = Date.parse(t.includes('T') ? t : t.replace(' ', 'T'));
          if (Number.isFinite(ts) && ts > now && (best === null || ts < best)) best = ts;
        }
      }
      return best;
    };

    const tick = () => {
      const end = nextEndTime();
      document.title = end ? `${fmtCountdown(end - Date.now())} · ${base}` : base;
    };

    const onVisibility = () => {
      if (document.hidden) {
        tick();
        interval = window.setInterval(tick, 1000);
      } else {
        if (interval !== null) {
          clearInterval(interval);
          interval = null;
        }
        document.title = base;
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (interval !== null) clearInterval(interval);
      document.title = base;
    };
  }, [count, isQuart, utils]);
}
