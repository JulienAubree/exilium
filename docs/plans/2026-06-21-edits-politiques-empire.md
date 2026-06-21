# Édits & Politiques d'Empire — spec v1

> **Statut** : spec avant code (à valider avant implémentation).
> **Date** : 2026-06-21
> **Chantier** : Empire §5.2 (cf. `docs/proposals/2026-06-09-modernisation-4x-empire.md`).
> **Objectif** : donner la **manette d'empereur** qui manque — des décisions globales à vrais arbitrages, qui font passer de « comptable » à « régnant ».

---

## 1. Problème

Le joueur n'a aucun levier à l'échelle de l'empire. Vocations (par planète) et gouverneurs (délégation) existent ; il manque la **posture impériale** : des choix globaux qui réorientent tout l'empire avec un coût d'opportunité réel.

## 2. Principe directeur

- **Pas de choix gratuit** : chaque posture = un gain franc **contre** un malus franc. Pas de « meilleure build » évidente → arbitrages situationnels (guerre ↔ croissance).
- **Gating par capacité, pas par nouvelle monnaie** (décision, cf. §7) : on ne peut pas tout activer → on **priorise**.
- **Réutiliser l'infra existante** : empilement de modificateurs (`buildBonusContext`), malus de construction (chemin gouvernance), capacité dérivée du niveau d'empire, config dans `universe_config` éditable en admin.
- **Mobile-first** : un écran « Salle du trône » lisible, posture par axe, slots utilisés/dispo, effet net affiché.

## 3. Modèle de design (v1)

### Axes de politique (postures mutuellement exclusives par axe)

Chaque **axe** a 2–3 **postures** ; `neutre` = défaut sans effet. Valeurs = défauts de départ, toutes dans `universe_config` (équilibrables sans redéploiement).

| Axe | Posture | Effet (global) |
|---|---|---|
| **Doctrine économique** | `croissance` | +10 % production ressources · −10 % vitesse construction **bâtiments** |
| | `economie_guerre` | −15 % production ressources · −20 % temps construction **vaisseaux+défenses** |
| | `neutre` | — |
| **Fiscalité** | `rendement` | +12 % production ressources · −10 % gain d'**exilium** |
| | `frugalite` | −8 % production · +15 % gain d'**exilium** |
| | `neutre` | — |
| **Logistique** | `mobilisation` | +1 slot de flotte · +10 % temps construction bâtiments |
| | `industrialisation` | −18 % temps construction bâtiments · −5 % production |
| | `neutre` | — |

> **Livré en v1** sur les leviers à intégration propre (production, temps de construction par catégorie, gains d'exilium, slots de flotte). Les effets *réparation des défenses* et *vitesse de flotte* (idée « retranchement ») sont reportés en **v2** (points d'intégration plus invasifs).

> Les magnitudes ci-dessus sont des **points de départ à équilibrer** (cf. §7, décision). On garde 3 axes max en v1 pour la lisibilité mobile.

### Capacité (slots)

Nombre de postures **non-neutres** activables simultanément = `empirePolicyCapacity(empireLevel)` :
- Niveau 1 → **1 slot**, puis **+1 tous les N niveaux** (défaut N=10, `universe.empire_policy_levels_per_slot`), plafonné au nombre d'axes (3).
- Même pattern que `empireGovernanceCapacity` (`packages/game-engine/src/formulas/empire-level.ts`).

### Coût de reconversion (anti flip-flop)

Changer une posture impose un **cooldown** par axe (défaut 12 h, `universe.policy_switch_cooldown_hours`) — on s'engage, on ne micro-optimise pas combat par combat. (Alternative : coût en exilium ; cf. §7.)

## 4. Données (migration `01xx_empire_policies`)

```sql
CREATE TABLE empire_policies (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active      jsonb NOT NULL DEFAULT '{}',     -- { "doctrine": "croissance", "fiscalite": "neutre", ... }
  switched_at jsonb NOT NULL DEFAULT '{}',     -- { "doctrine": "<iso>" } pour le cooldown par axe
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```
- Owner `exilium` (via `apply-migrations.sh`, jamais `sudo -u postgres`).
- `universe_config` : définitions des axes/postures/effets + `empire_policy_levels_per_slot` + `policy_switch_cooldown_hours`. Ajout au seed (`seed-game-config.ts`) — **additif**, pas de suppression.

## 5. Moteur (pur, `packages/game-engine/src/formulas/policy.ts`)

```ts
export interface PolicyEffects {
  productionDelta: number;                 // additif, plugue dans buildBonusContext
  exiliumGainMult: number;                 // multiplicatif sur les gains d'exilium
  buildTimeMult: { building, ship, defense };
  fleetSlotBonus: number;
  defenseRepairBonus: number;
  fleetSpeedMult: number;
}
export function policyEffects(active: Record<string,string>, universe): PolicyEffects // somme des postures actives
export function empirePolicyCapacity(level: number, config): number
```
+ tests purs (table des postures → effets attendus, capacité par niveau).

## 6. Intégration (points de branchement réels)

- **Production** : dans `buildBonusContext` (`apps/api/src/modules/resource/resource.service.ts:150`), nouvelle source `'politique'` → `add('politique', 'production_*', productionDelta)`. S'empile proprement avec gouvernance/vocation/recherche.
- **Construction** : réutiliser le chemin du `constructionMalus` de gouvernance dans `building/research/shipyard.service` → appliquer `buildTimeMult` par catégorie.
- **Exilium** : multiplier les crédits dans `exilium.service` (les gains passent par `addExilium`).
- **Slots de flotte** : `fleetSlotBonus` ajouté au calcul de `fleet.getFleetSlots`.
- **Réparation défenses / vitesse flotte** : combat (repair rate) et `fleet.helpers` (speed).
- **API** : module `policy` — `get` (postures actives, dispo, slots used/max, cooldowns, effet net) · `set({ axis, posture })` (valide capacité + cooldown).

## 7. Décisions à confirmer (produit / équilibrage)

1. **Gating** : capacité de slots dérivée du **niveau d'empire** *(recommandé : simple, anti-inflation, pas de nouvelle monnaie)* — ou une vraie ressource « Influence » dépensable ?
2. **Reconversion** : **cooldown** par axe *(recommandé)* ou coût en exilium ?
3. **Contentement** : **hors v1** *(recommandé)* — l'ajouter en v2 comme tissu conjonctif (un empire trop étalé devient dur à contenter → anti-snowball *tall vs wide*). Ou dès v1 ?
4. **Magnitudes & axes** : valider la table §3 (équilibrage). Compensation joueurs : aucune (purement additif, rien n'est retiré).

## 8. Phasage

- **v1 (cette spec)** : 3 axes, slots par niveau, cooldown, écran Salle du trône, intégration prod/construction/exilium/flotte. 1 migration, pas de suppression.
- **v2** : Contentement (par empire) + édits **temporaires** (mobilisation X jours) qui créent un rythme.
- **v3** : politiques d'alliance / interactions territoire (quand le pilier Alliances arrive).

---

*Spec Empire §5.2 — à valider §7 avant implémentation.*
