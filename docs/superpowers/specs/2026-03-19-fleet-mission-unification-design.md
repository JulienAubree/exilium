# Unification des mouvements de flotte — Mission Handlers

**Date** : 2026-03-19

## Problème

Le `fleet.service.ts` fait ~1585 lignes avec des branches if/else par type de mission. La logique de validation, d'arrivée et de retour est mélangée dans un seul fichier. Les types de mission sont définis à 3 endroits incohérents (DB enum, shared enum, frontend). Ajouter un nouveau type de mission nécessite de modifier le service central à de nombreux endroits.

## Solution

Refactoring interne avec le **Strategy pattern** : extraire un handler par type de mission, garder un dispatcher central mince. Zéro changement côté joueur (même UX, mêmes pages, mêmes endpoints). Zéro changement de schéma DB.

## Contraintes

- **Aucun changement frontend** — les pages Fleet, Movements, Missions restent identiques
- **Aucune migration DB** — les tables `fleet_events` et `pve_missions` ne changent pas
- **Aucun changement d'API** — les endpoints tRPC restent identiques
- **Les workers ne changent pas** — ils appellent toujours `fleetService.processArrival()`, `fleetService.processProspectDone()`, `fleetService.processMineDone()` et `fleetService.processReturn()`

---

## 1. Interface MissionHandler

```typescript
// apps/api/src/modules/fleet/fleet.types.ts

interface MissionHandlerContext {
  db: Database;
  resourceService: ResourceService;
  gameConfigService: GameConfigService;
  messageService?: MessageService;
  pveService?: PveService;
  asteroidBeltService?: AsteroidBeltService;
  pirateService?: PirateService;
  fleetArrivalQueue: Queue;
  fleetReturnQueue: Queue;
  universeSpeed: number;
}

interface MissionHandler {
  validateFleet(input: SendFleetInput, config: GameConfig, ctx: MissionHandlerContext): Promise<void>;
  processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult>;
  processReturn(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ReturnResult>;
}

interface PhasedMissionHandler extends MissionHandler {
  processPhase(phase: string, fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<PhaseResult>;
}
```

Les handlers qui ont des phases intermédiaires (mine) implémentent `PhasedMissionHandler`. Le dispatcher vérifie `'processPhase' in handler` pour router les phases.

**Validation async :** `validateFleet` est `async` et reçoit `ctx` car certaines validations nécessitent la DB (ex : attack vérifie que la cible n'appartient pas à l'attaquant, colonize vérifie la limite de planètes).

**Routage des phases :** Le dispatcher conserve les méthodes publiques `processProspectDone(fleetEventId)` et `processMineDone(fleetEventId)` que le fleet-arrival worker appelle. En interne, ces méthodes chargent le fleet event puis délèguent à `(handler as PhasedMissionHandler).processPhase('prospect-done' | 'mine-done', fleetEvent, ctx)`.

## 2. Types de résultat

```typescript
interface ArrivalResult {
  scheduleReturn: boolean;
  schedulePhase?: {
    jobName: string;   // 'prospect-done' | 'mine-done'
    delayMs: number;
  };
  cargo?: ResourceCargo;
  shipsAfterArrival?: ShipRecord;
  sideEffects?: ArrivalSideEffect[];
}

type ArrivalSideEffect =
  | { type: 'create_planet'; planetData: NewPlanetData }
  | { type: 'spy_report'; report: SpyReportData }
  | { type: 'send_message'; userId: string; category: string; subject: string; body: string }
  | { type: 'start_pve_mission'; pveMissionId: string }
  | { type: 'create_return_event'; returnEventData: Partial<FleetEventInsert> }
  | { type: 'update_fleet_phase'; phase: string; arrivalTime: Date };

interface PhaseResult {
  scheduleNextPhase?: {
    jobName: string;
    delayMs: number;
  };
  scheduleReturn?: boolean;
  cargo?: ResourceCargo;
  updateFleet?: Partial<FleetEventUpdate>;
}

interface ReturnResult {
  cargo: ResourceCargo;
  ships: ShipRecord;
  bonusShips?: ShipRecord;
  completePveMission?: boolean;
}
```

Les handlers sont **purs** : ils calculent un résultat, le dispatcher exécute les effets de bord (scheduler jobs, déposer cargo, publier notifications, marquer PvE missions).

**`ReturnResult` vs retour public :** `ReturnResult` est le contrat entre le handler et le dispatcher. La méthode publique `processReturn()` du dispatcher enrichit ce résultat avec les champs communs (`userId`, `mission`, `originName`, `targetCoords`, `originPlanetId`) lus depuis le fleet event, pour que les workers reçoivent le même format qu'actuellement.

**`shipsAfterArrival`** : représente les vaisseaux **survivants qui rentreront**. En cas de combat (attack, pirate), les vaisseaux détruits ne sont pas inclus — le handler calcule les pertes et ne retourne que les survivants.

**`create_return_event`** : cas spécial de colonize. Quand la colonisation réussit, le handler retourne `scheduleReturn: false` et un side effect `create_return_event` pour que le dispatcher crée un nouveau fleet event de retour (puisque le vaisseau de colonisation est consommé, les vaisseaux restants repartent dans un nouvel événement).

## 3. Registre et dispatcher

```typescript
// apps/api/src/modules/fleet/fleet.service.ts (~300-400 lignes)

const HANDLERS: Record<string, MissionHandler> = {
  transport: new TransportHandler(),
  attack: new AttackHandler(),
  spy: new SpyHandler(),
  colonize: new ColonizeHandler(),
  recycle: new RecycleHandler(),
  station: new StationHandler(),
  mine: new MineHandler(),
  pirate: new PirateHandler(),
};
```

Le dispatcher conserve la **logique commune** :
- Calcul de distance et durée de trajet
- Déduction de carburant et ressources
- Création du `fleet_event` en DB
- Scheduling des jobs BullMQ (arrivée, retour)
- Recall de flotte (vérification de phase, inversion)
- Dépôt de cargo et restitution des vaisseaux au retour
- Publication des notifications Redis et game events
- Appels `pveService` (startMission, completeMission, releaseMission)

Seule la logique **spécifique** à chaque mission est dans les handlers :
- Validation des contraintes de flotte (ex : sondes only pour spy)
- Logique d'arrivée (combat, espionnage, colonisation, prospection...)
- Calcul du cargo de retour (pillage, extraction, collecte débris...)
- Gestion des phases intermédiaires (mine uniquement)

## 4. Structure des fichiers

```
apps/api/src/modules/fleet/
├── fleet.service.ts          # Dispatcher (~300-400 lignes)
├── fleet.router.ts           # Inchangé
├── fleet.types.ts            # Interfaces, types de résultat, contexte
├── handlers/
│   ├── transport.handler.ts  # ~60 lignes
│   ├── station.handler.ts    # ~50 lignes
│   ├── spy.handler.ts        # ~80 lignes
│   ├── attack.handler.ts     # ~200 lignes
│   ├── colonize.handler.ts   # ~100 lignes
│   ├── recycle.handler.ts    # ~80 lignes
│   ├── mine.handler.ts       # ~250 lignes (PhasedMissionHandler)
│   └── pirate.handler.ts     # ~150 lignes
```

**Principes des handlers :**
- Stateless — pas d'état interne, tout vient du `ctx` et du `fleetEvent`
- Pas d'accès direct aux queues — retournent un résultat, le dispatcher schedule
- Accès à `db` et aux services via `ctx`
- La logique de recall reste dans le dispatcher (commune)
- Le dépôt de cargo au retour reste dans le dispatcher (commun)

## 5. Alignement du shared enum MissionType

```typescript
// packages/shared/src/types/missions.ts

enum MissionType {
  Transport = 'transport',
  Station = 'station',
  Spy = 'spy',           // renommé depuis 'espionage'
  Attack = 'attack',
  Colonize = 'colonize',
  Recycle = 'recycle',
  Mine = 'mine',          // ajouté
  Pirate = 'pirate',      // ajouté
}
// Expedition retiré (pas implémenté)
```

Le registre des handlers utilise `MissionType` comme clé.

**Note :** `MissionType` n'est actuellement importé nulle part dans le codebase (le service utilise des string literals). Le renommage `Espionage → Spy` n'a donc aucun impact en dehors du fichier de définition. Le type `'espionage'` dans le système de messages (`messageTypeEnum`) est un **type de message**, pas un type de mission — il ne doit **pas** être renommé. La suppression de `Expedition` est sans risque (aucune référence existante).

Les enums `FleetPhase` et `FleetStatus` dans le même fichier sont déjà alignés avec la DB — aucun changement nécessaire.

## 6. Stratégie de migration

Migration progressive, le code compile et fonctionne à chaque étape :

1. **Créer `fleet.types.ts`** — nouvelles interfaces, zéro impact
2. **Aligner le shared enum** — renommer Espionage → Spy, ajouter Mine/Pirate, retirer Expedition, mettre à jour les références API
3. **Extraire les handlers simples** — transport, station, spy (peu de logique)
4. **Extraire les handlers moyens** — colonize, recycle (logique ciblée)
5. **Extraire les handlers complexes** — attack (combat), pirate (combat PvE + bonus), mine (phases)
6. **Nettoyer le dispatcher** — supprimer les branches if/else mortes, ne garder que la logique commune
7. **Vérification finale** — build complet

Chaque handler peut être commité individuellement.

## Ce qui ne change PAS

- Tables `fleet_events` et `pve_missions` — aucune migration
- Endpoints tRPC — mêmes signatures, mêmes réponses
- Workers `fleet-arrival` et `fleet-return` — appellent toujours les mêmes méthodes du service
- Pages frontend Fleet, Movements, Missions — aucune modification
- Formules de calcul (distance, durée, extraction, combat) — déplacées dans les handlers mais identiques
- Système de notifications — le dispatcher continue de publier les events
- Tutorial system — le fleet-return worker continue d'appeler tutorialService

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `apps/api/src/modules/fleet/fleet.types.ts` | **Nouveau** — interfaces MissionHandler, résultats, contexte |
| `apps/api/src/modules/fleet/handlers/*.handler.ts` | **Nouveau** (x8) — un handler par mission |
| `apps/api/src/modules/fleet/fleet.service.ts` | **Réduit** de ~1585 à ~300-400 lignes — dispatcher + logique commune |
| `packages/shared/src/types/missions.ts` | Alignement enum MissionType sur la DB |
| Fichiers utilisant `MissionType.Espionage` | Renommer en `MissionType.Spy` |
