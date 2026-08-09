# Exilium — le plan de rework

> Établi le 2026-08-09, à partir d'un entretien de 23 questions avec Julien, du diagnostic
> factuel (`docs/reference/cartographie-fonctionnelle.md`) et de sept directions jugées
> comparativement (`docs/proposals/2026-08-09-directions-rework.md`).
>
> **Ce document remplace la recommandation du jury.** Celle-ci avait été conçue pour des
> joueurs compétitifs et un jeu à saisons bornées ; l'entretien a établi l'inverse sur les
> deux points. Ce qui suit dérive des réponses réelles, pas des hypothèses.

---

## 1. Le jeu, en une phrase

**Un 4X coopératif où des exilés dispersés reprennent, ensemble, un territoire occupé — et
où le monde sur lequel on est tombé décide de ce qu'on devient.**

---

## 2. Pourquoi le jeu s'est vidé — la vraie raison

Le diagnostic technique avait établi trois causes : l'économie qui fuit de 19,4 %, un combat
qui récompense l'inverse de son intention, et 529 h avant le premier vaisseau.

**Les joueurs, eux, ont dit autre chose : « on ne savait pas vers où ça allait. »**

Les trois causes techniques expliquent pourquoi le jeu était *pénible*. Elles n'expliquent pas
pourquoi ils sont *partis*. C'est le péché originel des OGame-like : on grossit, et puis voilà.
Pour une bande d'amis, ça ne tient pas.

Ce qui manquait précisément, d'après eux : **voir où en sont les autres**, **comprendre à quoi
sert ce qu'on débloque**, et **une histoire qui donne du sens à la croissance**.

Corollaire : le problème n'était pas l'absence de but, mais son **invisibilité**. C'est une
bonne nouvelle — une couche de téléologie coûte infiniment moins cher que du contenu.

---

## 3. La fiction — l'exil

> Écrite avec Julien le 2026-08-09. Les quatre axes qui restaient ouverts — la catastrophe, la
> nature de l'occupant, le rôle de l'exilium, l'époque — sont tranchés. Ton retenu : space opera,
> avec du souffle et du panache **des deux côtés** : les Premiers sont des pirates, ils ont des
> noms, des pavillons et de la gueule, et ils parlent.

### 3.1 Le texte

**Ce qu'on sait**

Il y a eu une guerre. On ne sait plus qui l'a commencée ni ce qui a été dit avant. On sait qu'elle
a duré, et qu'à la fin il n'y avait plus d'humanité — seulement des vaisseaux.

Ce qui a permis de partir s'appelle l'exilium. On ne sait plus le produire, on ne sait qu'en
chercher. Il ne s'en trouve pas partout, et sans lui il n'y a pas de long-courrier : un monde sans
exilium est un monde dont on ne repart pas.

**Ceux qui sont partis les premiers**

Les meilleurs vaisseaux sont partis d'abord, avec presque tout le stock. Ils sont allés loin, vite,
et ils se sont posés sur les mondes riches.

Nous sommes partis après, avec ce qui restait. On s'est arrêtés au bord, là où le carburant s'est
arrêté, et on a tenu.

Eux n'ont jamais eu à se reconstruire. Ils sont tombés sur des mondes qui marchaient déjà, et ils
les consomment. Ils tiennent des systèmes entiers, chacun au nom d'un capitaine, avec des ports,
des pavillons et la mémoire intacte de tout ce que nous avons oublié. Ils s'appellent eux-mêmes les
Premiers, et ils le disent souvent.

Leurs mondes s'usent. C'est pour ça qu'ils regardent vers le bord.

**La règle**

Une chose a survécu à l'oubli : on ne se fait pas la guerre entre nous. Personne ne sait plus d'où
vient cette règle. Tout le monde la respecte.

C'est peut-être la seule chose qu'on ait rapportée d'avant.

**Maintenant**

On recommence à voyager, et on se retrouve, un monde après l'autre. Il nous aura fallu des siècles
pour valoir le déplacement.

Maintenant qu'on le vaut, ils sont venus voir.

### 3.2 Ce que la fiction décide

Ce n'est pas de l'habillage. Chaque phrase justifie une mécanique choisie indépendamment, et
plusieurs d'entre elles réparent un système existant au lieu d'en ajouter un.

| La fiction dit | La mécanique fait |
|---|---|
| L'humanité s'est tuée elle-même | Pas de PvP entre joueurs — la règle vient du récit, pas du design |
| Chacun s'est posé où le carburant s'est arrêté | Les biomes déterminent ce que chaque empire peut faire |
| L'exilium est rare et permet d'aller loin | La monnaie morte devient la super-ressource ; voyager et débloquer en coûtent |
| L'exilium est chez eux | Boucle complète : il m'en faut → il est occupé → j'y vais à plusieurs → j'en rapporte → je vais plus loin |
| On a oublié, eux non | L'arbre de recherche n'invente pas, il **rend** — un nœud = une capacité retrouvée |
| Ils tiennent nos archives | Le PvE territorial rapporte de la mémoire, pas seulement du butin |
| Ce sont des pirates, et ils parlent | Un silo se **prend ou s'achète** : une décision collective à débattre, sur deux systèmes qui existent déjà |
| Ils viennent parce qu'on vaut enfin le déplacement | La menace naît de la réussite du groupe — auto-équilibrée, et ça date le début de la partie |

Deux conséquences valent d'être notées explicitement :

- **La boucle rend les vaisseaux de guerre nécessaires par l'économie.** Ils cessent d'être un
  système parallèle qu'on entretient sans savoir pourquoi.
- **« On ne cherche pas, on se souvient » répond au reproche des joueurs** (« on ne comprend pas à
  quoi sert ce qu'on débloque ») pour le prix d'un texte par nœud, sur un arbre qui existe déjà.

### 3.3 Les Premiers

**Les Premiers sont des pirates**, et le nom est celui qu'ils se donnent : une revendication
d'antériorité, arrogante, peinte sur les coques. Nous le répétons faute d'avoir autre chose à dire
d'eux. En face, **on ne se nomme pas** : on dit « nous ». Les gens qui ont tout perdu ne se donnent
pas de nom de faction.

Ils sont la branche de l'humanité qui n'a pas arrêté — pas un ennemi extérieur, mais ce qu'on
devient si on continue. Ce ne sont pas des pillards en marge : **ils tiennent des systèmes
entiers**, à la manière des républiques de flibustiers qui tenaient des ports et des littoraux.
Ils ne cultivent pas, ils consomment — et leurs mondes s'épuisent, ce qui leur donne un mobile qui
grandit avec le temps.

Ce que la piraterie apporte, concrètement :

- **Le panache est des deux côtés.** Plus besoin d'un ennemi froid dans un jeu qui veut du souffle.
- **Des capitaines récurrents et nommés.** Le contenu le moins cher à produire et le plus facile à
  raconter dans le groupe : un adversaire qui vous a humiliés une fois et qui revient s'entretient
  tout seul dans les conversations.
- **Ils parlent.** Donc on peut négocier, acheter, se faire rançonner — et une partie du récit
  passe par leur bouche, ce qui coûte des lignes de dialogue et pas des systèmes.
- **Ils tiennent du territoire.** Le front cesse d'être une liste de missions et devient une ligne
  visible sur la carte : nos mondes au bord, leurs systèmes dans le riche.

> Cette dernière décision relève en grande partie la limite d'enjeux qu'on redoutait ici : des
> pillards en marge plafonnent vite, une puissance rivale qui tient des systèmes, non. Reste ouvert,
> mais moins pressant : savoir si les Premiers sont toute l'histoire ou la couche visible d'autre
> chose.

### 3.3 bis — Un système, un capitaine, un objectif

C'est la forme que prend la progression territoriale, et elle vient gratuitement du fait qu'ils
tiennent des systèmes.

Chaque système pirate porte le nom de son capitaine. Le prendre est une affaire de plusieurs
semaines et de plusieurs joueurs — **c'est le palier visible que le plan cherchait sans avoir su le
formuler**. Et surtout, ça se planifie tout seul dans le groupe : « on tape Varek ce week-end » dit
où, combien de temps, et avec qui.

Les trois types de secteurs (3.4) ne sont pas concurrents de ce découpage : **ils s'emboîtent
dedans**. Un système contient ses ports, ses prises et ses cales.

> 🔧 **Décision technique à prendre au début, pas après.** `planets.userId` est `notNull` avec clé
> étrangère vers `users` : une planète sans propriétaire n'existe pas dans le schéma actuel. Deux
> voies —
>
> 1. **Les capitaines sont des lignes `users`.** Un système pirate devient un empire comme un
>    autre : flottes, bâtiments, défenses, combat et espionnage fonctionnent sans une ligne de code
>    supplémentaire, et les bastions peuvent être réellement défendus. **Recommandé.**
> 2. `userId` nullable et une notion de faction. Plus propre conceptuellement, mais impose un second
>    chemin de propriétaire dans tout le code de flotte et de combat.
>
> Si on prend la voie 1, poser un drapeau `isNpc` **dès la première migration** : sans lui, les
> classements, le fil de l'univers, le compteur de joueurs et l'admin compteront les pirates parmi
> les amis. Dette bornée, mais seulement si elle est posée au départ.

### 3.4 Les trois secteurs

« Reprendre un secteur » ne veut pas dire la même chose partout. Trois formes, trois gains, trois
façons de jouer :

| Secteur | Ce qu'ils y ont | Ce qu'on y gagne |
|---|---|---|
| **Les ports** | Un repaire, des équipages — ils y reviennent toujours | De l'exilium en flux tant qu'on tient. Le rendez-vous répétable du groupe. |
| **Les prises** | Une cache, une épave qu'ils démontent, peu de monde | Le gisement ou l'épave, définitivement. La progression franche et lisible sur la carte. |
| **Les cales** | Nos archives, au fond d'une soute, mélangées au reste du butin | Un souvenir rendu à **tout le monde**. Rare, à l'unité, événement de serveur. |

La cale est la pièce maîtresse : **le seul contenu dont le gain est collectif par nature**, donc le
seul qui rende la coopération évidente sans avoir à l'imposer. Et comme les Premiers parlent, elle
se **prend ou s'achète** — payer en exilium ce qu'on pourrait prendre au prix du sang est une
décision de groupe, elle se débat, et les deux systèmes nécessaires existent déjà.

---

## 4. Les principes de conception

Dérivés directement des réponses de l'entretien. Ils arbitrent les décisions futures.

1. **On ne s'attaque pas entre amis.** Le conflit existe, mais il porte sur des objectifs
   neutres et sur l'occupant. Jamais sur la planète d'un copain.
2. **On se compare sans s'opposer.** Score collectif et faits d'armes individuels. Aucun
   classement de puissance qui mettrait le joueur quotidien face à l'hebdomadaire.
3. **Chacun son échelle.** L'écart de rythme est une donnée du groupe, pas un défaut à corriger.
   Aucune mécanique ne doit punir celui qui se connecte une fois par semaine.
4. **Le monde parle.** À tout moment, on voit ce que font les autres et on comprend ce qu'on
   achète en débloquant quelque chose. Un système qui tombe en panne doit tomber en panne
   **audiblement**, à son point d'usage.
5. **Les mondes façonnent les empires.** Les biomes ne sont pas un bonus de production, ils sont
   ce qui rend deux empires structurellement différents — donc complémentaires, donc
   interdépendants sans dépendance forcée.
6. **Le plaisir de construire est une ressource du projet.** Le temps de dev disponible dépend
   de l'intérêt du chantier. Un lot de trois semaines d'équilibrage en ouverture tuerait le
   projet. L'intéressant passe devant.

---

## 5. Le plan, en actes

### Acte 0 — Rendre les chiffres honnêtes

*Invisible pour les joueurs. Prérequis de tout le reste.*

On ne construit pas une couche qui **montre** des choses au-dessus d'une économie qui affiche
528 423/h et en verse 425 740. Afficher un faux chiffre est pire que ne rien afficher.

- Chemin de crédit unique : l'affiché égale le versé, au centime, avec un test qui l'assertent.
- Les biomes et les politiques retrouvent un effet réel — prérequis direct de l'acte 2.
- Snapshot de config par partie : le back-office cesse d'être écrasé par le seed à chaque
  déploiement.

### Acte 1 — Le monde neuf et vivant

*C'est ce que les amis verront en revenant. Le plus tôt possible, même incomplet.*

**Pourquoi la carte neuve est ici et pas plus tard** : un fil d'actualité sur un monde mort
n'affiche rien. Le monde vivant a besoin de vie. Les 91 planètes actuelles sont un empire figé
au plafond — la couche sociale y serait vide.

- Carte neuve, tout le monde à égalité, dimensionnée sur l'effectif réellement attendu.
- Économie accélérée : multiplicateur **plat** (seul levier mesuré comme homothétique — raidir
  l'exposant est non-monotone et peut *ralentir* le jeu).
- **Le fil de l'univers** : qui a découvert quel biome, qui a débloqué quoi, où en est le score
  collectif, où en est le front.
- **Les déblocages lisibles** : chaque recherche et chaque bâtiment dit ce qu'il ouvre.
- **Les faits d'armes** : distinctions individuelles visibles, sans classement de puissance.

> ⚠️ Le mur des 529 h est un **verrou de ressource**, pas une courbe : le prospecteur coûte
> 375 hydrogène et la dotation de départ en donne 100. Un kit de départ le masquerait et il
> reviendrait au deuxième vaisseau. Il faut sortir l'hydrogène des coûts early.

**Le test** : si les amis reviennent, jouent trois semaines et racontent des choses, la thèse
tient. Sinon on l'apprend tôt et pour pas cher.

### Acte 2 — La divergence par les mondes

*Ce qui fait que le jeu devient le tien plutôt qu'un OGame de plus.*

Les biomes deviennent le moteur : ce qu'on trouve détermine ce qu'on peut faire. Deux joueurs
finissent avec des empires structurellement distincts, donc complémentaires, donc naturellement
amenés à s'échanger des choses. **La coopération devient mécanique au lieu d'être morale.**

C'est le seul système auquel Julien tient dans l'existant, et 33 biomes sur 5 raretés sont
déjà écrits.

### Acte 3 — Les Premiers

*Le cap visible, et la raison de construire des vaisseaux de guerre.*

Des systèmes entiers tenus par les Premiers, chacun au nom d'un capitaine, repris à plusieurs.
Choisi parmi quatre formes de PvE parce que c'est la seule qui soit à la fois **collective**,
**visible sur la carte** et compatible avec l'écart de rythme.

La fiction (section 3) a depuis précisé la forme : un système = un capitaine = un objectif, avec
ses ports, ses prises et ses cales à l'intérieur. Et la boucle qui rend les vaisseaux de guerre
nécessaires vient de l'économie et non d'un système parallèle : **l'exilium est chez eux.**

Les trois autres formes évoquées — vagues, cibles de difficulté croissante, événements
marquants — ne sont pas abandonnées : elles se greffent sur ce socle une fois qu'il tient.

> Aujourd'hui le PvE est trivial : 99,1 % de victoires, 1,25 round, un butin **5× inférieur** à
> un simple voyage de minage. Il faut le reconstruire, pas le régler.

### En parallèle, dès maintenant — la fiction

Elle ne coûte presque rien, elle informe tout le reste, et elle répond directement au « on ne
savait pas où ça allait ». C'est aussi la partie la plus amusante à écrire, ce qui compte dans
un projet dont le carburant est le plaisir.

**Fait le 2026-08-09** — le socle est écrit (section 3). Ce qu'il reste relève de l'écriture au
fil de l'eau et non d'une décision : les capitaines et ce qu'ils disent, le texte d'un nœud de
recherche retrouvé, les noms des systèmes.

---

## 6. Ce qui est décidé, ce qui reste ouvert

**Décidé** — 23 réponses d'entretien, puis 7 de plus sur la fiction :
jeu coopératif · pas de PvP entre joueurs, conflit sur objectifs neutres et sur l'occupant ·
monde persistant sans fin mais à paliers visibles · carte neuve à égalité · score collectif +
faits d'armes · biomes comme moteur de divergence · PvE territorial en premier · priorité au
monde vivant et lisible · ouverture au plus tôt même incomplète.

Et, depuis la section 3 : la catastrophe (une guerre que l'humanité s'est faite à elle-même) ·
l'occupant (**les Premiers**, pirates, la branche qui n'a pas arrêté — et qui parlent) · le ton
(space opera, panache des deux côtés) · l'époque (assez de temps pour avoir oublié) · l'exilium
comme super-ressource rare, détenue par eux · **les Premiers tiennent des systèmes entiers, un
capitaine par système** · les trois types de secteurs, emboîtés dedans · la cale qui se prend ou
s'achète.

**Ouvert** — à trancher avant ou pendant :
- Combien d'amis reviennent, et le dimensionnement de la carte qui en découle.
- La forme de jeu concrète d'une prise — les trois gains sont fixés (flux, gisement, souvenir), la
  confrontation elle-même reste à concevoir.
- **Ce qu'on fait d'un système repris** : on s'y installe, ou il s'ouvre simplement au passage ?
  Question ouverte depuis que les Premiers tiennent du territoire.
- Comment les faits d'armes se déclenchent, et lesquels valent la peine.
- Les capitaines : combien, comment ils reviennent, ce qu'ils disent.
- Si les Premiers sont toute l'histoire ou la couche visible de quelque chose de plus gros
  (cf. l'encadré 3.3 sur le plafond des enjeux).
- **Voie 1 ou voie 2 pour la propriété des planètes pirates** (encadré 3.3 bis) — à décider avant
  la première migration de la carte neuve, pas après.
- Le critère d'arrêt du rééquilibrage des unités, **écrit avant d'ouvrir le fichier** — un
  chantier sans fin naturelle est ce qui tue un projet solo.
- Quelle est la première chose qu'un joueur voit à sa première connexion sur la carte neuve.

---

## 7. Ce qu'on jette

Zéro utilisateur est une donnée, pas un accident. Ces systèmes n'ont jamais été touchés et les
traîner coûtera la même douleur plus tard, avec des intérêts :

politiques d'empire (2 joueurs sur 25) · vocations (0 planète en industrielle) · gouverneurs et
malus de gouvernance (jamais déclenché) · curseurs de production (89 % jamais touchés) · respec
de recherche (0) · coque scientifique (0 sur 14) · presets de flotte (1 joueur) · le tutoriel à
23 quêtes (86 % d'abandon, 10 comptes enfermés hors du chapitre 4).

**Réaffecté plutôt que jeté** : la monnaie exilium (0 dépense en 2 mois) quitte son rôle de jeton
de boutique et devient l'élément de la fiction — rare, détenu par les Premiers, nécessaire au
long-courrier et aux déblocages. Le nom traînait déjà partout dans le code et dans le titre du jeu ;
il ne restait qu'à lui donner un sens.

**À décider séparément** : l'arbre de recherche et ses forks S1 (récent, mais `firepower` n'a
jamais été recherché par personne), le vaisseau amiral, le moteur de combat dans sa forme
actuelle. Noter que la fiction donne à l'arbre de recherche une raison d'exister qu'il n'avait pas
— « on ne cherche pas, on se souvient » — ce qui plaide pour le garder et le rhabiller plutôt que
pour le refaire.
