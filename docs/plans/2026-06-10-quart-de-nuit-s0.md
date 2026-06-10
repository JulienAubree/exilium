# Quart de nuit — S0, l'écran témoin

> **Statut** : **gelé** — implémenté (commit `998361c6`) puis **retiré le 2026-06-10 au soir** par le rollback du shell (retour à l'itération sidebar, décision user). Conservé comme spec de référence si le chantier rouvre ; le code est dans l'historique git.
> **But initial** : valider le langage visuel avec les joueurs sur staging avant de dérouler S1-S5. Aucune mécanique touchée.

## Périmètre

**Dans S0** — le thème appliqué à trois objets, les plus vus et les plus « âme OGame » :
1. **La topbar / barre de ressources** (transversale) : chiffres exacts en mono, tick vivant.
2. **Le home Empire** : la vue tous-mondes passe en **table** (commandement n°2), coordonnées mono cliquables, timers à la seconde, alertes en tête.
3. **Le titre d'onglet** : compte à rebours du prochain événement dans `document.title` quand l'onglet est en arrière-plan (commandement n°4 — gratuit et emblématique).

**Hors S0** : tous les autres écrans, le son, la voix des officiers, l'haptique, les rituels (S2-S5), le retraitement des illustrations (S1 — en S0, simple cadre acier).

## Mécanisme de thème

- Une classe **`.theme-quart` sur `<html>`** qui redéfinit les variables HSL existantes de `global.css` (le thème est strictement additif : sans la classe, rien ne change).
- État dans le store UI (zustand persist) : `theme: 'default' | 'quart'`, toggle sans reload.
- **Switcher visible uniquement si `VITE_THEME_LAB=1`** (défini dans le build staging, absent du build prod) : entrée dans la page `/design` (DesignSheet) + menu profil. Le code du thème peut donc passer par le flux normal merge → prod+staging ensemble, sans être exposé en prod.
- **Fonte donnée** : IBM Plex Mono 400/500 (latin, woff2 self-hosted, ~50 Ko), préchargée seulement quand le thème est actif. Inter reste la fonte UI.

## Tokens (extraits — la table complète se fixe à l'implémentation)

| Variable | Défaut actuel | Quart de nuit |
|---|---|---|
| `--background` | `220 55% 3%` | `219 41% 7%` (#0A0F18 — bleu-noir spatial) |
| `--card` | `220 50% 8%` | `214 37% 13%` (#15202E — acier bleuté) |
| `--border` | *(actuel)* | `218 31% 24%` (#2A3850 — liseré métal) |
| `--foreground` | `210 20% 85%` | `209 24% 83%` (#C9D4DE — écume) |
| `--primary` | `200 85% 65%` (cyan) | `209 61% 65%` (#6FA8DC — bleu acier : liens, coordonnées) |
| `--live-data` *(nouveau)* | — | `36 79% 57%` (#E8A33D — phosphore ambre : timers, valeurs qui bougent) |
| `--font-data` *(nouveau)* | — | IBM Plex Mono |

Inchangés : les 4 couleurs-ressources (sémantique de jeu), `--destructive` & co (vrais états), motion tokens.

**Règle d'usage du mono** : réservé à la *donnée* (chiffres, coordonnées, timers, quantités) — jamais aux libellés ni aux phrases. C'est ce qui sépare « instrument » de « fatigue ».

## Le home Empire en « quart »

- **Table des planètes** (remplace/complète la grille de cartes, S0 = mode table par défaut sous le thème) : colonnes `[G:S:P]` (mono, bleu acier, lien) · planète · vocation · file en cours (nom + **timer ambre à la seconde**) · état (`●` vert nominal / rouge alerte). Lignes denses mais ≥12px, zébrage acier subtil.
- **Barre de ressources** : valeurs exactes `tabular-nums` en mono (abréviation k/M tolérée en mobile étroit, valeur exacte au tap), tick animé existant conservé.
- **Alertes en tête de page** en rouge — la seule couleur qui crie (file vide, attaque entrante).
- **Hero** : conservé mais resserré — l'atmosphère vient de l'illustration, le cadre devient instrument (filets acier, pas de glow).

## Definition of done

- Toggle on/off instantané, persisté, zéro régression visuelle thème défaut (vérif visuelle des écrans principaux dans les deux modes).
- Contraste **AA vérifié** sur les nouvelles paires (écume/fond, ambre/panneau, bleu acier/fond).
- `document.title` : compte à rebours actif uniquement onglet caché, restauré au focus.
- `pnpm typecheck` à chaque lot, `lint` + `test` en fin (parité CI).
- Budget : aucune dépendance lourde ; la fonte est le seul asset ajouté.
- Livraison : branche `feat/theme-quart-s0`, **présentation avant tout déploiement** (workflow CLAUDE.md), puis merge + déploiement prod & staging ensemble — le switcher n'apparaît qu'en staging via le flag.

## Mesure & critère de passage à S1

- Annonce in-game sur staging + post épinglé ; retours via la table `feedbacks`, titres préfixés `[Quart de nuit]`.
- **Passage à S1 si** : retours majoritairement positifs **et** aucun blocage de lisibilité mobile remonté. Sinon, itération sur S0 (les tokens se retunent sans redéploiement de structure).

## Risques

- **Les illustrations jurent dans le cadre acier** → S0 assume le simple recadrage ; le traitement « feed instrument » est un chantier S1.
- **La table dense déroute les joueurs récents** → garder l'accès à la vue cartes (toggle de vue local), la table est le défaut du *thème*, pas une suppression.
- **L'ambre phosphore trop proche du orange-minerai** → à valider à l'écran ; sinon décaler l'ambre vers `45°` de teinte (doré).
