export const RESOURCE_COLORS: Record<string, string> = {
  minerai: 'text-orange-400',
  silicium: 'text-emerald-400',
  hydrogene: 'text-blue-400',
};

export const RESOURCE_GLOWS: Record<string, string> = {
  minerai: 'glow-minerai',
  silicium: 'glow-silicium',
  hydrogene: 'glow-hydrogene',
};

export const RESOURCE_CARD_CLASS: Record<string, string> = {
  minerai: 'retro-card-minerai',
  silicium: 'retro-card-silicium',
  hydrogene: 'retro-card-hydrogene',
};

export const RESOURCE_BORDER_ACTIVE: Record<string, string> = {
  minerai: 'border-orange-400/50 shadow-[0_0_8px_rgba(251,146,60,0.15)]',
  silicium: 'border-emerald-400/50 shadow-[0_0_8px_rgba(52,211,153,0.15)]',
  hydrogene: 'border-blue-400/50 shadow-[0_0_8px_rgba(96,165,250,0.15)]',
};

export const RESOURCE_LABELS: Record<string, string> = {
  minerai: 'Minerai',
  silicium: 'Silicium',
  hydrogene: 'Hydrogene',
};

export const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  reserved: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  sold: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  expired: 'bg-red-500/20 text-red-400 border border-red-500/30',
  cancelled: 'bg-white/5 text-muted-foreground border border-white/10',
};

export const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  reserved: 'Reservee',
  sold: 'Vendue',
  expired: 'Expiree',
  cancelled: 'Annulee',
};

export function formatPrice(mi: number, si: number, h2: number) {
  const parts: string[] = [];
  if (mi > 0) parts.push(`${mi.toLocaleString('fr-FR')} Mi`);
  if (si > 0) parts.push(`${si.toLocaleString('fr-FR')} Si`);
  if (h2 > 0) parts.push(`${h2.toLocaleString('fr-FR')} H2`);
  return parts.join(' + ') || '0';
}
