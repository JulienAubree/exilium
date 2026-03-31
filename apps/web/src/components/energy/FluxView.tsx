import { Knob } from './Knob';

interface EnergySource {
  name: string;
  icon: string;
  energy: number;
  detail: string;
}

interface Consumer {
  key: string;
  name: string;
  icon: string;
  colorHex: string;
  colorClass: string;
  percent: number;
  energyConsumption: number;
  production: string;
  productionLabel: string;
}

interface FluxViewProps {
  sources: EnergySource[];
  totalEnergy: number;
  consumers: Consumer[];
  onPercentChange: (key: string, value: number) => void;
  onPercentChangeEnd: (key: string, value: number) => void;
  disabled?: boolean;
}

export function FluxView({
  sources,
  totalEnergy,
  consumers,
  onPercentChange,
  onPercentChangeEnd,
  disabled = false,
}: FluxViewProps) {
  const consumerCount = consumers.length;

  return (
    <div className="space-y-2">
      {/* Sources */}
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
        Sources d'énergie
      </h3>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        {sources.map((s) => (
          <div
            key={s.name}
            className="glass-card p-4 text-center flex-1 relative overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-energy to-transparent" />
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xs text-muted-foreground">{s.name}</div>
            <div className="text-lg font-bold text-energy font-mono mt-1">+{s.energy}</div>
            <div className="text-[11px] text-muted-foreground">{s.detail}</div>
          </div>
        ))}
      </div>

      {/* Flow pipe down */}
      <div className="flex flex-col items-center py-1">
        <div className="w-0.5 h-8 bg-gradient-to-b from-energy/60 to-primary/40 rounded" />
      </div>

      {/* Energy hub */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-energy/30 bg-energy/5">
          <span className="text-xs text-muted-foreground">Production totale</span>
          <span className="text-lg font-bold text-energy font-mono">{totalEnergy}</span>
        </div>
      </div>

      {/* SVG Branches */}
      <svg
        viewBox={`0 0 ${consumerCount * 190} 40`}
        className="w-full max-w-3xl mx-auto h-10"
        preserveAspectRatio="xMidYMid meet"
      >
        {consumers.map((c, i) => {
          const totalWidth = consumerCount * 190;
          const centerX = totalWidth / 2;
          const targetX = i * 190 + 95;
          return (
            <g key={c.key}>
              <path
                d={`M ${centerX} 0 Q ${centerX} 20, ${targetX} 20 L ${targetX} 40`}
                fill="none"
                stroke={c.colorHex}
                strokeWidth="1.5"
                opacity={c.percent > 0 ? 0.4 : 0.1}
              />
              <circle
                cx={targetX}
                cy={34}
                r={3}
                fill={c.colorHex}
                opacity={c.percent > 0 ? 0.6 : 0.15}
                className={c.percent > 0 ? 'animate-flow-pulse' : ''}
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            </g>
          );
        })}
      </svg>

      {/* Consumer cards */}
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
        Distribution
      </h3>
      <div className={`grid gap-3 ${consumerCount <= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {consumers.map((c) => (
          <div
            key={c.key}
            className="glass-card p-3 text-center relative overflow-hidden"
          >
            <div
              className="absolute inset-x-0 top-0 h-0.5"
              style={{ background: `linear-gradient(90deg, transparent, ${c.colorHex}, transparent)` }}
            />
            <div className="text-xl mb-1">{c.icon}</div>
            <div className="text-xs text-muted-foreground mb-2">{c.name}</div>
            <div className="flex justify-center mb-2">
              <Knob
                value={c.percent}
                onChange={(v) => onPercentChange(c.key, v)}
                onChangeEnd={(v) => onPercentChangeEnd(c.key, v)}
                color={c.colorHex}
                size="md"
                disabled={disabled}
              />
            </div>
            <div className="h-0.5 w-full rounded bg-muted overflow-hidden mb-1.5">
              <div
                className="h-0.5 rounded transition-[width] duration-200"
                style={{ width: `${c.percent}%`, backgroundColor: c.colorHex }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              Consomme <span className={`font-mono font-semibold ${c.colorClass}`}>{c.energyConsumption}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-border/30">
              <div className="text-[10px] text-muted-foreground">{c.productionLabel}</div>
              <div className={`text-sm font-mono font-semibold ${c.colorClass}`}>{c.production}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
