// a11y-audit.mjs — AUDITEUR D'ACCESSIBILITÉ déterministe (axe-core, WCAG 2.1 AA).
//
// Se connecte au staging, parcourt les pages clés, lance axe-core sur chacune et
// agrège les violations en findings taguées R13 — que l'agent-designer ingère au
// même titre que l'audit de code. Bien plus fiable qu'un persona LLM pour R13.
//
// Lancer : bash /opt/exilium/scripts/run-a11y.sh
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { startStagingServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const AXE_PATH = require.resolve('axe-core/axe.min.js');

const REPORTS = join(__dirname, 'reports');
const STAGING_DIST = process.env.FRICTION_BOT_DIST || '/opt/exilium-staging/apps/web/dist';
const API_TARGET = process.env.E2E_STAGING_URL || 'http://localhost:3001';
const EMAIL = process.env.LOGIN_EMAIL || '';
const PASSWORD = process.env.LOGIN_PASSWORD || '';

// Pages clés à auditer (in-game = nécessitent le login).
const PAGES = [
  '/',
  '/infrastructures',
  '/research',
  '/shipyard',
  '/fleet',
  '/galaxy',
  '/market',
  '/alliance',
  '/ranking',
  '/messages',
  '/feedback',
];

const SEVERITY = { critical: 'bloquant', serious: 'majeur', moderate: 'mineur', minor: 'mineur' };

async function login(page, srvUrl) {
  await page.goto(srvUrl + '/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !/\/login/.test(new URL(u).pathname), { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
}

async function runAxe(page) {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const res = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      resultTypes: ['violations'],
    });
    return res.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.target?.join(' ') ?? '',
    }));
  });
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error('LOGIN_EMAIL / LOGIN_PASSWORD requis (cf. run-a11y.sh).');

  const srv = await startStagingServer({ distDir: STAGING_DIST, apiTarget: API_TARGET });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR', serviceWorkers: 'block' });
  const page = await context.newPage();

  console.log(`[a11y] login ${EMAIL} sur ${srv.url}…`);
  await login(page, srv.url);
  const authed = !/\/login/.test(new URL(page.url()).pathname);
  console.log(`[a11y] ${authed ? 'connecté' : '⚠ non connecté — audit limité aux pages publiques'}`);

  // ruleId -> { impact, help, pages:Set, nodes, sample }
  const agg = new Map();
  const audited = [];
  for (const path of PAGES) {
    try {
      await page.goto(srv.url + path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
      const viols = await runAxe(page);
      audited.push(path);
      for (const v of viols) {
        const e = agg.get(v.id) ?? { impact: v.impact, help: v.help, pages: new Set(), nodes: 0, sample: v.sample };
        e.pages.add(path);
        e.nodes += v.nodes;
        if (!e.sample) e.sample = v.sample;
        agg.set(v.id, e);
      }
      console.log(`  ${path} — ${viols.length} règle(s) en violation`);
    } catch (err) {
      console.warn(`  ${path} — échec : ${String(err.message || err).slice(0, 80)}`);
    }
  }

  const order = { bloquant: 0, majeur: 1, mineur: 2 };
  const findings = [...agg.entries()]
    .map(([id, e]) => ({
      rule: 'R13',
      severity: SEVERITY[e.impact] || 'mineur',
      area: `a11y: ${id}`,
      detail: `${e.help} (${e.impact}) — ${e.nodes} élément(s) sur ${e.pages.size} page(s).`,
      evidence: `pages: ${[...e.pages].join(', ')}${e.sample ? ` · ex: ${e.sample.slice(0, 80)}` : ''}`,
    }))
    .sort((a, b) => order[a.severity] - order[b.severity]);

  const byImpact = {};
  for (const e of agg.values()) byImpact[e.impact] = (byImpact[e.impact] || 0) + 1;

  const out = {
    date: new Date().toISOString(),
    tool: 'axe-core WCAG 2.1 AA',
    target: API_TARGET,
    pagesAudited: audited,
    metrics: { pages: audited.length, distinctViolations: findings.length, byImpact },
    findings,
  };

  mkdirSync(join(REPORTS, '_a11y'), { recursive: true });
  const stamp = out.date.replace(/[:.]/g, '-').slice(0, 19);
  writeFileSync(join(REPORTS, '_a11y', `a11y-${stamp}.json`), JSON.stringify(out, null, 2));

  const L = ['# Audit accessibilité — Exilium', '', `- Date : ${out.date}`, `- Outil : ${out.tool}`, `- Pages auditées : ${audited.length}`, `- Violations distinctes : ${findings.length}`, ''];
  L.push(`## Findings R13 (${findings.length})`, '');
  findings.forEach((f, i) => {
    L.push(`### ${i + 1}. \`${f.area}\` — ${f.severity}`);
    L.push('', f.detail, '', `Indice : ${f.evidence}`, '');
  });
  writeFileSync(join(REPORTS, '_a11y', `a11y-${stamp}.md`), L.join('\n'));

  await browser.close();
  await srv.close();

  console.log(`\n[a11y] ${findings.length} violation(s) distincte(s) · ${JSON.stringify(byImpact)}`);
  console.log(`[a11y] → reports/_a11y/a11y-${stamp}.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
