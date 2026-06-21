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
audit déterministe ┐
règles de design   ┤
persona (objectif) ┴→ bot joue → run.json ┐
                                           ├→ AGENT-DESIGNER → reco-design.md ┐
                       audit + rubric ─────┘                                  │
                                            PUBLICATION → partie feedback in-game (table feedbacks) ┘
```

Quatre étages :

1. **Audit déterministe** (`audit.mjs`) — sans LLM, mesure les règles vérifiables par code (R6/R7/R3).
2. **Bots-personas** (`friction-bot.mjs`) — jouent, frictions **taguées par règle** (modèle éco, volume).
3. **Agent-designer** (`designer.mjs`) — synthétise audit + sessions + rubric en recos priorisées.
4. **Publication** (`publish-feedback.mjs`) — poste les recos dans la partie feedback in-game.

## Sécurité

- Tourne **uniquement sur le staging**. Le bot sert localement le build
  `/opt/exilium-staging/apps/web/dist` et proxifie `/trpc` → `:3001`. La prod
  n'est jamais touchée (garde-fou dans le runner).
- Le bot **crée un compte jetable** en base staging (`frictionbot+<ts>@staging.local`).
  À nettoyer périodiquement.

## Lancer

### Pipeline complet (une commande)

```bash
bash /opt/exilium/scripts/run-pipeline.sh
# en regardant le navigateur, budget plus large :
FRICTION_BOT_HEADFUL=1 FRICTION_BOT_MAX_STEPS=18 bash /opt/exilium/scripts/run-pipeline.sh
```

Enchaîne : **audit déterministe → session bot → agent-designer** → `reco-design.md`.

### Étage par étage

```bash
node /opt/exilium/apps/web/e2e/bots/audit.mjs   # 1. audit déterministe (sans LLM)
bash /opt/exilium/scripts/run-friction-bot.sh   # 2. session bot-persona
bash /opt/exilium/scripts/run-designer.sh        # 3. synthèse → recos
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
- **Designer** (`DESIGNER_MODEL`, def `deepseek-chat`) : sans audit, l'éco ratait la
  baseline R7 (planète hors URL) — mais l'**auditeur déterministe** la fournit
  désormais comme finding confirmé, donc l'éco (JSON fiable) suffit. `deepseek-reasoner`
  l'attrape aussi mais rend parfois du JSON invalide → fallback retry dans `llm.mjs`.

## Publication dans le feedback in-game

```bash
bash /opt/exilium/scripts/run-feedback.sh
```

Poste les recos du designer dans la table `feedbacks` du staging via la mutation
tRPC `feedback.create`, sous un compte **reporter dédié** `frictionbot-reporter@staging.local`
(sans « + » → épargné par le cleanup des comptes jetables `frictionbot+...`). Titres
préfixés `[bot]`, dédup par titre. `feedback.create` est **rate-limité (~5/h)** → on
trie par priorité, plafonne à `FEEDBACK_MAX` (def 5) par run, et on s'arrête sur 429.

## Sortie

`reports/<persona>-<date>/` :

- `rapport.md` — frictions (sévérité, étape, note, capture), erreurs console, parcours complet.
- `run.json` — même chose, mangé par l'agent-designer.
- `step-NN.png` — captures de chaque étape.

`reports/_audit/` : `audit-<date>.md` + `.json` (findings déterministes).
`reports/_designer/` : `reco-design-<date>.md` + `.json` (le livrable pour le designer humain).

## Fichiers

| Fichier | Rôle |
|---|---|
| `audit.mjs` | auditeur déterministe (sans LLM) : R6/R7 adressabilité URL, R3 profondeur |
| `friction-bot.mjs` | boucle d'agent-persona ; frictions **taguées par règle** (R1…R13) |
| `designer.mjs` | agent-designer : synthèse audit + sessions + rubric → recos priorisées |
| `publish-feedback.mjs` | poste les recos dans la table `feedbacks` (staging) via tRPC |
| `design-rules.md` | rubric des règles de design (R1…R13) + baselines mesurées |
| `personas.mjs` | définition des personas (1 pour l'instant) |
| `perceive.mjs` | extraction de l'arbre interactif d'une page |
| `llm.mjs` | client DeepSeek (compatible OpenAI), modèle pilotable par env |
| `serve.mjs` | mini-serveur statique du build staging + proxy `/trpc` |

Orchestration : `scripts/run-pipeline.sh` (audit → bot → designer → feedback).

## Suite

- Personas : joueur mobile (PWA), min-maxer, revenant.
- Anti-boucle bot : détecter la répétition d'une même action ratée et nudger / abandonner.
- Compteur de clics par tâche (R4) mesuré pendant la session.
- Étage « crawlers déterministes ×N » (pur Playwright, sans LLM, à chaque deploy).
- Agrégation des `run.json` / recos → table `feedbacks` (taggé `bot`) ou dashboard admin.
- Bascule provider Claude pour les passes profondes.
