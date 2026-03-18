# Refonte des cartes de detail — donnees DB dynamiques

## Probleme

Les cartes de detail (EntityDetailOverlay) affichent les informations des batiments, vaisseaux, defenses et recherches aux joueurs. Actuellement, elles lisent 100% de leurs donnees depuis des constantes hardcodees du package `game-engine`, ignorant completement les valeurs configurees en DB via le panneau admin. Modifier un cout, un nom ou un prerequis dans l'admin n'a aucun effet sur les cartes.

## Solution

Brancher les cartes de detail sur le `gameConfig` (donnees DB via tRPC) et ajouter les champs manquants (flavor texts, effect descriptions) en DB.

## 1. Schema DB — nouveaux champs

Migration SQL manuelle (`0004_detail_card_texts.sql`) ajoutant des colonnes `TEXT` nullable.

Schema Drizzle a modifier : `packages/db/src/schema/game-config.ts` (fichier unique contenant toutes les tables de config).

| Table Drizzle | Colonne | Usage |
|---------------|---------|-------|
| `buildingDefinitions` | `flavor_text` | Texte narratif immersif |
| `researchDefinitions` | `flavor_text` | Texte narratif immersif |
| `researchDefinitions` | `effect_description` | Description mecanique de l'effet (ex: "+5% degats par niveau") |
| `shipDefinitions` | `flavor_text` | Texte narratif immersif |
| `defenseDefinitions` | `flavor_text` | Texte narratif immersif |

Le seed (`seed-game-config.ts`) est mis a jour pour injecter les textes actuellement hardcodes dans `entity-details.ts`.

## 2. GameConfig — exposer les nouveaux champs

### Interfaces TypeScript

Etendre les interfaces dans `game-config.service.ts` :

- `BuildingConfig` : ajouter `flavorText: string | null`
- `ShipConfig` : ajouter `flavorText: string | null`
- `DefenseConfig` : ajouter `flavorText: string | null`
- `ResearchConfig` : ajouter `flavorText: string | null`, `effectDescription: string | null`

### Mapping dans getFullConfig()

Le `getFullConfig()` mappe explicitement chaque champ dans les objets de config (pas de spread). Les nouveaux champs doivent etre ajoutes dans le mapping :

- Section buildings (~ligne 214) : ajouter `flavorText: b.flavorText`
- Section ships (~ligne 255) : ajouter `flavorText: s.flavorText`
- Section defenses (~ligne 275) : ajouter `flavorText: d.flavorText`
- Section research (~ligne 235) : ajouter `flavorText: r.flavorText, effectDescription: r.effectDescription`

### Mutations admin

Ajouter les champs optionnels dans les schemas Zod des mutations `create*` ET `update*` :

- `createBuilding` / `updateBuilding` : `flavorText: z.string().nullable().optional()`
- `createShip` / `updateShip` : `flavorText: z.string().nullable().optional()`
- `createDefense` / `updateDefense` : `flavorText: z.string().nullable().optional()`
- `createResearch` / `updateResearch` : `flavorText: z.string().nullable().optional()`, `effectDescription: z.string().nullable().optional()`

### Pages admin

Ajouter un champ `textarea` "Texte d'ambiance" dans les `EditModal` des pages Buildings, Ships, Defenses et Research. Pour Research, ajouter aussi "Description d'effet".

## 3. Branchement des cartes de detail sur gameConfig

### Composants de detail

Les 4 composants (`BuildingDetailContent`, `ShipDetailContent`, `DefenseDetailContent`, `ResearchDetailContent`) appellent chacun `useGameConfig()` directement (cache React Query, pas de requete supplementaire) et passent `data` a `getXxxDetails(id, config)`.

Note : actuellement 3 des 4 composants n'importent meme pas `useGameConfig` — il faut l'ajouter.

### Interface locale GameConfigData

L'interface `GameConfigData` dans `entity-details.ts` (lignes 13-19) doit etre etendue pour inclure les nouveaux champs (`flavorText`, `effectDescription`) sur les types correspondants.

### entity-details.ts — source de donnees

Les fonctions `getXxxDetails()` lisent prioritairement depuis le config DB :

- **Noms, descriptions, couts, prerequis** : `config.buildings[id]`, `config.ships[id]`, etc.
- **Flavor texts** : `config.buildings[id].flavorText` (au lieu du dictionnaire hardcode)
- **Effect descriptions** : `config.research[id].effectDescription` (au lieu du dictionnaire hardcode)
- **Stats de combat** (weapons, shield, armor) : `config.ships[id].weapons`, `config.defenses[id].armor`, etc. (au lieu de `COMBAT_STATS`)
- **Stats de mouvement** (speed, fuel, cargo) : `config.ships[id].baseSpeed`, etc. (au lieu de `SHIP_STATS`)
- **Rapid fire** : `config.rapidFire` (au lieu de `RAPID_FIRE`)
- **Tables de production** : fonctions mathematiques du game-engine avec parametres issus de `config.production`

Fallback sur les constantes game-engine si config absent (garde de securite, ne devrait pas arriver en pratique). Les imports game-engine utilises pour le fallback sont conserves mais marques comme fallback uniquement.

## 4. Nettoyage

- Supprimer les dictionnaires de flavor texts et effect descriptions hardcodes dans `entity-details.ts` (lignes 25-91)
- Conserver les imports `BUILDINGS`, `SHIPS`, `DEFENSES`, `RESEARCH`, `COMBAT_STATS`, `SHIP_STATS` comme fallback si config absent
- Les constantes game-engine restent dans le package (utilisees cote serveur) — on ne les supprime pas
- Les fonctions de formules (production, energie, stockage) restent importees du game-engine

## Notes

- **Pas d'effect_description pour les batiments** : les effets des batiments (production, energie, stockage) sont des tables calculees a partir de formules mathematiques parametrees par `config.production`. Seules les recherches ont un texte d'effet editable.
- **Cache frontend** : `useGameConfig` a un `staleTime` de 5 minutes. Les modifications admin seront visibles par les joueurs au prochain rafraichissement du cache (max 5 min). Comportement acceptable.

## Fichiers impactes

### DB / Backend
- `packages/db/src/schema/game-config.ts` — ajout colonnes `flavor_text` sur buildingDefinitions, shipDefinitions, defenseDefinitions ; `flavor_text` + `effect_description` sur researchDefinitions
- `packages/db/drizzle/0004_detail_card_texts.sql` — migration manuelle
- `packages/db/drizzle/meta/_journal.json` — nouvelle entree
- `packages/db/src/seed-game-config.ts` — seeder les flavor texts et effect descriptions
- `apps/api/src/modules/admin/game-config.service.ts` — etendre interfaces + mapping getFullConfig()
- `apps/api/src/modules/admin/game-config.router.ts` — etendre schemas Zod (create + update)

### Admin
- `apps/admin/src/pages/Buildings.tsx` — champ textarea flavorText
- `apps/admin/src/pages/Ships.tsx` — champ textarea flavorText
- `apps/admin/src/pages/Defenses.tsx` — champ textarea flavorText
- `apps/admin/src/pages/Research.tsx` — champs textarea flavorText + effectDescription

### Frontend (cartes de detail)
- `apps/web/src/lib/entity-details.ts` — refonte source de donnees, suppression dictionnaires hardcodes, extension interface GameConfigData
- `apps/web/src/components/entity-details/BuildingDetailContent.tsx` — ajouter useGameConfig, passer config
- `apps/web/src/components/entity-details/ShipDetailContent.tsx` — ajouter useGameConfig, passer config
- `apps/web/src/components/entity-details/DefenseDetailContent.tsx` — ajouter useGameConfig, passer config
- `apps/web/src/components/entity-details/ResearchDetailContent.tsx` — ajouter useGameConfig, passer config
