// Couche LLM — provider DeepSeek via son endpoint compatible OpenAI.
// Tout est pilotable par env pour basculer sur Claude plus tard (l'« interrupteur »
// du studio-podcast) sans toucher au code.
//
//   DEEPSEEK_API_KEY   (requis)
//   DEEPSEEK_BASE_URL  (def: https://api.deepseek.com)
//   FRICTION_BOT_MODEL (def: deepseek-chat)  — modèle des bots-personas
//
// Deux usages :
//   decide()   — une décision courte (action du bot), JSON strict.
//   chatJSON() — synthèse plus longue (agent-designer), modèle + budget réglables.

const BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
export const MODEL_NAME = process.env.FRICTION_BOT_MODEL || 'deepseek-chat';

async function postChat({ model, system, user, maxTokens }) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY manquant');

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const content = choice?.message?.content ?? '{}';
  const finish = choice?.finish_reason;

  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  let parsed = tryParse(content);
  if (parsed === undefined) {
    const m = content.match(/\{[\s\S]*\}/);
    parsed = m ? tryParse(m[0]) : undefined;
  }
  if (parsed === undefined) {
    const hint = finish === 'length' ? ' → réponse tronquée, augmente max_tokens' : '';
    throw new Error(`Réponse JSON invalide (finish_reason=${finish}${hint}). Début : ${content.slice(0, 120)}`);
  }
  return { parsed, usage: data?.usage ?? null };
}

/** Décision courte d'un bot-persona (1 action). */
export function decide({ system, user }) {
  return postChat({ model: MODEL_NAME, system, user, maxTokens: 800 });
}

/** Synthèse libre (agent-designer) — modèle et budget tokens réglables. */
export function chatJSON({ system, user, model = MODEL_NAME, maxTokens = 800 }) {
  return postChat({ model, system, user, maxTokens });
}
