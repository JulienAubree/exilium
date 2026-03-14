# Phase 6b : Alliances — Design Spec

## Objectif

Ajouter un système d'alliances permettant aux joueurs de créer, rejoindre et gérer des alliances avec recrutement par invitation ou candidature, rangs basiques, message circulaire et classement alliances.

---

## 1. Modèle de données

### Nouvelles tables

**`alliances`**

| Colonne | Type | Contraintes |
|---------|------|------------|
| `id` | uuid | PK, default random |
| `name` | varchar(30) | NOT NULL, UNIQUE |
| `tag` | varchar(8) | NOT NULL, UNIQUE |
| `description` | text | nullable |
| `founderId` | uuid | NOT NULL, FK → users.id |
| `createdAt` | timestamp(tz) | NOT NULL, default now |

**`alliance_members`**

| Colonne | Type | Contraintes |
|---------|------|------------|
| `id` | uuid | PK, default random |
| `allianceId` | uuid | NOT NULL, FK → alliances.id ON DELETE CASCADE |
| `userId` | uuid | NOT NULL, UNIQUE, FK → users.id ON DELETE CASCADE |
| `role` | pgEnum(`alliance_role`) | NOT NULL, default 'member' |
| `joinedAt` | timestamp(tz) | NOT NULL, default now |

Enum `alliance_role` : `'founder'` | `'officer'` | `'member'`

**`alliance_invitations`**

| Colonne | Type | Contraintes |
|---------|------|------------|
| `id` | uuid | PK, default random |
| `allianceId` | uuid | NOT NULL, FK → alliances.id ON DELETE CASCADE |
| `invitedUserId` | uuid | NOT NULL, FK → users.id ON DELETE CASCADE |
| `invitedByUserId` | uuid | NOT NULL, FK → users.id |
| `status` | pgEnum(`request_status`) | NOT NULL, default 'pending' |
| `createdAt` | timestamp(tz) | NOT NULL, default now |

Enum `request_status` (partagé entre invitations et applications) : `'pending'` | `'accepted'` | `'declined'`

Index unique : `(allianceId, invitedUserId)` pour empêcher les doublons d'invitation.

**`alliance_applications`**

| Colonne | Type | Contraintes |
|---------|------|------------|
| `id` | uuid | PK, default random |
| `allianceId` | uuid | NOT NULL, FK → alliances.id ON DELETE CASCADE |
| `applicantUserId` | uuid | NOT NULL, FK → users.id ON DELETE CASCADE |
| `status` | pgEnum(`request_status`) | NOT NULL, default 'pending' |
| `createdAt` | timestamp(tz) | NOT NULL, default now |

Index unique : `(allianceId, applicantUserId)` pour empêcher les doublons de candidature.

### Modification existante

Ajouter `'alliance'` au `messageTypeEnum` dans `packages/db/src/schema/messages.ts`.

---

## 2. API — Module alliance

### Service : `allianceService`

Fichier : `apps/api/src/modules/alliance/alliance.service.ts`

Factory `createAllianceService(db, messageService)` — reçoit le messageService pour envoyer les messages circulaires et notifications.

### Router : `allianceRouter`

Fichier : `apps/api/src/modules/alliance/alliance.router.ts`

#### Mutations

- **`create`** — Input : `{ name: string (3-30), tag: string (2-8) }`. Vérifie que le joueur n'a pas déjà d'alliance. Crée l'alliance et ajoute le joueur comme `founder`.

- **`update`** — Input : `{ description: string }`. Réservé au founder/officer.

- **`leave`** — Pas d'input. Si le joueur est le dernier membre : dissolution (suppression de l'alliance). Sinon, si le joueur est founder : transfert du rôle founder au plus ancien officer, sinon au plus ancien membre.

- **`kick`** — Input : `{ userId: string }`. Réservé au founder/officer. Un officer ne peut pas kick un autre officer ni le founder. Le founder peut kick n'importe qui sauf lui-même.

- **`setRole`** — Input : `{ userId: string, role: 'officer' | 'member' }`. Réservé au founder uniquement. Ne peut pas changer son propre rôle.

- **`invite`** — Input : `{ username: string }`. Réservé au founder/officer. Vérifie que le joueur cible n'a pas déjà d'alliance et n'a pas déjà une invitation pending de cette alliance. Envoie un message système au joueur invité.

- **`respondInvitation`** — Input : `{ invitationId: string, accept: boolean }`. Le joueur invité accepte ou décline. Si accepte : vérifie qu'il n'a toujours pas d'alliance, crée le membership.

- **`apply`** — Input : `{ allianceId: string }`. Vérifie que le joueur n'a pas d'alliance et n'a pas déjà une candidature pending pour cette alliance. Envoie un message système à tous les founder + officers de l'alliance.

- **`respondApplication`** — Input : `{ applicationId: string, accept: boolean }`. Réservé au founder/officer. Si accepte : vérifie que le candidat n'a toujours pas d'alliance, crée le membership.

- **`sendCircular`** — Input : `{ subject: string, body: string }`. Réservé au founder/officer. Crée un message de type `'alliance'` pour chaque membre de l'alliance (sauf l'expéditeur).

#### Queries

- **`get`** — Input : `{ allianceId: string }`. Retourne les infos publiques : name, tag, description, nombre de membres, date de création.

- **`myAlliance`** — Pas d'input. Retourne l'alliance du joueur connecté avec la liste des membres (username, role, joinedAt), ou null si pas d'alliance.

- **`myInvitations`** — Retourne les invitations pending reçues par le joueur, avec le nom/tag de l'alliance et le username de l'inviteur.

- **`applications`** — Retourne les candidatures pending pour l'alliance du joueur (founder/officer uniquement), avec le username du candidat.

- **`ranking`** — Input : `{ page?: number }`. Retourne le classement alliances paginé (20 par page). Score = somme des points des membres (depuis la table `rankings` existante). Retourne : rank, name, tag, memberCount, totalPoints.

- **`search`** — Input : `{ query: string }`. Recherche par nom ou tag (ILIKE). Retourne les alliances matchantes avec infos publiques.

### Wiring

Dans `apps/api/src/trpc/app-router.ts` :
- Créer `allianceService` et `allianceRouter`
- Ajouter `alliance: allianceRouter` à l'app router

---

## 3. Frontend

### Nouvelle page : Alliance.tsx

Fichier : `apps/web/src/pages/Alliance.tsx`

**Si le joueur n'a pas d'alliance :**
- Onglet "Créer" : formulaire name + tag → appelle `alliance.create`
- Onglet "Rejoindre" : champ de recherche → `alliance.search`, résultats avec bouton "Postuler"
- Section "Invitations reçues" : liste des invitations pending avec boutons Accepter/Décliner

**Si le joueur a une alliance :**
- En-tête : nom, [TAG], description
- Liste des membres : username, rôle, date d'arrivée
- Actions selon le rôle :
  - Tous : bouton "Quitter"
  - Founder/Officer : "Inviter un joueur" (input username), "Message circulaire" (formulaire subject + body), "Candidatures" (liste avec Accept/Decline)
  - Founder : "Gérer les rôles" (dropdown par membre)
  - Founder/Officer : "Modifier la description"

### Nouvelle page : AllianceRanking.tsx

Fichier : `apps/web/src/pages/AllianceRanking.tsx`

Table paginée : rang, nom, tag, nombre de membres, points totaux. Même style que `Ranking.tsx` existant.

### Modifications existantes

| Fichier | Modification |
|---------|-------------|
| `apps/web/src/components/layout/Sidebar.tsx` | Ajouter liens "Alliance" (`/alliance`) et "Classement Alliances" (`/alliance-ranking`) |
| `apps/web/src/router.tsx` | Ajouter routes `/alliance` et `/alliance-ranking` |
| `apps/web/src/pages/Galaxy.tsx` | Afficher `[TAG]` devant le username si le joueur a une alliance |
| `apps/web/src/pages/Messages.tsx` | Ajouter filtre "Alliance" aux boutons de type |

---

## 4. Impact Galaxy — Tag alliance

Le `galaxyService.getSystem` doit inclure le tag alliance de chaque joueur dans les slots.
Modifier la query pour joindre `alliance_members` → `alliances` et retourner `allianceTag` dans chaque slot occupé.

---

## 5. Fichiers à créer

| Fichier | Responsabilité |
|---------|---------------|
| `packages/db/src/schema/alliances.ts` | Tables alliances, alliance_members, invitations, applications |
| `apps/api/src/modules/alliance/alliance.service.ts` | Logique métier alliances |
| `apps/api/src/modules/alliance/alliance.router.ts` | Routes tRPC alliances |
| `apps/web/src/pages/Alliance.tsx` | Page alliance joueur |
| `apps/web/src/pages/AllianceRanking.tsx` | Classement alliances |

## 6. Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `packages/db/src/schema/messages.ts` | Ajouter `'alliance'` au messageTypeEnum |
| `packages/db/src/schema/index.ts` | Ajouter export alliances |
| `apps/api/src/trpc/app-router.ts` | Wiring allianceService + allianceRouter |
| `apps/api/src/modules/galaxy/galaxy.service.ts` | Joindre alliance tag dans getSystem |
| `apps/api/src/modules/message/message.service.ts` | Ajouter `'alliance'` à la signature de type de `createSystemMessage` et au type filter de `listMessages` |
| `apps/api/src/modules/message/message.router.ts` | Ajouter `'alliance'` au `z.enum` du filtre type dans inbox |
| `apps/web/src/components/layout/Sidebar.tsx` | Liens Alliance + Classement Alliances |
| `apps/web/src/router.tsx` | Routes /alliance et /alliance-ranking |
| `apps/web/src/pages/Galaxy.tsx` | Afficher [TAG] devant le username |
| `apps/web/src/pages/Messages.tsx` | Filtre "Alliance" |
