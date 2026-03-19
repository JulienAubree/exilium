# Rapports de mission — Design Spec

## Objectif

Envoyer un rapport de mission structuré (événement, durée, récompenses, pertes) à chaque mission terminée. Ajouter les rapports manquants (transport, recycle, station, mine, pirate) et enrichir les rapports existants (attack, spy, colonize) avec la durée.

## Architecture

Les rapports sont créés dans chaque handler via `ctx.messageService.createSystemMessage()`, pattern déjà en place pour attack/spy/colonize. Aucun nouveau service nécessaire.

## Changements

### 1. Migration DB — nouveau type de message

Ajouter `mission` à l'enum `message_type` (fichier schema `packages/db/src/schema/messages.ts`). Les types existants (`combat`, `espionage`, `colonization`, `system`, `player`, `alliance`) restent inchangés.

### 2. Nouveaux rapports

#### Transport (`mission`)
- Sujet : `Transport effectué [galaxy:system:position]`
- Corps : cargo livré (minerai, silicium, hydrogène), durée du trajet

#### Recycle (`mission`)
- Sujet : `Recyclage effectué [galaxy:system:position]`
- Corps : débris collectés (minerai, silicium), durée du trajet

#### Station (`mission`)
- Sujet : `Flotte stationnée [galaxy:system:position]`
- Corps : vaisseaux stationnés, cargo déposé, durée du trajet

#### Mine (`mission`)
- Sujet : `Extraction terminée [galaxy:system:position]`
- Corps : ressource extraite (type + quantité), durée totale (trajet + prospection + minage)

#### Pirate (`mission`)
- Sujet : `Mission pirate [galaxy:system:position] — Victoire/Défaite`
- Corps : résultat du combat, butin obtenu, vaisseaux bonus, vaisseaux perdus, durée du trajet

### 3. Rapports existants enrichis

#### Attack (`combat`) — ajouter durée
Insérer la durée du trajet dans le corps du rapport existant.

#### Spy (`espionage`) — ajouter durée
Insérer la durée du trajet dans le corps du rapport existant.

#### Colonize (`colonization`) — ajouter durée
Insérer la durée du trajet dans le corps des rapports (succès et échecs).

### 4. Calcul de la durée

- Missions simples : `arrivalTime - departureTime` de l'event outbound
- Mine (multi-phase) : durée cumulée depuis le départ initial jusqu'à la fin du minage

Format : `Xh Ym` si >= 1h, `Ym Zs` sinon.

Fonction utilitaire `formatDuration(ms: number): string` dans `fleet.types.ts`.

### 5. Frontend

Ajouter le filtre "Mission" dans la boîte de réception (`Messages.tsx`), valeur `mission` dans le sélecteur de type.

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `packages/db/src/schema/messages.ts` | Ajouter `mission` à l'enum |
| `apps/api/src/modules/fleet/fleet.types.ts` | Ajouter `formatDuration()` |
| `apps/api/src/modules/fleet/handlers/transport.handler.ts` | Ajouter rapport |
| `apps/api/src/modules/fleet/handlers/recycle.handler.ts` | Ajouter rapport |
| `apps/api/src/modules/fleet/handlers/station.handler.ts` | Ajouter rapport |
| `apps/api/src/modules/fleet/handlers/mine.handler.ts` | Ajouter rapport |
| `apps/api/src/modules/fleet/handlers/pirate.handler.ts` | Ajouter rapport |
| `apps/api/src/modules/fleet/handlers/attack.handler.ts` | Ajouter durée |
| `apps/api/src/modules/fleet/handlers/spy.handler.ts` | Ajouter durée |
| `apps/api/src/modules/fleet/handlers/colonize.handler.ts` | Ajouter durée |
| `apps/web/src/pages/Messages.tsx` | Ajouter filtre "Mission" |
