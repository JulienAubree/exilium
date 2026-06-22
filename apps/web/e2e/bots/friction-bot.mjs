// friction-bot — un agent-persona qui JOUE à Exilium (staging) via un navigateur
// et raconte ses frictions UX. MVP : 1 persona "nouveau joueur", provider DeepSeek.
//
// Boucle : perçoit la page → demande UNE action au LLM (incarnant le persona) →
// l'exécute → recommence, jusqu'à "done"/"give_up" ou épuisement du budget.
// Sortie : reports/<persona>-<date>/rapport.md + run.json + captures.
//
// Lancer : bash /opt/exilium/scripts/run-friction-bot.sh
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStagingServer } from './serve.mjs';
import { perceive } from './perceive.mjs';
import { decide, MODEL_NAME } from './llm.mjs';
import { personas } from './personas.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PERSONA_ID = process.env.FRICTION_BOT_PERSONA || 'nouveau-joueur';
const MAX_STEPS = Number(process.env.FRICTION_BOT_MAX_STEPS || 15);
const STAGING_DIST = process.env.FRICTION_BOT_DIST || '/opt/exilium-staging/apps/web/dist';
const API_TARGET = process.env.E2E_STAGING_URL || 'http://localhost:3001';
const HEADLESS = !process.env.FRICTION_BOT_HEADFUL;

// Digest des règles de design (R1…R13) extrait du rubric, injecté dans le prompt
// pour que le bot RATTACHE chaque friction à une ou plusieurs règles.
const RULES_DIGEST = (() => {
  try {
    const txt = readFileSync(join(__dirname, 'design-rules.md'), 'utf8');
    return [...txt.matchAll(/\*\*(R\d+)\s+—\s+([^*]+?)\*\*/g)].map((m) => `${m[1]} — ${m[2].trim()}`).join('\n');
  } catch {
    return '';
  }
})();

const SYSTEM_PROMPT = `Tu es un testeur UX qui incarne un persona en jouant à un jeu web, dans un navigateur piloté.
À chaque tour tu reçois l'état de la page (url, titre, intitulés, liste d'éléments interactifs avec leur "ref", texte visible) et l'historique de tes actions.
Tu choisis UNE seule action pour progresser vers ton objectif, en raisonnant comme le persona — pas comme un dev.
Si quelque chose te ralentit, te perd, te surprend ou est ambigu, signale-le dans "friction" (du point de vue du persona) ET rattache-le à au moins une RÈGLE DE DESIGN (Rn) listée plus bas.

Réponds STRICTEMENT en JSON valide, sans texte autour :
{
  "thought": "ce que tu comprends / décides, 1 phrase",
  "friction": null OU { "severity": "bloquant" | "majeur" | "mineur", "rules": ["R4"], "note": "ce qui cloche, concrètement" },
  "action": { "type": "click" | "type" | "goto" | "done" | "give_up", "ref": <number si click/type>, "text": "<si type>", "url": "<chemin relatif si goto>" }
}

Règles d'action :
- "click": donne le "ref" d'un élément présent dans la liste interactables.
- "type": donne le "ref" d'un champ + le "text" à saisir.
- "goto": "url" relative (ex: "/overview"). À n'utiliser qu'en dernier recours, un vrai joueur clique.
- "done": l'objectif est RÉELLEMENT atteint et le confirme à l'écran — ne déclare jamais "done" juste après avoir soumis un formulaire ou cliqué un bouton, attends d'OBSERVER le résultat au tour suivant. "give_up": tu es bloqué et ne vois plus quoi tenter.
- N'invente JAMAIS un "ref" absent de la liste. Une seule action par tour.

RÈGLES DE DESIGN (le champ "friction.rules" doit citer ≥1 de ces identifiants) :
${RULES_DIGEST}`;

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// L'objectif (1re action de jeu) n'est pas atteignable sur une page d'auth :
// on refuse un "done" tant qu'on n'a pas quitté l'inscription/connexion.
function isAuthRoute(url = '') {
  return /^\/(register|login|forgot-password|reset-password|verify-email)\b/.test(url);
}

function buildUserPrompt({ persona, creds, step, max, snapshot, history, consoleErrors }) {
  const recent =
    history
      .slice(-5)
      .map((h) => `#${h.step} [${h.url}] ${h.action?.type ?? '?'} ${h.action?.ref ?? ''} → ${h.result}`)
      .join('\n') || '(aucune)';
  const errs = consoleErrors.length ? consoleErrors.map((e) => '- ' + e.text).join('\n') : '(aucune)';
  return [
    `PERSONA : ${persona.label}`,
    `OBJECTIF :\n${persona.goal}`,
    creds.mode === 'login'
      ? `IDENTIFIANTS de connexion : email=${creds.email} | mot de passe=${creds.password}`
      : `IDENTIFIANTS à utiliser pour l'inscription : email=${creds.email} | pseudo=${creds.username} | mot de passe=${creds.password}`,
    `ÉTAPE ${step}/${max}`,
    `ÉTAT DE LA PAGE (JSON) :\n${JSON.stringify(snapshot)}`,
    `ERREURS CONSOLE RÉCENTES :\n${errs}`,
    `TES DERNIÈRES ACTIONS :\n${recent}`,
    `Donne ta prochaine action en JSON.`,
  ].join('\n\n');
}

function mdEscape(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 160);
}

function writeReport({ outDir, persona, creds, history, frictions, consoleErrors, usage, outcome, srvUrl, api }) {
  const L = [];
  L.push(`# Rapport de friction — ${persona.label}`, '');
  L.push(`- Date : ${new Date().toISOString()}`);
  L.push(`- Persona : ${persona.label} (\`${persona.id}\`)`);
  L.push(`- Front local : ${srvUrl}  →  API ${api} (staging)`);
  L.push(`- Issue : **${outcome}**`);
  L.push(`- Étapes jouées : ${history.length} / max`);
  L.push(`- Modèle : \`${MODEL_NAME}\``);
  L.push(`- Tokens (approx) : prompt ${usage.prompt_tokens} · completion ${usage.completion_tokens}`);
  L.push(`- Compte de test créé en base staging : \`${creds.email}\` — **à nettoyer**`);
  L.push('');

  L.push(`## Frictions détectées (${frictions.length})`, '');
  if (frictions.length === 0) {
    L.push('Aucune friction signalée par le persona sur ce parcours.', '');
  } else {
    frictions.forEach((f, i) => {
      const rules = (f.rules || []).join(', ') || '—';
      L.push(`### ${i + 1}. \`[${rules}]\` ${f.severity} — étape ${f.step} — \`${f.url}\``);
      L.push('', f.note, '', `Capture : \`${f.shot}\``, '');
    });
  }

  L.push(`## Erreurs console (${consoleErrors.length})`, '');
  if (consoleErrors.length === 0) L.push('(aucune)', '');
  else {
    consoleErrors.slice(0, 30).forEach((e) => L.push(`- ${mdEscape(e.text)}`));
    L.push('');
  }

  L.push('## Parcours complet', '');
  L.push('| Étape | URL | Action | Résultat | Pensée |');
  L.push('|---|---|---|---|---|');
  history.forEach((h) => {
    const act = `${h.action?.type ?? '?'} ${h.action?.ref ?? ''} ${h.action?.text ? '"' + mdEscape(h.action.text) + '"' : ''}`.trim();
    L.push(`| ${h.step} | \`${mdEscape(h.url)}\` | ${mdEscape(act)} | ${mdEscape(h.result)} | ${mdEscape(h.thought)} |`);
  });
  L.push('');

  writeFileSync(join(outDir, 'rapport.md'), L.join('\n'));
}

async function main() {
  const persona = personas[PERSONA_ID];
  if (!persona) {
    throw new Error(`Persona inconnu: ${PERSONA_ID}. Dispo: ${Object.keys(personas).join(', ')}`);
  }

  const runId = `${persona.id}-${ts()}`;
  const outDir = join(__dirname, 'reports', runId);
  mkdirSync(outDir, { recursive: true });

  const stamp = Date.now();
  const isLogin = persona.auth === 'login';
  const creds = isLogin
    ? { mode: 'login', email: process.env.LOGIN_EMAIL || '', password: process.env.LOGIN_PASSWORD || '' }
    : {
        mode: 'register',
        email: `frictionbot+${stamp}@staging.local`,
        username: `fbot_${String(stamp).slice(-10)}`,
        password: 'FrictionBot1234!',
      };
  if (isLogin && (!creds.email || !creds.password)) {
    throw new Error('Persona en mode login : LOGIN_EMAIL et LOGIN_PASSWORD requis (cf. run-friction-bot.sh).');
  }

  console.log(`[friction-bot] persona=${persona.id} modèle=${MODEL_NAME} étapes≤${MAX_STEPS}`);
  console.log(`[friction-bot] compte de test : ${creds.email}`);

  const srv = await startStagingServer({ distDir: STAGING_DIST, apiTarget: API_TARGET });
  console.log(`[friction-bot] front staging servi sur ${srv.url} (proxy /trpc → ${API_TARGET})`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: persona.viewport,
    locale: 'fr-FR',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push({ text: m.text().slice(0, 200) });
  });
  page.on('pageerror', (e) => consoleErrors.push({ text: 'pageerror: ' + String(e).slice(0, 200) }));

  const history = [];
  const frictions = [];
  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  let outcome = 'budget épuisé';

  await page.goto(srv.url + (persona.start || '/'), { waitUntil: 'domcontentloaded' }).catch(() => {});

  for (let step = 1; step <= MAX_STEPS; step++) {
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    const snapshot = await perceive(page).catch((e) => ({
      url: page.url(),
      title: '',
      headings: [],
      interactables: [],
      text: 'ERREUR perception: ' + String(e),
    }));
    const shot = `step-${String(step).padStart(2, '0')}.png`;
    await page.screenshot({ path: join(outDir, shot) }).catch(() => {});

    const user = buildUserPrompt({
      persona,
      creds,
      step,
      max: MAX_STEPS,
      snapshot,
      history,
      consoleErrors: consoleErrors.slice(-3),
    });

    let resp;
    try {
      resp = await decide({ system: SYSTEM_PROMPT, user });
    } catch (e) {
      console.error('[friction-bot] erreur LLM :', e.message);
      outcome = 'erreur LLM : ' + e.message;
      break;
    }
    if (resp.usage) {
      usage.prompt_tokens += resp.usage.prompt_tokens || 0;
      usage.completion_tokens += resp.usage.completion_tokens || 0;
    }

    const { thought = '', friction = null, action = {} } = resp.parsed || {};
    if (friction && friction.note) {
      frictions.push({
        step,
        url: snapshot.url,
        severity: friction.severity || 'mineur',
        rules: Array.isArray(friction.rules) ? friction.rules : [],
        note: friction.note,
        shot,
      });
    }
    console.log(`[${step}] ${action.type ?? '?'} ${action.ref ?? ''} — ${String(thought).slice(0, 120)}`);

    const entry = { step, url: snapshot.url, thought, action, shot, result: 'ok' };
    try {
      if (action.type === 'click') {
        const target = page.locator(`[data-bot-ref="${action.ref}"]`).first();
        // Un timeout de clic sur un contrôle (correctement) désactivé — ex. le
        // bouton « Construire » quand les ressources manquent — est un artefact
        // du bot, pas une friction UX. On l'ignore au lieu de polluer R11.
        if (await target.isDisabled().catch(() => false)) {
          entry.result = 'élément désactivé — clic ignoré (pas une friction)';
        } else {
          await target.click({ timeout: 5000 });
        }
      } else if (action.type === 'type') {
        await page.locator(`[data-bot-ref="${action.ref}"]`).first().fill(String(action.text ?? ''), { timeout: 5000 });
      } else if (action.type === 'goto') {
        await page.goto(srv.url + (action.url || '/'), { waitUntil: 'domcontentloaded' });
      } else if (action.type === 'done') {
        if (isAuthRoute(snapshot.url)) {
          // Conclusion prématurée : on est encore sur l'inscription/connexion.
          // On force l'entrée dans le jeu et on poursuit la session.
          entry.result = "done refusé (encore sur une page d'auth) — entrée dans le jeu forcée";
          await page.goto(srv.url + '/', { waitUntil: 'domcontentloaded' }).catch(() => {});
        } else {
          entry.result = 'objectif atteint';
          history.push(entry);
          outcome = 'objectif atteint';
          break;
        }
      } else if (action.type === 'give_up') {
        entry.result = 'abandon';
        history.push(entry);
        outcome = 'abandon du persona';
        break;
      } else {
        entry.result = `action inconnue (${action.type})`;
      }
    } catch (e) {
      entry.result = 'échec : ' + String(e.message || e).slice(0, 120);
      frictions.push({
        step,
        url: snapshot.url,
        severity: 'majeur',
        rules: ['R11'],
        note: `Action "${action.type}" sur l'élément ${action.ref} a échoué (${entry.result}). Intention du persona : "${thought}".`,
        shot,
      });
    }
    history.push(entry);
  }

  writeReport({ outDir, persona, creds, history, frictions, consoleErrors, usage, outcome, srvUrl: srv.url, api: API_TARGET });
  writeFileSync(
    join(outDir, 'run.json'),
    JSON.stringify({ persona: persona.id, account: creds.email, outcome, frictions, history, consoleErrors, usage }, null, 2),
  );

  await browser.close();
  await srv.close();

  console.log(`\n[friction-bot] terminé — ${outcome}`);
  console.log(`[friction-bot] ${frictions.length} friction(s), ${history.length} étape(s), ${consoleErrors.length} erreur(s) console`);
  console.log(`[friction-bot] tokens ~ prompt:${usage.prompt_tokens} completion:${usage.completion_tokens}`);
  console.log(`[friction-bot] rapport : ${join(outDir, 'rapport.md')}`);
  if (creds.mode === 'register') {
    console.log(`[friction-bot] ⚠ compte de test créé en base STAGING : ${creds.email} (à nettoyer)`);
  } else {
    console.log(`[friction-bot] (login sur compte existant : ${creds.email})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
