import type { Blason } from '@exilium/shared';
import { BLASON_SHAPES, BLASON_ICONS, SHAPE_COMPONENTS, ICON_COMPONENTS } from '@exilium/shared';
import { AllianceBlason } from './AllianceBlason';
import { Input } from '@/components/ui/input';

type Props = {
  blason: Blason;
  motto: string | null;
  onBlasonChange: (b: Blason) => void;
  onMottoChange: (m: string | null) => void;
  allianceName?: string;
  allianceTag?: string;
};

// Relative luminance reused for contrast warning
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function BlasonPicker({
  blason,
  motto,
  onBlasonChange,
  onMottoChange,
  allianceName,
  allianceTag,
}: Props) {
  const lowContrast = contrastRatio(blason.color1, blason.color2) < 3;

  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      {/* Preview */}
      <div className="flex flex-col items-center gap-3">
        <AllianceBlason blason={blason} size={128} />
        {allianceName && (
          <div className="text-center">
            <div className="text-sm font-semibold">{allianceName}</div>
            {allianceTag && <div className="text-xs text-muted-foreground">[{allianceTag}]</div>}
          </div>
        )}
        {motto && (
          <p className="text-xs italic text-center text-muted-foreground max-w-[200px] border-l-2 border-primary/40 pl-2">
            {motto}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Shapes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-2">Forme</label>
          <div className="grid grid-cols-6 gap-2">
            {BLASON_SHAPES.map((shape) => {
              const Shape = SHAPE_COMPONENTS[shape];
              const selected = blason.shape === shape;
              return (
                <button
                  key={shape}
                  type="button"
                  onClick={() => onBlasonChange({ ...blason, shape })}
                  className={`aspect-square rounded border p-1 transition-colors ${selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-muted-foreground'}`}
                  aria-label={shape}
                >
                  <svg viewBox="0 0 100 100" width="100%" height="100%">
                    <Shape color1={blason.color1} color2={blason.color2} id={`pick-s-${shape}`} />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        {/* Icons */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-2">Icône</label>
          <div className="grid grid-cols-8 gap-2">
            {BLASON_ICONS.map((icon) => {
              const Icon = ICON_COMPONENTS[icon];
              const selected = blason.icon === icon;
              return (
                <button
                  key={icon}
                  type="button"
                  onClick={() => onBlasonChange({ ...blason, icon })}
                  className={`aspect-square rounded border p-1.5 transition-colors ${selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-muted-foreground'}`}
                  aria-label={icon}
                >
                  <svg viewBox="0 0 24 24" width="100%" height="100%">
                    <Icon color="currentColor" strokeWidth={2} />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground block mb-1">Couleur principale</span>
            <div className="flex gap-2">
              <input
                type="color"
                value={blason.color1}
                onChange={(e) => onBlasonChange({ ...blason, color1: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
              />
              <Input
                value={blason.color1}
                onChange={(e) => onBlasonChange({ ...blason, color1: e.target.value })}
                className="flex-1 font-mono text-xs"
                maxLength={7}
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground block mb-1">Couleur secondaire</span>
            <div className="flex gap-2">
              <input
                type="color"
                value={blason.color2}
                onChange={(e) => onBlasonChange({ ...blason, color2: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
              />
              <Input
                value={blason.color2}
                onChange={(e) => onBlasonChange({ ...blason, color2: e.target.value })}
                className="flex-1 font-mono text-xs"
                maxLength={7}
              />
            </div>
          </label>
        </div>

        {lowContrast && (
          <p className="text-xs text-amber-500">Lisibilité faible — les 2 couleurs sont trop proches.</p>
        )}

        {/* Motto */}
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground block mb-1">
            Devise (optionnelle, {(motto ?? '').length}/100)
          </span>
          <textarea
            value={motto ?? ''}
            onChange={(e) => onMottoChange(e.target.value.length === 0 ? null : e.target.value.slice(0, 100))}
            rows={2}
            maxLength={100}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            placeholder="Une devise qui vous représente…"
          />
        </label>
      </div>
    </div>
  );
}
