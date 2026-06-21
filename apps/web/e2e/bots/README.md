# friction-bots — détection de friction UX par agent-persona

MVP d'une « armée de bots » qui jouent à Exilium et remontent les frictions UX,
en complément des e2e classiques (`e2e/staging/`) qui, eux, vérifient des
invariants connus. Ici on ne vérifie pas : on **découvre** ce qui perd un joueur.

## Principe

Un agent incarne un **persona** (MVP : « nouveau joueur »). À chaque tour il
« voit » la page via son arbre d'éléments interactifs (pas de pixels → économe),
le LLM choisit **une** action en raisonnant comme le persona, et signale toute
friction. Boucle jusqu'à objectif atteint / abandon / budget épuisé.

```
persona (objectif) → [perçoit la page] → DeepSeek décide 1 action → l'exécute → … → rapport
```

## Sécurité

- Tourne **uniquement sur le staging**. Le bot sert localement le build
  `/opt/exilium-staging/apps/web/dist` et proxifie `/trpc` → `:3001`. La prod
  n'est jamais touchée (garde-fou dans le runner).
- Le bot **crée un compte jetable** en base staging (`frictionbot+<ts>@staging.local`).
  À nettoyer périodiquement.

## Lancer

```bash
bash /opt/exilium/scripts/run-friction-bot.sh
# voir le navigateur :
FRICTION_BOT_HEADFUL=1 bash /opt/exilium/scripts/run-friction-bot.sh
# budget plus court :
FRICTION_BOT_MAX_STEPS=10 bash /opt/exilium/scripts/run-friction-bot.sh
```

Pré-requis : API staging up (`curl localhost:3001/trpc/health`), build web
staging présent, clé `DEEPSEEK_API_KEY` (auto-chargée depuis
`~/studio-podcast/.env.local`).

## Sortie

`reports/<persona>-<date>/` :

- `rapport.md` — frictions (sévérité, étape, note, capture), erreurs console, parcours complet.
- `run.json` — même chose, exploitable par une future agrégation (→ table `feedbacks`).
- `step-NN.png` — captures de chaque étape.

## Fichiers

| Fichier | Rôle |
|---|---|
| `friction-bot.mjs` | boucle d'agent + génération du rapport |
| `personas.mjs` | définition des personas (1 pour l'instant) |
| `perceive.mjs` | extraction de l'arbre interactif d'une page |
| `llm.mjs` | client DeepSeek (endpoint compatible OpenAI), modèle pilotable par env |
| `serve.mjs` | mini-serveur statique du build staging + proxy `/trpc` |

## Suite (post-MVP)

- Personas : joueur mobile (PWA), min-maxer, revenant.
- Étage « crawlers déterministes ×N » (pur Playwright, sans LLM, à chaque deploy).
- Agrégation des `run.json` → table `feedbacks` (taggé `bot`) ou dashboard admin.
- Bascule provider Claude pour les passes profondes (`FRICTION_BOT_MODEL`).
