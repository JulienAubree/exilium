// audit.mjs — AUDITEUR DÉTERMINISTE (sans LLM, lecture seule du code source).
//
// Mesure les règles vérifiables par code (R6/R7 adressabilité URL, R3 profondeur)
// et émet des findings CONFIRMÉS que l'agent-designer ingère tels quels. Gratuit,
// rapide, reproductible — c'est le socle factuel sous la synthèse.
//
// Lancer : node /opt/exilium/apps/web/e2e/bots/audit.mjs
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.AUDIT_SRC || '/opt/exilium/apps/web/src';
const REPORTS = join(__dirname, 'reports');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}
const read = (p) => {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
};

function main() {
  if (!existsSync(SRC)) throw new Error(`Source introuvable : ${SRC}`);
  const files = walk(SRC);
  const rel = (p) => relative(SRC, p);
  const findings = [];
  const metrics = {};

  // R7 — état de vue persisté en localStorage dans un store (au lieu de l'URL).
  const storeFiles = files.filter((f) => /\/stores\//.test(f));
  for (const f of storeFiles) {
    const c = read(f);
    if (/localStorage/.test(c) && /(active|selected|current)/i.test(c)) {
      const m = c.match(/localStorage\.\w+\(\s*['"]([^'"]+)['"]/);
      findings.push({
        rule: 'R7',
        severity: 'bloquant',
        area: rel(f),
        detail: `État de vue persisté en localStorage${m ? ` (« ${m[1]} »)` : ''} au lieu de l'URL — la destination n'est ni partageable, ni adressable, et survit mal au refresh / bouton Retour.`,
        evidence: 'localStorage + état actif/sélectionné dans un store',
      });
    }
  }

  // Routes du routeur.
  const routerFile = files.find((f) => /router\.tsx$/.test(f));
  const routerSrc = routerFile ? read(routerFile) : '';
  const paths = [...routerSrc.matchAll(/path:\s*'([^']*)'/g)].map((m) => m[1]);
  metrics.routes = paths.length;
  metrics.paramRoutes = paths.filter((p) => p.includes(':')).length;
  metrics.hasPlanetParamRoute = paths.some((p) => /:planet/i.test(p));

  // R7 — multi-planètes sans :planetId dans l'URL.
  const hasPlanetStore = storeFiles.some((f) => /planet/i.test(f));
  if (hasPlanetStore && !metrics.hasPlanetParamRoute) {
    findings.push({
      rule: 'R7',
      severity: 'majeur',
      area: routerFile ? rel(routerFile) : 'router',
      detail: `Aucune route ne porte d'identifiant de planète (:planetId) alors que le jeu est multi-planètes — l'écran affiché dépend d'un état caché, pas de l'URL. Même URL pour la planète A et la planète B.`,
      evidence: `${paths.length} routes, 0 avec :planetId`,
    });
  }

  // R6 — adoption de l'état d'URL (useSearchParams) sur les pages.
  const pageFiles = files.filter((f) => /\/pages\//.test(f) && /\.tsx$/.test(f));
  const withSearch = pageFiles.filter((f) => /useSearchParams/.test(read(f)));
  metrics.pages = pageFiles.length;
  metrics.pagesWithUrlState = withSearch.length;

  // R6 — onglets/sous-vues pilotés par un état local (non adressables).
  const tabRe = /useState[^;\n]*\b(tab|view|section|active|selected|mode|step)\b/i;
  const localTabs = pageFiles.filter((f) => {
    const c = read(f);
    return tabRe.test(c) && !/useSearchParams/.test(c);
  });
  metrics.pagesWithLocalSubviews = localTabs.length;
  if (localTabs.length) {
    findings.push({
      rule: 'R6',
      severity: 'majeur',
      area: `${localTabs.length} page(s)`,
      detail: `Sous-vues/onglets pilotés par un état local (useState), non adressables par URL : refresh, partage et bouton Retour perdent le contexte. Adoption de l'état d'URL : ${withSearch.length}/${pageFiles.length} pages seulement.`,
      evidence: localTabs.slice(0, 12).map(rel).join(', '),
    });
  }

  // R3 — profondeur de nav (approx via l'imbrication des segments de route).
  metrics.maxRouteDepth = paths.reduce((d, p) => Math.max(d, p.split('/').filter(Boolean).length), 0);

  const out = { date: new Date().toISOString(), src: SRC, metrics, findings };
  mkdirSync(join(REPORTS, '_audit'), { recursive: true });
  const stamp = out.date.replace(/[:.]/g, '-').slice(0, 19);
  writeFileSync(join(REPORTS, '_audit', `audit-${stamp}.json`), JSON.stringify(out, null, 2));

  const L = [];
  L.push('# Audit déterministe — Exilium', '');
  L.push(`- Date : ${out.date}`);
  L.push(`- Source : \`${SRC}\``);
  L.push(`- Routes : ${metrics.routes} (dont ${metrics.paramRoutes} paramétrées) · route planète \`:planetId\` : ${metrics.hasPlanetParamRoute ? 'oui' : '**NON**'}`);
  L.push(`- Pages : ${metrics.pages} · avec état d'URL : ${metrics.pagesWithUrlState} · avec sous-vues locales : ${metrics.pagesWithLocalSubviews}`);
  L.push('');
  L.push(`## Findings confirmés (${findings.length})`, '');
  findings.forEach((f, i) => {
    L.push(`### ${i + 1}. \`[${f.rule}]\` ${f.severity} — ${f.area}`);
    L.push('', f.detail, '', `Indice : ${f.evidence}`, '');
  });
  writeFileSync(join(REPORTS, '_audit', `audit-${stamp}.md`), L.join('\n'));

  console.log(
    `[audit] ${findings.length} finding(s) · routes:${metrics.routes} pages:${metrics.pages} url-state:${metrics.pagesWithUrlState}/${metrics.pages} :planetId:${metrics.hasPlanetParamRoute}`,
  );
  findings.forEach((f) => console.log(`  [${f.rule}/${f.severity}] ${f.area} — ${f.detail.slice(0, 70)}…`));
  console.log(`[audit] → reports/_audit/audit-${stamp}.md`);
}

main();
