# Anomalie V3 — Événements narratifs

> Suite directe de la V1 (combats) en sautant la V2 (boons). Les events absorbent une partie du rôle des boons via leurs outcomes ponctuels.

**Status :** validé 2026-05-01 — implémentation immédiate.

## 1. Concept

Entre deux combats, le joueur tombe parfois sur un **événement narratif** : une carte avec un texte d'ambiance et 2 à 3 choix. Chaque choix résout instantanément un outcome ponctuel (ressources, hull, vaisseaux, exilium). Aucun timer pour décider — l'anomalie est en pause tant que le joueur n'a pas cliqué.

Les events sont **optionnels** : si la pool d'un tier est épuisée à un instant donné, le slot redevient un combat. Le mode reste jouable sans pool peuplée.

## 2. Mécaniques

### Cadence

- Events s'**intercalent** entre 2 combats (nœuds bonus, pas de remplacement)
- Espacement entre 2 events : **2, 3 ou 4 combats** (uniforme)
- En moyenne : **1 event toutes les 3 profondeurs**, soit ~6-7 events sur une run 20-deep
- Run finale ~26-28 nœuds totaux (20 combats + 6-8 events)

### Cooldown

- Avant un event : **2min de transit** (`nextNodeAt`), comme un combat
- Pendant l'event : **résolution instantanée** au clic, pas de double wait
- Après l'event : nouveau cooldown 2min vers le combat suivant

### Tirage

À chaque combat résolu (advance) :
1. `combatsUntilNextEvent--`
2. Si `combatsUntilNextEvent === 0` :
   - Choisir un event aléatoire parmi le pool : `enabled === true` ∧ `tier === currentTier(currentDepth+1)` ∧ `id ∉ seenEventIds`
   - Si aucun match → fallback combat (no-op, le slot devient un combat normal)
   - Si match → `nextNodeType = 'event'`, `nextEventId = picked.id`, ré-tirer `combatsUntilNextEvent ∈ {2,3,4}`
3. Sinon → `nextNodeType = 'combat'`, générer la preview ennemie comme avant

À l'engage : `combatsUntilNextEvent` initialisé à `random(2,3,4)`. Le premier nœud est toujours un combat.

### Tiers de profondeur

| Tier  | Profondeurs | Event count |
|-------|-------------|-------------|
| early | 1-7         | 10 events   |
| mid   | 8-14        | 10 events   |
| deep  | 15-20       | 10 events   |

Tier de l'event = tier de la profondeur **du prochain combat**. Ex : event entre depth 3 et 4 → tier `early` (depth 4).

### Pas de répétition

Chaque event id apparaît au maximum 1 fois par run (`seenEventIds`).

## 3. Choix & visibilité

Chaque event a **2 ou 3 choix**. Chaque choix :
- `label` : texte du bouton (ex: "Approcher l'épave")
- `hidden: boolean` : si `true`, l'outcome est caché (`???`) jusqu'au clic
- `outcome` : voir §4
- `resolutionText` : narration affichée après le clic ("Vous récupérez 1500 minerai dans les débris…")

Mix typique par event : 1-2 choix visibles + 1 choix caché (ratio ~60/40 sur le pool).

## 4. Outcomes ponctuels

Schéma Zod (toutes les clés optionnelles, additives) :

```ts
const outcomeSchema = z.object({
  minerai:    z.number().int().default(0),  // peut être négatif
  silicium:   z.number().int().default(0),
  hydrogene:  z.number().int().default(0),
  exilium:    z.number().int().default(0),
  hullDelta:  z.number().min(-1).max(1).default(0),  // ratio appliqué uniformément
  shipsGain:  z.record(z.string(), z.number().int().min(0)).default({}),  // shipId → count
  shipsLoss:  z.record(z.string(), z.number().int().min(0)).default({}),
}).default({});
```

### Application

- **Ressources** : ajoutées à `loot_minerai/silicium/hydrogene`. Clamp à 0 si négatif (pas de loot négatif accumulé).
- **Exilium** : applique au `user_exilium` immédiatement. Clamp à 0 (le joueur peut perdre tout son solde, pas aller négatif).
- **Hull delta** : `entry.hullPercent = clamp(entry.hullPercent + hullDelta, 0.01, 1.0)` pour chaque groupe. Plancher 1% pour éviter qu'un event seul détruise des vaisseaux (réservé au combat).
- **Ships gain** : si shipId existe déjà dans `fleet`, on additionne `count` (le nouveau hull moyen est pondéré : `(c1*h1 + c2*1) / (c1+c2)` avec h2=1.0 pour les renforts neufs). Sinon nouvelle entrée à 100% hull.
- **Ships loss** : décrémente `count`, plancher 0. Si la nouvelle count est 0, on supprime l'entrée. Le `flagship` est interdit côté schéma.

### Garde-fous

- `flagship` interdit dans `shipsGain` et `shipsLoss` (Zod refuse `'flagship'` comme clé).
- Tous les `shipId` doivent matcher le whitelist `role: 'combat'` (validé au moment d'écrire l'event en admin).

## 5. État persisté

### Nouvelles colonnes sur `anomalies`

```sql
ALTER TABLE anomalies
  ADD COLUMN next_node_type VARCHAR(8) NOT NULL DEFAULT 'combat',
  ADD COLUMN next_event_id  VARCHAR(40),
  ADD COLUMN seen_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN combats_until_next_event SMALLINT NOT NULL DEFAULT 3,
  ADD COLUMN event_log      JSONB NOT NULL DEFAULT '[]'::jsonb;
```

`event_log` : array de `{ depth, eventId, choiceIndex, outcomeApplied, resolvedAt }` pour l'historique.

## 6. API tRPC

### `anomaly.resolveEvent` (mutation, nouvelle)

```ts
input: { choiceIndex: number }  // 0..2
output: {
  outcome: OutcomeApplied;       // ce qui a vraiment été appliqué (clamp inclus)
  resolutionText: string;
  nextEnemyFp: number | null;    // nouveau combat préparé
}
```

Transaction unique :
1. `pg_advisory_xact_lock(hashtext(userId))` (cohérent avec V1)
2. `SELECT ... FOR UPDATE` sur `anomalies` (status='active', nextNodeType='event')
3. Charger `anomalyContent.events`, retrouver l'event par `nextEventId`
4. Valider `choiceIndex` (0 ≤ idx < choices.length)
5. Appliquer outcome (clamp + flagship guard)
6. Pousser dans `event_log` + `seen_event_ids`
7. Préparer le combat suivant : `nextNodeType='combat'`, générer enemy preview, `nextNodeAt = NOW + 2min`
8. Retourner outcome appliqué + résolution

Erreurs typiques :
- `nextNodeType !== 'event'` → `BAD_REQUEST` "aucun événement à résoudre"
- event id absent du content (admin l'a supprimé pendant la run) → fallback combat sans modification, retour explicite

### `anomaly.current` (lecture, étendue)

Renvoie les nouveaux champs : `nextNodeType`, `nextEventId`, `eventLog`. Le UI utilise `nextEventId` + `anomalyContent.get` pour afficher l'event sans nouvelle requête.

## 7. UI joueur

### `Anomaly.tsx` (RunView)

Le bloc "Prochain combat" devient adaptatif :
- `nextNodeType === 'combat'` : rendu actuel (image profondeur + ennemi + bouton "Lancer le combat")
- `nextNodeType === 'event'` : carte event (image event + titre + texte d'ambiance + 2-3 boutons de choix)

Quand `ready === true` (cooldown écoulé) et type=event, les boutons de choix sont activés. Au clic, modal de confirmation **uniquement pour les choix cachés** (à cause du risque) ; les choix visibles s'exécutent direct. Outcome affiché en toast + dans l'event log de la run.

### `EventLog` (nouveau composant léger)

Liste compacte des events résolus pendant la run :
```
P3 — Épave Spectrale → "Approcher" → +1500 minerai
P6 — Marchand Exilé → "Acheter le pack" → +12 fighter, −800 silicium
```

## 8. UI admin (`/admin/anomalies`)

La section "Événements aléatoires" (placeholder V3 actuelle) devient le vrai éditeur :

```
[+ Ajouter un event]

Événements early (10) [▼]
├── 1. [✓] [img] Épave Spectrale (3 choix)
├── 2. [✓] [img] Signal Détresse (2 choix)
└── …

Événements mid (10) [▼]
└── …

Événements deep (10) [▼]
└── …
```

Chaque event = carte expandable :
- Image (AnomalyImageSlot, slot=`event-<id>`)
- Toggle `enabled`
- Radio tier (early/mid/deep)
- Titre (max 80)
- Description (textarea max 1000)
- Liste de choix (2-3) :
  - Label
  - Toggle "caché"
  - Outcome editor (3 inputs ressources, 1 exilium, 1 hull%, 1 ship gain dropdown+count, 1 ship loss dropdown+count)
  - Resolution text (textarea max 500)

## 9. Pool de seed (30 events)

Rédigés en français, ton sci-fi cohérent avec Exilium. Pool initial dans `DEFAULT_ANOMALY_CONTENT.events`. L'admin peut éditer/désactiver/ajouter sans toucher au code.

Voir le seed dans `apps/api/src/modules/anomaly-content/anomaly-content.types.ts` après implémentation.

## 10. Edge cases

- **Pool vide pour le tier en cours** : fallback combat, pas d'erreur
- **Admin supprime un event en cours** : la run garde `nextEventId` mais à la résolution → fallback combat (préparer enemy + clear event id)
- **Joueur retreat avec un event en attente** : retreat normal (l'event est juste cancel, seenEventIds n'est pas modifié, le joueur ne le reverra pas dans cette run mais peut le voir dans une prochaine)
- **Wipe en combat** : event log conservé dans la row archivée (status='wiped')
- **Outcomes négatifs** : clamp loot/exilium à 0, hull à 1% mini, ships à 0 mini

## 11. Tests

- `anomaly.events.test.ts` (nouveau, formules pures) :
  - `pickNextEventGap` distribution sur N=1000 (uniforme {2,3,4})
  - `applyOutcome(fleet, outcome)` : hull clamp, ship gain (hull moyen pondéré), ship loss (suppression à 0)
  - `tierForDepth(depth)` mapping
- `anomaly.service.test.ts` (étendu) :
  - resolveEvent applique outcome + génère prochain combat
  - resolveEvent rejette si nextNodeType !== 'event'
  - resolveEvent fallback si event id supprimé
- Compat : runs en cours pré-V3 (sans `next_node_type`) doivent fonctionner — la migration set un default `'combat'`

## 12. Migration & rollout

- Migration `0067_anomaly_events.sql` : ajoute les 5 colonnes avec defaults safe
- Pas de backfill : les runs en cours continuent en "combat-only" jusqu'à leur fin
- Une fois déployé, les nouvelles runs bénéficient des events
- Le seed des 30 events vit dans le code → pas de migration de contenu

## 13. Hors-scope V3

- Boons run-scoped (V2)
- Map ramifiée (V4)
- Skip combat / event commerçant transformatif (V5+)
- Reports d'event (le toast + event log suffisent en V3)
- Outcome avec ramification ("si réussite X, sinon Y") — V4
