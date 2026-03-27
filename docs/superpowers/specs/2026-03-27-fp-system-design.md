# Système de Facteur de Puissance (FP)

## Contexte

Les missions pirates PvE utilisent des templates à composition fixe avec des techs invisibles, rendant l'équilibrage opaque et la difficulté imprévisible pour le joueur. Le FP introduit une métrique unique et transparente pour mesurer la puissance de combat d'une flotte.

## Objectifs

1. **Outil d'équilibrage** — permettre au game designer de calibrer les templates et vérifier la progression easy→medium→hard
2. **Info joueur** — afficher un comparatif FP dans l'UI pour que le joueur évalue la difficulté avant d'envoyer sa flotte
3. **Génération dynamique** — scaler les flottes pirates en fonction du FP cible, adapté au niveau du centre et borné par la flotte du joueur

## Formule FP

```
FP(unité) = Math.round((weapons × shotCount^exponent) × (shield + hull) / divisor)
```

Paramètres univers (configurables dans l'admin) :
- `fp_shotcount_exponent` — exposant appliqué au shotCount (défaut : 1.5)
- `fp_divisor` — diviseur de normalisation (défaut : 100)

Le FP est **calculé dynamiquement** à partir des stats existantes des vaisseaux/défenses. Aucun FP n'est hardcodé.

### Valeurs de référence (avec paramètres par défaut)

| Vaisseau | Weapons | ShotCount | Shield | Hull | FP |
|----------|---------|-----------|--------|------|----|
| Intercepteur | 4 | 3 | 8 | 12 | **4** |
| Frégate | 12 | 2 | 16 | 30 | **16** |
| Croiseur | 45 | 1 | 28 | 55 | **37** |
| Cuirassé | 70 | 1 | 40 | 100 | **98** |

| Défense | Weapons | ShotCount | Shield | Hull | FP |
|---------|---------|-----------|--------|------|----|
| Lance-missiles | 5 | 2 | 6 | 10 | **2** |
| Laser léger | 7 | 3 | 8 | 12 | **5** |
| Laser lourd | 15 | 2 | 18 | 35 | **16** |
| Canon EM | 50 | 1 | 30 | 60 | **45** |
| Tourelle plasma | 80 | 1 | 50 | 120 | **136** |

### FP d'une flotte

```
FP(flotte) = somme( FP(type) × count ) pour chaque type de vaisseau
```

## Génération dynamique des pirates

### Suppression des techs pirates

Les templates pirates n'ont plus de champ `techs`. Les pirates combattent avec des multiplicateurs à 1.0 (pas de bonus de recherche). La difficulté repose uniquement sur la composition et le nombre de vaisseaux.

### Nouvelle structure des templates

```typescript
{
  id: string
  name: string
  tier: 'easy' | 'medium' | 'hard'
  ships: Record<string, number>  // ratios (ex: { interceptor: 3, frigate: 1 })
  rewards: {
    minerai: number
    silicium: number
    hydrogene: number
    bonusShips: { shipId: string; count: number; chance: number }[]
  }
}
```

Changements par rapport à l'existant :
- Suppression de `techs`
- Suppression de `centerLevelMin` / `centerLevelMax` (remplacés par les fourchettes FP par tier)
- Le champ `ships` représente des **ratios**, plus des comptes absolus

### Fourchettes FP par tier

Paramètres univers (configurables dans l'admin) :

| Paramètre | Description |
|-----------|-------------|
| `pirate_fp_easy_min` | FP minimum pour le tier facile |
| `pirate_fp_easy_max` | FP maximum pour le tier facile |
| `pirate_fp_medium_min` | FP minimum pour le tier moyen |
| `pirate_fp_medium_max` | FP maximum pour le tier moyen |
| `pirate_fp_hard_min` | FP minimum pour le tier difficile |
| `pirate_fp_hard_max` | FP maximum pour le tier difficile |
| `pirate_fp_player_cap_ratio` | Ratio max FP pirate / FP flotte joueur (ex: 0.8) |

### Calcul du FP cible

```
fp_brut = random(fp_min_tier, fp_max_tier) × centerLevel
fp_cible = min(fp_brut, FP_flotte_joueur × pirate_fp_player_cap_ratio)
```

### Algorithme de scaling incrémental

1. Calculer le FP de base du template (ratios × 1)
2. Tant que FP_courant < FP_cible :
   - Parcourir les types de vaisseaux du template en suivant les ratios
   - Ajouter 1 vaisseau du type le plus sous-représenté par rapport au ratio
   - Recalculer FP_courant
3. Si le dernier ajout dépasse FP_cible, le retirer si l'écart est plus grand avec qu'avant

### Scaling des récompenses

Les récompenses du template sont scalées proportionnellement :

```
reward_final = Math.floor(reward_base × (FP_final / FP_base))
```

Les bonus ships ne sont pas scalés (restent fixes du template).

## Affichage joueur

### Carte de mission pirate

Affiche le FP de la flotte pirate à la place de la composition détaillée. Le joueur connaît la difficulté mais pas la composition exacte (révélée dans le rapport de combat).

### Écran d'envoi de flotte (missions pirates)

Comparatif dynamique mis à jour en temps réel :

```
Ta flotte : 72 FP  |  Pirates : 102 FP
```

- Le FP pirate est stocké dans les paramètres de la mission PvE à la génération
- Le FP joueur est calculé côté client à partir des stats vaisseaux de la game config (pas d'appel API)
- Pas d'indicateur qualitatif (pas de texte "Risqué" / "Favorable"), juste les chiffres

## Admin

### Page vaisseaux / défenses

Chaque vaisseau et défense affiche son FP calculé (lecture seule, recalculé depuis les stats).

### Page paramètres univers

Nouveaux champs :
- `fp_shotcount_exponent` (défaut : 1.5)
- `fp_divisor` (défaut : 100)
- `pirate_fp_easy_min` / `pirate_fp_easy_max`
- `pirate_fp_medium_min` / `pirate_fp_medium_max`
- `pirate_fp_hard_min` / `pirate_fp_hard_max`
- `pirate_fp_player_cap_ratio`

### Page templates pirates

- Suppression du champ `techs`
- Le champ `ships` passe de comptes absolus à des ratios
- Suppression des champs `centerLevelMin` / `centerLevelMax`
- Affichage du FP de base du template (calculé, lecture seule)
- Les récompenses de base restent, scalées au runtime

## Impact sur le code existant

### Fichiers à modifier

- `packages/db/src/schema/pve-missions.ts` — supprimer colonnes techs, centerLevelMin/Max de pirateTemplates
- `packages/db/src/seed-game-config.ts` — mettre à jour les templates (ratios, sans techs) + ajouter paramètres univers FP
- `packages/game-engine/src/formulas/` — nouvelle fonction `computeFP()` + `scaleFleetToFP()`
- `apps/api/src/modules/pve/pirate.service.ts` — refondre `pickTemplate()` et `processPirateArrival()` (supprimer techs, ajouter scaling)
- `apps/api/src/modules/fleet/handlers/pirate.handler.ts` — adapter au nouveau format (plus de techs pirates)
- `apps/web/` — afficher FP sur carte de mission + comparatif dans écran d'envoi
- `apps/admin/src/pages/PveMissions.tsx` — adapter le formulaire (supprimer techs, ratios, afficher FP calculé)
- `apps/admin/src/pages/Universe.tsx` — ajouter les paramètres FP
- Migration DB pour supprimer les colonnes obsolètes
