# Refonte « 3 clics » — l'empire au bout des doigts

> **Statut** : brainstorm ouvert (proposal). Rien d'implémenté.
> **Note (2026-06-10 soir)** : le shell Passerelle (panneaux P/F/E, command bar) a été **retiré** — rollback vers l'itération sidebar. Les constats « déjà livré » côté panneaux ne tiennent plus ; les chantiers (presets, carte d'intention, alertes actionnables, délégation) restent valables dans le shell sidebar.
> **Date** : 2026-06-10
> **Règle user** : *chaque action doit pouvoir se faire en 2 ou 3 clics max.*
> **Lié à** : `2026-06-09-modernisation-4x-empire.md` (altitude), `2026-06-09-refonte-architecture-information.md` (4 hubs), `2026-06-10-la-passerelle-rts-shell.md` (panneaux), `2026-06-10-design-refonte-calme-spatial.md` (calme).

---

## 1. Où on en est — la structure est prête, pas les parcours

Ce qui est déjà livré rend la règle des 3 clics *atteignable* :

- **Shell Empire-first + 4 hubs** : la planète est un drill-down, plus un monde parallèle.
- **La Passerelle (P1→P5)** : panneaux P/F/E toujours ouverts, command bar centrale, galaxie plein écran avec flottes animées. *Construire un bâtiment = P → Construire → ↑ = déjà 2-3 clics.* ✅
- **Gouverneurs v1** (directive Extraction) + **spécialisation v1** (Minière, Forge) : le 0-clic existe en germe.
- **Optimistic UI (M4)** : agir est instantané, plus de friction réseau perçue.

**Le constat** : la *navigation* est au budget, les *actions* ne le sont pas. On atteint l'endroit en 1-2 clics, puis on tombe dans un formulaire de 2002. L'exemple canonique est l'envoi de flotte : mission + coordonnées + quantité **par type de vaisseau** + cargo + confirmation ≈ 8-15 interactions ([Fleet.tsx](../../apps/web/src/pages/Fleet.tsx) : 6 états de formulaire, zéro preset).

**Les joueurs le disent déjà** (table `feedbacks`, non résolus) :
- « Sauvegarder / Nommer une flotte » — *presets, littéralement.*
- « Faire des flottes préselect — automatiquement le bon nombre de transporteurs » — *auto-composition.*
- « La liste des vaisseaux reset si on clique sur envoyer une flotte » — *perte de saisie = clics gaspillés.*
- (résolu mais même famille : « moyen plus ergonomique de choisir le nombre de vaisseaux »)

---

## 2. Le principe : un budget de clics, pas un slogan

> **La grammaire impériale** — le nombre de clics correspond au *poids de la décision*, jamais à la profondeur des menus :

| Budget | Type d'action | Exemples |
|---|---|---|
| **0 clic** | Ce qui n'est pas une décision d'empereur | files de construction (gouverneurs), recherche en chaîne, défauts de nouvelle colonie |
| **1 clic** | Répondre à un événement | alerte actionnable, toggle panneau, relancer la dernière action |
| **2 clics** | Agir chez soi | construire (P → ↑), produire, lancer la recherche suivante |
| **3 clics** | Projeter de la puissance dehors | cible → intention → **GO** (attaque, transport, espionnage, commerce, colonisation) |

Deux garde-fous de design :

1. **Friction proportionnelle à l'irréversibilité, pas à l'imbrication.** Abandonner une colonie ou engager toute sa flotte mérite une confirmation — mais la confirmation EST le 3ᵉ clic (un bouton qui se transforme en « Confirmer ? »), jamais un 4ᵉ écran.
2. **3 clics ≠ moins de profondeur.** Le réglage fin reste accessible (« Ajuster… » ouvre le formulaire complet) ; c'est le chemin *par défaut* qui est court. Les défauts intelligents font le travail, l'expert garde la main.

**Effet 4X recherché** : moins de clics = l'avantage compétitif passe du *temps de grind* à la *qualité des décisions*. C'est exactement « remonter l'altitude » (proposal modernisation §3) et c'est anti-snowball : le no-life ne gagne plus à la tendinite.

---

## 3. Audit des parcours (aujourd'hui → cible)

| Action | Aujourd'hui (≈) | Cible | Levier |
|---|---|---|---|
| Construire un bâtiment | **2-3** ✅ | 2 | panneau P (fait) |
| Changer de planète active | **2** ✅ | 2 | sélecteur fusionné (fait) |
| Produire des unités | 3-5 | **2-3** | panneau P onglet Produire + quantités mémorisées |
| Lancer une recherche | 3-4 | **2** | file de recherche + « suivante » en 1 clic depuis l'alerte |
| **Envoyer une flotte (attaque/transport)** | **8-15** ❌ | **3** | carte d'intention + presets (chantier A+B) |
| Espionner une cible | 5-8 | **2** | clic cible → Espionner (sondes auto) |
| Coloniser une position | 6-10 | **3** | clic position vide → Coloniser → plan de colonie |
| Réagir à une attaque entrante | 4+ (et il faut *trouver*) | **1-2** | alerte actionnable (chantier C) |
| Vendre un surplus au marché | 5-7 | **2-3** | alerte stock saturé → Vendre → ordre pré-rempli |
| Collecter une mission PvE | 4-6 | **3** | clic mission → preset adapté → GO |
| Équiper une nouvelle colonie | ~20 (cf. proposal 4X §5.3) | **0-2** | plan de colonie + gouverneur par défaut |

---

## 4. Les six chantiers

### A. Le canvas devient la surface d'action — la « carte d'intention » *(Passerelle P6)*

Aujourd'hui la galaxie est consultative : voir une cible et agir dessus sont deux mondes. Demain, **cliquer un objet du canvas ouvre une carte d'intention** (popover ancré, design calme) qui liste les *intentions* possibles selon l'objet et le contexte :

- **Planète ennemie** → Attaquer · Espionner · Marchander
- **Planète à moi** → Voir (panneau P ciblé) · Transférer des ressources
- **Position vide** → Coloniser · Baliser
- **Flotte en vol (la mienne)** → Rappeler · Suivre
- **Mission PvE** → Engager

Clic 1 = la cible. Clic 2 = l'intention. Clic 3 = **GO** (avec preset/défaut affiché, modifiable via « Ajuster… »). La galaxie cesse d'être une carte qu'on regarde : c'est la table de commandement — l'aboutissement logique de la Passerelle, et ce qui « mérite le centre » (question ouverte n°1 du doc Passerelle, résolue par l'usage).

### B. Presets de flotte — la demande joueur n°1

- **Compositions nommées** (« Raid léger », « Convoi minier ») : sauvegarder la composition courante en 1 clic depuis le formulaire actuel.
- **Auto-composition** : pour transport/collecte, calculer le bon nombre de cargos d'après le butin estimé / la capacité (le feedback « préselect » mot pour mot). Pour l'attaque : « ce qu'il faut pour battre le rapport d'espionnage » quand on en a un (lien rapport → contre-attaque en 2 clics).
- **Mémoire par type de mission** : le formulaire ré-ouvre pré-rempli avec la dernière composition utilisée pour cette mission (règle aussi le bug « la liste reset »).
- Les presets apparaissent dans la carte d'intention (chantier A) comme choix du clic 3, et la dernière flotte utilisée est le défaut du **GO**.

### C. Les alertes deviennent des boutons — le home Empire = file d'exceptions

Principe : **une alerte qui ne porte pas sa résolution est une dette de clics.** Chaque alerte du home/panneau E embarque SON action :

- File de construction vide → **[Relancer]** (la directive du gouverneur) — 1 clic
- Recherche terminée → **[Suivante]** (tête de file de recherche) — 1 clic
- Stock saturé → **[Vendre]** / **[Transférer]** (ordre pré-rempli) — 2 clics
- Attaque entrante → **[Évacuer la flotte]** / **[Voir la cible]** (canvas centré + carte d'intention) — 1-2 clics
- Surextension → **[Voir les vocations]** — guidage vers la décision

Le home Empire devient ce que la proposal IA visait : on agit sur les *exceptions*, on ne lit plus un dashboard.

### D. La délégation par défaut — le vrai 0 clic

Étendre ce qui marche (gouverneurs v1) pour que la corvée ne *coûte rien* :

- **Directives alignées sur les vocations** : Forge (production militaire), Recherche, Forteresse (défenses) — choisir une vocation propose sa directive en 1 clic (les deux systèmes v1 fusionnent en une seule décision d'identité de planète).
- **Plans de colonie** : « nouvelle colonie = plan Mine + gouverneur Extraction » → coloniser en 3 clics installe un monde qui démarre seul (tue le « ~20 clics manuels »).
- **File de recherche** (2-3 de profondeur) : la science avance sans rendez-vous.

### E. La command bar devient une palette d'actions

La barre centrale (3 pilules P/F/E) grandit en **palette** (`/` ou clic) : taper « att Krell » → cible trouvée → preset → Entrée. Toute action du jeu en ≤3 frappes pour les joueurs clavier — et le *registre d'actions* qu'elle impose (action = nom + cible + défauts) est la même infrastructure que les cartes d'intention et les alertes actionnables. On construit le registre une fois, trois surfaces le consomment.

### F. Mobile : mêmes budgets, autres gestes

Les panneaux sont desktop-only aujourd'hui. Transposition, pas adaptation :

- **Appui long sur le canvas** = carte d'intention (bottom sheet) — les 3 clics deviennent 3 touches.
- Le panneau P pilotable existe déjà en pages mobile ; les presets et alertes actionnables (B, C) sont des composants partagés — ils profitent aux deux plateformes gratuitement.
- La command bar mobile = le launcher de sheets existant (BottomTabBar), pas de nouveau paradigme.

---

## 5. Ordre de livraison (chaque lot shippe seul)

| Lot | Contenu | Pourquoi cet ordre |
|---|---|---|
| **1. Presets de flotte** (B) | sauvegarde + mémoire + auto-composition | Répond mot pour mot aux feedbacks ouverts ; aucune dépendance ; gain max/effort min |
| **2. Carte d'intention** (A) | popover canvas + registre d'actions v0 | Le moment « wow » de la refonte ; consomme les presets du lot 1 |
| **3. Alertes actionnables** (C) | home/panneau E = file d'exceptions | Consomme le registre du lot 2 |
| **4. Délégation** (D) | directives×vocations, plans de colonie, file de recherche | Décision produit (équilibrage gates/niveaux) à valider |
| **5. Palette** (E) | command bar v2 | Pur bonus desktop une fois le registre mûr |
| **6. Mobile** (F) | appui long + sheets d'intention | Réutilise tout ; à tester sur device réel |

**Mesure de réussite** : le budget de clics entre dans la *definition of done* — chaque feature notée « action X = N clics » dans sa spec, vérifiée à la review. (Optionnel : compteur télémétrie clics-par-action pour objectiver les progrès sur les vrais joueurs.)

---

## 6. Questions ouvertes

1. **Carte d'intention vs EntityDetailOverlay** : la carte d'intention remplace-t-elle l'overlay détail (qui devient « Ajuster… »/fiche), ou s'empile-t-elle dessus ? *(Intuition : elle le remplace comme premier contact — l'overlay devient le drill-down.)*
2. **Auto-composition d'attaque** : jusqu'où aider ? « Battre le rapport d'espionnage » est-il trop fort (tue la lecture de rapport) ? *(Piste : proposer, ne jamais garantir — estimation, pas oracle.)*
3. **Presets : par joueur ou par planète d'origine ?** Une flotte nommée référence des *quantités* — que faire si la planète n'a pas les vaisseaux ? (dégradé : envoyer ce qui existe + warning, ou griser le preset)
4. **File de recherche** : profondeur 2-3 ou illimitée ? (Illimitée = le jeu se joue tout seul ; 2-3 = on garde un rendez-vous décisionnel.)
5. **Gate des plans de colonie** : niveau d'empire (cohérent avec gouverneurs v1, `governor_unlock_level`=8) ?

---

*Document de travail — refonte « 3 clics » du 2026-06-10. À discuter avant spec dans `docs/plans/`.*
