// publish.ts — publie les findings du simulateur de rythme dans la table feedback
// sous le compte DebugBot (admin, rate-limit exempt).
//
// Cible par défaut : prod (localhost:3000). Surcharge : FEEDBACK_API.
//
// Mode DRY-RUN par défaut : affiche les findings SANS rien poster.
// Pour publier : PUBLISH=1 bash scripts/run-gamesim-publish.sh
//
// Dédup : skip si un feedback [sim][rythme] pour le même bâtiment existe déjà.
import { readFileSync } from 'node:fs';
import { synthesizeFindings } from './findings.js';
import { runAll } from './run.js';

const API = process.env.FEEDBACK_API || 'http://localhost:3000';

// Sécurité : on n'écrit que sur une API locale.
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API)) {
  throw new Error(`Refus : FEEDBACK_API (${API}) doit être une API locale (localhost).`);
}

const BOT = {
  email: 'debug-bot@exilium-game.com',
  username: 'DebugBot',
};

function botPassword(): string {
  if (process.env.DEBUG_BOT_PASSWORD) return process.env.DEBUG_BOT_PASSWORD;
  try {
    return readFileSync('/opt/exilium/.debug-bot-password', 'utf8').trim();
  } catch {
    throw new Error(
      'Mot de passe Debug bot introuvable. Pose DEBUG_BOT_PASSWORD ou lance scripts/ensure-debug-bot.sh.',
    );
  }
}

// --- mini client tRPC (format httpBatchLink, sans superjson) ---
async function trpc(
  proc: string,
  input: unknown = {},
  { token, method = 'POST' }: { token?: string; method?: string } = {},
): Promise<unknown> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  let res: Response;
  if (method === 'GET') {
    const q = encodeURIComponent(JSON.stringify({ 0: input }));
    res = await fetch(`${API}/trpc/${proc}?batch=1&input=${q}`, { headers });
  } else {
    res = await fetch(`${API}/trpc/${proc}?batch=1`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 0: input }),
    });
  }
  if (!res.ok) throw new Error(`tRPC ${proc} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as Array<{ error?: { message: string }; result?: { data: unknown } }>;
  const entry = body[0];
  if (entry?.error) throw new Error(`tRPC ${proc} error: ${entry.error.message}`);
  return entry?.result?.data;
}

async function ensureBotToken(): Promise<string> {
  try {
    const r = (await trpc('auth.login', { email: BOT.email, password: botPassword() })) as {
      accessToken: string;
    };
    return r.accessToken;
  } catch (e) {
    throw new Error(
      `Connexion Debug bot impossible (${(e as Error).message.slice(0, 80)}). ` +
        `Crée le compte d'abord : bash scripts/ensure-debug-bot.sh <db>.`,
    );
  }
}

// Extracts the building name from a [sim][rythme] title for dedup purposes.
// Title format: "[sim][rythme] Mur avant <building> (~Xh …)"
function extractBuildingFromSimTitle(title: string): string | null {
  const m = String(title || '').match(/^\[sim\]\[rythme\] Mur avant ([^\s(]+)/);
  return m ? m[1] : null;
}

async function main(): Promise<void> {
  console.log('[sim-publish] Calcul des findings de rythme...');
  const results = runAll();
  const findings = synthesizeFindings(results);

  if (findings.length === 0) {
    console.log('[sim-publish] Aucun mur significatif (>= 4h) trouvé dans la simulation optimale.');
    return;
  }

  const isDryRun = process.env.PUBLISH !== '1';

  if (isDryRun) {
    console.log(`[sim-publish] MODE DRY-RUN (set PUBLISH=1 pour publier) — ${findings.length} finding(s) :`);
    console.log('');
    for (const f of findings) {
      console.log(`--- WOULD POST ---`);
      console.log(`type    : idea`);
      console.log(`title   : ${f.title}`);
      console.log(`description :\n${f.description}`);
      console.log('');
    }
    return;
  }

  // --- PUBLISH MODE ---
  console.log(`[sim-publish] ${findings.length} finding(s) → ${API}`);

  const token = await ensureBotToken();

  // Fetch existing feedbacks for dedup
  const existingBuildings = new Set<string>();
  try {
    const page = (await trpc('feedback.list', { sort: 'recent' }, { token, method: 'GET' })) as
      | Array<{ title: string }>
      | { items?: Array<{ title: string }>; feedbacks?: Array<{ title: string }> };
    const items: Array<{ title: string }> = Array.isArray(page)
      ? page
      : (page as { items?: Array<{ title: string }>; feedbacks?: Array<{ title: string }> }).items ??
        (page as { items?: Array<{ title: string }>; feedbacks?: Array<{ title: string }> }).feedbacks ??
        [];
    for (const it of items) {
      const building = extractBuildingFromSimTitle(it.title);
      if (building) existingBuildings.add(building);
    }
    console.log(`[sim-publish] ${existingBuildings.size} building(s) déjà couverts dans le feedback.`);
  } catch (e) {
    console.warn(
      `[sim-publish] dédup indisponible (${(e as Error).message.slice(0, 60)}) — on poste quand même.`,
    );
  }

  let posted = 0;
  let skipped = 0;
  for (const finding of findings) {
    const building = finding.signature.replace('wall:', '');
    if (existingBuildings.has(building)) {
      skipped++;
      console.log(`  ⏭  déjà présent (${building}) : ${finding.title}`);
      continue;
    }
    try {
      await trpc(
        'feedback.create',
        { type: 'idea', title: finding.title, description: finding.description },
        { token },
      );
      posted++;
      existingBuildings.add(building);
      console.log(`  ✅ [idea] ${finding.title}`);
      await new Promise<void>((r) => setTimeout(r, 400));
    } catch (e) {
      if (/HTTP 429/.test((e as Error).message)) {
        console.warn("  ⏹  rate-limit du feedback atteint — on s'arrete (reessaie plus tard).");
        break;
      }
      console.error(`  ❌ ${finding.title} — ${(e as Error).message.slice(0, 120)}`);
    }
  }

  console.log(`\n[sim-publish] ${posted} publié(s), ${skipped} ignoré(s) (déjà présents).`);
  console.log(
    `[sim-publish] auteur : ${BOT.username} (catégorie idea) · cible ${API} · visible dans la page Feedback.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
