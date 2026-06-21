// publish-feedback.mjs — pousse les recommandations de l'agent-designer dans la
// partie FEEDBACK in-game, par le vrai chemin tRPC authentifié, sous la catégorie
// « debug » et le compte superviseur « Debug bot ».
//
// Cible par défaut : la PROD (localhost:3000) — c'est là que Julien lit ses
// retours. Les bots, eux, JOUENT sur le staging ; seules les recos remontent ici.
// Surcharge : FEEDBACK_API (doit rester en localhost).
//
// Pré-requis : le compte Debug bot existe sur la cible (créé par
// scripts/ensure-debug-bot.sh). Le publieur ne fait que se connecter.
//
// Lancer : bash /opt/exilium/scripts/run-feedback.sh
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS = join(__dirname, 'reports');
const API = process.env.FEEDBACK_API || 'http://localhost:3000';

const BOT = {
  email: 'debug-bot@exilium-game.com',
  username: 'DebugBot',
};

// Mot de passe : env, sinon fichier gitignoré (créé par ensure-debug-bot.sh).
// Jamais hardcodé dans le source.
function botPassword() {
  if (process.env.DEBUG_BOT_PASSWORD) return process.env.DEBUG_BOT_PASSWORD;
  try {
    return readFileSync('/opt/exilium/.debug-bot-password', 'utf8').trim();
  } catch {
    throw new Error(
      'Mot de passe Debug bot introuvable. Pose DEBUG_BOT_PASSWORD ou lance scripts/ensure-debug-bot.sh.',
    );
  }
}

// Sécurité : on n'écrit que sur une API locale (prod ou staging de ce VPS),
// jamais une URL distante arbitraire.
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API)) {
  throw new Error(`Refus : FEEDBACK_API (${API}) doit être une API locale (localhost).`);
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

async function ensureBotToken() {
  try {
    const r = await trpc('auth.login', { email: BOT.email, password: botPassword() });
    return r.accessToken;
  } catch (e) {
    // Pas de register ici : sur la prod ça créerait une planète mère (empire
    // fantôme). Le compte doit être créé hors-ligne, admin, sans planète.
    throw new Error(
      `Connexion Debug bot impossible (${e.message.slice(0, 80)}). ` +
        `Crée le compte d'abord : bash scripts/ensure-debug-bot.sh <db>.`,
    );
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

// Signature stable d'une reco = ses règles triées (le titre libre, lui, est
// reformulé par le LLM à chaque run → inutilisable pour dédupliquer).
function ruleKey(rec) {
  return (rec.rules || []).slice().sort().join('+') || 'Rx';
}
function botTitle(rec) {
  return `[bot][${ruleKey(rec)}] ${rec.title}`.slice(0, 200);
}
function titleSig(title) {
  const m = String(title || '').match(/^\[bot\]\[([^\]]*)\]/);
  return m ? m[1] : null;
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

  const token = await ensureBotToken();

  // Dédup par SIGNATURE de règles ([bot][R6+R7] …) — stable d'un run à l'autre.
  const existingSigs = new Set();
  try {
    const page = await trpc('feedback.list', { sort: 'recent' }, { token, method: 'GET' });
    const items = Array.isArray(page) ? page : page?.items || page?.feedbacks || [];
    for (const it of items) {
      const s = titleSig(it.title);
      if (s) existingSigs.add(s);
    }
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
    const sig = ruleKey(rec);
    const title = botTitle(rec);
    if (existingSigs.has(sig)) {
      skipped++;
      console.log(`  ⏭  déjà présent (${sig}) : ${title}`);
      continue;
    }
    const input = { type: 'debug', title, description: buildDescription(rec) };
    const pagePath = pickPagePath(rec);
    if (pagePath) input.pagePath = pagePath;
    try {
      await trpc('feedback.create', input, { token });
      posted++;
      existingSigs.add(sig);
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
  console.log(`[feedback] auteur : ${BOT.username} (catégorie debug) · cible ${API} · visible dans la page Feedback.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
