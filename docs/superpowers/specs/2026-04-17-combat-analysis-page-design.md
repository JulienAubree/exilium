# Combat Analysis Page — Design Spec

## Objectif

Page dediee d'analyse post-combat pour les combats PvP. Permet au joueur de comprendre precisement pourquoi un combat a bascule : quels types d'unites ont ete focuses, quand les pertes sont survenues, quels tirs ont ete decisifs.

## Scope

- **PvP uniquement** (missions `attack`)
- **Acces** : bouton "Analyser le combat" dans le rapport de combat existant (`CombatReportDetail`)
- **Route** : `/reports/:reportId/analysis`

## Non-scope (v1)

- Combats PvE (pirates)
- Purge automatique des donnees detaillees (a evaluer plus tard selon la taille en base)
- Re-simulation cote client (approche rejetee — expose les niveaux de recherche adversaire)

---

## 1. Modele de donnees

### 1.1 Journal de combat detaille

Chaque tir dans un round produit un evenement :

```typescript
interface CombatEvent {
  round: number;
  shooterId: string;        // ex: "intercepteur-12"
  shooterType: string;      // ex: "intercepteur"
  targetId: string;         // ex: "fregate-3"
  targetType: string;       // ex: "fregate"
  damage: number;           // degats bruts de l'arme
  shieldAbsorbed: number;   // absorbe par le bouclier
  armorBlocked: number;     // reduit par l'armure
  hullDamage: number;       // degats reels a la coque
  targetDestroyed: boolean; // true si ce tir a acheve la cible
}
```

### 1.2 Snapshots d'unites

Etat de chaque unite a la fin de chaque round (apres degats, avant regen bouclier) :

```typescript
interface UnitSnapshot {
  unitId: string;
  unitType: string;
  side: 'attacker' | 'defender';
  shield: number;
  hull: number;
  destroyed: boolean;
}
```

### 1.3 Structure du log complet

```typescript
interface DetailedCombatLog {
  events: CombatEvent[];
  snapshots: UnitSnapshot[][];   // snapshots[roundIndex] = unites a la fin du round
  initialUnits: UnitSnapshot[];  // etat au deploiement
}
```

### 1.4 Stockage

Nouvelle colonne JSONB nullable sur la table `mission_reports` :

```sql
ALTER TABLE mission_reports
ADD COLUMN detailed_log JSONB DEFAULT NULL;
```

Pas d'index (lecture par ID uniquement). Le log suit le cycle de vie du rapport — supprime avec lui.

Taille estimee :
- Combat moyen (~200 unites, 4 rounds) : 30-80 Ko
- Gros combat (~500 unites, 4 rounds) : 100-200 Ko

---

## 2. Changements moteur de combat

### 2.1 Interface d'entree

Champ optionnel ajoute a `CombatInput` :

```typescript
interface CombatInput {
  // ... champs existants inchanges ...
  detailedLog?: boolean;   // opt-in, false par defaut
}
```

### 2.2 Logique de capture

Quand `detailedLog` est `true` dans `simulateCombat()` :

1. **Avant le premier round** — snapshot de toutes les unites (etat initial)
2. **Dans `fireShot()`** — pousse un `CombatEvent` dans un accumulateur
3. **A la fin de chaque round** — snapshot de toutes les unites (apres degats, avant regen bouclier)

Le code existant (ciblage, degats, bouclier, armure) ne change pas de comportement. L'accumulateur est un objet optionnel passe en parametre aux fonctions internes.

### 2.3 Interface de sortie

Le `CombatResult` existant est inchange. Le log est retourne dans un champ optionnel :

```typescript
interface CombatResult {
  // ... champs existants inchanges ...
  detailedLog?: DetailedCombatLog;
}
```

### 2.4 Ce qui ne change pas

- Logique de combat (ciblage, degats, bouclier, armure)
- `CombatResult` de base (rounds, pertes, debris)
- Combats PvE (flag non active)
- Simulateur frontend du CombatGuide

---

## 3. API

### 3.1 Backend (attack handler)

L'attack handler passe `detailedLog: true` dans le `CombatInput` et stocke le resultat :

```typescript
const combatInput: CombatInput = {
  // ... existant ...
  detailedLog: true,
};
const result = simulateCombat(combatInput);

// Stockage dans le rapport
await ctx.reportService.create({
  // ... existant ...
  detailedLog: result.detailedLog ?? null,
});
```

### 3.2 Nouvel endpoint

```typescript
trpc.report.detailedLog.useQuery({ reportId: string })
```

- Retourne uniquement le contenu de la colonne `detailed_log`
- Non inclus dans `report.detail` (lazy loading)
- Permission : seul le proprietaire du rapport peut y acceder

### 3.3 Schema DB

Migration : ajout de la colonne `detailed_log` (JSONB nullable) sur `mission_reports`.

---

## 4. Frontend — Page d'analyse

### 4.1 Layout

Layout 3 colonnes : **sidebar attaquant (etroite) | panneau detail (large) | sidebar defenseur (etroite)**.

```
┌─────────────────────────────────────────────────────────────┐
│ ← Rapport    Analyse de combat [2:45:7] — Victoire         │
│                                     1,240 FP vs 980 FP     │
├─────────────────────────────────────────────────────────────┤
│ TIMELINE  [Init] [■ R1] [R2] [R3]                          │
│ Tirs: 124/88 — Bouclier: 3,200 — Pertes: 5/2              │
├──────────┬───────────────────────────────────┬──────────────┤
│ ATTAQUANT│         DETAIL: Cuirasse          │   DEFENSEUR  │
│          │                                   │              │
│ Intercep.│ 8/10 — Round 1                    │ Fregate      │
│ 45/50    │ ┌──────────┬──────────┐           │ 28/30        │
│          │ │Bouclier  │Coque     │           │              │
│ Croiseur │ │4800/8000 │3900/5000 │           │ Laser lourd  │
│ 12/12    │ └──────────┴──────────┘           │ 8/8          │
│          │                                   │              │
│ ■Cuirass.│ Infliges     │ Recus              │ Lance-roq.   │
│ 8/10     │ → Freg 2,400 │ ← Freg 1,200      │ 5/5          │
│          │ → L-R 800    │ ← L-R 600         │              │
│ Flagship │                                   │ Bouclier pl. │
│ 1/1      │ Pertes: #7 (Fregate) #3 (L-R)    │ niv. 3       │
│          │                                   │              │
│          │ Unites individuelles              │              │
│          │ [#1 490HP][#2 320HP]              │              │
│          │ [#5 180HP — deplie: tirs/recus]   │              │
│          │ [#7 Detruit][#3 Detruit]          │              │
└──────────┴───────────────────────────────────┴──────────────┘
```

### 4.2 Zones et interactions

**Header** : lien retour rapport, coordonnees, resultat (Victoire/Defaite/Nul), FP des deux camps.

**Timeline** : barre de rounds cliquable. Le round actif est surbrille. Sous la barre, stats resumees du round selectionne (tirs, bouclier absorbe, armure bloquee, pertes).

**Sidebars flotte** (attaquant gauche, defenseur droite) :
- Liste des types d'unites avec compteur survivants/initial
- Barre HP (bouclier ou coque)
- Cliquable : selectionne le type et remplit le panneau central
- Le type selectionne est surbrille (bordure orange)
- On peut cliquer un type ennemi aussi

**Panneau central** (quand un type est selectionne) :
- En-tete : nom du type, survivants/engages, round, + stats resumees (degats infliges, recus, pertes)
- Barres HP larges : bouclier total + coque totale (agreges sur les unites survivantes)
- Degats infliges (panel vert) : par type cible, avec barre proportionnelle + kills
- Degats recus (panel rouge) : par type source, avec bouclier absorbe
- Pertes du round : chaque unite detruite avec sa cause de mort (type + degats du tir fatal)
- Grille d'unites individuelles (2 colonnes) :
  - Carte par unite : nom, HP, barre de vie coloree (vert/jaune/orange/rouge selon %)
  - Cliquable pour deplier : tirs effectues (cibles, degats, kills) et impacts recus (sources, repartition bouclier/coque)
  - L'unite depliee s'etend sur 2 colonnes
  - Unites detruites : grises, barrees, cliquables pour voir la cause de mort

### 4.3 Responsivite mobile

- Les deux sidebars passent en onglets horizontaux au-dessus du detail ("Attaquant" / "Defenseur")
- Le panneau detail passe en pleine largeur
- La grille d'unites passe en 1 colonne

### 4.4 Donnees par unite individuelle (drill-down)

Quand un joueur deplie une unite dans la grille, il voit pour le round selectionne :

**Tirs effectues** :
- Pour chaque tir : cible (id + type), degats infliges, kill ou non

**Impacts recus** :
- Pour chaque tir recu : source (id + type), repartition bouclier/armure/coque

Ces donnees sont extraites du tableau `events` du `DetailedCombatLog`, filtrees par `round` et `shooterId`/`targetId`.

---

## 5. Arborescence des composants

```
CombatAnalysisPage                    ← page, route /reports/:reportId/analysis
├── CombatAnalysisHeader              ← retour, coordonnees, FP, resultat
├── CombatTimeline                    ← barre rounds cliquable + stats round
├── CombatAnalysisLayout              ← grid 3 colonnes (responsive → tabs)
│   ├── FleetSidebar                  ← sidebar attaquant (gauche)
│   ├── UnitDetailPanel               ← panneau central
│   │   ├── UnitDetailHeader          ← nom, survivants, stats resumees
│   │   ├── UnitHPBars                ← barres bouclier/coque larges
│   │   ├── DamagePanel               ← degats infliges + recus cote a cote
│   │   ├── DeathsList                ← pertes du round avec cause de mort
│   │   └── UnitGrid                  ← grille d'unites individuelles
│   │       └── UnitCard              ← carte depliable (tirs + impacts)
│   └── FleetSidebar                  ← sidebar defenseur (droite)
```

### 5.1 Etat local

```typescript
const [selectedRound, setSelectedRound] = useState(0);
const [selectedUnitType, setSelectedUnitType] = useState<string | null>(null);
const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
```

### 5.2 Chargement des donnees

```typescript
const { data: report } = trpc.report.detail.useQuery({ id: reportId });
const { data: detailedLog, isLoading } = trpc.report.detailedLog.useQuery(
  { reportId },
  { enabled: !!reportId },
);
```

### 5.3 Fichiers a creer

```
apps/web/src/pages/CombatAnalysis.tsx
apps/web/src/components/combat-analysis/
├── CombatAnalysisHeader.tsx
├── CombatTimeline.tsx
├── CombatAnalysisLayout.tsx
├── FleetSidebar.tsx
├── UnitDetailPanel.tsx
├── DamagePanel.tsx
├── DeathsList.tsx
├── UnitGrid.tsx
└── UnitCard.tsx
```

---

## 6. Cycle de vie des donnees

- **Creation** : `AttackHandler.processArrival()` passe `detailedLog: true`, stocke le resultat dans la colonne `detailed_log`
- **Acces** : bouton "Analyser le combat" dans `CombatReportDetail` (visible uniquement pour `missionType === 'attack'`), redirige vers la page d'analyse
- **Suppression** : suit le rapport — supprime avec lui (meme ligne SQL)
- **Purge** : pas de TTL automatique en v1 (a evaluer selon la croissance en base)

---

## 7. Fichiers impactes (existants)

| Fichier | Modification |
|---|---|
| `packages/game-engine/src/formulas/combat.ts` | Ajout `detailedLog` a `CombatInput` et `CombatResult`, accumulateur dans `fireShot`/`simulateCombat` |
| `apps/api/src/modules/fleet/handlers/attack.handler.ts` | Passer `detailedLog: true`, stocker dans rapport |
| `apps/api/src/modules/report/report.service.ts` | Supporter la colonne `detailed_log` |
| `apps/api/src/modules/report/report.router.ts` | Nouvel endpoint `detailedLog` |
| `packages/db/src/schema/mission-reports.ts` | Ajout colonne `detailed_log` |
| `apps/web/src/components/reports/CombatReportDetail.tsx` | Bouton "Analyser le combat" |
| `apps/web/src/router.tsx` | Route `/reports/:reportId/analysis` |
