# Fusion des chantiers — le Centre de commandement absorbé par le Chantier spatial

> **Statut** : spec — demande user (« on s'y perd avec trop de bâtiments différents »).
> **Périmètre** : les deux bâtiments de construction de **vaisseaux** fusionnent. L'**Arsenal planétaire** (défenses) n'est pas touché — extension possible plus tard si le besoin de simplification persiste.

## Design

Un seul bâtiment construit tous les vaisseaux : **le Chantier spatial** (`shipyard`), description « Débloque et construit tous les vaisseaux ». Le `commandCenter` disparaît. Les deux avaient la même courbe de coût (400/200/100, ×2) — la fusion est donc exactement compensable.

| Décision | Choix | Pourquoi |
|---|---|---|
| Niveau fusionné | `max(chantier, centre)` par planète | personne ne perd un débloquage |
| **Compensation** | remboursement intégral des niveaux 1..`min` (400/200/100 × (2^min − 1)), crédité sur la planète | courbes identiques → remboursement exact de l'investissement redondant |
| Prérequis vaisseaux militaires | `commandCenter N` → `shipyard N` (interceptor 1, frigate 3, cruiser 5, battlecruiser 7) | aucun joueur ne perd l'accès (fusionné = max ≥ centre) ; pacing early légèrement plus rapide pour les nouveaux, les recherches gardent le vrai gate |
| Files de production | une seule facility `shipyard`, **2 cales de base** (+1 au niveau 10, +1 au 20) | préserve la concurrence 1+1 d'avant ; ancien max (4 avec les 2 bâtiments ≥10) conservé via les paliers |
| Bonus de temps (−15 %/niv) | porté par le chantier pour TOUTES les catégories (2 défs `build_industrial`/`build_military`, sourceId `shipyard`) | au niveau max(), les vaisseaux militaires construisent plus vite qu'avant si centre < chantier — buff assumé |
| Catégorie de build (coques) | dérivée du **vaisseau** (`combatCategoryId === 'support'` → industriel, sinon militaire) au lieu du bâtiment-prérequis | l'identité des coques (combat/industrielle) continue de s'appliquer |
| Tutoriel (quest_17 « État d'alerte ») | re-ciblée : Chantier spatial niveau 3 | ~même timing ; déjà-complétées intactes, en-cours auto-validées si chantier ≥ 3 |
| Pages web | la page Chantier gagne des onglets **Industriels / Militaires** ; `/command-center` redirige | un bâtiment = une page ; un onglet planète de moins (la simplification demandée) |

## Migration `0099` (transaction)

1. `ship_prerequisites` : `commandCenter` → `shipyard` (avant le DELETE, sinon le CASCADE les emporte).
2. Par planète : refund (stocks de la planète), `shipyard.level = max`, suppression de la ligne `commandCenter` de `planet_buildings`.
3. `build_queue` : upgrades de `commandCenter` en cours/en file → annulés + refund du coût du niveau visé ; `facility_id = 'commandCenter'` → `'shipyard'` pour les vaisseaux.
4. `bonus_definitions` : DELETE `commandCenter__ship_build_time__build_military` (le seed insère la version `shipyard__…`).
5. `building_definitions` : DELETE `commandCenter` (cascade `building_prerequisites`).

**Backup obligatoire avant** (migration destructive). Reseed requis (seed modifié : bâtiment, prérequis, bonus, quête).

## Code

- **api/shipyard.service** : `getFacilityId` (ship → `shipyard`), `getShipBuildCategory` (par vaisseau), cales = 2 + `shipyard_parallel_build`, branches `commandCenter` supprimées.
- **api/talent.service** : `shipyard_parallel_build` = +1 (niv ≥ 10) +1 (niv ≥ 20) ; clés `military/industrial_parallel_build` supprimées.
- **web** : Shipyard.tsx à onglets (catalogue industriel/militaire, une file), CommandCenter.tsx supprimée + redirect, entrée de nav planète retirée, aides fusionnées, références `commandCenter` nettoyées (Overview/EmpirePlanetCard/Infrastructures).

## À annoncer aux joueurs (au déploiement)

Fusion + compensation automatique (« les ressources investies en double vous sont remboursées »), nouvelle règle des cales (2 de base), et l'onglet Centre de commandement qui disparaît au profit des onglets du Chantier.
