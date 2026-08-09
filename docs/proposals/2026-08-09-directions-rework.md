# Exilium — Recommandation finale

Julien, sept directions, trois jurys, un verdict. Voici où penche le jury, ce que je retiens, et pourquoi.

---

## 1. Le paysage en un coup d'œil

| # | Direction | Thèse en une ligne | Causes | Solo | Plaisir | Total | Verdict |
|---|---|---|---|---|---|---|---|
| **2** | **La Quinzaine** | Changer d'horloge maîtresse : x10 sur la production, rien ne dure plus qu'une session, saison de 15 jours | 8 | **8,5** | 7,5 | **24** | **Retenue — le moteur** |
| **4** | **La Campagne** | Le jeu devient une partie qu'on programme : une date, 14 jours, des gisements contestés, un vainqueur, des archives | 7 | 8 | **8,5** | **23,5** | **Retenue — le cadre** |
| **1** | **Le Réseau** | On ne lance plus des flottes, on pose des lignes ; l'objet de jeu devient le tuyau, pas le vaisseau | **9** | 6 | 7 | **22** | Finaliste écartée |
| 3 | USURE | Le combat cesse de détruire et se met à abîmer ; la ressource devient « combien de coques je remets en vol ce soir » | 6,5 | 7 | 5 | 18,5 | Écartée, pillée |
| 5 | Le Pacte | Personne ne construit un vaisseau de guerre seul : 5 matières exclusives, 2 classes max par empire | 5 | 5 | 6,5 | 16,5 | Écartée fermement (1 juge) |
| 6 | La Veine | Aucune production passive : tout est arraché à des veines finies et doit rentrer — et une flotte en route s'intercepte | 7,5 | 4 | 4 | 15,5 | Écartée fermement (1 juge) |
| 7 | Serments | Deux vracs, six matières régionales, un serment irréversible au jour 3 : la carte décide de ce que tu peux construire | 6 | 3,5 | 6 | 15,5 | Écartée fermement (1 juge) |

**Trois lectures immédiates.**

Le jury est divisé sur le champion mais **unanime sur le podium** : chaque juge a placé D2 et D4 dans son trio de tête, et aucun autre couple n'a cette propriété. D1 obtient la meilleure note individuelle du dossier (9/10 aux causes racines) et la pire des trois finalistes en faisabilité (6/10) — c'est le profil classique de la bonne idée trop chère.

Les trois directions du bas (D5, D6, D7) partagent la même faute : elles font du **comportement que ces joueurs n'ont jamais eu** l'exigence structurelle du jeu. D5 exige la présence simultanée pour progresser, D6 l'exige pour intercepter, D7 exige un marché liquide chez des gens qui ont fait 53 échanges en quatre mois. Chacune a été écartée fermement par un juge différent, et pour la même raison de fond.

Enfin, D2 et D4 ne sont pas deux directions concurrentes : ce sont **deux versions du même plan** avec des manques complémentaires. C'est là que se joue la recommandation.

---

## 2. Les trois directions sérieuses

### D4 — LA CAMPAGNE (7 / 8 / 8,5)

**La boucle.** Une date annoncée. Samedi 18h, tout le monde se connecte à la même minute, carte neuve, personne n'a d'avance. Le score n'est pas un stock mais un flux : 14 Gisements aux coordonnées fixes, publiés dès J1, qui rapportent 30 à 100 points/h et **qu'on ne tient qu'avec une flotte physiquement stationnée** — aucune défense statique, jamais. La session type fait 20 minutes : lire le Bulletin (sept lignes, pas un tableau de bord), voir qu'un gisement est à 62 % de garnison, envoyer six croiseurs (7 min de vol sur cette carte), remplir trois files de chantier, fermer. Le combat tombe pendant que tu es encore là. À J11 la Nappe commence à stériliser 4 systèmes toutes les 12 h avec 24 h de préavis ; à J14 il reste 12 systèmes et six gisements à 100 pts/h. Finale de trois heures, points ×3, gel du serveur. Puis l'Interlude : 2 à 6 semaines, jeu fermé, on lit les Archives.

**On garde.** `game-engine` intact (trois clés de config changent, pas une ligne de logique), `game-sim` promu en porte de calibration, les 13 handlers de mission, tout le contenu d'industrie et de combat, le back-office qui devient console de campagne. **On jette** l'exilium-monnaie, le tutoriel, les 33 biomes, le niveau d'empire, la vocation, la coque scientifique, les raids de colonisation, le combat pirate sous sa forme actuelle, et 71 856 emplacements réduits à 960.

**Ses trois coups de génie.** Le **couvre-feu 01h-08h** : les combats PvP ne se résolvent pas la nuit, les points de gisement continuent de tomber. Environ 40 lignes dans le worker d'arrivée, et c'est la mécanique la plus lucide des sept documents pour vingt-cinq adultes qui travaillent. Le **snapshot de config par campagne** : chaque campagne porte sa config en JSON, le back-office édite la campagne et plus le seed — la dette « réglable en prod est un mensonge » meurt par construction au lieu d'être corrigée. Les **Archives** : page gelée, courbe heure par heure des gisements, cinq plus grosses batailles depuis des snapshots que le moteur produit déjà. C'est « API → DB → guides » pointé sur ton propre jeu, quasi gratuit, et ça transforme le vide entre deux campagnes en chapitre au lieu d'échec.

**Première version jouable.** Campagne 0 : 7 jours, 5 amis, 24 systèmes, 6 gisements, kit de départ unique, deux actes, une page Archives. Annoncée à 3 semaines par l'auteur ; **le juge faisabilité la recalcule à 5-7 semaines** et il a raison — le générateur de carte paramétré, le Bulletin et les Archives ne sont pas dans les trois semaines.

**Le risque.** Elle demande à cinq personnes de s'accorder sur un samedi. Si six seulement viennent sur une carte pour vingt-cinq, c'est une ville fantôme avec un tableau d'affichage — et pire qu'aujourd'hui sur un point : **l'échec est daté, public et gelé dans les Archives pour toujours.** Le contre-feu existe et il faut l'appliquer sans négocier : on dimensionne la carte sur les inscrits confirmés, pas sur l'espoir. Le générateur prend l'effectif en paramètre.

**Son défaut réel, et le jury l'a vu.** Elle fait du combat la mécanique de score jouée tous les soirs, et le répare avec trois clés de config. Or D3 a mesuré que la régénération de bouclier seule fait passer la flotte équilibrée de 0/150 à 55/150 victoires, mono-frégate en gagnant encore 125/150. **Elle mise tout sur un système qu'elle sous-répare, et elle ne le sait pas.**

---

### D2 — LA QUINZAINE (8 / 8,5 / 7,5)

**La boucle.** La même journée qu'aujourd'hui, dix fois plus dense. 21h04 : ta cache orbitale affiche 380 000 de minerai débordés pendant que tu bossais, visible de tous sur la carte. Tu enfiles trois lignes au chantier — mine 19, arsenal 9, douze intercepteurs — **aucune ne dépasse vingt minutes**, tout finit ce soir. 21h13, notification : flotte entrante, impact dans trois minutes. Tu appelles un allié à cinq minutes de vol. 21h16, le combat se résout en quatre rounds parce que les boucliers ne se régénèrent plus qu'à 25 % : tes petits calibres percent au troisième. Débris à 50 %, récupérateurs lancés, tu fermes. J15 : reset, tout le monde repart à égalité.

**Ce qui la rend unique.** C'est **la seule direction du dossier dont l'analyse est mesurée et non affirmée**, et elle en sort trois résultats que personne d'autre n'a :

1. **94,0 % du temps écoulé est de l'attente de ressources, 6,0 % de la file de construction** — confirmé indépendamment par les 6,5 % d'occupation du chantier en prod. Le jeu n'est pas lent, il est vide.
2. **Le mur des 529 h est comportemental.** Le chantier niveau 2 est atteint à j9,2 dans le run optimal ; le premier vaisseau attend j22 parce que **le prospecteur coûte 375 hydrogène et la dotation de départ en donne 100**, et l'hydrogène a le pire ROI du jeu. Preuve : une politique va-t-en-guerre codée par l'auteur sort le premier intercepteur en **1,6 jour sur la config actuelle, sans rien changer**.
3. **Le levier de production est non-monotone.** Raidir `exponentBase` de 1,1 à 1,32 donne 4,4 jours jusqu'au premier vaisseau ; 1,40 donne **73,5 jours**, pire que la baseline. Seul le multiplicateur plat est homothétique.

**Le plafond de 20 minutes** sur `buildingTime` est le corollaire chiffré : la répartition attente/file passe de 94/6 à 46,9/53,1 à x10 sans plafond, à 1,4/98,6 à x50 (un clicker), et revient à **82,9/17,1 avec le plafond**. Le jeu reste un jeu de ressources, dix fois plus vite. Règle nommée : *rien dans le jeu ne dure plus longtemps qu'une session.*

**On garde tout** : `game-engine` intégralement (deux lignes changent), les 17 bâtiments, les 23 recherches, les 4 forks — dont « Puissance de feu », jamais recherché par personne, qui devient atteignable à j6. **On jette** la galaxie 9×499×16, l'univers persistant, le tutoriel, l'hydrogène comme verrou early, les déverrouillages par niveau d'empire.

**Première version jouable.** Saison Zéro : une Quinzaine jouée à 5 sur staging, sans reset. Sept lots dont le plus lourd est le débordement en orbite. Annoncée 4-5 semaines, recalculée **5-7 semaines** — et le juge faisabilité note que la v0 est *essentiellement de la configuration* : trois constantes, une ligne dans `combat.ts`, un script de dotation, une table neuve.

**Son argument décisif.** **Si elle rate, il reste un socle, pas un cratère.** Économie réparée, jeu dix fois plus rapide, combat avec de l'usure, cache orbitale — les quatre servent aussi bien à D1, D3, D4 ou D5.

**Son défaut réel.** Elle n'a pas de raison neuve d'ouvrir le jeu le mardi. Elle accélère l'horloge sans donner d'objectif. Et elle accélère la sanction de l'absence : à 43 050 ressources/h, deux jours d'absence sur quinze coûtent 13 % de la saison, contre littéralement rien aujourd'hui.

---

### D1 — LE RÉSEAU (9 / 6 / 7) — le finaliste que j'écarte

**La boucle.** On arrête d'envoyer des flottes, on pose des lignes. Une Ligne — origine, escales, manifeste, vaisseaux affectés — tourne indéfiniment comme une boucle de jobs BullMQ. Le seul nombre qui compte est le débit. Tu ouvres, tu vois un badge rouge : « Fonderie de Kepler-b sous-alimentée depuis 47 min. Demande 1 200 minerai/h, la ligne en livre 840. » Trois réponses à 20 secondes chacune. Tu regardes le Tableau des Contrats, tu en prends un, tu fermes. Le réseau continue.

**Elle est la meilleure du dossier sur les causes racines, et pour de bonnes raisons.** Elle supprime le compteur global : une planète possède un stock par bien, il n'y a plus qu'un consommateur et une seule fonction pure — deux chemins ne peuvent plus diverger parce qu'il n'y en a plus qu'un. Elle construit sur ce que ces gens ont **réellement fait** de leurs 8 317 envois (minage 31,6 % + transport 19,6 % = la moitié de l'activité), au lieu de parier contre. Les droits de relais avec péage en nature sont la première vraie relation économique entre joueurs de l'histoire du jeu. Et son **classement au débit glissant 24 h** est la meilleure réponse écrite nulle part ailleurs au problème central d'une bande d'amis : celui qui revient après trois semaines n'est pas hors-jeu, il est à zéro et remonte en une soirée.

**Pourquoi je l'écarte quand même.**

*Le calendrier.* Annoncée 5-6 semaines, recalculée **12-16 semaines** avec ~55 % de réemploi seulement. C'est un jeu neuf : objet central neuf (la Ligne comme boucle de jobs qui se rechaîne — donc état distribué, donc lignes bloquées et double-crédit à déboguer), modèle de stock neuf, chaîne à neuf biens.

*Le terrain.* Toute la proposition tient sur une seule page, la Carte du Réseau. C'est **exactement le terrain où ce projet est déjà mort une fois** : la Passerelle, livrée et rollbackée le jour même. La direction le reconnaît et n'a pas de parade au-delà de « on passe par staging ».

*Le mode d'échec.* Son risque admis est que le réseau atteigne son équilibre : tout est vert, plus rien à faire, on a remplacé une corvée par un économiseur d'écran. Ce mode d'échec est **silencieux et lent**. Après quatre mois de dev, tu ne sauras pas si ça a raté avant plusieurs semaines de jeu.

*Et un point technique dur.* Sa thèse « la taille du réseau est proportionnelle à ta production d'hydrogène » repose sur un facteur 40 sur `fuel_consumption` posé au doigt mouillé. Or D2 a mesuré que l'hydrogène est déjà le verrou accidentel qui produit le mur des 529 h. Reproduire le même verrou en le multipliant par 40 est le scénario le plus probable si on ne mesure pas d'abord.

**Un argument honnête en sa faveur, que je te dois** : c'est la seule direction dont le plaisir ne dépend pas de la présence des autres. Elle marche à deux joueurs. Sur une base dormante, ce n'est pas rien. Le contre-argument est brutal : à deux joueurs c'est un jeu d'usine solo, et Factorio existe déjà.

---

## 3. Ma recommandation

**« La Campagne, à l'horloge de la Quinzaine ». Le cadre vient de D4, le moteur vient de D2, le combat vient de D3 en trois règles bornées.**

### Le raisonnement en une page

Le vrai problème d'Exilium n'est ni l'économie ni le combat. C'est qu'**il n'y a plus de rendez-vous**. Zéro flotte depuis le 24 juin ne se répare pas avec un meilleur équilibrage : ça se répare avec une date dans le calendrier. C'est la thèse de D4, c'est ce que le juge plaisir défend, et je pense qu'elle est juste.

Mais D4 seule ne suffit pas, parce qu'une campagne de 14 jours sur une horloge qui met 68 heures à monter un chantier niveau 13 n'est pas une campagne, c'est une file d'attente avec une date de fin. C'est D2 qui apporte l'horloge, et elle l'apporte **mesurée** : multiplicateur plat, plafond de 20 minutes, hydrogène sorti des coûts early.

Et D4 sous-répare le seul système dont elle fait le cœur. C'est D3 qui apporte le correctif, mais on n'en prend que ce qui est prouvé.

**Pourquoi ça tient ensemble, précisément.** D2 et D4 partagent déjà le même squelette : saison bornée, kit de départ, carte réduite à un amas, combat retouché, `game-sim` comme porte de livraison, back-office comme console de saison. Ce n'est pas une greffe, c'est une fusion. Elles se complètent exactement sur leur manque : D2 n'a pas d'objectif public — et le juge faisabilité propose lui-même de greffer les Gisements en Quinzaine 2 ; D4 n'a pas d'horloge assez rapide — elle divise `baseTime` par 3 mais ne casse pas la seconde exponentielle, celle des durées, que D2 est la seule à avoir vue.

### Le détail de la fusion

**De D4 — le cadre, la réponse à « pourquoi j'ouvre le jeu »**
- La campagne datée : date de début annoncée, durée bornée, gel, vainqueur, Archives.
- Les **Gisements** : points de score publics, tenus par une flotte stationnée, **aucune défense statique jamais**, garnison minimale croissante, co-garnison d'alliance au prorata du FP engagé — le premier effet mécanique des alliances de toute l'histoire du jeu.
- Le **couvre-feu 01h-08h**. Non négociable.
- Le **snapshot de config par campagne**. Tue la dette du seed par construction.
- Le générateur de carte **paramétré par effectif confirmé**.
- Les **Archives**.
- La Nappe : Campagne 1, pas Campagne 0.

**De D2 — l'horloge, la réponse à « pourquoi ce soir »**
- Multiplicateur **plat x10** sur `baseProduction` (le seul levier homothétique, mesuré).
- **Plafond de 20 min** sur `buildingTime`, plus les divisors chantier et recherche.
- **L'hydrogène sort des coûts de vaisseaux et de recherches sous 3 000.** Point critique : six directions sur sept prescrivent un kit de départ contre le mur des 529 h ; D2 démontre que le mur est un verrou de ressource, donc **un kit de départ le masque au lieu de le lever et il revient au deuxième vaisseau**.
- La **cache orbitale** : le débordement s'accumule en orbite, visible de tous, non protégé, récoltable par une mission `harvest` qui recycle `recycle`.
- Le chantier à 3 files.
- `game-sim` comme rituel d'avant-saison, avec **rapport de rythme publié aux joueurs** comme note de saison.

**De D3 — le combat, deux constantes et une passe bornée**
- Régénération de bouclier à **25 %/round** (les trois directions convergent).
- Suppression de **`minDamagePerHit: 1`**. C'est la ligne qui laisse 3 000 de chair à canon effacer 45 000 de capital à 3,75 contre 1. Sans elle, un Gisement se tient avec une nuée d'intercepteurs et rien d'autre — et la co-garnison d'alliance n'a aucun intérêt tactique.
- Les défenses saignent : débris + réparation gratuite 0,5 → 0,15.
- La **méthode** : un point de vérité jouable avant d'avoir construit le monde.

**L'avertissement honnête sur ce point.** Ces deux règles seules ne suffiront pas. D3 mesure que son package complet ne remonte la flotte équilibrée qu'à 55/150 pendant que mono-frégate en gagne 125/150. Le travail réel est le re-tuning des 13 fiches, et D3 dit lui-même qu'il « n'a pas de fin naturelle ». **C'est précisément pour ça qu'il faut lui écrire un critère d'arrêt avant de commencer** (voir question 4). La bonne nouvelle : dans un jeu de Gisements sans défense statique, la barre est plus basse que dans un jeu de combat pur. Il suffit qu'aucune composition mono-type ne domine.

**Ce qu'on n'emprunte pas, et pourquoi.** De D3 : les trois types de dégâts, les postures, le seuil de rupture, la baie de réparation, l'usure persistante — trop de surface pour un gain non prouvé sans le re-tuning. De D2 : le reset tous les 15 jours comme dogme ; la durée est une variable. De D1 : les Lignes — c'est un autre jeu, pas une feature. De D5 et D7 : la dépendance matérielle dure. **On prend la Requête, on jette le mur.**

### Le plan et le délai

**7 à 9 semaines** jusqu'à l'ouverture de Campagne 0, avec deux points de vérité avant. Je préfère te donner un chiffre honnête : les sept propositions annoncent toutes entre 3 et 6 semaines, ce qui est de l'ancrage sur l'énoncé, pas une estimation.

| Lot | Contenu | Sert à quoi si tout rate |
|---|---|---|
| **S1-S2** | Chemin de crédit unique. Snapshot de config par campagne. Table `campaign` + script de reset réentrant (43 des 44 tables cascadent depuis `users.id`). Générateur de carte paramétré. | **Utile aux sept directions.** C'est de la dette, pas du pari. |
| **S3** | L'horloge : kit de départ, x10 plat, plafond 20 min, divisors, 3 files, hydrogène hors des coûts early. Calibrage `game-sim`. | Utile partout. |
| **S4** | Le combat : regen 25 %, `minDamagePerHit` à 0, débris sur défenses, **passe de re-tuning bornée**. → **TEST 1 : cinq amis, deux heures sur staging, flottes dotées à la main. Est-ce que se battre est amusant ?** | Utile partout. Et si la réponse est non, tu l'apprends à la semaine 4 avec quatre semaines de réparations utiles en poche. |
| **S5** | Les Gisements : table, tick horaire, `station.handler.ts` sans la contrainte « vos planètes », interdiction des défenses, garnison croissante, compteur public, co-garnison, classement en direct. | Le premier pari réel. |
| **S6** | Couvre-feu. Cache orbitale. Bulletin de campagne. → **TEST 2 : une soirée à cinq. Est-ce qu'un point contesté fait revenir ?** | |
| **S7-S8** | Archives. Requête de renfort. Suppression du code mort. Tutoriel → Briefing de 90 secondes. Calibrage final. | |
| **S9** | Ouverture Campagne 0 : 7 jours, 5 amis, 24 systèmes, 6 gisements. | |

**Le signal de falsification, net et précoce** (il vient de D4, garde-le tel quel) : **si au J3 les six gisements sont encore tenus par leur premier occupant, la thèse est fausse.**

### Le pari que tu prends, dit franchement

Il y a deux paris mutuellement exclusifs dans ce dossier.

**Pari A (D4+D2)** : le problème est l'absence de rendez-vous. On fabrique une date, un objectif public et une partie bornée. Ça marche si cinq personnes disent oui à un samedi. **Ça échoue vite et bruyamment.**

**Pari B (D1)** : le problème est que le jeu demandait vingt clics par jour. On fabrique un jeu qui tourne sans toi. Ça marche même à deux. **Ça échoue lentement et en silence.**

Pour un projet passion dont le pire scénario est « j'ai codé quatre mois et personne n'a joué », **A est le bon pari, parce qu'il te dit la vérité au jour 3 au lieu du mois 6.** Et parce que son coût de l'erreur est le plus bas du dossier : les lots S1-S4 sont exactement ce dont B aurait besoin de toute façon. Rien n'est perdu si tu changes d'avis en septembre.

---

## 4. Les pépites à greffer

Repêchées dans les directions écartées, signalées par le jury, classées par rapport levier/coût.

**1. La Requête et le Parrainage (D5)** — *le juge plaisir en fait la meilleure mécanique isolée du dossier.* « JMFion demande 140 Alliage — tu peux fournir. » Un tap, quinze secondes, un convoi part, quelqu'un est débloqué. C'est la seule mécanique de tout le dossier qui fabrique une interaction réelle **entre deux amis qui ne sont jamais en ligne en même temps**. Portée sur le cadre Campagne, elle devient la **Requête de renfort** : « Marches-4 tombe dans 40 min, il me faut 30 intercepteurs », push ciblé sur les joueurs qui ont une flotte à moins de X minutes de vol, un tap = mission `station` en co-garnison. Et le **Parrainage** : les trois premières Requêtes d'un débutant sont frappées et non prélevées — offrir une escadre ne coûte rien à celui qui donne. C'est ce qui remplace un tutoriel à 86 % d'abandon par un premier acte social. *Lot S7.*

**2. La cache orbitale (D2)** — *le juge faisabilité : si tu ne devais implémenter qu'une seule chose des sept documents, ce serait celle-là.* Une table, un affichage carte, une mission `harvest` qui recycle `recycle`. Elle règle quatre problèmes indépendants : les 91 % de planètes au plafond cessent d'être un empire figé, les 33 attaques sur 37 en 0 round trouvent enfin **une cible avec un enjeu** (le problème n'était pas l'équilibrage du combat, c'était l'absence de butin), l'absence coûte quelque chose de **borné** (du stock, pas du temps de progression), et les notifications push ont leur premier message vraiment urgent. Déjà dans mon plan en S6 ; je la mentionne ici parce qu'elle est transplantable dans les sept directions telle quelle. *Lot S6.*

**3. Le principe de bruyance (D7)** — *le juge causes racines : l'idée isolée la plus précieuse du dossier.* « Le correctif technique a déjà échoué une fois **parce que le bug était invisible**. » Un biome à +8 % empilé sur une production, l'ignorer ne coûte rien que personne ne remarque — c'est comme ça que la fuite de 19,4 % a survécu des mois, et rien ne garantit qu'elle ne revienne pas après réparation. **Loi de conception, gratuite, applicable partout** : chaque système doit tomber en panne de façon audible à son point d'usage. Appliquée ici : le Bulletin de campagne ne dit jamais « OK vert », il dit « Marches-4, garnison 62 %, tu perds 60 pts/h dans 40 minutes ». Et le détecteur de régression sur l'économie ne compare pas des totaux, il assertent affiché == crédité au centime.

**4. Le bouton « Rejouer avec » (D3)** — sur chaque rapport de bataille, un bouton qui ouvre le simulateur pré-rempli avec la bataille réelle et te laisse changer ta composition. `simulateCombat` est une fonction pure, ça tourne côté client sans serveur. C'est « API → DB → guides » pointé sur le jeu lui-même, et c'est là que tes amis passeront leur mercredi soir. Presque gratuit, très toi. *Bonus S8 ou Campagne 1.*

**5. Le seuil de rupture (D3)** — tu déclares au départ « je décroche à −30 % de tonnage » ; atteint, la flotte rentre en offrant un round de tirs gratuits. Un champ et un test en fin de round. **Perdre devient une décision qu'on prend, pas un accident qu'on subit** — et pour une bande d'amis, rentrer cabossé plutôt qu'effacé change tout le rapport au PvP. *Candidat fort pour Campagne 1.*

**6. Le gradient anti-blocage (D7, la Fonderie à 25/h)** — le principe, pas la mécanique : *jamais bloqué, toujours taxé.* C'est ce que D5 a refusé de livrer et c'est pour ça qu'elle est dernière. Appliqué ici : si tu ne peux pas tenir la garnison minimale d'un Gisement, tu ne perds pas l'accès, tu perds du rendement. Aucun état « je me connecte et je ne peux rien faire ».

**7. Le classement au flux, pas au stock (D1)** — mention honorable du juge plaisir. Bonne nouvelle : c'est **déjà structurellement vrai** dans la Campagne, puisque le score est en points/h. Rends-le explicite dans l'UI avec une moyenne glissante 24 h, pour que celui qui revient après trois semaines se voie remonter.

**8. Le Grand Travail (D1)** — une barre de progression commune visible sur la carte de tout le monde, alimentée par tous les membres d'une alliance. C'est le seul objectif collectif du dossier qui donne une raison mécanique d'être à plusieurs sans dépendance dure. *Candidat pour la mécanique d'alliance de Campagne 2.*

---

## 5. Ce qu'il faut trancher avant de coder

Cinq questions. Aucune n'est technique, aucune ne se répond avec le simulateur, et toutes conditionnent le périmètre.

**1. La date et l'effectif — et tu les demandes AVANT de générer quoi que ce soit.**
Combien d'engagements fermes tu peux obtenir sur un samedi 18h, annoncé trois semaines à l'avance ? 5 ? 8 ? 12 ? Le générateur de carte prend l'effectif en paramètre : 6 joueurs → 20 systèmes et 6 gisements, à densité identique. **Une campagne à 6 bien dimensionnée est un bon jeu ; une campagne à 6 sur une carte pour 25 est un désert.** C'est la seule question dont la mauvaise réponse tue la direction, et c'est la seule à laquelle tu peux répondre en envoyant trois messages ce soir. Fais-le avant la semaine 1 — si tu n'obtiens pas cinq oui, la recommandation change et il faut basculer sur D1.

**2. PvP planétaire : ouvert, jamais, ou seulement les caches orbitales ?**
C'est la question la plus profonde du dossier et personne ne peut y répondre à ta place. Les données disent 1,5 % d'attaques, 33 combats sur 37 en 0 round — mais aussi 151 559 vaisseaux de guerre construits et jamais utilisés. D1 supprime le PvP planétaire, D4 l'ouvre à J5, D3 en fait tout le jeu. Le juge plaisir avance une hypothèse que tu es le seul à pouvoir confirmer : **il est possible que ces vingt-cinq personnes préfèrent miner ensemble que se taper dessus.** Trois périmètres possibles, par ordre de risque social croissant : (a) conflit **uniquement** sur les Gisements neutres et les caches orbitales — on se dispute un point sur la carte, on ne rase jamais la planète d'un copain ; (b) Gisements + PvP planétaire ouvert après J5 ; (c) PvP libre dès J1. Mon avis, si tu veux l'entendre : commence en (a) pour Campagne 0, et n'ouvre (b) qu'après avoir vu comment ils réagissent au premier gisement volé.

**3. Qu'est-ce qui traverse un reset ?**
C'est le contrat émotionnel avec tes amis, et les sept directions ne s'accordent pas. Rien ? Un score cumulé (D2 fait de l'exilium le score de saison, non dépensable) ? Des Doctrines débloquées en **terminant** une campagne, pas en la gagnant (D4) — « il a moins de choix, pas moins de puissance », ce qui est l'asymétrie la plus honnête entre amis que le dossier propose ? Un palmarès dans les Archives ? Mon conseil : **le palmarès et les Archives d'abord, les Doctrines à partir de Campagne 2, et jamais de puissance.** Mais c'est ton groupe, pas le mien.

**4. Le re-tuning des 13 fiches de vaisseaux : quel critère d'arrêt, écrit à l'avance ?**
D3 dit que ce travail « n'a pas de fin naturelle ». C'est exactement le genre de chantier qui tue un projet solo passion — pas parce qu'il est difficile, parce qu'il est infini. Tu dois écrire la règle **avant** d'ouvrir le fichier : par exemple *« sur 150 duels à budget égal dans game-sim, aucune composition mono-type ne gagne plus de 65 % de ses duels ; trois jours de travail maximum ; passé ce délai on livre le meilleur état atteint et on note l'écart pour Campagne 1. »* Le chiffre exact m'importe moins que le fait qu'il existe et qu'il soit daté.

**5. Tu joues, ou tu animes — et sur combien de campagnes tu t'engages ?**
Si tu joues, tu ne peux pas régler en direct sans être juge et partie, et l'Interlude est ton seul créneau de dev. Si tu animes (maître de jeu qui publie le rapport de rythme, arbitre, écrit les Archives), tu gagnes un rôle réel mais tu perds ton propre jeu — sur un projet passion, c'est une vraie perte. Et corollaire : **une campagne est une fête, trois campagnes sont un jeu.** L'Interlude comme produit ne fonctionne que si la campagne suivante a une date. Si tu ne te sens pas de tenir trois cycles, dis-le maintenant : la direction reste bonne, mais Campagne 0 devient un one-shot assumé et on coupe les Archives, les Doctrines et le générateur paramétré — c'est trois semaines de moins.

---

**Deux dernières notes, pour la route.**

Corrige `game-sim` en premier et sers-t'en en porte de livraison, pas en diagnostic. Trois directions sur sept l'ont compris et c'est le seul outil du dépôt qui rend ce chantier faisable en solo : il te dit si le rythme tient **avant** que quiconque joue. Une campagne mal calibrée se détecte le mercredi de la semaine 3, pas au J4 devant cinq amis déçus.

Et retire le code mort d'un seul coup, en début de chantier, pas « au cas où ». D1 le dit mieux que moi : supprimer plusieurs milliers de lignes qu'on a aimé écrire est plus dur que d'en écrire de nouvelles, et c'est un projet passion. Les politiques d'empire, les vocations, les curseurs, les malus de gouvernance, les raids de colonisation, le tutoriel à 22 quêtes — zéro utilisateur, c'est une donnée, pas un accident. Traîner ces systèmes une campagne de plus ne les sauvera pas, ça te coûtera juste la même douleur plus tard, avec des intérêts.