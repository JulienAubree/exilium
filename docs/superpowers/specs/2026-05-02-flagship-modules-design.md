# Système de modules du Vaisseau Amiral — Design

> **Sous-projet 1/5** de la refonte Anomalie & Flagship. Voir `docs/proposals/2026-05-02-flagship-only-anomaly-roadmap.md` pour l'overview.

**Status :** validé 2026-05-02 — spec en attente de revue user avant plan d'implémentation.

## 1. Concept

Le système de talents du flagship (arbre + ranks + dépense Exilium) est remplacé par un **système de modules à slots**. Chaque coque équipe **9 modules** rangés en 3 raretés, dont les effets vont des stats passives à une capacité active à charges. Les modules sont **lootés via les anomalies** (et plus tard via pirates IG), formant la fondation du loot loop de l'Anomalie V4.

**Pourquoi maintenant**
- L'Anomalie V4 (sub-projet 2) abandonne le combat avec flotte complète (cause : crash JS à dizaines de milliers de vaisseaux). Le flagship-only nécessite un système d'équipement digestible.
- L'arbre de talents actuel est figé, peu engageant. Le passage à des modules lootables crée un loop endgame plus riche.

## 2. Mécaniques cœur

### 2.1 Slots & raretés (par coque)

| Rareté | Slots | Type d'effet | Magnitude indicative |
|---|---:|---|---|
| commun | 5 | Stat passive additive | +5 à +10 % par module |
| rare | 3 | Stat moyenne OU effet conditionnel | +15 à +25 % |
| épique | 1 | Capacité active à charges | voir §2.4 |

### 2.2 Stacking

**Additif simple.** Deux modules `+8% dmg` = `+16% dmg`. Lisible, prévisible. Pas de soft cap en V1 — la limite naturelle vient du nombre de slots.

Loadout complet (5C + 3R + 1E) procure ≈ **+80 à +100%** sur diverses stats + 3 effets situationnels + 1 capacité active. Le flagship équipé est sérieusement plus fort que nu, sans rendre le flagship nu inutilisable pour les anomalies low-depth.

### 2.3 Liaison à la coque

**Pool 100% dédié par coque.** Un module `combat` ne peut pas être équipé sur une coque `scientific`. Switcher de coque = changer tout le loadout (les modules de l'ancienne coque restent dans l'inventaire). Chaque coque garde son loadout actif persisté indépendamment.

Mapping thématique :
- `combat` → modules attaque + bonus généralistes (HP, défense, vitesse)
- `scientific` → modules recherche/scan/espionnage + bonus généralistes
- `industrial` → modules cargo/minage/explo + bonus généralistes

Chaque pool mélange ~70% modules thématiques + ~30% bonus généralistes. Évite qu'un joueur "scientifique" se retrouve sans option défensive viable.

### 2.4 Capacité épique à charges

Le slot épique débloque une **capacité active**.

- **Démarrage de run** : `epic_charges_current` est initialisé à `epic_charges_max` au moment de l'engage anomaly.
- **`epic_charges_max` baseline** : 1 (par défaut). Boostable par certains modules ayant un effet `{ type: 'stat', stat: 'epic_charges_max', value: 1 }`. Cap dur à 3 (clampé silencieusement même si plusieurs modules empilent +1).
- **Coût** : 1 charge par activation.
- **Déclenchement** : bouton dédié sur la carte de preview du prochain combat, avant de cliquer "Lancer le combat". Une seule activation par combat possible.
- **Sources de regen pendant la run** :
  - **V1 modules** : aucune regen pendant la run. Tu dépenses ce que tu as démarré avec.
  - **V2 (sub-projet 2 Anomaly V4)** : certains events anomaly récompenseront +1 charge.
- **Persistance** : `epic_charges_current` reset à `epic_charges_max` à chaque nouvelle run anomaly. Hors anomaly, les charges sont gelées (pas d'usage hors run).
- **Module qui boost les charges** : exemple `combat-strategist` rare = `{ type: 'stat', stat: 'epic_charges_max', value: 1 }` → équipé, le run démarre avec 2 charges au lieu de 1.

Exemples d'épiques (à itérer en implémentation, voir §13 pool de seed) :
- *Réparation d'urgence* (combat) : +50% hull immédiat
- *Surcharge tactique* (combat) : +100% dmg ce combat
- *Scan profond* (scientific) : révèle l'event suivant + ses outcomes cachés
- *Saut quantique* (industrial) : skip le prochain combat sans pertes ni loot

### 2.5 Pool size V1

| Coque | Communs | Rares | Épiques | Total |
|---|---:|---:|---:|---:|
| combat | 10 | 6 | 3 | 19 |
| scientific | 10 | 6 | 3 | 19 |
| industrial | 10 | 6 | 3 | 19 |
| **TOTAL** | **30** | **18** | **9** | **57** |

## 3. Loot & économie

### 3.1 Acquisition pendant la run anomaly

**Per-combat won** (drop commun continu) :
- 30% chance : 1 module commun de TON pool de coque, tirage uniforme parmi les modules `enabled = true` non-déjà-équipés en priorité (sinon duplicate)
- 5% chance : 1 module commun d'une AUTRE coque (l'autre coque est tirée uniformément parmi les 2 restantes), conservable pour usage futur
- 65% chance : rien

Les 3 issues sont mutuellement exclusives (somme = 100%). Tirage indépendant à chaque combat gagné. **Pas de drop à la défaite, au draw, ni au wipe.**

**Per-run terminée vivant** (succès OU retreat, pas wipe) — bonus final scalé par profondeur atteinte :

| Depth atteint | Bonus final |
|---|---|
| 1-3 | 1 commun |
| 4-7 | 1 rare |
| 8-12 | 1 rare + 30% chance épique |
| 13+ | 1 rare + 1 épique garanti |

**Wipe** : aucun loot final. Les drops per-combat déjà attribués pendant la run restent acquis (insérés au fil de la run dans `flagship_module_inventory`).

### 3.2 Estimation de la grind

Avec ces taux, en supposant un joueur qui complète des runs au depth 5 (3 combats gagnés en moyenne) :
- **Communs** : ~0.9 commun par run en moyenne (3 × 30%). Coupon collector pour 5 modules uniques sur 10 dans la pool ≈ **8-10 runs** pour fill les 5 slots commun (avec quelques duplicates).
- **Rares** : 1 rare par run dès le depth 4. Coupon collector pour 3 sur 6 ≈ **4-6 runs** pour fill les 3 slots rare.
- **Épiques** : drops à partir du depth 8 (30% chance) ou depth 13+ (garanti). Pool de 3 → **~5-8 runs** réussies au depth 8+ pour avoir au moins 1 épique.

Loop endgame estimé pour un loadout "raisonnable" sur 1 coque : **15-25 runs**. Suffisant pour tenir plusieurs semaines, gradients de récompense lisibles (premiers gains visibles dès la run 1).

### 3.3 Permanence

Les modules sont des **collectibles permanents**. Une fois loot → inventaire à vie. Duplicates possibles (même `module_id` × N) mais sans usage en V1. Préparation pour système de fusion futur.

Pas d'option d'abandon/suppression de module en V1 (l'inventaire grossit, on l'assume — au pire 57 entrées max + duplicates).

### 3.4 Sources futures (hors-scope V1)

- **Pirates IG** (sub-projet 4) : 1% drop commun par pirate killed en PvE missions
- **Events spéciaux** : certains events anomaly récompenseront un module spécifique au lieu de stats (sub-projet 2)
- **Fusion** : combiner N duplicates communs → 1 rare aléatoire (V2)

## 4. Équipement

### 4.1 Règles d'équipement

- **Hors anomaly** : libre, instantané, gratuit depuis l'écran flagship.
- **Pendant la run anomaly** : verrouillé. Le loadout snapshot est figé à l'engage et appliqué tel quel jusqu'au retour. Les charges épiques peuvent être consommées mais le loadout (quels modules sont équipés) ne change pas.

### 4.2 Validation des slots

Un module `M` peut être équipé dans un slot si toutes les conditions sont remplies :
1. `M.hull_id` === coque cible du loadout (combat/scientific/industrial)
2. `M.rarity` === type du slot (commun/rare/épique)
3. `M` existe dans `flagship_module_inventory` du flagship (count ≥ 1)
4. `M` n'est pas déjà équipé dans un autre slot du même loadout (un même module ne peut pas occuper 2 slots simultanément, même s'il y a des duplicates)
5. Slot cible est libre OU le slot existant est unequip d'abord (atomique, géré côté API)
6. Flagship n'est pas en `in_mission` (pas en anomaly active)

## 5. UI

### 5.1 Page `/flagship`

L'onglet "Talents" disparaît, remplacé par **"Modules"**.

**Layout fiche d'équipement RPG** :
- **Colonne gauche** (~360px) : silhouette du flagship avec 9 slots disposés
  - 1 slot épique au centre (gros, illuminé)
  - 3 slots rares en triangle autour
  - 5 slots communs en couronne externe
  - Slot vide : encart pointillé avec icône "+"
  - Slot équipé : icône module + tooltip survol (nom + effet abrégé)
  - Si module équipé n'a pas d'image uploadée : fallback icône générique par rareté (commun gris / rare bleu / épique violet)
- **Colonne droite** (flex) : inventaire filtrable
  - Filtres : rareté (toggle 3 chips), statut (équipé/disponible/dupe), recherche texte
  - Chaque ligne : icône + nom + effet abrégé + bouton "Équiper" (auto-target slot libre du bon type) ou "Détails"
  - Tri par rareté décroissante puis nom
  - Tabs en haut pour visualiser/éditer les loadouts des 3 coques. **La coque ACTIVE** (celle persistée sur `flagships.hull_id`) a un badge "actif" et son loadout est celui qui s'applique en combat. Les autres tabs permettent de préparer un loadout pour quand on switch de coque (le switch reste contrôlé par le système flagship existant)

**Modal détail module** au clic : nom + flavor text + effet exact (formaté en français lisible, pas le JSON brut) + slot visé + duplicates count.

### 5.2 Page `/anomalies`

**Important** : la run anomaly continue de fonctionner comme aujourd'hui en V1 modules (flagship + flotte vs ennemi). Les modules amplifient juste les stats du flagship pendant les combats. Le passage flagship-only (suppression de la flotte côté joueur) est traité dans sub-projet 2 (Anomaly V4).

Côté V1 modules — affichage seulement :
- Mention en lecture du loadout actif (icônes des 9 modules dans le hero, tooltip au survol)
- Bouton "Activer capacité épique" sur la carte de preview du prochain combat (si charges ≥ 1 et épique équipé)
- Le AnomalyEngageModal reste avec la sélection de flotte (V4 le simplifiera)

### 5.3 Notifications de loot pendant la run

Toast simple violet en bas-droit : `✨ +1 module : Plaque blindée standard (commun)`. Auto-dismiss 4s. Pas de modal interrupt (perte de fluidité).

### 5.4 Modal "Butin de fin de run"

À l'arrivée (après retreat/succès) :
- Apparaît automatiquement
- Grille des modules loot pendant la run + module(s) bonus final mis en avant
- Ressources/Exilium récupérés (déjà existant — réutilisé)
- CTA "Voir mes modules" → `/flagship`
- Auto-fermable, pas bloquant

### 5.5 Admin `/admin/modules`

Pattern master/detail (réutiliser celui de `/admin/anomalies`) :
- **Rail gauche** : 3 sections (combat / scientific / industrial), chaque section liste les modules groupés par rareté avec dot d'état (enabled = vert, disabled = gris)
- **Detail droite** : éditeur :
  - Champs simples : id (immutable une fois créé), nom, rareté (radio), coque (radio), description (textarea), image (`ModuleImageSlot`), toggle enabled
  - Effet : pour V1 simplicité, **textarea JSON** avec validation Zod en live (parse + erreur affichée sous le textarea). Templates pré-remplis sélectionnables ("Stat passive", "Conditional", "Active") qui injectent le squelette JSON adéquat. Évolution V2 : formulaire structuré par type.
- Save inline avec error feedback (pattern post-fix Anomalies admin)
- Bouton "+ Nouveau module" par tier dans chaque section coque

## 6. Data model

### 6.1 Tables nouvelles

```sql
CREATE TABLE module_definitions (
  id           VARCHAR(64) PRIMARY KEY,
  hull_id      VARCHAR(32) NOT NULL,
  rarity       VARCHAR(16) NOT NULL,        -- 'common' | 'rare' | 'epic'
  name         VARCHAR(80) NOT NULL,
  description  TEXT NOT NULL,
  image        VARCHAR(500) NOT NULL DEFAULT '',
  enabled      BOOLEAN NOT NULL DEFAULT true,
  effect       JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_rarity CHECK (rarity IN ('common', 'rare', 'epic')),
  CONSTRAINT chk_hull CHECK (hull_id IN ('combat', 'scientific', 'industrial'))
);
CREATE INDEX idx_modules_hull_rarity ON module_definitions(hull_id, rarity) WHERE enabled = true;

CREATE TABLE flagship_module_inventory (
  flagship_id  UUID NOT NULL REFERENCES flagships(id) ON DELETE CASCADE,
  module_id    VARCHAR(64) NOT NULL REFERENCES module_definitions(id) ON DELETE CASCADE,
  count        SMALLINT NOT NULL DEFAULT 1 CHECK (count > 0),
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (flagship_id, module_id)
);
```

### 6.2 Modifications `flagships`

```sql
ALTER TABLE flagships
  ADD COLUMN module_loadout JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN epic_charges_current SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN epic_charges_max SMALLINT NOT NULL DEFAULT 1;
```

### 6.3 Modifications `anomalies`

Pour permettre le snapshot du loadout au moment de l'engage et la persistance des effets épiques en attente :

```sql
ALTER TABLE anomalies
  ADD COLUMN equipped_modules JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Effet épique activé entre 2 combats, à appliquer au prochain combat.
  -- shape: { ability: 'overcharge', magnitude: 1.0, source: 'mod-id' } | null
  ADD COLUMN pending_epic_effect JSONB;
```

`equipped_modules` reprend la shape de `flagships.module_loadout` mais figée au moment de l'engage. Permet à l'admin de modifier les modules pendant qu'une run est active sans casser la run.

### 6.4 Tables legacy (talents)

**Décision : archivage avant suppression.** Plutôt que `DROP TABLE` immédiat, on rename vers `_archive` :

```sql
ALTER TABLE flagship_talents RENAME TO flagship_talents_archive;
ALTER TABLE talent_definitions RENAME TO talent_definitions_archive;
ALTER TABLE talent_branch_definitions RENAME TO talent_branch_definitions_archive;
```

Conservation 1-2 sprints pour audit/rollback éventuel. Suppression dans une migration séparée plus tard. Permet aussi un script SQL ad-hoc pour rejouer la migration si bug détecté.

### 6.5 Shape `module_loadout` (jsonb)

```ts
{
  combat:     { epic: 'mod-id' | null, rare: ['a','b','c'], common: ['1','2','3','4','5'] },
  scientific: { epic: ..., rare: [...], common: [...] },
  industrial: { epic: ..., rare: [...], common: [...] }
}
```

Slots vides = `null` (épique) ou tableau partiel (rare/common). Tableaux strictement de longueur ≤ 3 (rares) et ≤ 5 (communs). Validation Zod stricte côté API.

**Trade-off jsonb vs table relationnelle** : jsonb choisi pour V1 car les besoins de query cross-joueur (ex : "qui équipe X ?") n'existent pas encore. Lecture loadout = 1 column. Si métriques admin futures requièrent des aggregates, on migrera vers une table `flagship_loadout_slots` à ce moment-là.

### 6.6 Shape `effect` (JSONB)

```ts
type ModuleEffect =
  | { type: 'stat'; stat: StatKey; value: number }                             // ex: { type: 'stat', stat: 'damage', value: 0.05 }
  | { type: 'conditional'; trigger: TriggerKey; threshold?: number;
      effect: { stat: StatKey; value: number } }                                // ex: { type: 'conditional', trigger: 'first_round', effect: { stat: 'damage', value: 0.50 } }
  | { type: 'active'; ability: AbilityKey; magnitude: number };                // ex: { type: 'active', ability: 'repair', magnitude: 0.50 }

type StatKey = 'damage' | 'hull' | 'shield' | 'armor' | 'cargo' | 'speed' | 'regen' | 'epic_charges_max';
type TriggerKey = 'first_round' | 'low_hull' | 'enemy_fp_above' | 'last_round';
type AbilityKey = 'repair' | 'shield_burst' | 'overcharge' | 'scan' | 'skip' | 'damage_burst';
```

`value` et `magnitude` sont des fractions (0.05 = +5%). `threshold` (pour `enemy_fp_above` ou `low_hull`) est une fraction également (0.30 = sous 30% hull).

`epic_charges_max` est un cas particulier : `value` = nombre absolu (+1 charge).

Validation Zod stricte côté API (admin save + service equip). Effets non typés rejetés.

## 7. Migration

Script unique exécuté lors du déploiement. Décomposé en plusieurs étapes idempotentes.

### 7.1 Étapes (ordre critique)

> **Ordre important** : le refund (étape 3) lit les tables `flagship_talents` et `talent_definitions`. Il DOIT s'exécuter AVANT le rename de l'étape 5.

1. **Créer les nouvelles tables** (`module_definitions`, `flagship_module_inventory`) + colonnes flagships et anomalies avec defaults sécurisés.

2. **Seed les 57 modules** dans `module_definitions` via le code (`default-modules.seed.ts`, parsé Zod et inséré une fois). Idempotent via `ON CONFLICT (id) DO UPDATE SET ...`.

3. **Calcul du refund Exilium** : pour chaque flagship, agréger
   ```sql
   SELECT
     ft.flagship_id,
     SUM(ft.current_rank * (
       CASE td.tier
         WHEN 1 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_1'), 1)
         WHEN 2 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_2'), 2)
         WHEN 3 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_3'), 3)
         WHEN 4 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_4'), 4)
         WHEN 5 THEN COALESCE((SELECT value::int FROM universe_config WHERE key='talent_cost_tier_5'), 5)
       END
     )) AS exilium_to_refund
   FROM flagship_talents ft
   JOIN talent_definitions td ON td.id = ft.talent_id
   WHERE ft.current_rank > 0
   GROUP BY ft.flagship_id;
   ```
   Crédit dans `user_exilium.balance` + INSERT dans `exilium_log` source `talent_refund` avec details `{ flagshipId, totalRanks, computedExilium }`.

4. **Starter pack** : pour chaque flagship avec `hull_id IS NOT NULL`, INSERT 1 module commun "starter" lié à la coque dans `flagship_module_inventory`. 3 starters fixes définis dans le seed (chaque coque a son starter distinct sur une stat différente) :
   - combat → `starter-armored-plating` (+5% hull)
   - scientific → `starter-shield-modulator` (+5% shield)
   - industrial → `starter-cargo-bay` (+5% cargo)

5. **Rename des tables legacy** (cf §6.3) : pas de DROP immédiat.

### 7.2 Pré-flight check

Avant le run en prod :
- Exécuter le calcul du refund sur staging avec les données récentes
- Vérifier la somme totale (cohérente avec l'Exilium émis cumulé via talents — `SELECT SUM(amount) FROM exilium_log WHERE source = 'talents'`)
- Inspecter manuellement 5-10 flagships au hasard

### 7.3 Idempotence

Toutes les étapes sont safe à re-run :
- Tables : `CREATE TABLE IF NOT EXISTS`
- Seed : `INSERT ... ON CONFLICT DO UPDATE`
- Refund : marqueur dans une table `_migrations_state` (key=`flagship_modules_refund`, value=`done`) — bloque la 2e exécution
- Starter : `INSERT ... ON CONFLICT DO NOTHING`
- Rename : `IF EXISTS`

### 7.4 Communication

Annoncement dans la table `announcements` au déploiement :
> "Les talents flagship deviennent des modules. Votre Exilium investi a été remboursé. Découvrez la nouvelle page Modules sur l'écran flagship — vous démarrez avec 1 module starter et il y en a 56 autres à looter via les anomalies !"

## 8. Architecture code

### 8.1 Game engine (`@exilium/game-engine`)

Nouveau module `formulas/modules.ts` :
- `parseLoadout(loadout, modulePool) → EquippedModules` — résout les ids vers les définitions complètes, ignore les ids manquants
- `applyModulesToStats(baseStats, modules, context) → ModifiedStats` — applique les effets `stat` (additif) et `conditional` (selon contexte combat : round, hull%, enemy FP)
- `getMaxCharges(modules) → number` — somme des bonus charges (effets `stat` avec `stat: 'epic_charges_max'`)
- `resolveActiveAbility(abilityId, magnitude, context) → AppliedEffect` — applique une capacité épique au state combat

Tests unitaires : 15-20 cas couvrant chaque type d'effet + conditionnels + charges + edge cases (loadout vide, modules dupliqués, ids manquants, conditional non déclenché).

### 8.2 API (`apps/api/src/modules/modules/`)

```
modules/
├── modules.types.ts           # Zod schemas pour Effect + Loadout
├── default-modules.seed.ts    # 57 modules + 3 starters
├── modules.service.ts         # CRUD inventory, equip/unequip, drop rolls
└── modules.router.ts          # tRPC router
```

Routes tRPC :
- `module.inventory.list` — modules possédés (groupés par coque/rareté)
- `module.loadout.get(hullId)` — loadout actif de la coque
- `module.loadout.equip({ hullId, slotType, slotIndex, moduleId })` — validation + persist (transaction)
- `module.loadout.unequip({ hullId, slotType, slotIndex })`
- `module.admin.list` / `module.admin.upsert` / `module.admin.delete` — CRUD admin

L'activation de la capacité épique est exposée par le router **anomaly** (puisque dépendante du contexte run) :
- `anomaly.activateEpic({ hullId })` — vérifie qu'une anomaly est active + charges ≥ 1 + épique équipé. Consomme 1 charge sur `flagships.epic_charges_current`. Selon la nature de l'épique :
  - effet immédiat → applique sur `anomalies.fleet` (ex: hullPercent += 0.5) puis `pending_epic_effect = null`
  - effet next-combat → écrit dans `anomalies.pending_epic_effect`, consommé au prochain `runAnomalyNode`
  - Retourne `{ ability, magnitude, applied: 'immediate' | 'pending', remainingCharges }`

Modifs **`anomaly.service.ts`** :
- À l'engage : snapshot du loadout sur la row anomaly (`equipped_modules`) + `epic_charges_current` reset à `epic_charges_max`. Le snapshot évite que l'admin modifie les modules pendant la run.
- Combat resolution : `applyModulesToStats(flagshipBaseStats, equippedModules, combatContext)` avant la simulation. `combatContext` inclut `roundIndex`, `currentHullPercent`, `enemyFP`, `pendingEpicEffect` pour les effets conditionnels et l'épique activée.
- Per-combat : roll de drop commun, INSERT inventory si win
- Per-run final : roll de drop selon depth, INSERT inventory au retreat/succès. Pas de drop si wipe.
- Activation épique entre 2 combats : `module.epic.activate({ hullId })` consomme 1 charge sur `flagships.epic_charges_current` ET set `anomalies.pending_epic_effect` selon la nature de l'épique :
  - **Effet immédiat** (repair, hull bonus) → applique directement à `anomalies.fleet` (ex: hullPercent += 50%) puis `pending_epic_effect = null`
  - **Effet next-combat** (overcharge, ablative shield) → set `pending_epic_effect`, consommé au prochain `runAnomalyNode`
- Refonte des 30 events V3 : remplacer les outcomes "ships gain/loss" par "module commun bonus" ou "+1 charge épique" (cette refonte est faite dans sub-projet 2)

Modifs **`flagship.service.ts`** :
- Lecture du loadout dans `flagship.get()` retour
- Validation au changement de coque : interdit si `status === 'in_mission'`

### 8.3 Front

```
apps/web/src/components/flagship/
├── ModuleLoadoutGrid.tsx       # silhouette + 9 slots
├── ModuleSlot.tsx              # 1 slot (vide ou occupé) avec tooltip
├── ModuleInventoryPanel.tsx    # liste filtrable + équipe
├── ModuleDetailModal.tsx       # détail au clic
└── ModuleHullTabs.tsx          # tabs combat/scientific/industrial

apps/web/src/components/anomaly/
└── AnomalyLootSummaryModal.tsx # butin fin de run

apps/web/src/pages/Flagship.tsx # remove TalentsTab, add ModulesTab
```

```
apps/admin/src/pages/Modules.tsx                    # master/detail
apps/admin/src/components/ui/ModuleImageSlot.tsx    # upload pattern (hérite AnomalyImageSlot)
```

### 8.4 Image upload

Nouvelle catégorie `'module'` dans `AssetCategory` :
- Path : `/assets/module/<module-id>.webp` (1 image par module)
- Pipeline : `processModuleImage` similaire à `processAnomalyImage` (1280px hero + 640px thumb)
- Caddyfile : ajouter `/assets/module/*` à la liste `@game_assets`
- Cache-Control : `no-cache, must-revalidate` (pattern admin)

## 9. Tests

### 9.1 Game engine

15-20 cas vitest sur `modules.ts` :
- `parseLoadout` : ids valides, ids manquants ignorés, modules désactivés ignorés
- `applyModulesToStats` :
  - Stat passive simple (+5% hull)
  - Stack additif (3 modules +5% = +15%)
  - Conditional `first_round` (déclenché round 1 only)
  - Conditional `low_hull` (déclenché sous threshold)
  - Conditional non déclenché → no-op
- `getMaxCharges` : somme des bonus
- `resolveActiveAbility` : repair, shield_burst, overcharge

### 9.2 Service

Pattern mocks DB (cf `daily-quest.service.test.ts`) :
- Equip validation (rareté/coque/slot/ownership) — 6-8 tests
- Equip refusé pendant in_mission — 1 test
- Module désactivé en admin → équipement refusé, lecture loadout silencieuse — 2 tests
- Drop rolls (mock RNG seed → vérif distribution sur 10000 rolls : 30% commun own, 5% commun other, 65% rien) — 3 tests
- Drop final per-depth (1-3 → 1 commun, 4-7 → 1 rare, 8-12 → 1 rare + chance épique, 13+ → 1 rare + 1 épique) — 4 tests
- Activation épique : immediate effect applique au fleet, next-combat effect persiste sur anomalies.pending_epic_effect — 2 tests
- Migration : refund correct (mock universe_config + flagship_talents fixture), idempotence (marker `_migrations_state.flagship_modules_refund` empêche re-run), starter pack (1 par hull, log warning si hull NULL) — 4 tests

### 9.3 Front

Smoke tests E2E sur `/flagship` rendering (modules tab affiché, equip flow basic). Pattern existant pour la couverture, pas de tests E2E lourds.

## 10. Edge cases

- **Joueur change de coque pendant qu'il a un loadout actif** : le loadout actuel reste persisté pour cette coque, le loadout de la nouvelle coque est chargé (vide au début si jamais équipé).
- **Module supprimé en admin pendant qu'il est équipé** : au prochain `loadout.get`, on retire silencieusement l'id manquant (slot redevient vide). Module disabled = même traitement.
- **Drop d'un module duplicate** : `count++` dans `flagship_module_inventory`. UI affiche `×2` à côté du module dupliqué. Ne sert à rien en V1 (prep pour fusion).
- **Charge épique > cap** : clampé silencieusement à `epic_charges_max`.
- **Charges épiques < 0** : impossible (validation côté service refuse).
- **Joueur sans flagship** : système de modules indisponible. UI affiche un message d'incitation à débloquer le flagship.
- **Joueur avec `hull_id = NULL`** : pas de starter (log warning). Démarre avec 0 modules. Le pack est attribué à la prochaine sélection de coque.
- **Wipe en anomaly** : pas de loot final, mais les drops per-combat déjà acquis restent (insérés au fil de la run).
- **Drop d'un module désactivé en admin** : skip silencieux (rare event puisque rolls ne tirent que parmi enabled).
- **Loadout snapshot d'un module supprimé en admin pendant la run** : effet `applyModulesToStats` ignore les ids manquants → run continue sans bonus pour ce slot.
- **Switch hull bloqué pendant in_mission** : déjà géré par flagship.service mais tester explicitement (modules ne contournent pas cette protection).
- **Refund Exilium avec balance overflow** : Exilium balance est `bigint`, pas de risque pratique.

## 11. Migration & rollout

- **Pré-déploiement** :
  - Run du calcul refund sur staging, vérification de la somme (cohérente avec `exilium_log` historiques)
  - Smoke test : créer 3 flagships test (un par coque), équiper modules, run anomaly fictive
- **Déploiement** : migration unique. PM2 reload → cache flushed.
- **Communication** : announcement publié au moment du déploiement.
- **Monitoring post-déploiement** :
  - Logs sur `module.loadout.equip` errors (validation fail)
  - Métriques admin futures : top 10 modules équipés, distribution rareté équipée

## 12. Hors-scope V1

- Système de fusion / upgrade (consume duplicates → upgrade)
- Modules avec effets multi-stats ou multi-effets
- Set bonuses (équiper 3 modules de la même catégorie → bonus extra)
- Modules d'autres coques **équipables** (V1 : juste collectibles, équipement bloqué)
- Sources alternatives de loot (pirates IG = sub-projet 4)
- Réécriture des 30 events V3 anomaly pour outcomes module-aware (sub-projet 2)
- 4e coque "espionnage" (ajoute son pool de 19 modules — futur)
- Métriques admin "qui équipe quoi" (futur, requiert table relationnelle)
- Option d'abandon/suppression de modules dans l'inventaire (V2)

## 13. Pool de seed V1 — esquisse

Liste indicative des 57 modules à concevoir lors de l'implémentation. Chaque module a un id stable, un nom, un flavor text 1-2 phrases, un effet typé.

### Combat (10 communs / 6 rares / 3 épiques)

**Communs :**
1. `combat-armored-plating` — Plaque blindée standard (+5% hull) — STARTER
2. `combat-power-converter` — Convertisseur de puissance (+8% damage)
3. `combat-reinforced-shield` — Bouclier renforcé (+7% shield)
4. `combat-targeting-stabilizer` — Stabilisateur de visée (+5% damage)
5. `combat-light-thruster` — Réacteur léger (+5% speed)
6. `combat-emergency-repair` — Régulateur d'urgence (+5% regen entre combats)
7. `combat-armored-holds` — Soutes blindées (+5% cargo)
8. `combat-extra-armor` — Plaques supplémentaires (+8% armor)
9. `combat-reinforced-hull` — Coque renforcée (+8% hull)
10. `combat-fuel-bypass` — Bypass carburant (+5% cargo + +3% speed)

**Rares :**
1. `combat-opening-salvo` — Salve d'ouverture (1er round : +50% damage)
2. `combat-survival-protocol` — Protocole de survie (sous 30% hull : +30% shield regen)
3. `combat-veteran-crew` — Équipage vétéran (+15% damage, +15% hull)
4. `combat-strategist` — Stratège (+1 charge épique au démarrage de la run)
5. `combat-anti-debris` — Anti-débris (réduit de 50% le debris drop attaquant)
6. `combat-counter-attack` — Riposte (chaque kill ennemi : +5% damage permanent ce combat, max +30%)

**Épiques :**
1. `combat-emergency-repair-epic` — Réparation d'urgence (1 charge → +50% hull immédiat)
2. `combat-overcharge` — Surcharge tactique (1 charge → +100% damage ce combat)
3. `combat-ablative-shield` — Bouclier ablatif (1 charge → bloque tous les dégâts du round suivant)

### Scientific (10 / 6 / 3) — esquisse

**Communs (extraits)** : `sci-sensor-array` (+5% damage, STARTER — l'effet "scan range" est V2), `sci-data-bank` (+8% regen entre combats), `sci-stealth-coating` (+10% damage 1er round), …

**Rares (extraits)** : `sci-deep-scan` (révèle l'event suivant), `sci-quantum-research` (+1 module rare per-run final), …

**Épiques** : `sci-deep-scan-epic`, `sci-time-dilation` (1 charge → relance combat sans pertes), `sci-knowledge-burst` (1 charge → tous les choix d'event apparaissent visibles).

### Industrial (10 / 6 / 3) — esquisse

**Communs (extraits)** : `indus-cargo-bay` (+5% cargo, STARTER), `indus-mining-laser` (+5% damage), `indus-fuel-tanks` (+10% speed), …

**Rares (extraits)** : `indus-salvage-protocol` (+50% recovery vaisseaux), `indus-bulk-loot` (+30% loot ressources final), …

**Épiques** : `indus-quantum-jump` (1 charge → skip prochain combat sans loot), `indus-megastructure` (1 charge → +200% hull mais 0 damage ce combat), `indus-ressource-lure` (1 charge → double le loot final).

Le détail complet (descriptions, valeurs précises, équilibrage) sera affiné lors de l'implémentation. **Workload estimé : 12-15h pour les 57.**

## 14. Ordre d'implémentation suggéré

Pour le sub-skill writing-plans :

1. **Migration DB + schémas Drizzle** — tables + colonnes + check constraints
2. **Game engine `modules.ts`** + tests unitaires (sans dépendance, peut être validé isolément)
3. **Seed 57 modules** dans `default-modules.seed.ts` + parser Zod
4. **API `modules.service.ts`** + routes tRPC (sans intégration anomaly encore)
5. **API admin routes** (CRUD modules) + image upload pipeline
6. **Front `/admin/modules`** (master/detail)
7. **Front `/flagship` modules tab** (loadout grid + inventory)
8. **Migration script** (refund + starter + tables rename) — testé sur staging
9. **Anomaly integration** (snapshot loadout, drops per-combat, drops per-run, applyModulesToStats)
10. **Front loot toast + butin modal**
11. **Lint + tests + commit + deploy**
12. **Post-deploy** : monitoring, ajustements universe_config

## 15. Dépendances vers les autres sous-projets

- **Sub-projet 2 (Anomaly V4)** consomme les modules : combat resolution doit lire le loadout, drop rolls intégrés, refonte des 30 events pour leur faire utiliser charges/modules.
- **Sub-projet 3 (Tech tree)** : potentiellement gating de certains modules par techs débloquées (à valider, non requis V1).
- **Sub-projet 4 (Pirates loot)** : étend les sources d'acquisition.
