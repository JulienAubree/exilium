import type { RunResult } from './recorder.js';

function fmt(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}

export function renderReport(results: RunResult[]): string {
  const L: string[] = ['# Rapport de rythme — Exilium', '', `- Date : ${new Date().toISOString()}`, `- Profils : ${results.map((r) => r.policy).join(', ')}`, ''];
  const ids = [...new Set(results.flatMap((r) => r.milestones.map((m) => m.id)))];
  L.push('## Temps jusqu\'au jalon', '', `| Jalon | ${results.map((r) => r.policy).join(' | ')} |`, `|---|${results.map(() => '---').join('|')}|`);
  for (const id of ids) {
    const cells = results.map((r) => { const m = r.milestones.find((x) => x.id === id); return m ? fmt(m.timeSec) : '—'; });
    L.push(`| ${id} | ${cells.join(' | ')} |`);
  }
  L.push('', '## Murs 🧱', '');
  for (const r of results) {
    if (!r.walls.length) { L.push(`- ${r.policy} : aucun mur > seuil`); continue; }
    for (const w of r.walls) L.push(`- ${r.policy} : attente ${w.waitH} h à ${fmt(w.atSec)} avant \`${w.for}\``);
  }
  return L.join('\n') + '\n';
}
