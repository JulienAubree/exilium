import type { RunResult } from './recorder.js';

export interface Finding {
  signature: string;
  title: string;
  description: string;
}

const SIGNIFICANT_WALL_H = 4;

function formatSimTime(atSec: number): string {
  const days = Math.floor(atSec / 86400);
  const hours = Math.floor((atSec % 86400) / 3600);
  if (days > 0) return `j${days}${hours > 0 ? ` ${hours}h` : ''}`;
  return `${hours}h`;
}

/**
 * Synthesizes significant walls from a simulation run into actionable findings.
 * Uses the OPTIMAL run (reliable lower bound); falls back to the last result.
 * Only walls >= 4h are considered significant.
 * Multiple walls for the same building are deduped, keeping the worst (highest waitH).
 * Returns findings sorted by worst waitH descending.
 */
export function synthesizeFindings(results: RunResult[]): Finding[] {
  const run = results.find((r) => r.policy === 'optimal') ?? results[results.length - 1];
  if (!run) return [];

  // Group by building, keep the worst wall per building
  const worstByBuilding = new Map<string, { waitH: number; atSec: number }>();
  for (const wall of run.walls) {
    if (wall.waitH < SIGNIFICANT_WALL_H) continue;
    const existing = worstByBuilding.get(wall.for);
    if (!existing || wall.waitH > existing.waitH) {
      worstByBuilding.set(wall.for, { waitH: wall.waitH, atSec: wall.atSec });
    }
  }

  const findings: Finding[] = [];
  for (const [building, { waitH, atSec }] of worstByBuilding) {
    const roundedH = Math.round(waitH);
    const signature = `wall:${building}`;
    const title = `[sim][rythme] Mur avant ${building} (~${roundedH}h d'attente optimale)`.slice(0, 200);
    const simTime = formatSimTime(atSec);
    const description = [
      `[Constat automatique — simulateur de rythme de progression]`,
      ``,
      `Le bâtiment "${building}" constitue un mur significatif dans la simulation optimale.`,
      `Attente détectée : ~${roundedH}h (pic à ${simTime} de jeu simulé).`,
      ``,
      `Dans un run optimal (aucune erreur de séquence, ressources optimisées),`,
      `le joueur doit attendre jusqu'à ${roundedH}h avant de pouvoir construire "${building}".`,
      `En rythme réel (moins optimal), l'attente sera probablement plus longue.`,
      ``,
      `Suggestion neutre : envisager d'aplatir la courbe de coût de "${building}"`,
      `ou d'avancer un prérequis afin de réduire ce point de friction.`,
    ].join('\n');

    findings.push({ signature, title, description });
  }

  // Sort descending by waitH
  findings.sort((a, b) => {
    const hA = worstByBuilding.get(a.signature.replace('wall:', ''))!.waitH;
    const hB = worstByBuilding.get(b.signature.replace('wall:', ''))!.waitH;
    return hB - hA;
  });

  return findings;
}
