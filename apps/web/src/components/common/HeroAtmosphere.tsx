interface HeroAtmosphereProps {
  /** Image to use as blurred backdrop. Falls back to the gradient if missing. */
  imageUrl?: string | null;
  /** Tint variant — controls the colored wash applied over the blurred image. */
  variant?: 'cyan-purple' | 'cyan-cyan' | 'gold-red' | 'green-cyan' | 'indigo';
  /** Fallback gradient (used when no imageUrl). Overrides the variant default. */
  fallbackGradient?: string;
}

// Design v2 « calme spatial » : les washes colorés (violet/cyan/ambre) sont
// neutralisés — l'image clé apporte déjà sa couleur ; l'UI reste muette.
// Les variants sont conservés dans l'API pour compat, tous rendus neutres.
const NEUTRAL_TINT = 'bg-slate-950/50';
const NEUTRAL_FALLBACK = 'bg-surface-raised';

const TINT_CLASSES: Record<NonNullable<HeroAtmosphereProps['variant']>, string> = {
  'cyan-purple': NEUTRAL_TINT,
  'cyan-cyan': NEUTRAL_TINT,
  'gold-red': NEUTRAL_TINT,
  'green-cyan': NEUTRAL_TINT,
  indigo: NEUTRAL_TINT,
};

const FALLBACK_GRADIENTS: Record<NonNullable<HeroAtmosphereProps['variant']>, string> = {
  'cyan-purple': NEUTRAL_FALLBACK,
  'cyan-cyan': NEUTRAL_FALLBACK,
  'gold-red': NEUTRAL_FALLBACK,
  'green-cyan': NEUTRAL_FALLBACK,
  indigo: NEUTRAL_FALLBACK,
};

/**
 * Atmospheric backdrop for hero sections. Lives entirely inside its parent's
 * box (no horizontal nor vertical bleed) — clipping is the parent's job
 * (it should set `overflow-hidden`).
 *
 * Three layers, top-down:
 *   1. Blurred key art (or fallback tinted gradient).
 *   2. Colored wash so the image picks up the brand.
 *   3. Vertical fade into the page surface so titles/CTAs stay legible.
 */
export function HeroAtmosphere({
  imageUrl,
  variant = 'cyan-purple',
  fallbackGradient,
}: HeroAtmosphereProps) {
  const fallback = fallbackGradient ?? FALLBACK_GRADIENTS[variant];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full scale-110 object-cover opacity-50 blur-sm"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div className={`h-full w-full ${fallback}`} />
      )}
      <div className={`absolute inset-0 ${TINT_CLASSES[variant]}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
    </div>
  );
}
