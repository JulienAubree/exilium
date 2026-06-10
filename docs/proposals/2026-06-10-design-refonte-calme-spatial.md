# Refonte design — audit & direction « calme spatial »

> **Statut** : brainstorm ouvert (proposal). Rien d'implémenté.
> **Date** : 2026-06-10
> **Objectif user** : « hyper smooth, hyper agréable, XXIe siècle, pas de marqueurs AI slop ».
> **Lié à** : refonte IA (2026-06-09) — la structure est faite, ici on traite la peau et le mouvement.

---

## 1. Audit

### 1.1 Ce qui est bien (fondations à garder)

- **Vrais tokens** : palette HSL en CSS variables + Tailwind/shadcn → tout est retunable en un endroit.
- **Souci du contraste** : `--muted-foreground-soft` documenté WCAG AA dans le CSS — rare, précieux, à garder comme exigence.
- **Identité couleur des ressources** (minerai orange, silicium vert, hydrogène bleu, énergie jaune) appliquée partout avec cohérence. C'est de la sémantique, pas de la déco — ça reste.
- **HeroAtmosphere** : système image-clé floutée + wash + fondu vers la page. Bon pattern (la couleur vient du *contenu*), réutilisé partout.
- **Mobile soigné** : `touch-feedback`, safe-areas, `dvh`, anti-zoom iOS, bottom sheets avec une vraie courbe (`cubic-bezier(0.32, 0.72, 0, 1)`).
- **Skeletons systématiques** + composants communs riches (KpiTile, FilterPills, EmptyState, Timer…).
- Les **illustrations** (planètes, bâtiments, vaisseaux) sont l'atout visuel n°1 du jeu.

### 1.2 Ce qui date / les marqueurs « AI slop » (mesuré)

| Marqueur | Mesure | Problème |
|---|---|---|
| Glows néon (`glow-*`, `shadow-[0_0_…]`, `pulse-glow`) | classes dédiées + hovers | Esthétique « sci-fi dashboard » générique, bruit permanent |
| Dégradés (`bg-gradient`) | **91 occurrences** | Washes violet/indigo/cyan = LE marqueur IA 2024-25 |
| Glassmorphism (`backdrop-blur`) | **66 occurrences** | Coût GPU mobile réel (jank au scroll), flou visuel |
| Micro-typo 10-11px | **618 occurrences** | « Tableur sci-fi », illisible mobile, fatigue |
| `uppercase tracking-wider` | **298 occurrences** | Crie partout → plus de hiérarchie |
| Bordures colorées `/20 /30 /40` | **240 occurrences** | Chaque carte a sa teinte → plus rien ne ressort |
| Langages de carte concurrents | `glass-card`, `retro-card` ×5, ad hoc | Pas d'unité |
| Bouton `retro` (mono+gradient+glow) | 1 variant | Troisième langage typographique |
| `prefers-reduced-motion` | **4 occurrences** | Accessibilité motion quasi absente |
| Animations | 8 keyframes ad hoc, durées/courbes disparates | Pas de *système* de motion |

**Diagnostic en une phrase : l'UI crie en permanence, donc rien n'est important.** Le néon constant, les washes colorés et la micro-typo en capitales créent une tension visuelle continue — l'inverse de « smooth ». Et c'est précisément le cocktail (glass + glow + gradient violet) que tout le monde identifie aujourd'hui comme du design généré.

---

## 2. Direction proposée : « calme spatial »

> **Thèse : l'espace est sombre, vaste et silencieux — pas un casino.**
> L'UI devient quasi muette ; la couleur et l'émotion viennent du *contenu* (illustrations, carte, événements). Quand quelque chose bouge ou s'allume, c'est que ça **veut dire quelque chose**.

### 2.1 Couleur — « la couleur appartient au contenu »

- **UI monochrome** : fond, 2 niveaux de surface, bordure unique, texte sur 3 niveaux, UNE couleur primaire (le cyan actuel, légèrement désaturé). C'est tout.
- **Les 4 couleurs ressources restent** (sémantique de jeu) mais **sans text-shadow néon** — la couleur seule suffit, le glow n'ajoute que du flou.
- **Rouge/ambre réservés aux vrais états** : attaque entrante, surextension, déficit. Si une bordure est ambre, il se passe quelque chose. (Aujourd'hui : 240 bordures colorées décoratives → l'alerte ne ressort plus.)
- **Mort aux washes violets** : HeroAtmosphere garde l'image floutée + fondu, mais les tints `from-indigo-950 via-purple-900` deviennent neutres (slate) — l'image apporte déjà sa couleur.

### 2.2 Matière — une seule, honnête

- **Un seul langage de surface** : `surface` (carte) et `surface-raised` (popover/menu), bordure 1px, **zéro blur, zéro gradient, zéro ombre néon**. Une ombre portée discrète max pour les éléments flottants.
- `glass-card`, `retro-card*`, variant bouton `retro` : supprimés/migrés.
- **`backdrop-blur` limité à 2 endroits max** (topbar mobile, bottom sheet) — ou remplacé par opacité pleine : gain de fluidité immédiat sur mobile milieu de gamme.
- `bg-stars` : ok en fond de page connexion/landing, pas dans l'app.

### 2.3 Typographie — moins de niveaux, plus grands

- **Échelle fixe** : 12 (caption) / 13 (secondary) / 14 (body) / 16 (title) / 20 (page) / 28 (display). **Plancher 12px** — les 618 usages de 10-11px migrent vers 12-13.
- **Uppercase divisé par ~5** : réservé aux en-têtes de section de carte (un par carte max). Le reste passe en sentence case avec graisse/couleur pour hiérarchiser.
- **`tabular-nums` partout où il y a des chiffres qui changent** (déjà 85 usages — généraliser aux ressources, timers, files).
- Inter reste (bonne fonte, bien chargée). Optionnel : une fonte display pour les titres de pages/héros si on veut un caractère (à tester — pas obligatoire).

### 2.4 Motion — un système, pas des animations

C'est LE levier « hyper smooth ». Trois principes :

1. **Tokens de motion** : `--motion-fast: 120ms` (hover, press), `--motion-base: 200ms` (apparitions, tabs), `--motion-slow: 350ms` (sheets, overlays) + 2 courbes : `ease-out` standard, et la spring existante des sheets pour tout ce qui « glisse ». On supprime les durées ad hoc.
2. **Le mouvement raconte la continuité** :
   - **View Transitions API** sur les navigations (drill-down planète, ouverture hub) — supportée par les navigateurs cibles PWA, fallback gratuit.
   - **Compteurs de ressources animés** (tween sur la valeur, pas de saut) — le tick devient vivant.
   - **Files/timers** : la barre de progression se termine par un règlement doux (ease-out) + état « terminé » qui respire une fois, pas un pulse infini.
3. **`prefers-reduced-motion` respecté globalement** (un utilitaire, pas du cas par cas).

### 2.5 Smoothness ressentie = perfs + optimisme

- **Optimistic UI sur les mutations fréquentes** (lancer une construction/production : feedback instantané, rollback si erreur) — tRPC/React Query le permet proprement.
- **Prefetch au survol/touchstart** des liens de nav (React Router `lazy` + warmup).
- **Moins de blur = moins de jank** (cf. 2.2).
- Audit Lighthouse mobile après refonte pour valider (objectif : interactions < 100ms perçues).

### 2.6 Micro-moments de jeu (la vie au bon moment)

Le calme général rend les moments forts possibles :
- **Level-up d'empire** : un vrai moment (l'écran respire, la couronne s'anime une fois) — pas un toast générique.
- **Attaque entrante** : la seule chose qui a le droit de pulser en continu.
- **Fin de construction** : satisfaction douce (check + règlement de la barre), pas de feu d'artifice.

---

## 3. Mise en œuvre proposée (incrémentale, comme l'IA)

1. **Lot D0 — tokens & purge** : nouvelles variables (surfaces, motion), suppression `glow-*`/`retro-*`/variant retro, neutralisation des tints HeroAtmosphere, plancher typo 12px sur les composants *communs* (KpiTile, badges, tabs, subnavs). Gros volume mais mécanique.
2. **Lot D1 — motion système** : tokens durées/courbes, View Transitions sur la nav, compteurs animés, reduced-motion global.
3. **Lot D2 — composants** : unification carte/surface, bouton (4 variants max), états (hover/focus/active) systématiques.
4. **Lot D3 — page par page** : repasse écran par écran (Empire, planète, Flotte, Galaxie…) en appliquant le langage — l'occasion de dédensifier les pages les plus chargées (Recherche 656 lignes, Missions, Énergie).
5. **Lot D4 — optimistic UI + prefetch** (peut courir en parallèle).

**Garde-fous** : pas de redesign des illustrations (elles portent l'identité) ; contraste AA conservé ; chaque lot shippe seul ; avant/après screenshots à chaque lot pour valider le cap avec le user.

---

## 4. Questions ouvertes

1. **Fonte display** pour les titres (caractère) ou Inter partout (sobriété) ?
2. Le **thème reste-t-il sombre uniquement** ? (Un jeu spatial en light mode est étrange, mais la PWA en plein soleil…) Proposition : sombre seul, mais surfaces légèrement éclaircies pour la profondeur.
3. **bg-stars** : garder une présence subtile du ciel étoilé dans l'app (fond de page Empire ?) ou réserver au login ?
4. Jusqu'où pousser la dédensification des pages stats-lourdes (Énergie, Recherche) — tableaux ou cartes ?

---

*Document de travail — audit design du 2026-06-10. À discuter avant spec/implémentation.*
