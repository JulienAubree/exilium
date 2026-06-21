// publish-feedback.mjs — pousse les recommandations de l'agent-designer dans la
// partie FEEDBACK in-game (table feedbacks), par le vrai chemin tRPC authentifié.
//
// On poste les recos CURÉES du designer (pas les frictions brutes, trop bruyantes),
// sous un compte « reporter » dédié et PERSISTANT (frictionbot-reporter@staging.local,
// sans « + » → épargné par le cleanup des comptes jetables frictionbot+...).
// Dédup par titre pour ne pas spammer à chaque run.
//
// STAGING-ONLY. Lancer : bash /opt/exilium/scripts/run-feedback.sh
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(__dirname, 'reports');
const API = process.env.E2E_STAGING_URL || 'http://localhost:3001';

const REPORTER = {
  email: 'frictionbot-reporter@staging.local',
  username: 'frictionbot_reporter',
  password: 'FrictionBotReporter1!',
};

if (/:3000|\/\/exilium-game\.com|\.exilium-game\.com/.test(API)) {
  throw new Error(`Refus : E2E_STAGING_URL (${API}) ressemble à la prod. Feedback bot = staging only.`);
}

// --- mini client tRPC (format httpBatchLink, sans superjson) ---
async function trpc(proc, input = {}, { token, method = 'POST' } = {}) {
  const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) };
  let res;
  if (method === 'GET') {
    const q = encodeURIComponent(JSON.stringify({ 0: input }));
    res = await fetch(`${API}/trpc/${proc}?batch=1&input=${q}`, { headers });
  } else {
    res = await fetch(`${API}/trpc/${proc}?batch=1`, { method: 'POST', headers, body: JSON.stringify({ 0: input }) });
  }
  if (!res.ok) throw new Error(`tRPC ${proc} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const entry = body[0];
  if (entry?.error) throw new Error(`tRPC ${proc} error: ${entry.error.message}`);
  return entry?.result?.data;
}

async function ensureReporterToken() {
  try {
    const r = await trpc('auth.login', { email: REPORTER.email, password: REPORTER.password });
    return r.accessToken;
  } catch {
    // Pas encore créé → on l'inscrit (register auto-login → renvoie les tokens).
    const r = await trpc('auth.register', {
      email: REPORTER.email,
      username: REPORTER.username,
      password: REPORTER.password,
    });
    console.log(`[feedback] compte reporter créé : ${REPORTER.email}`);
    return r.accessToken;
  }
}

function loadLatestReco() {
  const dir = join(REPORTS, '_designer');
  if (!existsSync(dir)) return null;
  const jsons = readdirSync(dir)
    .filter((f) => f.startsWith('reco-design-') && f.endsWith('.json'))
    .sort();
  if (!jsons.length) return null;
  return JSON.parse(readFileSync(join(dir, jsons[jsons.length - 1]), 'utf8'));
}

function mapType(rec) {
  const blob = `${(rec.rules || []).join(' ')} ${rec.recommendation} ${(rec.evidence || []).join(' ')}`.toLowerCase();
  if (rec.rules?.includes('R11') || rec.rules?.includes('R13') || /404|erreur|échec|bug|cassé|plante/.test(blob)) {
    return 'bug';
  }
  return 'idea';
}

function pickPagePath(rec) {
  const blob = `${rec.recommendation} ${(rec.evidence || []).join(' ')}`;
  const m = blob.match(/\/[a-zA-Z][\w-]*(?:\/[a-zA-Z:][\w-]*)*/);
  return m && m[0].length <= 500 ? m[0] : undefined;
}

function buildDescription(rec) {
  const lines = [
    '[Retour automatique — bot de test UX (persona « nouveau joueur »)]',
    '',
    `Thème : ${rec.theme || '—'} · Règles : ${(rec.rules || []).join(', ') || '—'} · Sévérité : ${rec.severity || '—'}`,
    `Impact : ${rec.impact || '—'} · Effort : ${rec.effort || '—'}${rec.priority ? ` · Priorité P${rec.priority}` : ''}`,
    '',
    `Recommandation : ${rec.recommendation || '—'}`,
  ];
  if (rec.evidence?.length) lines.push('', `Constats : ${rec.evidence.join(' ; ')}`);
  return lines.join('\n').slice(0, 2000);
}

async function main() {
  const reco = loadLatestReco();
  if (!reco || !(reco.recommendations || []).length) {
    console.error('[feedback] Aucune reco designer à publier (lance run-designer.sh d’abord).');
    process.exit(1);
  }
  // Le endpoint feedback.create est rate-limité (~5/h) : on poste les plus
  // prioritaires d'abord et on plafonne ; le reste passe aux runs suivants (dédup).
  const MAX_PUBLISH = Number(process.env.FEEDBACK_MAX || 5);
  const recs = (reco.recommendations || []).slice().sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  console.log(`[feedback] ${recs.length} reco(s) (plafond ${MAX_PUBLISH}/run) → ${API}`);

  const token = await ensureReporterToken();

  // Dédup : titres déjà présents (page récente).
  let existing = new Set();
  try {
    const page = await trpc('feedback.list', { sort: 'recent' }, { token, method: 'GET' });
    const items = Array.isArray(page) ? page : page?.items || page?.feedbacks || [];
    existing = new Set(items.map((i) => i.title));
  } catch (e) {
    console.warn(`[feedback] dédup indisponible (${e.message.slice(0, 60)}) — on poste quand même.`);
  }

  let posted = 0;
  let skipped = 0;
  for (const rec of recs) {
    if (posted >= MAX_PUBLISH) {
      console.log(`  ⏹  plafond ${MAX_PUBLISH} atteint — le reste passera au prochain run.`);
      break;
    }
    const title = `[bot] ${rec.title}`.slice(0, 200);
    if (existing.has(title)) {
      skipped++;
      console.log(`  ⏭  déjà présent : ${title}`);
      continue;
    }
    const input = { type: mapType(rec), title, description: buildDescription(rec) };
    const pagePath = pickPagePath(rec);
    if (pagePath) input.pagePath = pagePath;
    try {
      await trpc('feedback.create', input, { token });
      posted++;
      console.log(`  ✅ [${input.type}] ${title}`);
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      if (/HTTP 429/.test(e.message)) {
        console.warn('  ⏹  rate-limit du feedback atteint — on s’arrête (réessaie plus tard).');
        break;
      }
      console.error(`  ❌ ${title} — ${e.message.slice(0, 120)}`);
    }
  }

  console.log(`\n[feedback] ${posted} publié(s), ${skipped} ignoré(s) (déjà présents).`);
  console.log(`[feedback] auteur : ${REPORTER.email} · visible dans la page Feedback du staging.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
