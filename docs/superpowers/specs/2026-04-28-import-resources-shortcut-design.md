# Import Resources Shortcut — Design

**Goal :** Permettre à un joueur d'envoyer rapidement des ressources d'une de ses planètes vers la planète courante, sans passer par la navigation `/fleet/send` complète. Un bouton "Importer ↓" sur la barre/page de ressources ouvre un dropdown avec sélection de la source, des montants et envoi en un clic.

**Scope v1 :** Bouton + dropdown sur la barre de ressources mobile et la page Resources desktop. Réutilise la mission `transport` existante côté API (aucun nouveau type de mission, aucune mécanique gameplay nouvelle). Auto-sélection des cargos depuis la source.

**Non-goals :**
- Pas de transport instantané ni de cooldown/coût spéciaux — c'est une mission `transport` classique avec durée de vol normale.
- Pas de transport multi-source (une seule planète source par envoi).
- Pas de transport dans l'autre sens ("Exporter") — toujours **vers** la planète courante.
- Pas d'auto-import récurrent ou planifié.

---

## 1. Architecture

### Composants UI

Nouveau composant unique réutilisable :

```
apps/web/src/components/resources/ImportResourcesButton.tsx
```

Ce composant englobe :
- Le bouton trigger ("Importer ↓").
- Le panneau dropdown (pattern maison `useState` + `useRef` + `useOutsideClick`, identique à `DailyQuestDropdown` / `NotificationsBell`).
- La sélection de source + sliders de ressources + récap cargos.

Il est inséré à deux endroits :
- `apps/web/src/components/layout/ResourceBar.tsx` (mobile uniquement, `lg:hidden`) — placé en bout de barre.
- `apps/web/src/pages/Resources.tsx` (desktop, `hidden lg:block`) — en haut à droite à côté du `PageHeader`.

Le composant lui-même reste agnostique du contexte d'affichage et reçoit `targetPlanetId` en prop.

### Flow utilisateur

```
[Bouton "Importer ↓"] (visible si planètes ≥ 2)
        ↓ clic
[Dropdown ouvert]
  - Si aucune autre planète exploitable → message "Aucune planète ne peut envoyer..."
  - Sinon → liste des sources triées par stock total décroissant
        ↓ clic sur une planète source
[Vue détaillée dans le même dropdown]
  - 3 lignes ressources avec input numérique + bouton "Max" + bouton "0"
  - Pré-rempli à Max sur les 3
  - Cargo nécessaire vs cargo dispo source (warning si insuffisant)
  - Bouton "Envoyer le transport" (disabled si total = 0 ou cargo = 0)
        ↓ clic envoi
[Mutation fleet.send(mission='transport')]
  - Toast success "Transport envoyé"
  - Dropdown se ferme
```

### API

**Nouveau endpoint** : `planet.summaries` (tRPC, query, protected).

Renvoie pour le joueur connecté la liste de ses planètes avec un résumé léger :

```ts
type PlanetSummary = {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  minerai: number;
  silicium: number;
  hydrogene: number;
  // Cargo capacity disponible sur cette planète (somme par type de vaisseau cargo)
  cargoCapacity: number;
  // Inventaire des cargos pour calcul d'auto-sélection côté client
  ships: Record<string, number>;  // ex: { smallCargo: 12, largeCargo: 3 }
};
```

Implémentation : un seul SELECT joignant `planets` + `planet_ships` filtré par `userId`, agrégé en mémoire. Cargo capacity calculée côté serveur à partir de `gameConfig.ships`. Peu d'overhead — déjà des appels similaires côté API.

**Mutation déjà existante réutilisée** : `fleet.send` avec `mission: 'transport'`.

### Calcul auto-sélection des cargos (client)

Logique pure dans `apps/web/src/lib/cargo-pack.ts` (nouveau) :

```ts
function packCargos(
  needed: number,
  available: { smallCargo: number; largeCargo: number; ... },
  shipStats: Record<string, { cargoCapacity: number }>
): { picked: Record<string, number>; coveredCargo: number };
```

Stratégie : tri des cargos disponibles par capacité **croissante** (small d'abord pour minimiser le sur-dimensionnement), on accumule jusqu'à couvrir `needed`. Si pas assez, on retourne tout ce qu'on a et le caller cap les montants.

Testable unitairement, indépendant de React.

---

## 2. Comportement détaillé

### Conditions d'affichage du bouton

Le bouton n'est rendu que si :
- Le joueur a au moins 2 planètes (`planet.list.length >= 2`).
- La planète courante est définie (`activePlanetId`).

Pas de pré-fetch de `planet.summaries` tant que le bouton n'est pas cliqué (économie réseau).

### Tri et filtrage des sources

Dans le dropdown :
- **Filtre dur** : exclut la planète courante.
- **Tri** : décroissant par `minerai + silicium + hydrogene`. Les planètes vides finissent en bas.
- **État désactivé** : ligne grisée + texte *"Aucun cargo disponible"* si `cargoCapacity == 0`. Cliquable mais ouvre la vue détaillée (avec inputs disabled à 0) — utile pour comprendre.

### Sliders / inputs ressources

- Champ numérique avec parsing `formatNumber` (séparateur de milliers).
- Boutons rapides "0" et "Max" à droite de chaque champ.
- "Max" = `Math.min(stock_dispo_source, capacité_cargo_restante)`. Le calcul "capacité cargo restante" prend en compte ce qui est déjà alloué aux deux autres ressources, donc cliquer "Max" sur minerai après avoir mis silicium = 1000 ne reprend que ce qui reste de cargo.
- Empty state : valeur 0 = ressource non transportée.

### Auto-sélection des cargos

Calculée dynamiquement à chaque changement de montant. Affichée en lecture seule sous les inputs :

> `→ 8 smallCargo + 1 largeCargo (cargo 14 800 / 25 000)`

Si le total dépasse les cargos dispos : warning ambré sous la ligne, et le bouton "Envoyer" reste actif mais le clic capera les montants côté client avant l'appel API (pour éviter une 400).

### Envoi

Mutation `fleet.send` avec :
- `originPlanetId`: planète source choisie
- `targetGalaxy / targetSystem / targetPosition`: extraits de la planète courante
- `mission`: `'transport'`
- `ships`: résultat de `packCargos`
- `mineraiCargo / siliciumCargo / hydrogeneCargo`: montants saisis

Toast `success` : *"Transport envoyé depuis {nom_source}"* + lien "Voir la flotte" qui navigue vers `/fleet?tab=movements`. Dropdown se ferme via `onSuccess`.

En cas d'erreur (`TRPCError`) : toast `error` avec le message backend, dropdown reste ouvert pour correction.

---

## 3. Edge cases

| Cas | Comportement |
|---|---|
| Joueur n'a qu'une planète | Bouton non rendu. |
| Toutes les autres planètes ont stock = 0 ET cargo = 0 | Dropdown affiche un message d'état, pas de liste. |
| Source en cours de transport vers la même cible | Autorisé (additionne). Pas de check spécifique. |
| Source occupée par une mission qui mobilise tous ses cargos | `cargoCapacity` reflète seulement les cargos *présents au sol*, pas en flight. Donc auto-sélection limitée → warning. |
| Le joueur ferme le dropdown en cours de saisie | État local perdu (volontaire — pas de persistance, c'est un raccourci). |
| La mutation `fleet.send` échoue (validation backend) | Toast erreur, dropdown reste ouvert. |
| Une autre mission a vidé la source entre l'ouverture du dropdown et l'envoi | Backend rejette → message d'erreur clair côté joueur. Pas de polling temps réel pour rafraîchir la liste. |

---

## 4. Tests

### Backend

`apps/api/src/modules/planet/__tests__/planet.summaries.test.ts` :
- Renvoie toutes les planètes du joueur, pas celles des autres.
- Calcule `cargoCapacity` correctement à partir de `planet_ships` × `config.ships`.
- Retourne tableau vide si le joueur n'a pas de planètes.

### Helper client

`apps/web/src/lib/cargo-pack.test.ts` :
- Petit cargo d'abord, large cargo ensuite.
- Si `needed = 0` → retourne `{}`.
- Si `available` ne couvre pas `needed` → retourne tout disponible + `coveredCargo < needed`.
- Cap correctement quand un seul type est dispo.

### Composant UI

Pas de test unitaire React (cohérent avec le reste du projet — pas de Testing Library en place). Validation manuelle via le dev server.

---

## 5. Suite de travaux

- **Phase v1 (ce spec)** : raccourci basique mission transport.
- **Phase v2 (séparé)** : preset par source ("le matin je vide toujours la planète X vers la mère") — à coupler avec l'idée *flottes préselect* du backlog.
- **Phase v3 (séparé)** : refonte de la page Fleet pour exploiter ces presets, mentionnée par zechapeon dans le ticket *"Flotte"*.
