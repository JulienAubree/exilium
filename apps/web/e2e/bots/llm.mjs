// Couche LLM — provider DeepSeek via son endpoint compatible OpenAI.
// Tout est pilotable par env pour pouvoir basculer sur Claude plus tard
// (l'« interrupteur » du studio-podcast) sans toucher au code du bot.
//
//   DEEPSEEK_API_KEY   (requis)
//   DEEPSEEK_BASE_URL  (def: https://api.deepseek.com)
//   FRICTION_BOT_MODEL (def: deepseek-chat)

const BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
export const MODEL_NAME = process.env.FRICTION_BOT_MODEL || 'deepseek-chat';

/**
 * Demande une décision au LLM. Renvoie l'objet JSON parsé + l'usage tokens.
 * @param {{ system: string, user: string }} param0
 * @returns {Promise<{ parsed: any, usage: { prompt_tokens?: number, completion_tokens?: number } | null }>}
 */
export async function decide({ system, user }) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY manquant');

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '{}';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : {};
  }
  return { parsed, usage: data?.usage ?? null };
}
