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
règles de design ┐
persona (objectif)┴→ [perçoit la page] → DeepSeek décide 1 action → l'exécute → … → run.json
                                                                                       │
                          rubric (design-rules.md) + tous les run.json → AGENT-DESIGNER ┘
                                                                          → reco-design.md priorisé
```

Deux étages :

1. **Bots-personas** — jouent et remontent des frictions brutes (modèle éco, volume).
2. **Agent-designer** (`designer.mjs`) — synthétise toutes les sessions + le rubric
   `design-rules.md` en recommandations priorisées (impact × effort), façon design
   critique. Tourne une fois par lot, donc on lui met un modèle plus fort.

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

### Agent-designer

```bash
bash /opt/exilium/scripts/run-designer.sh
# modèle éco (rate les findings architecturaux des baselines) :
DESIGNER_MODEL=deepseek-chat bash /opt/exilium/scripts/run-designer.sh
```

Lit `design-rules.md` + tous les `reports/*/run.json` → `reports/_designer/reco-design-<date>.md`.
Ne touche ni la prod ni la base (lecture seule des rapports).

## Choix de modèle (mesuré)

- **Bots** (`FRICTION_BOT_MODEL`, def `deepseek-chat`) : éco suffit pour explorer.
- **Designer** (`DESIGNER_MODEL`, def `deepseek-reasoner`) : le modèle éco a **raté**
  la baseline R7 (planète hors URL) ; le reasoner l'attrape et la classe bloquant.
  La synthèse profonde justifie le modèle fort (1 appel par lot).

## Sortie

`reports/<persona>-<date>/` :

- `rapport.md` — frictions (sévérité, étape, note, capture), erreurs console, parcours complet.
- `run.json` — même chose, mangé par l'agent-designer.
- `step-NN.png` — captures de chaque étape.

`reports/_designer/` : `reco-design-<date>.md` + `.json` (le livrable pour le designer humain).

## Fichiers

| Fichier | Rôle |
|---|---|
| `friction-bot.mjs` | boucle d'agent-persona + rapport |
| `designer.mjs` | agent-designer : synthèse rubric + sessions → recos priorisées |
| `design-rules.md` | rubric des règles de design (R1…R13) + baselines mesurées |
| `personas.mjs` | définition des personas (1 pour l'instant) |
| `perceive.mjs` | extraction de l'arbre interactif d'une page |
| `llm.mjs` | client DeepSeek (compatible OpenAI), modèle pilotable par env |
| `serve.mjs` | mini-serveur statique du build staging + proxy `/trpc` |

## Suite

- **Instrumenter le rubric** : injecter `design-rules.md` dans le prompt des bots
  (findings tagués par règle) + auditeur déterministe (URL R6/R7, clics R4, profondeur R3).
- Personas : joueur mobile (PWA), min-maxer, revenant.
- Étage « crawlers déterministes ×N » (pur Playwright, sans LLM, à chaque deploy).
- Agrégation des `run.json` / recos → table `feedbacks` (taggé `bot`) ou dashboard admin.
- Bascule provider Claude pour les passes profondes.
