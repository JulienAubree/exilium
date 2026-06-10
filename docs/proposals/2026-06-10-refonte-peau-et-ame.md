# Refonte « peau & âme » — même jeu, autre monde

> **Statut** : **direction tranchée (2026-06-10)** — A « Quart de nuit » retenue, avec tempérament « âme OGame » (voir §4 A′). Spec S0 : `docs/plans/2026-06-10-quart-de-nuit-s0.md`.
> **Date** : 2026-06-10
> **Commande user** : *les mécaniques d'Exilium restent telles quelles (« je les ADORE »). Changer complètement le design, l'interface et le feeling.*
> **Périmètre** : zéro formule touchée, zéro règle touchée, zéro donnée touchée. Tout ce qui se voit, s'entend et se ressent.
> **Lié à** : `2026-06-10-design-system-as-code.md` (les tokens rendent le re-skin total faisable), `2026-06-10-refonte-3-clics.md` (le socle ergonomique, compatible avec toute direction). Remplace l'ambition de `2026-06-10-design-refonte-calme-spatial.md` : « calme spatial » nettoyait l'habit existant ; ici on en change.

---

## 1. Le brief reformulé

Les mécaniques disent : *tu règnes sur un empire spatial*. L'habillage dit : *tu utilises une web-app soignée*. C'est l'écart à combler — pas en nettoyant encore (ça, c'est fait), mais en changeant de nature : **l'interface doit devenir un lieu, et le jeu doit avoir une âme sensorielle** — une matière, une voix, des sons, des rituels.

Deux couches dans cette proposal :
- **L'âme** (§3) : la couche sensorielle transversale — valable quel que soit l'habit choisi.
- **La peau** (§4) : trois directions artistiques complètes et contrastées — on en choisit une.

---

## 2. Le contrat : ce qui ne bouge pas

Bâtiments et files, recherche, énergie, biomes et types de planètes, vocations, gouverneurs, flotte et combat (light/medium/heavy), vaisseau amiral, missions PvE, marché, espionnage, colonisation et surextension, alliances/chat, classements, quêtes quotidiennes, niveau d'empire, push. **Chaque écran reste fonctionnellement identique** : mêmes données, mêmes actions, mêmes parcours (le socle 2-3 clics reste la loi d'interaction). Un joueur qui revient après la refonte sait *exactement* jouer — il ne reconnaît juste plus l'endroit.

---

## 3. L'âme — la couche sensorielle (quel que soit l'habit)

### 3.1 La voix de l'empire
Aujourd'hui le jeu parle en toasts techniques (« Construction terminée »). Demain, **chaque système parle par son officier** — cinq voix-fonctions, du *copy systémique* (templates, pas du contenu à nourrir) :

| Officier | Systèmes | Ton |
|---|---|---|
| L'Intendante | ressources, énergie, marché | précise, sèche, un brin d'ironie |
| L'Architecte | bâtiments, files, colonies | enthousiaste, concret |
| L'Amiral | flotte, combats, défense | laconique, militaire |
| Le Maître-espion | espionnage, scans, rapports | allusif, prudent |
| La Chancelière | alliances, messages, classements | protocolaire, politique |

« Votre Intendante signale : les entrepôts de Khelios saturent. » — même information, autre monde. Coût : une passe de réécriture du copy + un composant de notification. Gain de feeling : massif.

### 3.2 Le son — le jeu devient audible
- **Earcons par famille** (pas par événement) : économie = graves boisés · construction = métal sourd · flotte = cuivres/sonar · social = cloches · alerte = la SEULE stridente.
- **Ambiances par lieu** : home = le pont (ventilation, bips lointains) · galaxie = le vide (sonar épars) · marché = rumeur de criée. Discrètes, bouclées, coupables.
- Web Audio + sprite audio (~300 Ko), volumes séparés (ambiance/effets), **réglable et mémorisé** ; off par défaut en PWA mobile installée ? À tester.

### 3.3 L'haptique (mobile)
Vibration API : un tic sec à la pose d'un ordre, double-tic à la fin de construction, motif distinct pour l'alerte d'attaque. Trois motifs, pas trente.

### 3.4 La motion signature
Une *seule* signature de mouvement par direction artistique (§4) — tout l'écran obéit à la même physique. C'est ce qui fait qu'un jeu se reconnaît les yeux mi-clos.

### 3.5 Les cinq rituels
Les moments forts méritent une mise en scène (le reste reste calme) :
1. **Lancer un ordre** (construction, flotte) — le geste de pouvoir, ~400 ms de satisfaction.
2. **La dépêche de combat** — un rapport ne s'affiche pas, il *s'ouvre*.
3. **La fin de construction** — règlement doux, jamais de feu d'artifice.
4. **Le level-up d'empire** — le seul moment plein écran autorisé.
5. **L'attaque entrante** — la seule chose qui a le droit de ne jamais se taire.

---

## 4. La peau — trois directions complètes

> Même jeu, trois mondes. Chaque direction définit : palette, matière, typographie, traitement des illustrations existantes, son, motion, et ce que deviennent les écrans clés.

### A. « Quart de nuit » — la passerelle militaire
**Le feeling en une phrase** : *amiral de quart sur le pont, 3 h du matin, l'empire dort et veille à la fois.*
- **Palette** : obsidienne `#0B0E12`, acier `#1F2630`, écume `#C9D4DE` ; phosphore ambre `#E8A33D` pour la donnée vivante, vert signal pour le nominal, rouge pour la seule vraie alerte.
- **Matière & typo** : instruments — cadrans, jauges, caches métal ; grotesque pour l'UI, **mono pour toute donnée** (la donnée est sacrée, elle a sa fonte).
- **Illustrations** : recadrées dans des *feeds* d'instruments (hublots, retours capteurs), légère trame.
- **Son** : statique radio, sonar, relais qui claquent ; voix d'officiers « filtrées casque ».
- **Motion** : mécanique — tout glisse sur rails, s'enclenche, se verrouille. Pas d'élastique.
- **Écrans clés** : la galaxie = table tactique ; le rapport de combat = **transcription radio horodatée qui se déroule ligne à ligne** ; le marché = téléscripteur.
- **Risque** : reste dans la famille « sci-fi sombre » → la transformation est forte mais pas totale. C'est la continuité audacieuse de la Passerelle actuelle.

### A′. Le tempérament « âme OGame » *(tranché par le user, 2026-06-10)*

> Brief : *« Je veux garder une âme un peu OGame quand même. »* — Quart de nuit est retenue, mais l'héritage OGame devient un pilier de la direction, pas un accident. Ce qu'on garde d'OGame, c'est sa **culture de la donnée**, pas son look de 2002.

Les sept commandements de l'héritage :

1. **La barre de ressources est éternelle.** Chiffres exacts, qui tickent en direct, toujours visibles — l'objet le plus sacré du genre. Les 4 couleurs-ressources (minerai orange, silicium vert, hydrogène bleu, énergie jaune) survivent à tout rethème : c'est de la sémantique de jeu.
2. **La table est noble.** La donnée dense en lignes scannables est un *plaisir*, pas une dette : la vue Empire est une table, les rapports ont des tableaux de butin. La fonte mono rend la table belle — on ne force pas tout en cartes.
3. **Les coordonnées sont une langue.** `[4:122:8]` partout, en mono, cliquables — l'adresse galactique comme identité.
4. **Le compte à rebours est le héros.** Précis à la seconde, partout — jusqu'au titre de l'onglet navigateur (le prochain événement en `document.title`, comme à l'époque).
5. **La galaxie se lit aussi en lignes.** La vue système en liste reste un mode de premier rang à côté du canvas — les vétérans *vivent* dans cette grille.
6. **La culture du rapport.** L'inbox de rapports (espionnage, combat, butin détaillé) est un lieu central, mis en scène en transcriptions radio — pas relégué.
7. **Le métal et l'espace profond.** Le fond glisse de l'obsidienne neutre vers le **bleu-noir spatial** (`#0A0F18`), panneaux **acier bleuté** (`#15202E`), liserés métal — la mémoire chromatique d'OGame, exécutée sobre (plancher 12px, zéro chrome skeuomorphe, zéro glow permanent).

**Palette ajustée (fusion)** : fond `#0A0F18` · panneau `#15202E` · liseré `#2A3850` · texte écume `#C9D4DE` · **donnée vivante phosphore ambre `#E8A33D`** · **liens & coordonnées bleu acier `#6FA8DC`** · nominal `#5FB37A` · alerte `#D4533B` · les 4 couleurs-ressources inchangées.

### B. « La Chancellerie » — l'empire sur papier
**Le feeling en une phrase** : *monarque à son bureau, qui gouverne un empire interstellaire à la plume et au sceau.*
- **Palette** : parchemin `#F4EDDE`, encre `#2B2520`, vermillon des sceaux `#9E3B2D`, filets or `#A98C4A` — **interface claire** (rupture maximale, lisibilité plein soleil). Exception spectaculaire : **la carte galactique reste nuit noire** — une carte stellaire dépliée sur le bureau, le seul objet sombre du jeu.
- **Matière & typo** : papier, registres, filets, marges généreuses ; serif de caractère pour les titres et le récit, sans humaniste pour la donnée dense, chiffres tabulaires « gravés ».
- **Illustrations** : traitées en **planches gravées** (filtre encre/sépia + trame), encadrées de filets — l'existant devient un atlas.
- **Son** : plume, papier, **tampon de cire** (l'earcon signature : poser un ordre = sceller), cloches de chancellerie.
- **Motion** : papier — les pages se *posent*, les dépêches *glissent*, le sceau *s'estampille* (LA signature du jeu).
- **Écrans clés** : ressources = livre de comptes à points de conduite ; rapports de combat = **dépêches scellées qu'on décachette**, pertes à l'encre rouge ; recherche = codex annoté ; alliances = traités.
- **Risque** : audacieux pour un jeu spatial (c'est aussi sa force) ; demande une vraie direction typographique. Adhésion joueurs à tester — c'est LE pari.

### C. « L'Orrery » — la mécanique céleste
**Le feeling en une phrase** : *astronome-roi penché sur un planétaire de laiton, qui remonte son empire comme une horloge.*
- **Palette** : nuit `#101522`, verre fumé `#161D2E`, **laiton `#C9A227`**, argent `#9FB0C4`, garance pour l'alerte.
- **Matière & typo** : instruments d'optique et d'horlogerie — filets laiton, verres, graduations ; serif display racée + chiffres tabulaires fins.
- **Illustrations** : les planètes deviennent des **orbes** (vernis, cerclés de laiton) — l'atout visuel n°1 du jeu mis sous vitrine.
- **Son** : horlogerie, tintements de verre, carillons ; le tick des ressources = un *tic-tac* feutré (le jeu respire).
- **Motion** : orbitale — tout tourne, s'engrène, trouve son point d'équilibre. Les files d'attente sont des rouages qui avancent.
- **Écrans clés** : le home = le planétaire (tes mondes en orbite autour de ta capitale) ; la recherche = constellation à relier ; le combat = reconstitution mécanique sur la table.
- **Risque** : le plus exigeant graphiquement (le laiton mal fait = kitsch) ; le moins « action » pour la flotte.

### Tableau de décision

| Critère | Quart de nuit | Chancellerie | Orrery |
|---|---|---|---|
| Rupture de feeling | ++ | **+++** | +++ |
| Fantasme empereur | + | **+++** | ++ |
| Fantasme amiral/flotte | **+++** | + | + |
| Lisibilité mobile (dont plein jour) | ++ | **+++** | + |
| Coût dev solo | ++ (proche de l'existant) | ++ (typo+CSS, filtres sur illustrations) | – (matière exigeante) |
| Risque d'adhésion joueurs | faible | **à tester** | moyen |
| Différenciation marché | + (sci-fi sombre = la norme) | **+++** (personne ne fait ça) | ++ |

---

## 5. Décision *(tranchée le 2026-06-10)*

~~Recommandation Chancellerie / finaliste Quart de nuit~~ → **le user a tranché : A « Quart de nuit », tempérée par l'âme OGame (§4 A′)**. L'identité d'amiral née de la Passerelle devient l'identité du jeu ; l'héritage OGame (données denses, coordonnées, comptes à rebours, tables) en est le cœur assumé.

**Protocole de validation (inchangé sur le principe, simplifié)** :
1. **S0 — un écran témoin** dans le thème retenu, derrière un toggle (flag staging), spec : `docs/plans/2026-06-10-quart-de-nuit-s0.md`.
2. Joueurs invités sur staging, retours **via la table `feedbacks`**.
3. Si validé → S1-S5 (§6) ; un seul thème maintenu à terme.

---

## 6. Plan de production (après le choix)

1. **S1 — Fondations** : tokens du thème (couleur, typo, matière, motion), chargement des fontes, traitement des illustrations (pipeline de filtres, pas de re-commande).
2. **S2 — La voix** : réécriture du copy système en voix d'officiers + composant notification/dépêche.
3. **S3 — Son & haptique** : sprite audio, earcons, ambiances, réglages.
4. **S4 — Écran par écran** : home, planète, galaxie, flotte, marché, recherche, alliances — dans cet ordre (du plus vu au moins vu), chaque écran shippe seul.
5. **S5 — Les cinq rituels** : l'orchestration fine (son+motion+visuel) en dernier, quand le langage est stable.

**Garde-fous** : AA conservé partout ; `prefers-reduced-motion` et mute respectés ; budget perf mobile inchangé (la matière est du CSS et des filtres, pas des shaders) ; annonce + période de prévenance aux joueurs (c'est leur jeu aussi).

---

## 7. Questions ouvertes

1. **Musique** ? (Ambiances oui — une vraie BO est un autre métier et un autre budget. Proposition : pas de musique en v1, ambiances seulement.)
2. **Les officiers** : noms propres + portraits (gravures ?) ou titres seuls ? (Proposition : titres seuls en v1 — les portraits sont du authored-content à assumer plus tard.)
3. **Chancellerie** : interface claire assumée à 100 % ou variante sombre « cabinet de nuit » pour le confort nocturne ?
4. **Le tutoriel** : profite-t-on de la refonte pour le re-raconter dans la nouvelle voix (l'arrivée au pouvoir) ?
5. Les **e-mails/push** adoptent-ils la voix des officiers ? (Cohérence totale vs sobriété des notifications système.)

---

*Document de travail — refonte peau & âme du 2026-06-10. Choisir la direction (§5) avant toute spec dans `docs/plans/`.*
