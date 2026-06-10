# La Passerelle — shell RTS à panneaux (concept B, retiré)

> **Statut** : **retiré (2026-06-10 soir)** — P1→P5 ont été livrés dans la journée puis
> **annulés par rollback** : le user a tranché pour le retour à l'itération sidebar
> (shell Empire-first, `ebd2c409`). Le code reste dans l'historique git. Conservé comme
> trace du concept et de ses leçons (cf. contrainte n°3 : 4 métamorphoses en 48 h, c'est
> précisément le risque qui s'est matérialisé).
> *(Historique : suite logique du shell Empire-first — le user demandait le paradigme RTS,
> le dock planète flottant en était le précurseur.)*

## 1. Le paradigme

On ne **navigue** plus entre des pages, on **pilote** depuis un poste de commandement :

```
┌──────────────────────────────────────────────────────────────┐
│  nav fantôme (haut) — hubs + actions                          │
│                                                               │
│   ┌─────────────┐          CANVAS                ┌─────────┐ │
│   │ PANNEAU     │   (la carte galactique vivante │ PANNEAU │ │
│   │ Planète     │    — ou le home Empire en      │ Flotte  │ │
│   │ (drill-down │    étape intermédiaire)        │ (mvts,  │ │
│   │  fenêtré)   │                                │  envoi) │ │
│   └─────────────┘                                └─────────┘ │
│  [dock planète]                    [barre de panneaux P F E …]│
└──────────────────────────────────────────────────────────────┘
```

- **Canvas** : le fond permanent. Cible finale = la carte galactique vivante (planètes,
  mouvements de flottes en temps réel — le SSE existe déjà —, plus tard territoires
  d'alliance). Étape intermédiaire acceptable : le home Empire reste le canvas.
- **HUD persistant** : nav fantôme (existante), dock planète (existant), alertes
  (AlertBanner), et une **barre de panneaux** pour toggler les fenêtres.
- **Panneaux flottants** : Planète (le drill-down actuel, fenêtré), Flotte (mouvements +
  envoi), Empire (synthèse), Recherche, Marché… Ouvrables/fermables, raccourcis clavier
  (P, F, E, G), 1-2 panneaux simultanés (pas un window-manager complet).

## 2. Ce qui rend ça crédible (l'existant fait 80 % du travail)

- **Les overlays existent déjà** : `EntityDetailOverlay`, `SendFleetOverlay`,
  `AbandonColonyModal`… Le jeu sait déjà afficher du contenu par-dessus. Il manque un
  **PanelManager** : registre des panneaux, stack, toggle, raccourcis, persistance
  (un store zustand comme `ui.store`).
- **Les pages sont des composants propres** (post-refonte) : `Movements`, `StationedFleet`,
  le drill-down planète — elles peuvent se rendre *dans une fenêtre* comme dans une route
  (le pattern Production/FleetHub le prouve déjà).
- **Le design system v2** donne la matière des fenêtres gratuitement (`Surface raised`,
  motion tokens, `TabBar`).
- **SSE temps réel** déjà en place pour nourrir une carte vivante.

## 3. Les contraintes honnêtes

1. **La carte doit mériter le centre** : aujourd'hui elle est consultative. Pour être le
   canvas, il lui faut : mouvements de flottes visibles en temps réel, focus sur SES
   planètes, et à terme le territoire (pilier Alliances). Sinon le canvas est un fond mort.
2. **Mobile** : les panneaux deviennent des bottom sheets plein écran (la BottomTabBar
   fait déjà ça conceptuellement). Le canvas-carte sur mobile = consultatif, pas permanent.
3. **Réapprentissage joueurs** : 4ᵉ métamorphose en 48h — il faudra une annonce et
   peut-être une période où les deux modes coexistent (les routes restent valides).
4. **Perf** : la carte en canvas permanent doit être sobre (pas de re-render continu).

## 4. Chemin de migration (chaque étape utile seule, pas de big bang)

1. **P1 — PanelManager + panneau Flotte** : le système de fenêtres (store, raccourcis,
   barre de toggle) avec UN panneau : Mouvements/Envoi consultable par-dessus n'importe
   quel écran (raccourci F). Valeur immédiate même si on s'arrête là.
2. **P2 — Planète en panneau** : le dock ouvre la planète en fenêtre (P) par-dessus
   l'écran courant ; le drill-down route reste pour les liens profonds.
3. **P3 — Empire/Recherche en panneaux** légers (synthèses, pas les pages complètes).
4. **P4 — La carte devient le home** : `/` = galaxie (focus sur ton territoire), les
   panneaux par-dessus. Le vrai basculement RTS — à ne franchir que quand P1-P3 prouvent
   le pattern et que la carte s'est animée.
5. **P5 — La carte vivante** : flottes en mouvement, événements, territoires (rejoint le
   chantier Alliances de la proposal 4X).

## 5. Questions ouvertes

1. Panneaux **déplaçables/redimensionnables** ou positions fixes (gauche/droite) ?
   *(Intuition : fixes d'abord — la liberté de drag est du polish, pas du paradigme.)*
2. Combien de panneaux simultanés ? *(Intuition : 2 max, un par côté.)*
3. P4 : la carte-canvas remplace le home Empire, ou le home Empire devient lui-même un
   panneau (E) par-dessus la carte ?
4. Raccourcis clavier : P/F/E/G/M (+ Échap ferme) — conflits avec le navigateur à vérifier.
