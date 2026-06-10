# Design system as code — unification & design sheet vivante

> **Statut** : brainstorm ouvert (proposal). Compagnon de `2026-06-10-design-refonte-calme-spatial.md` :
> le doc « calme spatial » dit *à quoi ça ressemble*, celui-ci dit *comment on l'impose dans le code*.
> **Date** : 2026-06-10

---

## 1. Le constat : le système actuel est une convention orale

| Mesure | Valeur | Lecture |
|---|---|---|
| Usage de la primitive `ui/card` | **1 fichier** | La primitive existe, personne ne s'en sert |
| Cartes écrites à la main (`rounded+border`) | **106** | Chaque écran réinvente la carte |
| Couleurs hex en dur dans les `.tsx` | **177** | Les tokens existent mais sont contournés |
| Composants `common/` | 33 | Bonne couche métier… aux styles internes divergents |

Sans couche de code qui **impose** le langage, toute purge esthétique se re-pollue : un dev solo pressé (nous) recopiera le pattern le plus proche, divergent. La refonte design n'est durable que si **le chemin le plus facile est le chemin correct**.

---

## 2. Architecture en 3 couches

```
┌─ 3. PATTERNS DE JEU ──────────────────────────────────────┐
│  EntityCard · Stat · QueuePanel · HubTabs · DetailOverlay │  ← les écrans composent ÇA
├─ 2. PRIMITIVES ───────────────────────────────────────────┤
│  Surface · Text · Stack/Inline · Button · Badge · Tabs    │  ← les patterns composent ÇA
├─ 1. TOKENS ───────────────────────────────────────────────┤
│  couleur · typo · espacement · rayon · motion · élévation │  ← tout le reste consomme ÇA
└───────────────────────────────────────────────────────────┘
```

Règle d'or : **une page n'écrit jamais une couleur, une taille de texte ou une durée**. Elle compose des patterns ; les patterns composent des primitives ; les primitives consomment des tokens.

### 2.1 Couche 1 — Tokens (CSS variables + mapping Tailwind)

Deux niveaux : primitifs (l'échelle brute) → **sémantiques** (le sens). Le code n'utilise QUE les sémantiques.

**Couleur (sémantique) :**

| Token | Rôle |
|---|---|
| `bg` / `surface` / `surface-raised` | page / carte / popover-menu (3 niveaux, c'est tout) |
| `border` / `border-strong` | défaut / hover-focus |
| `text` / `text-secondary` / `text-faint` | 3 niveaux (AA documenté, on garde l'existant) |
| `primary` / `on-primary` | LA couleur d'action (cyan désaturé) |
| `res-minerai/-silicium/-hydrogene/-energie` | sémantique de jeu (sans glow) |
| `danger` / `warning` / `success` | vrais états uniquement |

**Typo (rôles, plancher 12px) :** `display 28/600 · page 20/600 · title 16/600 · body 14/400 · secondary 13/400 · caption 12/400` + `nums` (tabular). Six rôles, pas un de plus.

**Espacement :** échelle 4-8-12-16-24-32 (déjà l'usage de fait via Tailwind — on la documente et on s'y tient).

**Motion :** `fast 120ms · base 200ms · slow 350ms` × 2 courbes (`standard` ease-out, `spring` celle des sheets). + `reduced-motion` global.

**Élévation :** `none` (surface) · `raised` (une ombre discrète, la seule autorisée).

### 2.2 Couche 2 — Primitives (8, pas 30)

| Primitive | API (esquisse) | Remplace |
|---|---|---|
| `<Surface>` | `variant: card\|raised`, `interactive?` (hover/focus states intégrés) | glass-card, retro-card×5, 106 cartes ad hoc |
| `<Text>` | `role: display…caption`, `tone`, `nums?` | 618 micro-typos + uppercase sauvages |
| `<Stack>/<Inline>` | `gap: 1-6` (échelle) | les flex/grid gap improvisés |
| `<Button>` | 4 variants : `primary, secondary, ghost, danger` | l'actuel (− retro) |
| `<Badge>` | `tone: neutral\|res-*\|danger\|warning\|success` | pills colorées ad hoc |
| `<Tabs>` | utilisé par hub Flotte, Production, Classements, planète | 4 implémentations actuelles |
| `<Icon>` | taille par token | tailles inline |
| `<Progress>` | barre + règlement de fin animé | barres ad hoc |

Critère d'entrée strict : une primitive n'existe que si elle est utilisée ≥ 3 endroits. Le reste vit dans les patterns.

### 2.3 Couche 3 — Patterns de jeu (l'anatomie répétée d'Exilium)

C'est l'apport le plus rentable : **le jeu entier répète ~8 structures**. On les canonise une fois :

1. **`EntityCard`** — bâtiment, vaisseau, défense, recherche : *même anatomie* (image, nom+niveau, effet, coûts, durée, CTA, états verrouillé/file/max). Aujourd'hui ré-implémentée par page (Buildings 619 l., Shipyard, Defense, Research…). UNE implémentation paramétrée = la moitié de la dette UI du jeu.
2. **`Stat`** — chiffre + icône ressource + variation (`tabular-nums`, compteur animé). Utilisé : topbars, KPI, cartes, files.
3. **`QueuePanel`** — file de construction/production (item, barre, timer, annuler). 3 variantes actuelles → 1.
4. **`PageHero`** — HeroAtmosphere + titre + KPI bar (déjà quasi-pattern, on fige l'API, tints neutralisés).
5. **`DetailOverlay`** — fiche entité (déjà `EntityDetailOverlay`, on y branche le reste).
6. **`AlertBanner`** — surextension, attaque, brownout : le SEUL composant autorisé à pulser.
7. **`EmptyState` / `LockedState`** — existants, à tokeniser.
8. **`DataList`** — classements, rapports, mouvements (ligne mobile / table desktop — le dual-rendering actuel de Ranking, généralisé).

### 2.4 Enforcement — le système qui se défend tout seul

- **ESLint (`eslint-plugin-tailwindcss` + règle custom)** : interdit dans `pages/` et `components/` (hors `ui/`) : `text-[10px]`, `text-[11px]`, `bg-gradient-*`, `backdrop-blur-*`, `shadow-[0_0`, hex inline `#…`, `glow-*`. Erreur, pas warning.
- **Tailwind config** : suppression des utilities `glow-*`, `glass-card`, `retro-*` → l'usage casse au build au lieu de traîner.
- **CI** : déjà en place (lint en parité) — les règles y vivent gratuitement.
- Échappatoire explicite : `// eslint-disable-next-line design-system -- raison` (greppable, justifiée).

### 2.5 La design sheet vivante

Deux faces, même source :

1. **`/design` (route admin-only, in-app)** : la vitrine vivante — tous les tokens rendus (palette, typo, motion jouable), chaque primitive dans tous ses états, chaque pattern avec données de démo. *C'est dans le vrai runtime* : si la sheet est belle, le jeu est beau. Coût marginal (une page qui importe ce qui existe), zéro Storybook à maintenir.
2. **`docs/reference/design-system.md`** : la règle écrite — tokens, quand utiliser quoi, les interdits, comment ajouter un composant. Versionné, lu par les futures sessions Claude (≈ CLAUDE.md du design).

---

## 3. Stratégie de migration (remplace les lots D0-D3 du doc compagnon)

1. **M0 — Fondations** : tokens v2 (variables + mapping Tailwind), primitives (`Surface`, `Text`, `Stack`, `Tabs`, `Stat`, `Progress`), route `/design`, doc de référence. **Aucune page ne change** — le système existe à côté.
2. **M1 — Patterns** : `EntityCard`, `QueuePanel`, `AlertBanner`, `DataList` construits sur les primitives, exposés dans `/design`.
3. **M2 — Migration mécanique** : codemod (script) pour les cas triviaux — `text-[10px]→<Text role=caption>` n'est pas automatisable proprement, mais `glow-*` (suppression), hex→tokens, `glass-card→Surface` le sont en grande partie. Le reste : page par page, **les plus visibles d'abord** (Empire, planète, Flotte).
4. **M3 — Enforcement ON** : les règles ESLint passent en erreur quand la migration d'un dossier est finie (activation par dossier via overrides).
5. **M4 — Motion & perfs** : View Transitions, compteurs animés, optimistic UI (inchangé vs doc compagnon).

Chaque étape shippe seule ; screenshots avant/après par page pour validation.

---

## 4. Questions ouvertes (en plus de celles du doc compagnon)

1. La route `/design` : admin-only (réutilise la garde admin existante) ou build dev uniquement ?
2. `EntityCard` : migrer Research (656 l.) en premier (le plus gros gain) ou en dernier (le plus risqué) ?
3. Veut-on figer les primitives dans `packages/` (réutilisables par l'admin app) ou rester dans `apps/web` ? *(intuition : `apps/web` d'abord, extraction si l'admin en a besoin un jour)*

---

*Document de travail — design system as code, 2026-06-10.*
