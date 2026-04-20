import { useState } from 'react';
import { getUnitName } from '@/lib/entity-names';
import { DamagePanel } from './DamagePanel';
import { ShotLog } from './ShotLog';
import { DeathsList } from './DeathsList';
import { UnitGrid } from './UnitGrid';
import type { CombatEvent, UnitSnapshot, DetailedCombatLog, RoundResult, UnitTypeHP } from './types';

const fmt = (n: number) => Math.floor(n).toLocaleString('fr-FR');

interface UnitDetailPanelProps {
  selectedUnitType: string | null;
  selectedSide: 'attacker' | 'defender';
  selectedRound: number;
  detailedLog: DetailedCombatLog | null | undefined;
  roundResult: RoundResult | undefined;
  initialFleet: Record<string, number>;
  gameConfig: any;
  expandedUnitId: string | null;
  onExpandUnit: (unitId: string | null) => void;
}

export function UnitDetailPanel({
  selectedUnitType,
  selectedSide,
  selectedRound,
  detailedLog,
  roundResult,
  initialFleet,
  gameConfig,
  expandedUnitId,
  onExpandUnit,
}: UnitDetailPanelProps) {
  const [damageView, setDamageView] = useState<'summary' | 'shots'>('summary');
  if (!selectedUnitType) {
    return (
      <div className="glass-card flex items-center justify-center p-8 min-h-[300px]">
        <div className="text-center space-y-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto text-muted-foreground/40"
          >
            <path d="M21 21H4.6c-.56 0-.84 0-1.054-.109a1 1 0 0 1-.437-.437C3 20.24 3 19.96 3 19.4V3" />
            <path d="m7 14 4-4 4 4 6-6" />
          </svg>
          <p className="text-sm text-muted-foreground">
            Selectionnez un type d'unite pour voir le detail
          </p>
        </div>
      </div>
    );
  }

  const unitName = getUnitName(selectedUnitType, gameConfig);
  const initialCount = initialFleet[selectedUnitType] ?? 0;

  // Get HP data from round result
  const hpByType: Record<string, UnitTypeHP> | undefined =
    selectedSide === 'attacker'
      ? roundResult?.attackerHPByType
      : roundResult?.defenderHPByType;
  const hp = hpByType?.[selectedUnitType];

  // Get current surviving count from round result
  const currentFleet =
    selectedSide === 'attacker'
      ? roundResult?.attackerShips
      : roundResult?.defenderShips;
  const survivingCount = currentFleet?.[selectedUnitType] ?? 0;

  // Events for this round
  const events: CombatEvent[] = detailedLog?.events ?? [];

  // Compute total damage dealt and received by this unit type this round
  const roundEvents = events.filter((e) => e.round === selectedRound);
  const losses = roundEvents.filter(
    (e) => e.targetType === selectedUnitType && e.targetDestroyed,
  ).length;

  // Snapshots for the selected round
  const snapshots: UnitSnapshot[] =
    detailedLog?.snapshots?.[selectedRound] ?? [];
  const sideSnapshots = snapshots.filter((s) => s.side === selectedSide);

  const roundLabel = selectedRound === 0 ? 'Deploiement' : `Round ${selectedRound}`;

  // Unit flow: engaged → start of round → losses → end of round
  const startOfRound = selectedRound > 0 ? survivingCount + losses : initialCount;
  const previousLosses = initialCount - startOfRound; // cumulated losses before this round

  return (
    <div className="glass-card p-4 space-y-4 min-h-[300px]">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-foreground">{unitName}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{roundLabel}</p>
      </div>

      {/* Unit flow visual */}
      {selectedRound === 0 ? (
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="flex items-center gap-1.5 rounded-md bg-white/5 border border-border/20 px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/60">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-lg font-bold text-foreground">{initialCount}</span>
            <span className="text-[10px] text-muted-foreground">deployes</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {/* Engaged */}
          <div className="text-center shrink-0">
            <div className="rounded-md bg-white/5 border border-border/20 px-2.5 py-1.5">
              <div className="text-sm font-bold text-foreground">{initialCount}</div>
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">Engages</div>
          </div>

          {/* Arrow with previous losses */}
          {previousLosses > 0 ? (
            <div className="flex flex-col items-center shrink-0">
              <div className="text-[9px] text-red-400/70">-{previousLosses}</div>
              <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="text-muted-foreground/30">
                <path d="M0 5h13M10 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : (
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="text-muted-foreground/30 shrink-0">
              <path d="M0 5h13M10 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}

          {/* Start of round */}
          <div className="text-center shrink-0">
            <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5">
              <div className="text-sm font-bold text-blue-400">{startOfRound}</div>
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">Debut R{selectedRound}</div>
          </div>

          {/* Arrow */}
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="text-muted-foreground/30 shrink-0">
            <path d="M0 5h13M10 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Losses this round */}
          <div className="text-center shrink-0">
            <div className={`rounded-md px-2.5 py-1.5 ${losses > 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/5 border border-border/20'}`}>
              <div className={`text-sm font-bold ${losses > 0 ? 'text-red-400' : 'text-muted-foreground/40'}`}>
                {losses > 0 ? `-${losses}` : '0'}
              </div>
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">Pertes</div>
          </div>

          {/* Arrow */}
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="text-muted-foreground/30 shrink-0">
            <path d="M0 5h13M10 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Surviving */}
          <div className="text-center shrink-0">
            <div className={`rounded-md px-2.5 py-1.5 ${survivingCount > 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <div className={`text-sm font-bold ${survivingCount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {survivingCount}
              </div>
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              {survivingCount > 0 ? 'Survivants' : 'Aneantis'}
            </div>
          </div>
        </div>
      )}

      {/* HP bars */}
      {hp && (
        <div className="grid grid-cols-2 gap-3">
          {/* Shield */}
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-cyan-400 font-semibold uppercase tracking-wider">
                Bouclier
              </span>
              <span className="text-muted-foreground font-mono">
                {fmt(hp.shieldRemaining)} / {fmt(hp.shieldMax)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-500/70 transition-all"
                style={{
                  width: `${hp.shieldMax > 0 ? (hp.shieldRemaining / hp.shieldMax) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          {/* Hull */}
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-orange-400 font-semibold uppercase tracking-wider">Coque</span>
              <span className="text-muted-foreground font-mono">
                {fmt(hp.hullRemaining)} / {fmt(hp.hullMax)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500/70 transition-all"
                style={{
                  width: `${hp.hullMax > 0 ? (hp.hullRemaining / hp.hullMax) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Damage panels (only for rounds > 0) */}
      {selectedRound > 0 && events.length > 0 && (
        <div className="space-y-2">
          {/* View toggle */}
          {detailedLog?.initialUnits && (
            <div className="flex items-center gap-1 text-[10px]">
              <button
                type="button"
                className={`px-2.5 py-1 rounded transition-colors ${damageView === 'summary' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setDamageView('summary')}
              >
                Resume
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded transition-colors ${damageView === 'shots' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setDamageView('shots')}
              >
                Tir par tir
              </button>
              {damageView === 'shots' && (
                <span className="text-muted-foreground/50 ml-1">
                  <span className="text-cyan-400/50">bouclier</span>{' / '}
                  <span className="text-orange-400/50">coque</span>
                </span>
              )}
            </div>
          )}

          {damageView === 'summary' && (
            <DamagePanel
              events={events}
              unitType={selectedUnitType}
              round={selectedRound}
              side={selectedSide}
              gameConfig={gameConfig}
            />
          )}

          {damageView === 'shots' && detailedLog?.initialUnits && (
            <ShotLog
              events={events}
              initialUnits={detailedLog.initialUnits}
              unitType={selectedUnitType}
              side={selectedSide}
              round={selectedRound}
              gameConfig={gameConfig}
            />
          )}
        </div>
      )}

      {/* Deaths list */}
      {selectedRound > 0 && (
        <DeathsList
          events={events}
          unitType={selectedUnitType}
          round={selectedRound}
          gameConfig={gameConfig}
        />
      )}

      {/* Unit grid (individual units) */}
      {sideSnapshots.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Unites individuelles
          </div>
          <UnitGrid
            snapshots={sideSnapshots}
            events={events}
            unitType={selectedUnitType}
            round={selectedRound}
            expandedUnitId={expandedUnitId}
            onExpandUnit={onExpandUnit}
            gameConfig={gameConfig}
          />
        </div>
      )}
    </div>
  );
}
