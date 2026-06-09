# Niveau d'empire — spec technique

> **Statut** : spec validée en session (brainstorm du 2026-06-09, cf. `docs/proposals/2026-06-09-modernisation-4x-empire.md` §5).
> **Branche** : `feat/empire-level`. Migration : `0094`.

## 1. Design (décisions actées)

Le bâtiment **Centre de Pouvoir Impérial** (IPC) est supprimé. Ses effets sont repris par un **niveau d'empire** alimenté par de l'XP gagnée en jouant.

**Règle d'or — séparation niveau / exilium :**
- **Niveau d'empire** = tout ce qui est **permanent et structurel** : capacité de gouvernance, niveau de missions, (à terme : slots de politiques, paliers flagship). Automatique, jamais de régression.
- **Exilium** = tout ce qui est **opérationnel et consommable** : réparation flagship (existant), édits temporaires (futur). N'achète **jamais** de bonus permanent.

Attribut de **l'empire** (pas du joueur) : reset si saisons un jour.

## 2. XP — sources et grille v1

Pattern : mirror de `dailyQuestService.processEvent` — le service `empireProgressionService.processEvent(event)` est appelé aux mêmes sites d'émission. Grille dans `universe_config` (clé par source) :

| Source (`empire_xp_log.source`) | Événement | XP v1 |
|---|---|---|
| `building` | construction terminée (worker) | `2 × niveau atteint` (`empire_xp_per_building_level`) |
| `research` | recherche terminée (worker) | `5 × niveau atteint` (`empire_xp_per_research_level`) |
| `pve` | victoire PvE (pirate.handler) | `15` flat (`empire_xp_pve_victory`) |
| `pvp` | victoire PvP attaquant (attack.handler) | `40` flat (`empire_xp_pvp_victory`) |
| `colonization` | colonisation aboutie | `150` (`empire_xp_colonization`) |
| `admin` | ajustement admin | manuel |

Pas d'XP sur : ressources collectées, flotte expédiée, marché (macro-ables → grind). Les daily quests restent 100 % exilium (assiduité). Jalons uniques étendus = v2.

## 3. Formules (game-engine, `formulas/empire-level.ts`)

- **Courbe** : XP cumulée pour atteindre le niveau L : `empire_xp_curve_base × (L-1) × L / 2` (quadratique, même forme que l'ex-flagship-xp). Base v1 : `100`. Niveau 1=0 XP (départ), niv 2=100, niv 5=1000, niv 10=4500, niv 20=19000. **Le niveau affiché démarre à 1** (un empereur niveau 0, ça ne se dit pas) ; en interne xp=0 → level=1.
- **Capacité de gouvernance** : `1 + floor((level - 1) / empire_capacity_levels_per_colony)` (v1 : `2`). Level 1 → 1 (équivalent IPC 0), level 3 → 2, level 19 → 10.
- **Plancher grandfathered** : `capacité = max(formule, governance_floor)` où `governance_floor = 1 + niveau IPC archivé` (migration). Personne ne perd de colonie ; le plancher devient obsolète quand le niveau rattrape.
- **Niveau de missions** : `mission_default_level + floor((level - 1) / empire_mission_levels_per_bonus)` (v1 : `5`). Level 1 → 3 (continuité avec l'existant), level 6 → 4…
- **Scaling coût colonisation** : remplace `ipcLevel` par `(capacité - 1)` dans `scaleCost` (même intention : plus d'envergure administrative = entretien colonial plus cher).
- **Flagship** : hooks à terme (coques gatées par niveau, bonus aux paliers) — PAS dans cette implémentation, juste noté ici.
- Cap : `empire_level_max` (v1 : `100`, libre).

## 4. DB (migration 0094)

```
empire_progression  (user_id PK → users CASCADE, xp bigint ≥0 default 0,
                     level int default 1, governance_floor int default 0,
                     created_at, updated_at)
empire_xp_log       (id uuid PK, user_id → users CASCADE, amount int,
                     source varchar(32), details jsonb, created_at,
                     index (user_id, created_at))   — mirror exilium_log
```

Migration 0094 :
1. CREATE les 2 tables.
2. Seed `empire_progression` pour les joueurs ayant un IPC > 0 sur leur homeworld : `governance_floor = 1 + level` (archivage du grandfathering). Pas de remboursement, pas d'XP de départ — tout le monde démarre niveau 1.
3. DELETE `build_queue` / `planet_buildings` / `building_definitions` pour `imperialPowerCenter` ; DELETE `entity_categories` `building_gouvernance` (l'IPC en était le seul membre, aucun prérequis ne pointe vers lui).
4. INSERT des clés `universe_config` (ON CONFLICT DO NOTHING ; le seed upsert aussi).

Seed : retirer la définition IPC + la catégorie gouvernance ; ajouter les clés config (§2, §3).

## 5. API

- **Module `empire-progression`** : service (`getOrCreate`, `award(userId, amount, source, details)` — transactionnel, recalcule le niveau, log, notification `empire-level-up` si passage de niveau —, `getProgression`, `processEvent`) + router tRPC `empireProgression.get` → `{ xp, level, nextLevelXp, currentLevelXp, capacity, governanceFloor, missionLevel }`.
- **Câblage** : instancié dans `app-router.ts` + passé aux `Services` du build-completion worker et aux handlers fleet (même chemin optionnel que `dailyQuestService`).
- **Émissions** : worker build-completion (building + research, niveau dans `notificationPayload.level`), pirate.handler (pve:victory), attack.handler (pvp:battle_resolved si attaquant vainqueur), site de complétion de colonisation.
- **Consommateurs migrés** : `lib/governance.ts`, `cron/resource-tick.ts` (lecture en masse d'`empire_progression`), `colonization.service.ts` (`getIpcLevel` → capacité par niveau), `player-admin.service.ts`, `pve.service.getMissionCenterLevel`.
- L'endpoint `colonization.governance` expose `empireLevel` à la place d'`ipcLevel`.

## 6. Web

- **Retrait IPC** : `Infrastructures.tsx`, `BuildingDetailContent.tsx` (+ `GovernanceSection`), `InfrastructuresHelp.tsx`.
- **Page Empire** : carte « Niveau d'empire » (niveau, barre d'XP, prochaine capacité/mission débloquée) + `EmpireGovernanceBanner` mis à jour (copies « améliorez le Centre de Pouvoir » → « gagnez des niveaux d'empire », champ `ipcLevel` → `empireLevel`).
- **Toast level-up** : notification SSE `empire-level-up`, même chemin que `daily-quest-completed`.
- `GovernanceAlert` (overview) : copie mise à jour.

## 7. Équilibrage initial (tout en `universe_config`, à retuner sur données réelles)

Pacing visé : capacité 2 (≃ ex-IPC 1) vers niveau 3 ≈ 2-3 jours de jeu actif early game ; un joueur actif gagne ~150-400 XP/jour en early (constructions ~niveau 5-15 + quelques missions). L'ex-joueur IPC 9 (capacité 10) doit atteindre le niveau 19 pour dépasser son plancher — il en profite sans y être contraint.
