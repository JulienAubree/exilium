# Refonte de la colonisation

## Nouveau systeme de colonisation

La colonisation n'est plus instantanee. Etablir une colonie est desormais un veritable projet qui demande strategie et engagement.

### Deroulement

1. **Envoyez votre vaisseau colonie** vers une position vide
2. **A l'arrivee**, la planete entre en phase de stabilisation — une barre de progression demarre
3. **Completez les 3 fondations** pour accelerer la colonisation
4. **Gerez les alertes** qui surgissent toutes les 2 heures
5. **A 100%**, prenez possession de votre nouvelle colonie

### Les 3 fondations

Chaque fondation est une mission unique qui accelere considerablement la stabilisation :

- **Etablir l'avant-poste** — Deployez les infrastructures temporaires (coute 2 000 minerai + 1 000 silicium). Boost immediat de +20%.
- **Ravitaillement vital** — Envoyez un convoi de ressources depuis une autre planete. +5% par tranche de 2 000 ressources livrees, jusqu'a +25%.
- **Securiser le secteur** — Envoyez des vaisseaux de combat. Chaque vaisseau ajoute +2%/h de progression passive permanente, jusqu'a +20%/h.

### Alertes et evenements

Toutes les 2 heures, un evenement surgit :
- **Raid hostile** — Des pirates attaquent l'avant-poste. Envoyez des renforts pour le repousser.
- **Penurie critique** — Les stocks s'epuisent. Envoyez un ravitaillement d'urgence.

Vous avez 4 a 6 heures pour reagir. Ignorer une alerte fait reculer la barre de progression. Si elle tombe a 0%, la colonisation echoue et le vaisseau colonie rentre a la base.

### Difficulte variable

La vitesse de progression passive depend de la planete :
- **Temperee** : progression rapide (facteur x1.0)
- **Aride / Glaciale** : progression moderee (x0.7)
- **Volcanique / Gazeuse** : progression lente (x0.5)

La distance au systeme d'origine impacte aussi la difficulte.

---

## Nouveau batiment : Centre de Pouvoir Imperial

Constructible uniquement sur la planete mere. Il represente le siege politique de votre empire.

### Gouvernance

Chaque niveau augmente votre **capacite de gouvernance** de +1 planete. Il n'y a pas de limite au nombre de planetes que vous pouvez coloniser, mais depasser votre capacite entraine des penalites sur toutes vos colonies :

| Depassement | Recolte | Construction |
|---|---|---|
| +1 | -15% | +15% |
| +2 | -35% | +35% |
| +3 et + | -60% | +60% |

La planete mere est toujours exemptee. Ameliorez le Centre de Pouvoir pour absorber votre expansion — ou acceptez les penalites si vous preferez l'expansion rapide.

L'indicateur de gouvernance est visible dans la vue Empire.

---

## Ameliorations de la vue Empire

- **Indicateurs KPI cliquables** — Chaque chiffre de la barre (production, planetes, gouvernance, flottes) se deplie pour montrer le detail
- **Production par planete** — Barres visuelles proportionnelles, triees par contribution
- **Flottes en vol** — Liste detaillee avec type de mission, phase, coordonnees, et compte a rebours en temps reel
- **Noms de planetes cliquables** — Cliquez pour naviguer directement vers la planete
- **Cartes de colonisation** — Les planetes en colonisation apparaissent comme des cartes speciales cliquables dans l'Empire

---

## Autres ameliorations

- **Bouton "Changer de coque"** du vaisseau amiral rendu visible (etait quasi invisible a 50% d'opacite)
- **Filtre Exploration** ajoute aux rapports de mission
- **Reorganisation des planetes** simplifiee avec un systeme de fleches (remplace le drag & drop instable)
- **Bandeau hors ligne** ameliore — verifie la connectivite reelle au lieu de se fier a `navigator.onLine`
- **Correction des compteurs de vaisseaux** en production parallele (race condition corrigee)
