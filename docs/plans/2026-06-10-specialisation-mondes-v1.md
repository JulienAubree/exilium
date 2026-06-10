# Spécialisation des mondes — v1 (vocations)

> **Statut** : spec v1 — premier sous-système du chantier Empire (proposal modernisation 4X §5.1).
> Décisions par défauts raisonnables (session autonome) — ajustables en config sans deploy.

## Design

Chaque colonie peut adopter une **vocation** : un bonus fort contre un malus réel — l'empire
prend une *forme*. La planète-mère reste **Capitale** (équilibrée, non spécialisable).

**v1 — deux vocations + neutre** (les deux dials déjà plombés : production & temps de construction) :

| Vocation | Bonus | Malus | Fantasme |
|---|---|---|---|
| **Monde minier** | +20 % production (3 ressources) | +15 % temps de construction | l'empire-extraction |
| **Monde-forge** | −20 % temps de construction | −10 % production | l'atelier de l'empire |
| *Équilibrée* (défaut) | — | — | — |

v2 (quand leurs hooks seront branchés) : Scientifique (annexes de recherche), Forteresse
(défense/bouclier), synergies d'adjacence, caps par rôle.

## Règles

- **Débloqué au niveau d'empire 5** (`vocation_unlock_level`) — le niveau gate, comme convenu.
- **Premier choix gratuit** par planète ; **reconversion** : coût en ressources sur la planète
  (`vocation_reconversion_minerai` 50k / `_silicium` 25k) + **cooldown 7 jours**
  (`vocation_cooldown_hours` 168). Revenir à Équilibrée = une reconversion aussi.
- Effets appliqués partout où la gouvernance s'applique déjà : tick de masse, rates
  single-planet, temps de construction (start + complete recompute).

## Implémentation

- **DB** : `planets.vocation` (varchar 32, null = équilibrée) + `planets.vocation_changed_at` ;
  migration `0096` ; clés `universe_config` (5).
- **Engine** : `formulas/vocation.ts` — `vocationEffects(vocation, universe)` →
  `{ productionDelta, constructionTimeMult }` (+ tests).
- **API** : `planet.setVocation` (gate niveau, cooldown, coût via `resourceService.spendResources`,
  homeworld interdit) ; effets dans `resource-tick`, `resource.service` (rates), `building.service`
  (×2 sites, à côté de `govTimeMult`).
- **Web** : carte Vocation dans la Vue d'ensemble du drill-down (choix/reconversion, coûts,
  cooldown) ; badge vocation sur les cartes Empire et le panneau Planète (v1 : drill-down d'abord).
