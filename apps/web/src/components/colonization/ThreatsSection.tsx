import {
  AlertTriangle as IconAlertTriangle,
  Clock as IconClock,
  Crosshair as IconCrosshair,
} from 'lucide-react';
import { getShipName } from '@/lib/entity-names';
import { RaidCountdown } from './Countdowns';
import { ExpandableInfo } from '@/components/common/ExpandableInfo';
import type { GameConfigLike, InboundFleet } from './types';

interface ThreatsSectionProps {
  planetRaids: InboundFleet[];
  gameConfig: GameConfigLike | null | undefined;
}

export function ThreatsSection({ planetRaids, gameConfig }: ThreatsSectionProps) {
  return (
    <section className="rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/5 to-red-900/5 overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
          <IconAlertTriangle className="w-4 h-4" />
          Menaces
        </h3>
        {planetRaids.length > 0 && (
          <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-400">
            {planetRaids.length} en approche
          </span>
        )}
      </div>

      <div className="px-4 pb-2">
        <p className="text-[11px] text-muted-foreground leading-tight">
          Les pirates lancent des raids à intervalles irréguliers tant que la colonisation n'est pas terminée.
        </p>
        <div className="mt-1.5">
          <ExpandableInfo label="Comprendre les raids" accent="red">
            <p>
              Un raid peut survenir à tout moment après l'établissement de l'avant-poste. Votre niveau de détection (lié à vos bâtiments) détermine les informations visibles : compte à rebours, composition, identité.
            </p>
            <p>
              Au combat : votre garnison affronte la flotte pirate. Si elle perd, les pirates pillent vos stocks (minerai + silicium) et la progression peut être impactée.
            </p>
            <p className="text-muted-foreground">
              Défense : gardez une garnison à FP suffisant, surveillez les comptes à rebours et envoyez des renforts en avance quand une menace est détectée.
            </p>
          </ExpandableInfo>
        </div>
      </div>

      <div className="px-4 pb-4">
        {planetRaids.length > 0 ? (
          <div className="space-y-2">
            {planetRaids.map((raid) => {
              const ships = raid.ships;
              const shipEntries = Object.entries(ships).filter(([, v]) => v > 0);
              const tier = raid.detectionTier ?? 0;

              return (
                <div
                  key={raid.id}
                  className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconCrosshair className="w-4 h-4 text-red-400" />
                      <span className="text-xs font-semibold text-red-400">
                        {tier >= 4 && raid.senderUsername
                          ? raid.senderUsername
                          : 'Raid pirate'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconClock className="w-3.5 h-3.5 text-red-400/60" />
                      <RaidCountdown arrivalTime={raid.arrivalTime} />
                    </div>
                  </div>

                  {/* Fleet composition if visible */}
                  {tier >= 3 && shipEntries.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {shipEntries.map(([shipId, count]) => (
                        <span
                          key={shipId}
                          className="rounded-md bg-card/80 border border-border/30 px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {getShipName(shipId, gameConfig)} x{count}
                        </span>
                      ))}
                    </div>
                  )}
                  {tier >= 2 && tier < 3 && raid.shipCount != null && (
                    <p className="text-[11px] text-muted-foreground">
                      Flotte estimée : {raid.shipCount} vaisseaux
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-card/40 border border-border/20 px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              Aucune menace détectée
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
