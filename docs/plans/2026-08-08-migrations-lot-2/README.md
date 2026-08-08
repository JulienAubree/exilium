# Migrations du lot 2 — nettoyage du code mort (brouillons)

> Écrites le 2026-08-08, **non appliquées**. Elles sont volontairement rangées ici
> et **pas** dans `packages/db/drizzle/` : `apply-migrations.sh` exécute tout
> fichier absent de `_migrations`, donc les laisser dans le dossier de migrations
> les aurait fait partir avec le premier déploiement venu.

## Comment les activer

Quand tu donnes ton feu vert, déplacer le fichier voulu dans
`packages/db/drizzle/`, puis déployer normalement. Vérifier avant que le numéro
ne collisionne pas avec une migration créée entre-temps.

```bash
mv docs/plans/2026-08-08-migrations-lot-2/0106_*.sql packages/db/drizzle/
```

## Contenu

| Fichier | Ce qu'elle fait | Destructif | Couplage obligatoire |
|---|---|---|---|
| `0106_drop_dead_slag_rate_keys.sql` | 8 clés `slag_rate` positionnelles | non | aucun — peut partir seule |
| `0107_drop_dead_expedition_flagship_xp_keys.sql` | 25 clés `expedition_*` + 4 clés d'XP de vaisseau amiral | non | aucun (le module moteur `flagship-xp` est déjà supprimé) |
| `0108_drop_dead_colonization_v1_keys.sql` | 17 clés de la colonisation v1 | non | aucun — indépendante |
| `0109_drop_push_subscriptions_preferences.sql` | `DROP COLUMN push_subscriptions.preferences` | non (0 donnée utile) | **oui, strict** — voir ci-dessous |

Les trois premières ne suppriment que des lignes de `universe_config` que plus
aucun code ne lit. Elles peuvent partir ensemble ou séparément, dans n'importe
quel ordre.

`0109` est la seule qui peut casser la production si l'ordre n'est pas respecté :
elle doit partir **dans le même déploiement** que le retrait du champ dans
`packages/db/src/schema/push-subscriptions.ts`, API et workers rechargés en même
temps que le DDL. Le fichier explique en détail pourquoi l'ordre inverse fait
perdre définitivement des progressions de joueur.

## Les deux pièges qui ont fait échouer les tentatives précédentes

**1. Le seed ressuscite ce que la migration supprime.** `deploy.sh` applique les
migrations *puis* rejoue `pnpm --filter @exilium/db db:seed`, qui fait des
**upserts**. Toute clé encore présente dans `seed-game-config.ts` réapparaît
quelques secondes après son `DELETE`. Les clés visées ici sont toutes absentes du
seed — c'est vérifié, et c'est ce qui rend ces `DELETE` durables. Si tu ajoutes
une clé à supprimer, vérifie d'abord `grep <clé> packages/db/src/seed-game-config.ts`.

**2. Jamais de `LIKE`, toujours l'énumération.** Chaque famille de clés a des
voisines vivantes qui partagent le préfixe :

- `slag_rate%` → la clé plate `slag_rate` pilote le taux de scories du minage
- `flagship%` → `flagship_repair_duration_seconds` et
  `flagship_instant_repair_exilium_cost` font marcher la réparation du vaisseau
  amiral des 25 joueurs
- `colonization_%` → 33 des 50 clés sont vivantes (consommation, seuils
  d'avant-poste, difficulté, raids, bonus de garnison…)

Un `DELETE ... LIKE` sur n'importe laquelle de ces familles casse la production.

## Après application

Contrôle de bonne suppression **et** de non-régression, sur prod *et* staging :

```sql
-- doit renvoyer 0 ligne
SELECT key FROM universe_config WHERE key LIKE 'expedition_%' OR key LIKE 'slag_rate.pos%';
-- doit renvoyer 3 lignes intactes
SELECT key FROM universe_config
WHERE key IN ('slag_rate','flagship_repair_duration_seconds','flagship_instant_repair_exilium_cost');
```

Complément cosmétique à faire avec `0106` : retirer `'slag_rate.pos8'` et
`'slag_rate.pos16'` de la liste de sections dans `apps/admin/src/pages/Universe.tsx`.
Sans le `DELETE`, cette édition seule ne masque rien (les clés glissent de « PvE »
vers « Divers » via le repli `'other'`).
