# Shell « Empire-first » — spec (concept A, retiré)

> **Statut : retiré (2026-06-10 soir)** — livré le matin même (`ebd2c409`) puis annulé par le
> rollback #2 : retour à l'état pré-Empire-first (`eb8a7457`, ressources en haut + bloc planète
> unifié + sidebar), décision user. Le code reste dans l'historique git.
> *(Historique : décision user 2026-06-10 matin — concept A maintenant, B « passerelle/carte vivante » = horizon ultérieur.)*
> Réalise les lots 3-4 de la refonte IA sous forme de swap de shell — le contenu des pages (fraîchement
> redesigné v2) se glisse dans la nouvelle coquille sans réécriture.

## Structure cible

- **`/` = l'Empire** (ex-page Empire) : LE home. `/empire` → redirect `/`.
- **`/planet/:planetId` = drill-down planète** (adressable, back-button, View Transitions) :
  - `PlanetLayout` : retour Empire + sélecteur de planète + badges ressources + `TabBar`
  - Onglets : **Vue d'ensemble** (ex-`/` Overview) · Ressources · Énergie · Infrastructures · Production
  - Planète en colonisation : onglets verrouillés sur Vue d'ensemble (qui affiche ColonizationProgress)
- **La double nav disparaît** : `PlanetSubnav` (bloc planète global) supprimé. À la place :
  - `GlobalTopbar` desktop : marque + actions globales (messages, notifs, rapports, quêtes, profil)
  - Mobile : TopBar n'affiche le sélecteur planète que sur les routes `/planet/*`
  - `ResourceBar` mobile : visible uniquement sur `/planet/*`
- **Bottom bar mobile finale : 4 tabs** = Empire (`/`) · Galaxie · Flotte · Social. Le groupe
  « Planète » disparaît — l'accès planète passe par les cartes du home.
- **Cartes Empire** : clic → `/planet/:id` (plus de bascule de store + navigation implicite).

## Compat / redirects

`/resources` `/energy` `/infrastructures` `/production` (+ querystring) → `/planet/<actif>/…`
via `RedirectToActivePlanet` (lit le store, fallback 1ʳᵉ planète). Les chaînes existantes
(`/shipyard` → `/production?tab=…`) continuent de fonctionner par rebond. Tutoriel/onboarding/push
inchangés (leurs cibles passent par ces redirects).

## Inchangé

Contenu des pages, contexte d'Outlet (`{planetId, planetClassId}` — PlanetLayout le fournit depuis
l'URL pour ses enfants ; le Layout global le fournit toujours depuis le store pour Flotte & co),
store planète (sync URL → store pour le sélecteur mobile et les pages hors drill-down).
