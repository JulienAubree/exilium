# Refonte graphique de la vue galaxie (desktop)

## Contexte

La vue galaxie actuelle (`apps/web/src/pages/Galaxy.tsx`) presente le systeme solaire courant sous forme d'un tableau a 5 colonnes (Position / Planete / Type / Joueur / Actions) sur desktop, et d'une liste lineaire sur mobile. Le tableau est efficace mais purement informatif : aucun rappel spatial du systeme, aucune charge graphique, le joueur ne ressent pas qu'il observe un vrai espace stellaire.

L'objectif est de remplacer **uniquement** la vue desktop par une representation visuelle forte, organisee autour d'une carte orbitale top-down du systeme. Le mobile garde sa liste lineaire actuelle (qui marche bien au doigt et n'a pas besoin d'etre reinventee).

## Principes de conception

- **Hybride 50/50** master/detail : un visuel central qui represente le systeme + un panneau d'actions a cote pour rester operationnel.
- **Top-down concentrique** : etoile au centre, 16 orbites concentriques, planetes posees sur leurs orbites. Lecture intuitive et iconique.
- **Trois zones** sur l'ecran : ribbon de positions (gauche, ~72 px), orbital map (centre, fluide), panneau detail (droite, ~340 px).
- **Style realiste deep space** : fond noir profond, etoiles de fond, couronne stellaire chaude, planetes ombrees aux couleurs de leur type. Pas de neon, pas de stylise.
- **Fog of war progressif** : les positions non-decouvertes sont grisees et desaturees, les orbites correspondantes sont en pointilles faibles. Aucun "?" ni placeholder texte.
- **Aura de propriete** : la couleur du disque appartient au type de la planete, jamais a son proprietaire. Le proprietaire est signale par un halo radial doux derriere le disque (cyan = moi, bleu = allie, rouge = hostile, rien = neutre).
- **Animations subtiles** : drift contemplatif, pas de rotation orbitale reelle. Tout en CSS, zero `requestAnimationFrame`.
- **Aucun changement back-end** : l'API `getSystem()` actuelle couvre 100 % du besoin.
- **Aucun changement de la vue mobile** : la liste lineaire `lg:hidden` reste strictement intacte.

## Scope et hors-scope

### Dans le scope
- Nouveau composant desktop `GalaxySystemView` rendu a partir du breakpoint `lg` (>= 1024 px).
- Refonte purement client (composants React + SVG + CSS Tailwind).
- Reutilisation du composant `AsteroidBelt.tsx` existant dans le panneau detail (mode E uniquement).
- Ajout d'un composant leger `OrbitalDebrisRing.tsx` pour le rendu des ceintures sur la carte.
- Ajout d'une prop `aura` sur `PlanetDot.tsx` pour le halo de faction.
- Tests unitaires sur la geometrie + tests d'integration sur la sychronisation ribbon/canvas/panel.

### Hors scope
- Vue galaxie large (multi-systemes simultanes).
- Animation de transition entre deux systemes (slide / warp).
- Drag-pan ou zoom du canvas (le systeme entier tient toujours dans le canvas).
- Mini-map dans un coin.
- Mode mobile equivalent : le mobile garde sa liste lineaire.

## Architecture des zones

### Cadre general

```
+---------------------------------------------------------------+
|  [1:42]  < Precedent | Systeme | Suivant >    [coord input]   |  <- top bar (existant repositionne)
+------+--------------------------------------+-----------------+
| Rib  |                                      |                 |
| bon  |         Orbital map (canvas)         |     Detail      |
|      |                                      |                 |
| 16   |         Etoile centrale              |     Header      |
| pos  |         16 orbites concentriques     |     Biomes      |
|      |         Planetes posees dessus       |     Effets      |
|      |                                      |     Actions     |
| ~72px|         (~ 60 % de la largeur)       |     ~340 px     |
+------+--------------------------------------+-----------------+
```

- Hauteur : `h-[calc(100vh-topbarheight)]` pour eviter le scroll vertical sur 1080p.
- Le panneau detail scrolle independamment si son contenu deborde.
- Les trois zones partagent un meme etat de selection : `selectedSlot: { kind: 'system' | 'slot', position?: number }`.

### Zone 1 : Ribbon des 16 positions (gauche)

- Largeur fixe ~72 px, pleine hauteur. Pas de scroll : 16 cellules de ~32 px tiennent toujours.
- Header de colonne : etiquette `SLOTS` + compteur `x/16` (positions decouvertes).
- Une cellule par position :
  - Numero `01`-`16` en monospace gris clair.
  - Mini-marqueur `PlanetDot` (14 px) reflechissant **exactement** l'etat du slot (cf. legende des etats dans la zone canvas ci-dessous).
- Etats de la cellule :
  - Hover : fond cyan leger + le canvas met aussi en avant la planete correspondante (hover bidirectionnel).
  - Selectionnee : fond cyan plus marque + bordure gauche cyan 2 px.
  - Click : met a jour `selectedSlot`.
- **Volontairement frugal** : pas de nom, pas d'icone supplementaire. Le ribbon est un index spatial, pas un mini-tableau.

### Zone 2 : Orbital map (centre)

#### Geometrie

- 16 orbites concentriques, rayons espacees progressivement (premieres serrees, dernieres plus ecartees pour la lisibilite au centre).
- L'angle d'une planete sur son orbite est **derive de facon deterministe** de `(galaxy, system, position)` via un hash. Stable entre deux visites, signature unique par systeme.
- L'etoile centrale est une couronne radiale chaude (orange -> jaune) avec un coeur blanc dur. Taille proportionnelle au canvas.
- Champ d'etoiles statique en arriere-plan (~30-50 points blancs distribues, opacities variees).

#### Les etats de slot

Trois categories de relation joueur (derivees de `userId` + `allianceId` du slot vs. l'utilisateur courant) :

1. **Mienne** : disque colore (gradient radial du type de planete) + aura cyan douce (halo radial flou).
2. **Alliee** : disque colore + aura bleue (joueur de mon alliance).
3. **Hostile** : disque colore + aura rouge (tout autre joueur : hors alliance OU sans alliance — la regle metier actuelle est "non-allies = cible legitime des actions offensives").

Quatre etats d'occupation independants du proprietaire :

4. **Vide decouverte** : cercle pointille fin dans la couleur du type de planete revele. Pas de fill.
5. **Inconnue** : disque grise desature sur orbite en pointilles tres faibles. Pas de "?", pas de label.
6. **Ceinture d'asteroides** : anneau de debris fin (~22 petits disques orange) sur l'orbite. Pas l'animation lourde de `AsteroidBelt.tsx`.
7. **Selectionnee** : surcouche qui se superpose a n'importe quel etat ci-dessus. Anneau ivoire fin + 4 ticks cardinaux.

Cas defensif : si un slot a un proprietaire mais que la relation ne peut pas etre derivee (donnees incompletes), fallback sur "disque colore seul, aucune aura".

**Regle importante** : la couleur du disque depend toujours du type/biome majeur de la planete. Le proprietaire ne change jamais cette couleur, il est signale uniquement par l'aura.

#### Animations (drift subtil)

Toutes en CSS `@keyframes` dans `globals.css`, jamais en JS rAF.

| Animation | Cible | Duree | Effet |
|-----------|-------|-------|-------|
| `star-breathe` | Couronne de l'etoile | 4 s ease-in-out infinite | opacity 0.85 ↔ 1.0 |
| `aura-breathe` | Halos de faction | 4-6 s avec offsets | opacity 0.6 ↔ 0.8 |
| `selection-rotate` | Anneau de selection | 12 s linear infinite | `stroke-dashoffset` glissant |
| `slot-hover` | Halo au hover | 200 ms ease-out | scale 1.0 → 1.1 |

Toutes respectent `@media (prefers-reduced-motion: reduce)` : devient statique, l'etoile arrete de respirer, les auras aussi. La selection reste visible mais n'a plus de rotation.

#### Interactions canvas

- **Click** sur planete / belt / slot vide / etoile : met a jour `selectedSlot`.
- **Click sur l'etoile centrale** : desselectionne, retour mode A.
- **Hover** sur planete : tooltip discret a 8 px de la planete (1 ligne : `Position N - Nom - Proprietaire`), aura agrandie de 10 %.
- **Hover bidirectionnel** : hover sur ribbon active aussi le tooltip + l'aura agrandie de la planete correspondante sur le canvas, et inversement.

### Zone 3 : Panneau detail (droite)

Largeur fixe ~340 px. Scroll vertical interne. Le contenu depend de la selection courante : 5 modes.

#### Mode A : Aucune selection (vue systeme, par defaut)

- Header : `Systeme [G:S]` (gros), sous-titre `16 positions` (le type d'etoile pourra etre ajoute plus tard si l'API l'expose).
- Stats systeme (grille 2x3 de mini-cards) :
  - Decouvertes : `x / 14` (positions hors ceintures)
  - Mes planetes : `m`
  - Alliees : `a`
  - Hostiles : `h`
  - Vides : `v`
  - Inconnues : `i`
- Les 2 ceintures d'asteroides (positions 8 et 16) ne sont pas comptees dans ces stats puisqu'elles sont toujours connues.
- Legende repliable (toggle, fermee par defaut) : rappel des etats de slot + couleurs faction.
- CTA bas : `Centrer sur ma capitale` si une planete mienne dans le systeme.

#### Mode B : Planete selectionnee (occupee)

- Header planete : nom (gros), sous-titre `Tellurique temperee - Position 5`.
- Bandeau proprietaire : avatar/initiale + pseudo + tag d'alliance + relation (`Hostile` rouge, `Allie` bleu, `Vous` cyan).
- Section Biomes (si decouverts) : grille de chips, une par biome, couleur de rarete + nom + effet principal. Si non explores : ligne `Biomes inconnus - explorer pour reveler`.
- Section Champ de debris (si present) : icone SVG `MissionIcon` debris + ressources recuperables.
- Section Actions (boutons primaires conditionnes a la possession des bonnes flottes, logique back actuelle) :
  - Si vous : `Gerer la planete` (lien vers la vue planete).
  - Si allie : `Message au joueur`.
  - Si hostile : `Espionner` / `Attaquer` / `Message`.

#### Mode C : Planete selectionnee (vide decouverte)

- Header : `Position 5 - Tellurique temperee - vide`.
- Section Biomes potentiels : si deja explores, meme grille de chips. Sinon `Explorer pour reveler les biomes`.
- Section Actions :
  - `Coloniser` (si colonisateur disponible).
  - `Explorer` (si explorateur disponible et biomes pas tous decouverts).

#### Mode D : Position inconnue selectionnee

- Header : `Position 5 - Inconnu` en gris.
- Une seule action : `Envoyer une sonde d'exploration`.
- Texte d'ambiance gris : *"Aucune donnee disponible. Envoyer un explorateur pour reveler la position."*

#### Mode E : Ceinture d'asteroides selectionnee

- Header : `Position 8 - Ceinture d'asteroides`.
- Visuel central : reutilisation du composant `<AsteroidBelt>` existant a pleine largeur du panneau. C'est le seul endroit ou l'animation lourde est rendue.
- Section Action : `Lancer une mission de minage` + temps + ressources estimees, selon la mecanique actuelle.

#### Transitions entre modes

- Fade rapide (~150 ms) sur le contenu du panneau quand `selectedSlot` change.
- La largeur ne bouge pas (340 px fixe) -> pas de reflow du canvas.

## Interactions transverses

### Source de verite unique

Un seul etat React local `selectedSlot: { kind: 'system' | 'slot', position?: number }` est detenu par `GalaxySystemView`. Tous les clics (ribbon, canvas, etoile) le mettent a jour. Tous les rendus (canvas, ribbon, panel) en derivent.

### Navigation systeme

La top bar existante est conservee, simplement repositionnee au-dessus des trois zones. Elle contient :
- `<` precedent / `>` suivant systeme
- Input de coordonnees `[Galaxy:System]`
- Bouton `Galaxie >` (lien future vue large, hors scope)

### Raccourcis clavier

| Touche | Effet |
|--------|-------|
| `<-` / `->` | Systeme precedent / suivant |
| `Up` / `Down` | Selection precedente / suivante dans le ribbon (cycle 1->16) |
| `Esc` | Desselectionne (mode A) |
| `Enter` sur planete selectionnee | Action principale (Gerer / Espionner / Coloniser selon le mode) |

Les raccourcis sont desactives quand le focus est dans un champ texte (input de coordonnees, chat, etc.).

### Persistance dans l'URL

La selection courante est refletee dans l'URL via querystring : `?pos=5`. Cas couverts :
- Partage d'un lien direct vers une planete.
- Retour navigateur arriere -> desselectionne ou revient au systeme precedent.
- L'URL systeme reste inchangee : `/galaxy?g=1&s=42`.

### Accessibilite

- Le canvas SVG est `role="img"` avec un `aria-label` global decrivant le systeme : `"Systeme 1:42, 9 positions sur 16 decouvertes, 2 vous appartiennent"`.
- Chaque marqueur de planete est un `<g role="button" tabindex="0" aria-label="Position 5, Kepler-3b, hostile">`, navigable au clavier independamment du ribbon.
- Le ribbon est une `<ul role="listbox">` avec `aria-activedescendant` pointant la selection courante.
- `prefers-reduced-motion: reduce` desactive toutes les animations decoratives.

## Performance

- Le canvas est un **unique SVG** (pas 16 sous-composants React isoles). Re-render uniquement si `selectedSlot` ou `slots` changent.
- Toutes les animations sont en CSS keyframes -> aucun JS rAF, GPU-friendly.
- L'animation lourde `<AsteroidBelt>` n'est rendue que dans le panneau detail mode E -> 0 ou 1 instance, jamais 2.
- Le marqueur de belt sur la carte est un composant separe `<OrbitalDebrisRing>` qui rend juste ~22 petits disques statiques.

## Decoupage en composants

Tous les nouveaux fichiers vivent dans `apps/web/src/components/galaxy/GalaxySystemView/`.

| Composant | Role | Taille approx. |
|-----------|------|----------------|
| `GalaxySystemView.tsx` | Conteneur desktop, owns `selectedSlot`, gere raccourcis clavier | ~150 lignes |
| `Ribbon.tsx` | Liste verticale 16 cellules, hover bidirectionnel | ~80 lignes |
| `OrbitalCanvas.tsx` | SVG unique, rend etoile + orbites + slots | ~200 lignes |
| `OrbitalCanvas/SlotMarker.tsx` | Un slot (8 etats possibles) | ~120 lignes |
| `DetailPanel.tsx` | Switch sur les 5 modes A-E | ~100 lignes |
| `DetailPanel/ModeSystem.tsx` | Mode A | ~60 lignes |
| `DetailPanel/ModePlanet.tsx` | Modes B + C + D (planete occupee / vide / inconnue) | ~150 lignes |
| `DetailPanel/ModeBelt.tsx` | Mode E, reutilise `<AsteroidBelt>` existant | ~50 lignes |
| `geometry.ts` | Pure functions : `slotAngle()`, `orbitRadius()`, `polarToCartesian()` | ~60 lignes |

## Modifications de l'existant

- **`apps/web/src/pages/Galaxy.tsx`** : remplacer le bloc `hidden lg:block` (le tableau actuel) par `<GalaxySystemView slots={slots} galaxy={...} system={...} />`. Le bloc `lg:hidden` (mobile) reste **strictement inchange**.
- **`apps/web/src/components/galaxy/PlanetDot.tsx`** : ajouter une prop `aura?: 'mine' | 'ally' | 'enemy' | null` qui rend un halo radial sous le disque. Reutilisable entre l'orbital map, le ribbon et le panneau detail (coherence visuelle garantie).
- **`apps/web/src/components/galaxy/AsteroidBelt.tsx`** : aucune modification. Reutilise tel quel dans le panneau detail mode E.
- **`apps/web/src/components/galaxy/OrbitalDebrisRing.tsx`** (nouveau) : version *light* du belt pour la carte, rend juste un anneau de ~22 petits disques orange statiques.
- **`apps/web/src/styles/globals.css`** (ou equivalent) : ajout des keyframes `star-breathe`, `aura-breathe`, `selection-rotate`, `slot-hover`.

## Aucun changement back-end

L'API `getSystem(galaxy, system, userId?)` (`apps/api/src/modules/galaxy/galaxy.service.ts`) et la structure `slots` couvrent deja 100 % du besoin. Les tables `discoveredPositions`, `discoveredBiomes`, `planets` restent inchangees. C'est strictement une refonte client desktop.

## Stack visuel

- **Tailwind** : reutilisation des couleurs deja tokenisees dans `tailwind.config.js`. Les couleurs d'aura peuvent reutiliser `cyan-300`, `blue-400`, `red-400` existantes.
- **SVG inline uniquement**. Aucun `<canvas>`, aucune lib externe.
- **Animations** : 4 keyframes ajoutes dans `globals.css`. Tout en CSS, zero JS.
- **Icones** : pas d'emoji (regle projet). Reutilisation des SVG du dossier `apps/web/src/components/common/`. Au plus un nouveau SVG si necessaire (`SystemIcon` pour l'etoile dans le mode A).

## Tests

- **`geometry.test.ts`** : tests purs sur `slotAngle()` (determinisme : meme `(g, s, pos)` -> meme angle), `orbitRadius()` (monotone croissant, dans le canvas), distribution angulaire (16 angles distincts par systeme).
- **`SlotMarker.test.tsx`** : rendu par etat (8 cas), snapshot SVG, bonne couleur d'aura selon `relation`.
- **`GalaxySystemView.test.tsx`** : integration. Click sur ribbon met a jour le panneau, click sur etoile desselectionne, raccourcis clavier (`<-`, `->`, `Up`, `Down`, `Esc`), hover bidirectionnel ribbon <-> canvas.
- Pas de test visuel automatise sur les animations CSS.

## Risques et points d'attention

- **Hover bidirectionnel ribbon <-> canvas** : un peu de plomberie React (selecteur partage). A implementer proprement via le state `hoveredSlot` au niveau du parent.
- **Determinisme du hash angulaire** : la fonction de hash doit rester stable a travers les versions, sinon les positions des planetes "bougeraient" entre deux deploiements. A documenter dans le commentaire de `slotAngle()`.
- **Cohabitation avec les selecteurs de planete existants** : la vue galaxie partage des handlers avec d'autres pages (chat, target dropdowns). Verifier qu'on ne casse pas les flux de selection existants quand on ajoute le state local `selectedSlot`.
- **Resize** : le canvas doit recalculer les rayons d'orbites au resize de la fenetre. `ResizeObserver` sur le wrapper, debounce 100 ms.
