# Protection blindée des ressources

## Contexte

Actuellement, lors d'une attaque, l'attaquant peut piller jusqu'à `lootRatio` (configurable, défaut 50%) des ressources stockées sur la planète. Le défenseur n'a aucun moyen de protéger ses ressources en dehors de dépenser ou transporter avant l'attaque.

Cette feature ajoute une **capacité blindée** : une portion des ressources est protégée et ne peut pas être pillée. Cela crée un "plancher" stratégique qui récompense l'investissement dans l'infrastructure défensive.

## Mécaniques

### Formule de pillage

**Actuelle** :
```
lootable = stock × lootRatio
```

**Nouvelle** :
```
protectedAmount = min(stock, protectedCapacity)
lootable = max(0, stock - protectedAmount) × lootRatio
```

Le `protectedAmount` ne peut pas dépasser le stock réel (pas de protection négative). Le `lootRatio` s'applique uniquement sur la portion non protégée.

### Protection de base (hangars)

Chaque hangar de ressource (minerai, silicium, hydrogène) fournit une capacité blindée proportionnelle à sa capacité de stockage :

```
baseProtected = storageCapacity × protectedStorageBaseRatio
```

- `protectedStorageBaseRatio` : nouvelle clé dans `gameConfig.universe`, défaut `0.05` (5%)
- La protection est calculée par ressource, à partir du hangar correspondant
- Exemple : Hangar Minerai Nv.8 = 100k capacité → 5k minerai protégés

### Recherche "Blindage des hangars"

Nouvelle recherche dans le tech tree. Chaque niveau amplifie la protection de base :

```
protectedCapacity = baseProtected × (1 + researchLevel × bonusPerLevel)
```

- `bonusPerLevel` : configuré dans `gameConfig.bonuses` via le système de bonus existant, role `armored_storage`, défaut `0.05` (+5% par niveau)
- Niveau 0 : protection de base uniquement (5% du stockage)
- Niveau 10 : 5% × 1.5 = 7.5% du stockage
- Niveau 20 : 5% × 2.0 = 10% du stockage

### Configuration dans gameConfig

**universe** :
- `protectedStorageBaseRatio` : `0.05`

**research** (nouvelle entrée) :
- id : `armoredStorage`
- name : `Blindage des hangars`
- description : `Renforce les hangars pour protéger une partie des ressources contre le pillage. Chaque niveau augmente la capacité blindée de 5%.`
- Coûts et temps : progression standard (à calibrer, mais typiquement minerai + silicium, scaling exponentiel)
- Prérequis : hangar minerai Nv.2 (le joueur doit avoir investi dans le stockage)

**bonuses** (nouvelle entrée) :
- role : `armored_storage`
- source : `research`
- sourceId : `armoredStorage`
- effect : `+0.05` par niveau (multiplicatif sur la base)

## Impact sur le combat (game-engine)

### Calcul du butin

Dans la fonction qui calcule le butin après combat (dans game-engine), modifier le calcul :

1. Récupérer les niveaux des hangars (storageMinerai, storageSilicium, storageHydrogene) pour calculer la capacité de stockage de chaque ressource
2. Calculer `protectedStorageBaseRatio` depuis la config
3. Récupérer le niveau de recherche `armoredStorage` du défenseur
4. Résoudre le bonus `armored_storage` via `resolveBonus`
5. Pour chaque ressource : `protectedCapacity = storageCapacity × baseRatio × (1 + bonus)`
6. `lootable = max(0, stock - protectedCapacity) × lootRatio`
7. Le butin est ensuite limité par la capacité cargo de l'attaquant (existant)

### Données à passer au calcul

Le calcul du butin doit recevoir en plus :
- Les capacités de stockage par ressource du défenseur
- Le niveau de recherche `armoredStorage` du défenseur
- La config (protectedStorageBaseRatio + bonuses)

### Rapport de combat

Ajouter dans le résultat du combat :
- `protectedResources: { minerai: number, silicium: number, hydrogene: number }` — les quantités protégées pour chaque ressource
- Ce champ est inclus dans le rapport de mission stocké en DB

## Frontend

### Page Recherche

La recherche "Blindage des hangars" apparaît dans la liste des recherches avec :
- Son icône (à définir, style bouclier + caisse)
- Ses coûts, temps, et prérequis
- Description : "Renforce les hangars pour protéger une partie des ressources contre le pillage."
- Aucun composant spécifique à créer : elle utilise le système de rendu de recherche existant, ajoutée via gameConfig

### Page Vue d'ensemble (Overview)

Dans les jauges circulaires de ressources, ajouter un indicateur visuel du seuil de protection :
- Une marque/ligne sur la jauge indiquant la limite de protection
- Tooltip au survol : "X minerai protégés contre le pillage"
- Si le stock est en dessous du seuil, la jauge entière est dans la zone "safe" — pas d'indicateur spécial nécessaire

### Page Bâtiments (détail hangar)

Dans la fiche de détail d'un hangar (EntityDetailOverlay), ajouter une ligne d'information :
- "Capacité blindée : X" (avec l'icône bouclier)
- Sous la ligne "Capacité de stockage : Y"
- Tooltip : "Cette quantité de ressources est protégée contre le pillage. Améliorez la recherche Blindage des hangars pour augmenter cette protection."

### Rapports de combat

Dans le rapport de combat côté défenseur, ajouter une section :
- "Ressources protégées" avec les 3 valeurs (minerai, silicium, hydrogène)
- Affiché uniquement si au moins une ressource a été protégée (protectedAmount > 0)
- Style : badges verts avec icône bouclier, similaire aux badges de butin existants

### Empire dashboard

Dans la vue Empire, pas de changement immédiat. La protection est une info de détail, pas un KPI global. Le joueur consulte ses hangars ou son overview pour voir sa protection.

## Scope

**Inclus** :
- Nouvelle config `protectedStorageBaseRatio` dans universe
- Nouvelle recherche `armoredStorage` dans gameConfig
- Nouveau bonus `armored_storage` dans le système de bonus
- Modification du calcul de butin dans game-engine
- Modification du rapport de combat pour inclure les ressources protégées
- Frontend : indicateur sur les jauges, info dans les hangars, section dans les rapports

**Exclu** :
- Pas de nouveau bâtiment dédié (la protection vient des hangars + recherche)
- Pas de protection contre l'espionnage (l'espion voit le stock réel)
- Pas de protection variable par type de mission (même formule pour toutes les attaques)
