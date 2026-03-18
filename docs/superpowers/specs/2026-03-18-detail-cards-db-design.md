# Refonte des cartes de detail — donnees DB dynamiques

## Probleme

Les cartes de detail (EntityDetailOverlay) affichent les informations des batiments, vaisseaux, defenses et recherches aux joueurs. Actuellement, elles lisent 100% de leurs donnees depuis des constantes hardcodees du package `game-engine`, ignorant completement les valeurs configurees en DB via le panneau admin. Modifier un cout, un nom ou un prerequis dans l'admin n'a aucun effet sur les cartes.

## Solution

Brancher les cartes de detail sur le `gameConfig` (donnees DB via tRPC) et ajouter les champs manquants (flavor texts, effect descriptions) en DB.

## 1. Schema DB — nouveaux champs

Migration SQL ajoutant des colonnes `TEXT` nullable :

| Table | Colonne | Usage |
|-------|---------|-------|
| `buildings` | `flavor_text` | Texte narratif immersif |
| `research` | `flavor_text` | Texte narratif immersif |
| `research` | `effect_description` | Description mecanique de l'effet (ex: "+5% degats par niveau") |
| `ships` | `flavor_text` | Texte narratif immersif |
| `defenses` | `flavor_text` | Texte narratif immersif |

Le seed (`seed-game-config.ts`) est mis a jour pour injecter les textes actuellement hardcodes dans `entity-details.ts`.

## 2. GameConfig — exposer les nouveaux champs

### Interfaces TypeScript

Etendre les interfaces dans `game-config.service.ts` :

- `BuildingConfig` : ajouter `flavorText: string | null`
- `ShipConfig` : ajouter `flavorText: string | null`
- `DefenseConfig` : ajouter `flavorText: string | null`
- `ResearchConfig` : ajouter `flavorText: string | null`, `effectDescription: string | null`

Les requetes `SELECT *` dans `getFullConfig()` retournent deja ces colonnes — seule l'interface TypeScript change.

### Mutations admin

Ajouter les champs optionnels dans les schemas Zod des mutations existantes :

- `updateBuilding` : `flavorText: z.string().nullable().optional()`
- `updateShip` : `flavorText: z.string().nullable().optional()`
- `updateDefense` : `flavorText: z.string().nullable().optional()`
- `updateResearch` : `flavorText: z.string().nullable().optional()`, `effectDescription: z.string().nullable().optional()`

### Pages admin

Ajouter un champ `textarea` "Texte d'ambiance" dans les `EditModal` des pages Buildings, Ships, Defenses et Research. Pour Research, ajouter aussi "Description d'effet".

## 3. Branchement des cartes de detail sur gameConfig

### Composants de detail

Les 4 composants (`BuildingDetailContent`, `ShipDetailContent`, `DefenseDetailContent`, `ResearchDetailContent`) appellent `useGameConfig()` et passent `data` a `getXxxDetails(id, config)`.

### entity-details.ts — source de donnees

Les fonctions `getXxxDetails()` lisent prioritairement depuis le config DB :

- **Noms, descriptions, couts, prerequis** : `config.buildings[id]`, `config.ships[id]`, etc.
- **Flavor texts** : `config.buildings[id].flavorText` (au lieu du dictionnaire hardcode)
- **Effect descriptions** : `config.research[id].effectDescription` (au lieu du dictionnaire hardcode)
- **Stats de combat** (weapons, shield, armor) : `config.ships[id].weapons`, `config.defenses[id].armor`, etc. (au lieu de `COMBAT_STATS`)
- **Stats de mouvement** (speed, fuel, cargo) : `config.ships[id].baseSpeed`, etc. (au lieu de `SHIP_STATS`)
- **Rapid fire** : `config.rapidFire` (au lieu de `RAPID_FIRE`)
- **Tables de production** : fonctions mathematiques du game-engine avec parametres issus de `config.production`

Fallback sur les constantes game-engine si config absent (ne devrait pas arriver en pratique).

## 4. Nettoyage

- Supprimer les imports `COMBAT_STATS`, `SHIP_STATS`, `RAPID_FIRE`, `BUILDINGS`, `SHIPS`, `DEFENSES`, `RESEARCH` dans `entity-details.ts`
- Supprimer les dictionnaires de flavor texts et effect descriptions hardcodes dans `entity-details.ts` (lignes 25-91)
- Les constantes game-engine restent dans le package (utilisees cote serveur) — on supprime uniquement leur usage frontend pour les cartes de detail
- Les fonctions de formules (production, energie, stockage) restent importees du game-engine

## Fichiers impactes

### DB / Backend
- `packages/db/src/schema/buildings.ts` — ajout colonne `flavor_text`
- `packages/db/src/schema/research.ts` — ajout colonnes `flavor_text`, `effect_description`
- `packages/db/src/schema/ships.ts` — ajout colonne `flavor_text`
- `packages/db/src/schema/defenses.ts` — ajout colonne `flavor_text`
- `packages/db/drizzle/0004_detail_card_texts.sql` — migration
- `packages/db/drizzle/meta/_journal.json` — nouvelle entree
- `packages/db/src/seed-game-config.ts` — seeder les flavor texts et effect descriptions
- `apps/api/src/modules/admin/game-config.service.ts` — etendre interfaces
- `apps/api/src/modules/admin/game-config.router.ts` — etendre schemas Zod

### Admin
- `apps/admin/src/pages/Buildings.tsx` — champ textarea flavorText
- `apps/admin/src/pages/Ships.tsx` — champ textarea flavorText
- `apps/admin/src/pages/Defenses.tsx` — champ textarea flavorText
- `apps/admin/src/pages/Research.tsx` — champs textarea flavorText + effectDescription

### Frontend (cartes de detail)
- `apps/web/src/lib/entity-details.ts` — refonte source de donnees, suppression hardcode
- `apps/web/src/components/entity-details/BuildingDetailContent.tsx` — passer gameConfig
- `apps/web/src/components/entity-details/ShipDetailContent.tsx` — passer gameConfig
- `apps/web/src/components/entity-details/DefenseDetailContent.tsx` — passer gameConfig
- `apps/web/src/components/entity-details/ResearchDetailContent.tsx` — passer gameConfig
