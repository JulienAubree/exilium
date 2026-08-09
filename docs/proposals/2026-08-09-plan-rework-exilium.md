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

Le nom du jeu portait la réponse depuis le début.

> Vous êtes les rescapés d'un empire tombé. Quelque chose vous a chassés de chez vous et vous a
> **dispersés** — chacun a atterri où il a pu, sur le monde qu'il a trouvé. C'est pourquoi vos
> empires ne se ressemblent pas : le biome où vous êtes tombés a décidé de ce que vous pouvez
> faire. C'est pourquoi vous ne vous attaquez pas : vous êtes les derniers. Et c'est pourquoi il
> y a un front — **ce qui vous a chassés occupe encore vos anciennes terres.**

Ce n'est pas de l'habillage. Chaque phrase justifie une mécanique choisie indépendamment :

| La fiction dit | La mécanique fait |
|---|---|
| Vous avez été dispersés | Les biomes déterminent ce que chaque empire peut faire |
| Vous êtes les derniers | Coopération, pas de PvP entre joueurs |
| L'occupant tient vos terres | Territoire PvE à reprendre — le cap visible sur la carte |
| Vous cherchez à rentrer | Progression sans fin, mais avec des paliers territoriaux |

**À écrire ensemble** : la nature de l'occupant, la catastrophe fondatrice, et le ton (tragique,
pulp, contemplatif). Ce sont des décisions de Julien ; ce document ne les tranche pas.

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

### Acte 3 — L'occupant

*Le cap visible, et la raison de construire des vaisseaux de guerre.*

Des secteurs de la carte tenus par l'occupant, avec des forces crédibles, libérés à plusieurs.
Choisi parmi quatre formes de PvE parce que c'est la seule qui soit à la fois **collective**,
**visible sur la carte** et compatible avec l'écart de rythme.

Les trois autres formes évoquées — vagues, cibles de difficulté croissante, événements
marquants — ne sont pas abandonnées : elles se greffent sur ce socle une fois qu'il tient.

> Aujourd'hui le PvE est trivial : 99,1 % de victoires, 1,25 round, un butin **5× inférieur** à
> un simple voyage de minage. Il faut le reconstruire, pas le régler.

### En parallèle, dès maintenant — la fiction

Elle ne coûte presque rien, elle informe tout le reste, et elle répond directement au « on ne
savait pas où ça allait ». C'est aussi la partie la plus amusante à écrire, ce qui compte dans
un projet dont le carburant est le plaisir.

---

## 6. Ce qui est décidé, ce qui reste ouvert

**Décidé** — 23 réponses d'entretien :
jeu coopératif · pas de PvP entre joueurs, conflit sur objectifs neutres et sur l'occupant ·
monde persistant sans fin mais à paliers visibles · carte neuve à égalité · score collectif +
faits d'armes · biomes comme moteur de divergence · PvE territorial en premier · priorité au
monde vivant et lisible · fiction de l'exil, co-écrite · ouverture au plus tôt même incomplète.

**Ouvert** — à trancher avant ou pendant :
- La nature de l'occupant, la catastrophe fondatrice, le ton du récit.
- Combien d'amis reviennent, et le dimensionnement de la carte qui en découle.
- Ce que « reprendre un secteur » veut dire mécaniquement, et ce que ça rapporte.
- Comment les faits d'armes se déclenchent, et lesquels valent la peine.
- Le critère d'arrêt du rééquilibrage des unités, **écrit avant d'ouvrir le fichier** — un
  chantier sans fin naturelle est ce qui tue un projet solo.
- Quelle est la première chose qu'un joueur voit à sa première connexion sur la carte neuve.

---

## 7. Ce qu'on jette

Zéro utilisateur est une donnée, pas un accident. Ces systèmes n'ont jamais été touchés et les
traîner coûtera la même douleur plus tard, avec des intérêts :

politiques d'empire (2 joueurs sur 25) · vocations (0 planète en industrielle) · gouverneurs et
malus de gouvernance (jamais déclenché) · curseurs de production (89 % jamais touchés) · respec
de recherche (0) · coque scientifique (0 sur 14) · monnaie exilium sous sa forme actuelle (0
dépense en 2 mois) · presets de flotte (1 joueur) · le tutoriel à 23 quêtes (86 % d'abandon,
10 comptes enfermés hors du chapitre 4).

**À décider séparément** : l'arbre de recherche et ses forks S1 (récent, mais `firepower` n'a
jamais été recherché par personne), le vaisseau amiral, le moteur de combat dans sa forme
actuelle.
