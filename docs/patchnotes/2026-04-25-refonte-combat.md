# Refonte du système de combat

## Une nouvelle façon de penser vos flottes

Le système de combat est entièrement repensé. Fini le « le plus gros portefeuille gagne » : chaque type de vaisseau a maintenant un rôle précis, des forces et des faiblesses. La composition de flotte devient un vrai choix stratégique.

---

## Armement multi-batteries

Les vaisseaux militaires possèdent désormais **une ou deux batteries d'armes**, chacune avec son propre profil :

- **Canon principal** : gros dégâts, cible une catégorie précise (Léger / Moyen / Lourd)
- **Batterie secondaire** : dégâts plus faibles mais plus de tirs, vise une autre catégorie

Chaque batterie tire en parallèle dans le round. Plus besoin de choisir une priorité de cible — chaque arme a sa cible naturelle.

### Profils des vaisseaux militaires

| Vaisseau | Canon principal | Batterie secondaire |
|---|---|---|
| **Intercepteur** | 4 dmg ×3 vs Léger + Enchaînement | — |
| **Frégate** | 12 dmg ×1 vs Moyen | 6 dmg ×2 vs Léger |
| **Croiseur** | 35 dmg ×1 vs Lourd | 6 dmg ×2 vs Léger + Rafale 6 |
| **Cuirassé** | 50 dmg ×1 vs Lourd | 10 dmg ×2 vs Moyen + Rafale 4 |

### Profils des défenses planétaires

| Défense | Armement |
|---|---|
| Lanceur de missiles | 6 dmg ×2 vs Léger + Enchaînement |
| Laser léger | 7 dmg ×3 vs Léger + Enchaînement |
| Laser lourd | 15 dmg ×2 vs Moyen |
| Canon électromagnétique | 55 dmg ×1 vs Lourd |
| Artillerie à ions | 90 dmg ×1 vs Lourd |

---

## Nouveaux traits de combat

### Rafale N Catégorie

Quand une batterie tire sur sa catégorie de prédilection, elle effectue **N coups supplémentaires** (en plus de ses tirs de base).

**Exemple** : la batterie secondaire du croiseur a `Rafale 6 Léger`. Elle tire normalement 2 coups, mais quand sa cible est un vaisseau léger, elle tire **8 coups** (2 + 6 bonus).

C'est entièrement déterministe : pas de RNG, pas de chaîne. Le bonus s'applique uniquement quand la cible matche la catégorie.

### Enchaînement

Quand un tir détruit sa cible, l'unité tire **un coup bonus** sur une autre unité de la même catégorie. Maximum un bonus par tir de base — pas de chaîne infinie.

C'est l'identité des unités légères : intercepteur, lanceur de missiles, laser léger. Elles excellent à nettoyer les essaims de cibles fragiles.

### Affichage en jeu

Dans la fiche de chaque vaisseau, les batteries et leurs traits sont affichés avec des badges colorés. Survolez un trait avec la souris pour afficher un popover explicatif avec exemple concret.

---

## Relations de counter-play

La pyramide de force est claire :

```
Intercepteurs ──dominés par──> Croiseurs (Rafale 6 Léger)
Frégates      ──dominées par──> Cuirassés (Rafale 4 Moyen)
Cuirassés     ──submergés par──> Essaims d'intercepteurs
```

Le joueur qui spam un seul type d'unité est punissable. La diversification est récompensée. Une flotte qui mixe intercepteurs + frégates + croiseurs est plus solide qu'une mono-composition de même valeur.

---

## La recherche Protection améliore aussi le blindage

La recherche **Technologie Protection** (et son extension **Blindage composite** sur Laboratoire Aride) augmentait déjà la coque. Elle augmente désormais aussi le **blindage** (la réduction plate de dégâts).

Concrètement, vos vaisseaux deviennent plus résistants aux tirs faibles. Un cuirassé au niveau 10 de Protection a 12 d'armure au lieu de 6 — il bloque deux fois plus de dégâts par tir perçant.

L'effet est visible dans la fiche de chaque vaisseau et défense : le blindage affiche son bonus actif comme la coque et le bouclier.

---

## Bouclier planétaire renforcé

### Capacité de base augmentée

La capacité du bouclier planétaire au niveau 1 passe de **30 à 50**. Aux niveaux supérieurs, la progression suit le même facteur de croissance, ce qui rend le bouclier utile dès l'early-game.

| Niveau | Capacité avant | Capacité après |
|---|---:|---:|
| 1 | 30 | **50** |
| 3 | 51 | **85** |
| 5 | 86 | **143** |
| 10 | 319 | **530** |

### Bonus de recherche appliqué

Le bouclier planétaire bénéficie maintenant du **multiplicateur de recherche Blindage** comme tous les autres boucliers. Un défenseur avec recherche Blindage 5 (+50%) voit la capacité effective de son bouclier augmenter d'autant.

La capacité effective est affichée directement dans le bandeau du bouclier sur la page Défense, avec l'indicateur de bonus à côté.

### Description revue

La fiche du bâtiment mentionne explicitement que la recherche Blindage augmente la capacité en combat — fini les surprises sur la valeur réelle.

---

## Défenses planétaires rééquilibrées

Les défenses lourdes étaient sous-utilisées. Leurs stats ont été ajustées pour les rendre comparables aux défenses légères en termes de DPS par crédit :

| Défense | Avant | Après |
|---|---|---|
| Lanceur de missiles | 5 dmg ×2, 6 shield, 10 hull | **6 dmg ×2, 8 shield, 14 hull** |
| Canon électromagnétique | 50 dmg, 30 shield, 60 hull | **55 dmg, 35 shield, 70 hull** |
| Artillerie à ions | 80 dmg, 50 shield, 120 hull | **90 dmg, 60 shield, 140 hull** |

Le laser léger et le laser lourd restent inchangés en stats — ils étaient déjà correctement positionnés.

---

## Équilibrage post-simulation

Après 200 simulations × 24 scénarios, on a constaté que la défense était sur-puissante (méta 80/20 défense/attaque). Plusieurs ajustements remettent les pendules à l'heure :

### Config combat

| Paramètre | Avant | Après |
|---|---:|---:|
| Taux de réparation des défenses post-combat | 70% | **50%** |
| Nombre de rounds maximum | 4 | **6** |
| Champ de débris | 30% | **35%** |

Le défenseur paie maintenant 50% de ses défenses détruites au lieu de 30% — l'anti-harcèlement reste préservé mais l'invincibilité économique disparaît. Les combats de flottes équivalentes se concluent au lieu de finir en match nul.

### Stats vaisseaux militaires

| Vaisseau | Stat | Avant | Après |
|---|---|---:|---:|
| Intercepteur | bouclier | 8 | **6** |
| Croiseur | bouclier | 28 | **32** |
| Croiseur | bat. sec. dmg | 5 | **6** |
| Cuirassé | coque | 100 | **120** |

L'intercepteur perd un peu de survie pour casser l'invincibilité du spam. Le croiseur gagne en résistance et en DPS contre les légers (Rafale ×6 sur 6 dmg = 48 DPS vs léger). Le cuirassé devient un vrai tank avec +20% de coque.

### Coûts défenses (nerf cost-efficiency)

| Défense | Coût avant | Coût après |
|---|---:|---:|
| Lanceur de missiles | 2 000 | **3 000** |
| Laser léger | 2 000 | **3 000** |
| Laser lourd | 8 000 | **7 500** |
| Canon EM | 37 000 | **30 000** |
| Artillerie à ions | 130 000 | **97 500** |

Les défenses légères étaient 2-3× plus rentables au DPS/crédit que les vaisseaux équivalents — d'où la dominance défensive. Leur coût est revalué pour rester accessible mais sans écraser la concurrence.

---

## Construction accélérée et plus accessible

Les temps de construction late-game étaient un blocker (24h pour un cuirassé, 40h pour une artillerie à ions). La majorité des coûts d'unités ont été réduits de 25%, et la formule de temps a été révisée.

### Coûts vaisseaux (-25%)

| Vaisseau | Coût avant | Coût après |
|---|---:|---:|
| Intercepteur | 4 000 | **3 000** |
| Frégate | 10 000 | **7 500** |
| Croiseur | 29 000 | **21 750** |
| Cuirassé | 60 000 | **45 000** |
| Petit transporteur | 4 000 | **3 000** |
| Grand transporteur | 12 000 | **9 000** |
| Recycleur | 18 000 | **13 500** |
| Vaisseau de colonisation | 40 000 | **30 000** |
| Sonde d'espionnage | 1 000 | **750** |

Les défenses légères restent au prix post-rebalance pour ne pas annuler le nerf cost-efficiency.

### Nouveaux temps de construction

Le multiplicateur de temps global a été augmenté. Résultat : ~58% de temps en moins pour la majorité des unités.

| Unité | Temps avant | Temps après |
|---|---:|---:|
| Intercepteur | 1h36 | **40 min** |
| Frégate | 4h00 | **1h40** |
| Croiseur | 10h48 | **4h30** |
| Cuirassé | 24h00 | **10h00** |
| Lanceur de missiles | 1h12 | **40 min** |
| Laser léger | 1h12 | **40 min** |
| Canon électromagnétique | 15h12 | **6h20** |
| Artillerie à ions | 40h00 | **16h40** |

Construction de flottes beaucoup plus fluide. La reconstruction post-combat n'est plus un parcours d'obstacles.

---

## Disparition de la priorité de cible joueur

Le toggle « Priorité de cible » sur la page Flotte a été retiré. Avec le système multi-batteries, chaque arme a déjà sa cible naturelle — il n'y a plus rien à choisir.

Si vous aviez l'habitude de sélectionner « Lourd » pour cibler les vaisseaux ennemis spécifiques, sachez que vos batteries principales ciblent automatiquement les vaisseaux lourds en priorité (canon principal du croiseur et du cuirassé).

---

## Guide de combat actualisé

La page **Guide de combat** a été réécrite pour refléter le nouveau système :
- Section « Stats d'un vaisseau » reformulée avec les batteries
- Nouvelle section **« Traits de combat »** avec badges Rafale/Enchaînement et exemples
- Phrases de counter-play pour vous aider à composer vos flottes
- Formule du Facteur de Puissance simplifiée (DPS × durabilité)

---

## En résumé

| Avant | Après |
|---|---|
| Une seule arme par vaisseau | Une ou deux batteries selon le vaisseau |
| Une seule cible par tir | Chaque batterie cible sa catégorie naturelle |
| Combats prévisibles | Counter-play actif (croiseur > intercepteur, cuirassé > frégate) |
| Défense quasi-invincible économiquement | Défense forte mais payante en cas de brèche |
| 24h pour construire un cuirassé | 10h pour construire un cuirassé |
| Bouclier planétaire faible et statique | Bouclier renforcé et boostable par recherche |

La fenêtre d'attaque rentable s'ouvre à partir de **3× le budget défensif** au lieu de 13× auparavant. La défense reste avantageuse — c'est l'esprit du jeu — mais elle n'est plus une forteresse imprenable.

À vous de jouer.
