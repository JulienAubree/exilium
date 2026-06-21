// designer.mjs — l'AGENT-DESIGNER : étape de synthèse.
//
// Il lit le rubric (design-rules.md) + tous les findings bruts des sessions de
// bots (reports/*/run.json) et produit des RECOMMANDATIONS DE DESIGN priorisées
// (impact × effort), façon design-critique + research-synthesis. C'est le
// livrable pour le designer humain — ou à sa place.
//
// Lancer : bash /opt/exilium/scripts/run-designer.sh
// Modèle  : DESIGNER_MODEL (def: deepseek-reasoner — la synthèse profonde vaut le
//           coût ; le designer ne tourne qu'une fois par lot. Le modèle éco rate
//           les findings architecturaux des baselines. Basculer Claude possible).
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatJSON } from './llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(__dirname, 'reports');
const RUBRIC_PATH = join(__dirname, 'design-rules.md');
const DESIGNER_MODEL = process.env.DESIGNER_MODEL || 'deepseek-reasoner';

const SYSTEM_PROMPT = `Tu es un designer produit / UX senior. On te confie une revue de design.

Tu reçois :
1) un RUBRIC de règles de design numérotées (R1…R13) — certaines sections marquées ⚠
   contiennent des BASELINES déjà mesurées dans le code : traite-les comme des
   findings CONFIRMÉS, pas des hypothèses ;
2) des FINDINGS bruts issus de sessions où des bots-personas ont réellement joué au
   jeu (frictions ressenties, erreurs console, parcours et nombre de clics).

Ta mission : produire des RECOMMANDATIONS DE DESIGN, façon design critique + synthèse
de recherche. Pas un simple résumé : regroupe, hiérarchise, propose.

Règles de production :
- Regroupe les findings par THÈME (ex: structure de l'information, navigation & URL,
  économie de clics, clarté & langage, feedback, accessibilité).
- Rattache chaque reco aux RÈGLES concernées (ex: ["R7","R6"]).
- Évalue "impact" (élevé|moyen|faible) et "effort" (faible|moyen|élevé), puis déduis
  une "priority" entière (1 = à faire en premier ; fort impact + faible effort d'abord).
- "recommendation" doit être CONCRÈTE et actionnable côté produit (quoi changer),
  jamais une généralité ("améliorer l'UX" est interdit).
- "evidence" : cite la friction / l'erreur / le parcours qui justifie la reco.
- N'invente pas de findings hors de ce qu'on te donne (rubric + sessions).

Réponds STRICTEMENT en JSON valide :
{
  "summary": "2-4 phrases : l'état général du design et les axes majeurs",
  "recommendations": [
    {
      "title": "titre court et parlant",
      "theme": "le thème",
      "rules": ["R7"],
      "severity": "bloquant|majeur|mineur",
      "impact": "élevé|moyen|faible",
      "effort": "faible|moyen|élevé",
      "priority": 1,
      "evidence": ["preuve 1", "preuve 2"],
      "recommendation": "la proposition concrète"
    }
  ]
}`;

function loadRuns() {
  if (!existsSync(REPORTS)) return [];
  const dirs = readdirSync(REPORTS).filter((d) => {
    if (d.startsWith('_')) return false;
    const p = join(REPORTS, d);
    return statSync(p).isDirectory() && existsSync(join(p, 'run.json'));
  });
  const runs = [];
  for (const d of dirs) {
    try {
      const run = JSON.parse(readFileSync(join(REPORTS, d, 'run.json'), 'utf8'));
      const history = run.history || [];
      runs.push({
        session: d,
        persona: run.persona,
        outcome: run.outcome,
        steps: history.length,
        clicks: history.filter((h) => h.action?.type === 'click').length,
        pagesVisited: [...new Set(history.map((h) => h.url))],
        frictions: (run.frictions || []).map((f) => ({ severity: f.severity, url: f.url, note: f.note })),
        consoleErrors: [...new Set((run.consoleErrors || []).map((e) => e.text))],
      });
    } catch (e) {
      console.warn(`[designer] run.json illisible (${d}): ${e.message}`);
    }
  }
  return runs;
}

function severityRank(s) {
  return { bloquant: 0, majeur: 1, mineur: 2 }[s] ?? 3;
}

function renderMarkdown({ result, runs, usage }) {
  const recs = (result.recommendations || []).slice().sort((a, b) => {
    return (a.priority ?? 99) - (b.priority ?? 99) || severityRank(a.severity) - severityRank(b.severity);
  });

  const totalFrictions = runs.reduce((n, r) => n + r.frictions.length, 0);
  const L = [];
  L.push('# Recommandations de design — Exilium', '');
  L.push(`- Date : ${new Date().toISOString()}`);
  L.push(`- Agent-designer (modèle) : \`${DESIGNER_MODEL}\``);
  L.push(`- Sessions de bots analysées : ${runs.length} (${totalFrictions} friction(s) brute(s))`);
  L.push(`- Recommandations : ${recs.length}`);
  L.push(`- Tokens : prompt ${usage?.prompt_tokens ?? '?'} · completion ${usage?.completion_tokens ?? '?'}`);
  L.push('');

  L.push('## Synthèse', '', result.summary || '(vide)', '');

  L.push('## Recommandations (priorisées)', '');
  if (recs.length === 0) L.push('(aucune)', '');
  recs.forEach((r) => {
    const rules = (r.rules || []).join(', ');
    L.push(`### P${r.priority ?? '?'} · ${r.title}${rules ? `  \`[${rules}]\`` : ''}`);
    L.push('');
    L.push(`- Thème : ${r.theme || '—'} · Sévérité : ${r.severity || '—'}`);
    L.push(`- Impact : ${r.impact || '—'} · Effort : ${r.effort || '—'}`);
    if (r.evidence?.length) L.push(`- Preuves : ${r.evidence.map((e) => `« ${e} »`).join(' ; ')}`);
    L.push('', `**Reco :** ${r.recommendation || '—'}`, '');
  });

  L.push('---', '');
  L.push('## Matière première (sessions)', '');
  runs.forEach((r) => {
    L.push(`- \`${r.session}\` — persona ${r.persona}, ${r.steps} étapes / ${r.clicks} clics, ${r.frictions.length} friction(s) ; pages : ${r.pagesVisited.join(', ')}`);
  });
  L.push('');

  return L.join('\n');
}

async function main() {
  if (!existsSync(RUBRIC_PATH)) throw new Error(`Rubric introuvable : ${RUBRIC_PATH}`);
  const rubric = readFileSync(RUBRIC_PATH, 'utf8');

  const runs = loadRuns();
  console.log(`[designer] modèle=${DESIGNER_MODEL} · ${runs.length} session(s) chargée(s)`);
  if (runs.length === 0) {
    console.warn('[designer] Aucune session de bot trouvée — la synthèse ne reposera que sur les baselines du rubric.');
  }

  const user = [
    `=== RUBRIC (règles de design) ===\n${rubric}`,
    `=== FINDINGS BRUTS (sessions de bots) ===\n${JSON.stringify(runs, null, 2).slice(0, 12000)}`,
    `Produis les recommandations de design en JSON selon le format demandé.`,
  ].join('\n\n');

  const { parsed, usage } = await chatJSON({
    system: SYSTEM_PROMPT,
    user,
    model: DESIGNER_MODEL,
    maxTokens: 3500,
  });

  const outDir = join(REPORTS, '_designer');
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const md = renderMarkdown({ result: parsed, runs, usage });
  const mdPath = join(outDir, `reco-design-${stamp}.md`);
  writeFileSync(mdPath, md);
  writeFileSync(join(outDir, `reco-design-${stamp}.json`), JSON.stringify(parsed, null, 2));

  const recs = parsed.recommendations || [];
  console.log(`\n[designer] ${recs.length} recommandation(s) générée(s)`);
  console.log(`[designer] tokens ~ prompt:${usage?.prompt_tokens ?? '?'} completion:${usage?.completion_tokens ?? '?'}`);
  console.log(`[designer] livrable : ${mdPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
