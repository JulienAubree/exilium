# Marche de rapports d'exploration

## Contexte

Le systeme d'exploration planetaire permet aux joueurs d'envoyer des explorateurs pour decouvrir les biomes des positions vides dans la galaxie. Ces decouvertes sont per-player (fog of war) et stockees dans `discovered_biomes` / `discovered_positions`. Actuellement, cette connaissance n'a aucune valeur marchande : un joueur qui a entierement cartographie un systeme ne peut pas en faire profiter les autres.

L'objectif est de permettre aux joueurs de transformer leurs decouvertes en rapports vendables sur le marche galactique, creant un role de "cartographe/explorateur" qui produit de l'intelligence vendable. Les acheteurs obtiennent la connaissance d'une position (type de planete + biomes) sans avoir a envoyer de missions d'exploration.

## Principes de conception

- **Rapport = objet consommable unique** : un rapport est un snapshot fige des connaissances du vendeur sur une position au moment de la creation. Il est vendu une seule fois (exemplaire unique).
- **Livraison instantanee** : l'achat transfere immediatement les biomes et la position au `discovered_biomes` / `discovered_positions` de l'acheteur. Pas de flotte cargo — c'est de la donnee, pas du minerai.
- **Cout de creation en hydrogene** : l'hydrogene etant la ressource rare du jeu, la creation de rapport est un investissement mid-game. Le cout scale avec la rarete des biomes contenus.
- **Reutilisation du marche existant** : les rapports sont vendus via le meme systeme de marche que les ressources (meme commission, meme duree, meme UX de listing).
- **Opacite partielle** : le listing du marche montre la galaxie et le systeme mais PAS la position exacte (`[g:s:?]`). Le detail des biomes (noms, effets) n'est revele qu'apres achat.

## Scope et hors-scope

### Dans le scope
- Creation de rapports vendables depuis le rapport de mission d'exploration ET depuis la vue galaxie
- Nouveau modele de donnees `exploration_reports` (objet avec lifecycle)
- Extension de `market_offers` pour porter sur un rapport
- Nouvel onglet "Rapports" sur la page marche (acheter + mes rapports)
- Cout de creation en hydrogene (scaling par rarete)
- Commission vendeur identique aux ressources
- Ecriture instantanee des biomes + position chez l'acheteur a l'achat
- Garde-fous : pas de doublon position, pas d'achat si tout deja connu

### Hors scope
- Cartes systeme (vente en bloc d'un systeme entier — backlog futur)
- Copies multiples d'un rapport (exemplaire unique)
- Livraison par flotte
- Systeme d'encheres
- Nouveau batiment ou nouvelle recherche

## Modele de donnees

### Nouvelle table `exploration_reports`

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID PK | |
| `ownerId` | UUID FK users | Le joueur qui possede actuellement le rapport |
| `creatorId` | UUID FK users | Le joueur qui a cree le rapport (immuable) |
| `galaxy` | smallint | Coordonnee galaxie de la position cible |
| `system` | smallint | Coordonnee systeme de la position cible |
| `position` | smallint | Coordonnee position de la cible |
| `planetClassId` | varchar | Type de planete au moment de la creation |
| `biomes` | jsonb | Snapshot fige : `Array<{ id: string; name: string; rarity: string; effects: unknown }>` |
| `biomeCount` | smallint | Nombre de biomes (denormalise pour tri/filtre) |
| `maxRarity` | varchar | Rarete la plus elevee (`common`→`legendary`, denormalise pour filtre) |
| `isComplete` | boolean | Vrai si le rapport contenait TOUS les biomes de la position |
| `creationCost` | numeric(20,2) | Hydrogene depense (pour historique) |
| `status` | enum | `'inventory'`, `'listed'`, `'sold'`, `'consumed'` |
| `createdAt` | timestamp | |

Index : `(ownerId, status)` pour lister rapidement l'inventaire, `(galaxy, system, status)` pour les requetes marche.

**Pourquoi un snapshot JSONB ?** Le rapport est un objet fige au moment de la creation. Si le vendeur explore davantage apres la creation, le rapport ne change pas. Ca evite aussi les edge cases ou les decouvertes du vendeur changeraient apres la vente.

### Extension de `market_offers`

Ajouter un champ nullable :

```
explorationReportId UUID FK exploration_reports NULLABLE
```

Quand non-null, l'offre porte sur un rapport d'exploration (pas sur une ressource). Les champs `resourceType` / `quantity` sont null dans ce cas.

Discrimination : `explorationReportId IS NOT NULL` = offre de rapport, sinon = offre de ressource classique.

Le `resourceType` enum existant (`minerai | silicium | hydrogene`) n'est PAS modifie.

## Cout de creation

### Formule

```
cout_hydrogene = BASE_COST + SUM(rarityCost[biome.rarity] pour chaque biome du rapport)
```

### Bareme

| Constante | Valeur | Config |
|-----------|--------|--------|
| `BASE_COST` | 200 | `universe.report_creation_base_cost` |

| Rarete | Cout additionnel par biome |
|--------|---------------------------|
| common | +50 |
| uncommon | +100 |
| rare | +250 |
| epic | +600 |
| legendary | +1000 |

Stocke dans un `universe` config `report_creation_biome_costs` (jsonb) pour ajustement sans deploiement.

### Exemples

- 2 biomes communs : `200 + 50 + 50 = 300 hydrogene`
- 1 rare + 1 epic : `200 + 250 + 600 = 1050 hydrogene`
- 1 legendaire + 2 communs + 1 rare : `200 + 1000 + 50 + 50 + 250 = 1550 hydrogene`

### Commission a la mise en vente

Meme systeme que les ressources : le vendeur paye 5% de la valeur de l'offre (en minerai/silicium/hydrogene selon le prix fixe). Non remboursable si l'offre expire. Reductible par le talent `market_fee` existant.

Le cout de creation (hydrogene) et la commission de vente (% du prix) sont deux mecanismes distincts : le premier remunere le travail de cartographie, le second est la taxe du marche.

## Regles metier

### Creation

- Le joueur doit avoir la position dans ses `discovered_positions`
- Le rapport snapshot les biomes actuellement dans `discovered_biomes` du joueur pour cette position
- Un rapport sans biome (juste la position / type de planete) est autorise — valeur faible mais c'est au vendeur de juger
- Un seul rapport en `inventory` ou `listed` par position `[g:s:p]` par joueur. Pour recreer un rapport avec plus de biomes, il faut d'abord consommer ou annuler l'ancien
- Le cout en hydrogene est preleve sur la planete active. Si insuffisant → erreur

### Mise en vente

- Le rapport doit etre en `status = 'inventory'`
- Le joueur fixe un prix libre (un ou plusieurs des 3 ressources)
- La commission est prelevee sur la planete active. Si insuffisant → erreur
- Le rapport passe en `status = 'listed'`, une `market_offers` row est creee avec `explorationReportId`
- Duree : 48h (identique aux ressources). Expiration → rapport revient en `inventory`, commission perdue

### Achat

- L'acheteur ne peut PAS acheter un rapport si il connait deja TOUS les biomes du rapport (verification biome par biome contre ses `discovered_biomes`). Message : "Vous connaissez deja toutes les informations de ce rapport"
- Le paiement est instantane (preleve sur la planete active de l'acheteur)
- A l'achat :
  1. Upsert dans `discovered_positions` de l'acheteur (galaxy, system, position)
  2. Upsert dans `discovered_biomes` de l'acheteur pour chaque biome du rapport (pas de doublon si l'acheteur en connaissait deja certains)
  3. Le rapport passe en `status = 'sold'`
  4. Le vendeur recoit le paiement credite sur la planete d'ou il avait mis en vente
  5. Transfert d'ownership : `ownerId` passe a l'acheteur (pour historique)

### Annulation

- Le vendeur peut annuler une offre `listed` → rapport revient en `inventory`, commission perdue
- Le vendeur peut supprimer un rapport en `inventory` → passe en `status = 'consumed'` (soft delete, historique conserve)

## Affichage marche (cote acheteur)

### Listing des rapports en vente

Chaque card affiche :
- Coordonnees partielles : `[g:s:?]` — la galaxie et le systeme mais PAS la position exacte
- Type de planete (nom + PlanetDot visuel du `planetClassId`)
- Nombre de biomes contenus
- Badge rarete max (couleur de rarete : common gris → legendary dore)
- Indicateur "Complet" ou "Partiel"
- Prix (en ressources)
- Pseudo du vendeur

Ce que le listing ne montre PAS :
- La position exacte (revelee apres achat)
- Le nom des biomes et leurs effets (reveles apres achat)

### Indicateur de valeur ajoutee pour l'acheteur

Si l'acheteur a deja partiellement explore la position (il connait le systeme mais pas tous les biomes), afficher un indicateur : "X biomes deja connus". Ca l'aide a evaluer si le rapport vaut le prix.

Difficulte : l'acheteur ne connait pas `p`, donc cette verif ne peut se faire que si l'acheteur connait la position (il l'a deja visitee). Si l'acheteur n'a jamais visite la position, pas d'indicateur — il achete "a l'aveugle" (mais il connait g:s, le type de planete, et la rarete max).

## Integration UI

### Page marche (`/market`)

Nouvel onglet **"Rapports"** a cote des onglets existants (Buy / Sell / My Offers). Contient deux sous-vues :

**Sous-vue "Acheter des rapports"** :
- Liste des rapports en vente (filtre par galaxie/systeme, type de planete, rarete min)
- Cards avec les informations du listing decrites ci-dessus
- Bouton "Acheter" par card (disabled si l'acheteur connait deja tout)

**Sous-vue "Mes rapports"** :
- Rapports en inventaire : bouton "Mettre en vente" (ouvre un flow de pricing inline)
- Rapports en vente : statut + bouton "Annuler"
- Rapports vendus : historique (prix, acheteur, date)

### Point d'entree : rapport de mission d'exploration

Sur `ExploreReportDetail.tsx`, ajouter un bouton "Creer un rapport vendable" dans la section actions (a cote de Coloniser / Explorer a nouveau).

Condition d'affichage : la position est dans `discovered_positions` du joueur.

Flow au clic :
1. Resume affiche en inline ou modal : coordonnees, type de planete, liste des biomes qui seront inclus (snapshot de l'etat actuel, pas juste cette mission), cout en hydrogene
2. Confirmation → creation → rapport apparait en inventaire + lien vers "Mes rapports"

Bloque si un rapport existe deja en `inventory` ou `listed` pour cette position (message : "Un rapport existe deja pour cette position").

### Point d'entree : vue galaxie (panneau detail)

Sur `ModePlanet.tsx` (mode C empty-discovered et mode B relation === 'mine'), ajouter un bouton "Creer un rapport" dans la section actions.

Conditions :
- La position est dans `discovered_positions` du joueur
- Aucun rapport en `inventory` ou `listed` pour cette position
- Le joueur possede le batiment Marche Galactique

Meme flow que ci-dessus (resume → cout → confirmation).

### Prerequis

Meme que le marche actuel : batiment Marche Galactique niveau 1 minimum. Pas de nouveau batiment ni de nouvelle recherche.

## Backend — operations API

### Nouveau module `exploration-report`

| Operation | Input | Description |
|-----------|-------|-------------|
| `explorationReport.create` | `{ planetId, galaxy, system, position }` | Cree le rapport : snapshot biomes, calcule cout, preleve hydrogene, insere en status `inventory` |
| `explorationReport.list` | (none) | Liste les rapports du joueur (inventory + listed + sold) |
| `explorationReport.delete` | `{ reportId }` | Passe en `consumed` (soft delete, inventaire seulement) |
| `explorationReport.canCreate` | `{ galaxy, system, position }` | Verification rapide : position decouverte ? rapport existant ? retourne `{ canCreate, reason?, cost }` |

### Extension du module `market`

| Operation | Input | Description |
|-----------|-------|-------------|
| `market.listReports` | `{ galaxy?, system?, minRarity?, cursor?, limit? }` | Liste les offres de rapports en vente (exclut les offres du joueur) |
| `market.createReportOffer` | `{ reportId, priceMinerai, priceSilicium, priceHydrogene }` | Met en vente : verifie ownership + status inventory, calcule commission, cree l'offre |
| `market.buyReport` | `{ offerId }` | Achete : verifie pas-de-doublon-biomes, preleve paiement, ecrit discovered_biomes + discovered_positions, credite vendeur, status → sold |
| `market.cancelReportOffer` | `{ offerId }` | Annule : rapport → inventory, commission perdue |

Les operations existantes (`market.list`, `market.createOffer`, etc.) restent inchangees — elles ne retournent que les offres de ressources (`explorationReportId IS NULL`).

## Notifications

Reutilisation du systeme de notifications existant :

| Event | Destinataire | Message toast |
|-------|-------------|---------------|
| `report-sold` | vendeur | "{acheteur} a achete votre rapport d'exploration [{g}:{s}:?]" |
| `report-purchased` | acheteur | "Rapport d'exploration [{g}:{s}:{p}] acquis — {n} biomes reveles" |

Ajouter ces deux types dans :
- `packages/shared/src/types/notifications.ts` (EVENT_TYPE_TO_CATEGORY → `'market'`)
- `apps/api/src/modules/game-event/game-event.service.ts` (GameEventType union)
- `apps/api/src/modules/game-event/game-event.router.ts` (zod enum)
- `apps/web/src/hooks/useNotifications.ts` (switch case)
- `apps/web/src/lib/game-events.ts` (formatEventText, eventTypeColor, eventNavigationTarget)
- `packages/db/src/seed-game-config.ts` (UI labels)

## Risques et points d'attention

- **Spam de rapports communs** : le cout de creation en hydrogene (300 min pour un rapport 2 communs) + la commission de vente (5%) forment un double filtre naturel. Un joueur qui spamme des rapports sans valeur perd de l'hydrogene et de la commission pour rien.
- **Exploitation : vendre un rapport vide** : autorise (juste le type de planete), mais le cout de 200 hydrogene + commission rend ca non-rentable. Le listing montre "0 biomes" donc l'acheteur voit le contenu.
- **Race condition a l'achat** : deux joueurs essaient d'acheter le meme rapport simultanement. Le premier qui passe la transaction gagne, le second recoit une erreur "Rapport deja vendu". Utiliser une transaction SQL avec `SELECT ... FOR UPDATE` sur l'offre.
- **Position deja detruite / colonisee** : le rapport contient des biomes d'une position qui a ete colonisee depuis. L'acheteur recoit quand meme les biomes — c'est de la donnee historique, toujours utile pour evaluer la valeur de la planete.
- **Migration existante** : la nouvelle table `exploration_reports` n'impacte aucune table existante. Le FK nullable sur `market_offers` est une migration additive (colonne nullable, pas de contrainte sur les lignes existantes).
