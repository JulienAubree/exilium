# Le critère d'arrêt du rééquilibrage du combat

> Écrit le 2026-08-09, **avant d'avoir ouvert un seul fichier d'équilibrage**.
> C'est la règle que le plan de rework s'impose (principe 6, section 5) : un
> chantier sans fin naturelle est ce qui tue un projet solo, et le rééquilibrage
> d'un moteur de combat est le chantier sans fin par excellence.
>
> **Ce document demande une validation de Julien avant que le tuning commence.**
> Tuner sans contrat convenu, c'est précisément la boucle qu'on veut éviter.

---

## 1. Le problème, en chiffres

Mesuré sur les 1 138 combats PvE réellement joués en production :

| | Valeur | Ce que ça dit |
|---|---:|---|
| Victoires | **99,1 %** | Il n'y a pas de combat, il y a une formalité |
| Durée moyenne | **1,27 round** | La flotte adverse fond au premier échange |
| Combats sans aucune perte | **83 %** | Envoyer sa flotte ne coûte rien |
| Rapport de puissance médian | **20 : 1** | En faveur du joueur |
| Rapport moyen | **63 : 1** | La queue est encore pire |

Ce n'est ni la formule de combat ni les gabarits pirates pris isolément : le
moteur est sain et les templates référencent les mêmes vaisseaux que les
joueurs. C'est **l'assemblage** — un budget de puissance calculé par
`tier × niveau du centre de missions`, plafonné à 0,8 × la puissance du joueur
mais seulement vers le bas, des multiplicateurs de recherche à 1/1/1 côté
pirate, aucune défense, et un butin écrasé par `pve_loot_multiplier = 0,1`.

---

## 2. Ce qu'on cherche

Un assaut sur un système des Premiers doit être **une décision, pas une
formalité**. Concrètement : le joueur doit pouvoir perdre, il doit payer même
quand il gagne, et il doit avoir intérêt à s'y mettre à plusieurs.

---

## 3. Le critère, exécutable

Trois flottes de référence, définies **à l'avance** et figées dans le code, pour
que le calibrage ne soit pas une conversation mais une mesure.

| Flotte | Représente | Puissance |
|---|---|---|
| **Petite** | Le joueur qui vient de débloquer le chantier | ~1 |
| **Moyenne** | Trois semaines de jeu régulier | ~10 |
| **Grosse** | Le groupe qui s'y met à plusieurs | ~40 |

Une garnison est **bien réglée** quand, sur 200 simulations contre la flotte de
référence de son palier :

1. **Taux de victoire entre 40 % et 70 %.** En dessous, le palier est un mur qui
   décourage ; au-dessus, c'est encore une formalité.
2. **Des pertes attaquantes non nulles dans au moins 80 % des victoires.** Une
   victoire gratuite n'est pas une victoire, c'est un encaissement.
3. **Durée moyenne d'au moins 2 rounds.** Un combat réglé au premier échange
   n'a pas d'histoire à raconter.

Un palier qui satisfait les trois est **fini**. On n'y retouche plus.

---

## 4. La borne de temps

**Deux séances de calibrage au maximum.** Passé ce point, ce qui reste se règle
en jouant, via le back-office — les garnisons sont de la config, pas du code.

Si un palier résiste aux deux séances, on ne s'acharne pas : on le sort du
lancement et on ouvre avec les paliers qui tiennent. Un système de moins est
sans conséquence ; un projet abandonné parce qu'on a passé trois semaines sur
une courbe, non.

---

## 5. Ce que le critère ne couvre PAS

À dire explicitement, pour qu'on ne lui demande pas ce qu'il ne sait pas faire :

- **Le plaisir.** Un combat peut satisfaire les trois seuils et être ennuyeux.
  Seuls les retours des amis le diront.
- **Le sur-nombre.** Rien n'empêche encore d'envoyer dix fois la flotte de
  référence. Le cap `0,8 × puissance joueur` disparaît avec les garnisons fixes,
  et son remplaçant reste à concevoir — coût en hydrogène du convoyage, limite
  d'escadre par assaut, ou plafond de rounds. **Question ouverte.**
- **La progression entre paliers.** Le critère juge chaque palier isolément.
  Que l'enchaînement forme une courbe agréable est un jugement, pas une mesure.

---

## 6. À valider

- [ ] Les trois seuils (40-70 %, 80 % de victoires coûteuses, 2 rounds)
- [ ] Les trois flottes de référence, et leurs puissances
- [ ] La borne de deux séances, et la règle « un palier qui résiste sort du
      lancement »
