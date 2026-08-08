# Monitoring de disponibilité

> Mis en place le 2026-08-08, après une panne de production d'un mois.

## Ce qui s'est passé (et pourquoi ce doc existe)

Le 8 juillet 2026 à 22h18, le VPS a redémarré. PM2 est reparti avec `cwd = /`, donc
`--env-file=.env` (chemin relatif) pointait sur `/.env` qui n'existe pas. `exilium-api`
est mort sur `node: .env: not found`, a brûlé ses 15 redémarrages autorisés **en quelques
millisecondes** (l'échec était instantané), puis PM2 l'a passé en `stopped` définitivement.

Le worker, lui, tournait toujours : il est en mode `fork`, où PM2 applique correctement le
`cwd`. Les logs continuaient d'afficher les ticks de ressources et les recalculs de
classement. **Tout avait l'air vivant, et aucun joueur ne pouvait se connecter.**

Personne ne l'a su pendant un mois. Il n'y avait aucune alerte — et le formulaire de
feedback in-game passe par la même API, donc les joueurs n'avaient même pas de canal pour
signaler la panne. La table `feedbacks` est restée vide.

**Trois leçons, qui structurent tout ce document :**
1. Le worker vivant ne prouve rien. Il faut sonder ce que vit *un joueur*.
2. Le canal d'alerte ne doit jamais dépendre de ce qu'il surveille.
3. Une alerte qu'on n'a jamais vue arriver n'est pas une alerte. On la teste.

---

## En place aujourd'hui

### 1. La sonde `/health`

`GET https://exilium-game.com/health` → `200` si Postgres **et** Redis répondent, `503` sinon.
Exemptée du rate-limit (`apps/api/src/index.ts`). Le corps détaille chaque dépendance :

```json
{"status":"ok","timestamp":"…","checks":{"db":{"ok":true,"latencyMs":41},"redis":{"ok":true,"latencyMs":2}}}
```

### 2. Le watchdog local

`scripts/health-watchdog.sh`, déclenché par `exilium-watchdog.timer` **toutes les 2 minutes**.

Ce qu'il fait à chaque passage :
- sonde l'URL **publique** (donc DNS + TLS + Caddy + API + DB + Redis, la chaîne complète)
- en cas d'échec, sonde aussi en local pour distinguer « API morte » de « problème devant l'API »
- exige **2 échecs consécutifs** avant d'alerter (~4 min de tolérance) — évite d'alerter sur
  un hoquet réseau ou pendant un `pm2 reload`
- tente une **auto-réparation** si PM2 déclare l'API `stopped`/`errored` (jamais pendant un
  reload : le statut y reste `online`), au maximum une fois par quart d'heure
- envoie un mail **une seule fois** au passage en panne, puis un mail de rétablissement
- surveille aussi, une alerte par jour maximum : l'espace disque (< 10 % libre) et la
  fraîcheur du backup Postgres (> 30 h)

L'alerte part par **appel HTTP direct à l'API Resend**, jamais par le mailer de l'app —
c'est tout l'intérêt : l'application est précisément morte quand il y a quelque chose à dire.

```bash
journalctl -u exilium-watchdog.service --since today
```

### 3. Durcissement PM2

- unit systemd **`pm2-ubuntu.service`** (`enabled`) : PM2 ressuscite au boot via `pm2 resurrect`.
  Elle n'existait pas — c'est pour ça qu'un simple reboot a suffi à tout arrêter.
- **`exp_backoff_restart_delay: 200`** sur l'API et le worker : PM2 espace ses tentatives au
  lieu de griller son budget de redémarrages en quelques millisecondes.
- `--env-file` en **chemin absolu** dans `ecosystem.config.cjs` : la cause racine.

> ⚠️ **`dump.pm2` est la source de vérité au reboot.** Fais `pm2 save` après **tout**
> changement de process, sinon la résurrection restaure un état périmé. Un `pm2 save` du
> 22 juillet avait figé « exilium-api = stopped » dans le dump.

### 4. Tester le canal d'alerte

À relancer après tout changement de clé Resend, de domaine d'envoi ou d'adresse :

```bash
/opt/exilium/scripts/health-watchdog.sh --test-alert
```

Envoie un mail explicitement étiqueté comme test, avec un diagnostic complet de la stack.
Si tu ne le reçois pas (**pense à regarder les spams**), le monitoring est aveugle.

Pour éprouver la logique de panne sans rien casser ni envoyer de mail :

```bash
EXILIUM_WATCHDOG_STATE_DIR=/tmp/wd-test \
EXILIUM_WATCHDOG_DRY_RUN=1 \
EXILIUM_WATCHDOG_PUBLIC_URL=http://localhost:9999/health \
  /opt/exilium/scripts/health-watchdog.sh
```

---

## Ce qui manque encore : le monitoring externe

**Le watchdog tourne sur le VPS qu'il surveille.** Il couvre le scénario réellement vécu
(API morte, machine debout), mais il est aveugle si la machine tombe, si le réseau OVH lâche,
ou si le disque est plein au point d'empêcher systemd de démarrer un service.

Il faut donc **un œil hors du VPS**. Ça demande un compte, donc une action de ta part — 5 min :

1. Compte gratuit sur https://uptimerobot.com/signUp
2. **+ New Monitor** → Type `HTTPS`, Name `Exilium prod`, URL `https://exilium-game.com/health`,
   intervalle `5 minutes`, timeout `30s`
3. Coche ton email en Alert Contact → **Create Monitor**

Monitors additionnels utiles :

| URL | Pourquoi |
|---|---|
| `https://exilium-game.com/health` | La stack applicative complète |
| `https://www.exilium-game.com/` | Vérifie que le SPA statique est bien servi |
| `https://admin.exilium-game.com/` | Doit renvoyer `401`. Configure « alert when status is NOT 401 » → détecte une régression de config Caddy qui exposerait l'admin |

### Pour aller plus loin

- **Healthchecks.io** pour surveiller que le backup cron tourne : ajouter
  `curl https://hc-ping.com/<uuid>` à la fin de `scripts/backup-postgres.sh`. Le watchdog
  vérifie déjà la fraîcheur des dumps, mais Healthchecks alerte même si le VPS est mort.
- **Status page publique** (`status.exilium-game.com`) via UptimeRobot — de la transparence
  pour les joueurs, et ça évite les « le jeu est cassé ? » en boucle.

---

## Runbook express

| Symptôme | Commande |
|---|---|
| API arrêtée | `cd /opt/exilium && pm2 start ecosystem.config.cjs --only exilium-api && pm2 save` |
| PM2 entièrement mort | `sudo systemctl start pm2-ubuntu` |
| Caddy KO | `sudo systemctl restart caddy` |
| Voir les passages du watchdog | `journalctl -u exilium-watchdog.service --since today` |
| Suspendre les alertes (maintenance) | `sudo systemctl stop exilium-watchdog.timer` (⚠️ ne pas oublier de le relancer) |

Runbook complet : [`runbook.md`](runbook.md).
