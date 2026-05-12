export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : '', `${s}s`].filter(Boolean).join(' ');
}

/**
 * Variante "compacte" : `2h15`, `2h`, `45min`. Pas de secondes.
 * Utile pour les libellés courts (UI mobile, badges).
 */
export function formatDurationCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

/**
 * Variante "courte" : adapte l'unité maximale à la durée.
 * `45s`, `2m 15s`, `2h 30m`. Sans secondes au-delà d'1h.
 */
export function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * `25.5h → "1j 1h"`, `2.5h → "2h 30min"`, `0.25h → "15min"`.
 */
export function formatHoursMinutes(hours: number): string {
  if (hours >= 24) return `${Math.floor(hours / 24)}j ${Math.floor(hours % 24)}h`;
  if (hours >= 1) return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}min`;
  return `${Math.round(hours * 60)}min`;
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 10_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString('fr-FR');
}

/**
 * Format français complet, sans compactage : `1 234 567`. Utiliser pour
 * les chiffres importants (ressources, prix, soute) où la précision
 * compte. Pour les badges/labels compacts, préférer `formatNumber`.
 */
export function fmt(value: number): string {
  return Number(value).toLocaleString('fr-FR');
}

/**
 * Date courte FR : `12 mai`, `12 mai 2026` si une autre année.
 */
export function formatDateShort(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Date + heure FR : `12/05/2026 14:32`.
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}
