# Combat — Documentation de référence

> Source de vérité pour le système de combat post-refonte (2026-04-25).
> Toute divergence avec le code = bug du doc, à signaler.
>
> **Code** : [`packages/game-engine/src/formulas/combat.ts`](../../packages/game-engine/src/formulas/combat.ts)
> **Configuration** : [`packages/game-engine/src/formulas/combat-config.ts`](../../packages/game-engine/src/formulas/combat-config.ts)
> **Tests scénarios** : [`packages/game-engine/src/formulas/combat.scenarios.test.ts`](../../packages/game-engine/src/formulas/combat.scenarios.test.ts)
> **Patchnote refonte** : [`patchnotes/2026-04-25-refonte-combat.md`](../patchnotes/2026-04-25-refonte-combat.md)

## Vue d'ensemble

Un combat se joue en **rounds simultanés** (max 6 par défaut) entre une flotte attaquante et une combinaison flotte + défenses + bouclier planétaire défenseur. Chaque round, les deux camps tirent en même temps sur un snapshot pris en début de round, puis les dégâts sont appliqués et les boucliers régénérés.

Le combat s'arrête plus tôt si un camp est entièrement détruit. À la fin :
- L'**outcome** est `attacker`, `defender` ou `draw`
- Un **champ de débris** est généré (35 % du coût des vaisseaux détruits, M+S uniquement)
- Une fraction des défenses détruites est **réparée** automatiquement (50 %)
- Si l'attaquant gagne, il pille jusqu'à **33 %** des ressources non-protégées de la planète

## 1. Catégories de cibles

Chaque unité (vaisseau ou défense) appartient à une **catégorie** qui détermine qui peut la cibler et dans quel ordre :

| ID | Nom | Ciblable | Ordre |
|---|---|---|---|
| `light` | Léger | ✓ | 1 |
| `medium` | Moyen | ✓ | 2 |
| `heavy` | Lourd | ✓ | 3 |
| `shield` | Bouclier (planétaire) | ✓ | 4 |
| `defense` | Défense | ✓ | 5 |
| `support` | Support (cargos, sondes) | ✗ | 6 |

> Source : `combat-config.ts:COMBAT_CATEGORIES`. Les vaisseaux **support** (cargos, sondes, recycleurs) sont ignorés tant qu'il reste une cible ciblable. Ils ne sont touchés qu'en dernier recours, quand tout le reste est détruit.

## 2. Profils d'armes (weaponProfiles)

Chaque vaisseau et chaque défense expose une liste de **batteries** (`WeaponProfile[]`). Une batterie a :

- `damage` : dégâts par tir (avant bonus recherche)
- `shots` : nombre de tirs de base par round
- `targetCategory` : catégorie de cible naturelle de cette batterie
- `rafale?: { category, count }` : trait optionnel (cf. ci-dessous)
- `hasChainKill?: boolean` : trait optionnel (cf. ci-dessous)

Toutes les batteries d'une unité tirent **en parallèle** dans le round. Une frégate avec 2 batteries fait 2 salves indépendantes par round.

**Fallback legacy** : si une unité n'a pas de `weaponProfiles` configuré, le code synthétise une batterie unique à partir des `baseWeaponDamage` + `baseShotCount` historiques, ciblant `light` par défaut. Toutes les unités combat actuelles ont leur profil explicite.

## 3. Traits de combat

### Rafale N Catégorie

Quand la cible sélectionnée pour la salve appartient à la catégorie `rafale.category`, la batterie tire **N coups supplémentaires** au-delà de ses `shots` de base.

```
totalShots = shots + (firstTarget.category === rafale.category ? rafale.count : 0)
```

Exemple : la batterie secondaire du croiseur a `{ damage: 6, shots: 2, targetCategory: 'light', rafale: { category: 'light', count: 6 } }`. Quand sa première cible est légère → 8 coups (2 + 6) sur des cibles légères. Sinon → 2 coups normaux.

**Déterministe** : pas de RNG sur le déclenchement, juste un check de catégorie sur la première cible.

### Enchaînement (`hasChainKill`)

Quand un tir **détruit** sa cible, la batterie tire **un coup bonus** sur une autre unité de la même catégorie que celle détruite. Maximum 1 chaîne par tir de base — pas de réaction en chaîne infinie.

C'est l'identité des unités anti-essaim (intercepteur, lanceur de missiles, laser léger).

## 4. Profils en jeu

### Vaisseaux militaires

| Vaisseau | Cat. | Bouclier | Coque | Armure | Canon principal | Batterie secondaire |
|---|---|---:|---:|---:|---|---|
| **Intercepteur** | `light` | 6 | 12 | 1 | 4 dmg ×3 vs Léger + Enchaînement | — |
| **Frégate** | `medium` | 16 | 30 | 2 | 12 dmg ×1 vs Moyen | 6 dmg ×2 vs Léger |
| **Croiseur** | `heavy` | 32 | 55 | 4 | 35 dmg ×1 vs Lourd | 6 dmg ×2 vs Léger + Rafale 6 |
| **Cuirassé** | `heavy` | 40 | 120 | 6 | 50 dmg ×1 vs Lourd | 10 dmg ×2 vs Moyen + Rafale 4 |

### Défenses planétaires

| Défense | Cat. | Bouclier | Coque | Armure | Armement |
|---|---|---:|---:|---:|---|
| **Lanceur de missiles** | `light` | 8 | 14 | 1 | 6 dmg ×2 vs Léger + Enchaînement |
| **Artillerie laser légère** | `light` | 8 | 12 | 1 | 7 dmg ×3 vs Léger + Enchaînement |
| **Artillerie laser lourde** | `medium` | 18 | 35 | 3 | 15 dmg ×2 vs Moyen |
| **Canon électromagnétique** | `heavy` | 35 | 70 | 5 | 55 dmg ×1 vs Lourd |
| **Artillerie à ions** | `heavy` | 60 | 140 | 7 | 90 dmg ×1 vs Lourd |

> Source : `packages/db/src/seed-game-config.ts` (les valeurs en DB peuvent diverger si modifiées via l'admin — la seed est appliquée à chaque déploiement, voir [runbook](runbook.md)).

### Cargos et utilitaires (support, non-ciblables tant qu'autre chose reste)

Petit cargo, grand cargo, recycleur, sonde d'espionnage, vaisseau de colonisation, prospecteur, récupérateur, satellite solaire, explorateur. Tous catégorie `support`, profil légèrement défensif (bouclier/coque faible, dégâts symboliques) — mais ils ne ripostent pratiquement jamais en pratique car on cible ce qui menace en premier.

## 5. Calcul des dégâts

Pour chaque tir :

```
1. Bouclier absorbe d'abord
   - Si shield >= damage : shield -= damage. Coque intacte.
   - Sinon : surplus = damage - shield ; shield = 0
2. Armure réduit le surplus (plancher: minDamagePerHit = 1)
   - hullDamage = max(surplus - armor, minDamage)
3. Coque encaisse
   - hull -= hullDamage
   - Si hull <= 0 : unité détruite (l'overkill est tracké comme `overkillWasted`)
```

**Pas de bounce rule** : la règle « si dégâts < 1 % du bouclier max → 0 dégât » a été retirée à la refonte. Toujours `minDamagePerHit = 1` minimum quand un tir atteint la coque.

## 6. Bonus de recherche

Trois multiplicateurs s'appliquent **avant** la simulation, pas pendant :

- `weapons` : multiplie `damage` de chaque batterie
- `shielding` : multiplie `baseShield` (= `maxShield`)
- `armor` : multiplie **`baseArmor` ET `baseHull`** (la recherche Blindage donne plus d'armure ET plus de coque, c'est le seul qui touche 2 stats)

Ces multiplicateurs viennent de `resolveBonus('weapons' | 'shielding' | 'armor', null, userResearch, bonusDefs)`. Au niveau 0 → ×1. Recherche niveau 5 (linéaire +10 %/niv) → ×1.5.

Le calcul du multiplicateur est documenté dans [`game-mechanics.md` §5](game-mechanics.md#5-systeme-de-bonus).

## 7. Bouclier planétaire

Si la planète défenseur a le bâtiment **Bouclier planétaire**, une unité spéciale `__planetaryShield__` est injectée côté défenseur :

- Catégorie `shield`
- `shield: planetaryShieldCapacity`, `hull: 1`, `armor: 0`
- **Indestructible mais perçable** : une fois `shield = 0`, l'unité est marquée détruite **pour le reste du round** → les dégâts excédentaires passent aux défenses
- **Régénère intégralement à chaque début de round** (et le « 1 hp » est restauré)
- Sa capacité est multipliée par `defenderMultipliers.shielding` (recherche Blindage)
- Pas d'arme — le bouclier ne riposte pas

Conséquence stratégique : tant que les attaquants n'infligent pas plus que `planetaryShieldCapacity × shielding` de dégâts par round, les défenses ne prennent rien.

## 8. Sélection de cible

Pour chaque salve, la batterie sélectionne une cible parmi les unités vivantes du camp adverse :

1. **Priorité** : unité dont la catégorie === `targetCategory` de la batterie. Random parmi les éligibles.
2. **Fallback ordre** : si aucune unité de la catégorie cible, on parcourt les autres catégories `targetable` dans l'ordre `targetOrder` (light → medium → heavy → shield → defense).
3. **Dernier recours** : catégories `targetable: false` (les supports). Random.

Conséquence : un cuirassé qui n'a plus de cibles `heavy` ni `medium` ni `light` finira par taper sur les cargos, mais seulement quand il n'y a vraiment plus rien d'autre.

## 9. Déroulement d'un round

```
Pour chaque round (jusqu'à maxRounds = 6) :
  1. Si aucun vivant d'un côté → fin du combat
  2. Cloner l'état (snapshot début de round)
  3. Phase attaque : chaque attaquant vivant tire (toutes ses batteries)
                    sur les clones défenseur
  4. Phase défense : chaque défenseur vivant tire sur les clones attaquant
  5. Appliquer les dégâts du clone aux unités réelles (les deux camps)
  6. Snapshot post-dégâts (pour le rapport détaillé)
  7. Régénérer les boucliers de tous les survivants à 100 %
  8. Réveiller le bouclier planétaire si percé pendant le round
```

**Simultané** : les deux camps tirent sur des copies de l'état initial du round. Une frégate qui meurt au round 3 a quand même tiré ses 2 batteries au round 3.

**Régen bouclier** : à 100 % à chaque début de round, pas de progression entre rounds. Un cuirassé presque mort mais bouclier intact en fin de round 1 commence le round 2 avec son bouclier max.

## 10. Issue, débris, réparation, pillage

### Outcome

- `attacker` : défenseur sans unité ciblable vivante ET attaquant a des survivants
- `defender` : inverse
- `draw` : les deux camps ont des survivants après `maxRounds`

### Champ de débris

```
debris.minerai  = floor(0.35 × somme(coût_minerai des vaisseaux détruits, 2 camps))
debris.silicium = floor(0.35 × somme(coût_silicium des vaisseaux détruits, 2 camps))
```

> Seuls les **vaisseaux** comptent (filtrés via `shipIds`). Les défenses détruites ne génèrent **pas** de débris. L'hydrogène n'est jamais rendu en débris.

### Réparation des défenses

Pour chaque défense détruite côté défenseur, indépendamment : `random < 0.5` → réparée gratuitement après combat.

```
repairedDefenses[type] = compte de défenses détruites qui repop (loi binomiale)
```

### Pillage (gestion par `attack.handler`, pas le moteur combat)

Si l'attaquant gagne et que le défenseur a des ressources non-protégées :

```
ratio_pillage = 0.33 (combat_pillage_ratio)
butin_max = somme(ressources_non_protegees) × ratio_pillage / 3   par ressource
butin_effectif = min(butin_max, capacite_cargo_des_survivants)
```

Les ressources protégées (`calculateProtectedResources`) dépendent du niveau des entrepôts + recherche `armoredStorage` + talents joueur.

## 11. Configuration (universe_config)

Tous les paramètres ci-dessous sont des entrées de la table `universe_config`, modifiables via l'admin. Valeurs actuelles :

| Clé | Valeur | Effet |
|---|---:|---|
| `combat_max_rounds` | 6 | Nombre de rounds maximum |
| `combat_debris_ratio` | 0.35 | Fraction du coût récupérée en débris |
| `combat_defense_repair_rate` | 0.5 | Probabilité par défense détruite d'être réparée |
| `combat_pillage_ratio` | 0.33 | Fraction des ressources non-protégées pillable |
| `combat_min_damage_per_hit` | 1 | Dégâts mini quand un tir atteint la coque |
| `combat_research_bonus_per_level` | 0.1 | Inutilisé directement par le combat — laissé pour compat |

> Source : `packages/db/src/seed-game-config.ts` lignes 520-526. Le code charge ces valeurs via `buildCombatConfig(universe)` à chaque requête de combat (le cache `gameConfigService` les sert depuis la mémoire).

## 12. Déterminisme et tests

Le combat est **complètement déterministe** quand `rngSeed` est passé. Le moteur utilise `mulberry32` pour ne pas dépendre de `Math.random` dans les tests.

12 scénarios canoniques sont snapshotés dans `combat.scenarios.test.ts` :
1. small raid (5 intercepteurs vs planète vide)
2. mirror match (1 vs 1 intercepteur)
3. interceptor swarm vs frigate wall
4. cruiser sweep vs interceptor swarm
5. battlecruisers vs frigates (counter expectation)
6. balanced mixed fleet vs balanced mixed fleet
7-12. variations défenses, bouclier planétaire, multipliers, edge cases

**Toute modification de la logique combat fait tomber ces snapshots** — c'est le signal que tu dois revalider scenario par scenario avant de mettre à jour le `.snap`.

## 13. Logging détaillé (admin / debug)

`simulateCombat({ ..., detailedLog: true })` retourne en plus un `DetailedCombatLog` avec :
- `events` : liste de tous les `CombatEvent` (1 par tir : qui tire qui, dégâts, bouclier absorbé, armure bloquée, destroyed)
- `snapshots` : état des unités après chaque round
- `initialUnits` : état avant le round 1

Utilisé par le panel admin (`Player → Combat replay`) et par le mode debug. Coût mémoire significatif sur les gros combats (~100 KB pour 4 rounds × 200 unités) — désactivé par défaut en prod.
