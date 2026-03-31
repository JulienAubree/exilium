interface EnergyBalanceProps {
  energyProduced: number;
  energyConsumed: number;
  productionFactor: number;
}

export function EnergyBalance({ energyProduced, energyConsumed, productionFactor }: EnergyBalanceProps) {
  const surplus = energyProduced - energyConsumed;
  const sufficient = surplus >= 0;
  const ratio = energyConsumed > 0 ? Math.min(100, (energyProduced / energyConsumed) * 100) : 100;

  return (
    <section className="glass-card p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Bilan énergétique
        </h3>
        <div className="flex gap-4 text-xs">
          <span className="text-energy font-mono">+{energyProduced}</span>
          <span className="text-destructive font-mono">−{energyConsumed}</span>
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-2 rounded-full transition-[width] duration-500 ${
            sufficient ? 'bg-energy' : 'bg-destructive'
          }`}
          style={{ width: `${ratio}%` }}
        />
      </div>

      <div className="flex justify-between mt-1.5 text-xs">
        <span className={`font-mono font-semibold ${sufficient ? 'text-energy' : 'text-destructive'}`}>
          Facteur: {(productionFactor * 100).toFixed(0)}%
        </span>
        <span className="text-muted-foreground">
          {sufficient ? `Surplus: +${surplus}` : `Déficit: ${surplus}`}
        </span>
      </div>

      {productionFactor < 1 && (
        <p className="mt-2 text-xs text-destructive">
          Production réduite — construisez une centrale solaire ou des satellites solaires !
        </p>
      )}
    </section>
  );
}
