#!/usr/bin/env bash
#
# Watchdog d'uptime Exilium — surveille la stack, tente une auto-réparation,
# et alerte par email.
#
# Contexte : le 8 juillet 2026, un reboot a laissé `exilium-api` en `stopped`.
# Le worker continuait ses ticks (ressources, classements) donc tout *semblait*
# vivant, mais aucun joueur ne pouvait se connecter. La panne a duré un mois.
# Ce script existe pour que ça ne se reproduise pas.
#
# Principe de conception : **le canal d'alerte ne dépend pas de ce qu'il surveille**.
# On appelle l'API HTTP de Resend directement — surtout pas le mailer de l'app,
# qui est précisément mort quand il y a quelque chose à signaler.
#
# Installé via systemd : exilium-watchdog.timer (toutes les 2 min).
# Logs : journalctl -u exilium-watchdog.service
#
set -uo pipefail

# ---------------------------------------------------------------- configuration

ALERT_TO="${EXILIUM_ALERT_TO:-julien.4ubree@gmail.com}"
# Surchargeables pour pouvoir tester le chemin de panne sans casser la prod.
PUBLIC_URL="${EXILIUM_WATCHDOG_PUBLIC_URL:-https://exilium-game.com/health}"
LOCAL_URL="${EXILIUM_WATCHDOG_LOCAL_URL:-http://localhost:3000/health}"
# À 1, les alertes sont seulement journalisées (test de la logique sans envoi).
DRY_RUN="${EXILIUM_WATCHDOG_DRY_RUN:-0}"
ENV_FILE="/opt/exilium/.env"
STATE_DIR="${EXILIUM_WATCHDOG_STATE_DIR:-/var/lib/exilium-watchdog}"
STATE_FILE="$STATE_DIR/state"          # UP | DOWN — dernier état notifié
FAIL_FILE="$STATE_DIR/consecutive"     # compteur d'échecs consécutifs
HEAL_FILE="$STATE_DIR/last-heal"       # epoch de la dernière auto-réparation

# Nombre d'échecs consécutifs avant d'alerter (2 × 2 min = ~4 min de tolérance).
# Évite d'alerter sur un hoquet réseau isolé ou un reload PM2 en cours.
FAIL_THRESHOLD=2

# Ne pas retenter une auto-réparation plus d'une fois par quart d'heure : si ça
# crash-loop, on veut une alerte, pas un script qui s'acharne.
HEAL_COOLDOWN=900

# Seuils des vérifications annexes
DISK_MIN_PCT=10        # alerte si moins de 10 % libres sur /
BACKUP_MAX_AGE_H=30    # le backup tourne à 3h du matin → 30h laisse une marge

mkdir -p "$STATE_DIR" 2>/dev/null || true

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

# ---------------------------------------------------------------- notification

send_alert() {
  local subject="$1" body="$2"

  if [ "$DRY_RUN" = "1" ]; then
    log "[DRY-RUN] alerte NON envoyée — sujet : $subject"
    return 0
  fi

  local key
  key=$(grep -m1 '^RESEND_API_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"'"'"' \r')
  if [ -z "$key" ]; then
    log "ALERTE NON ENVOYÉE (RESEND_API_KEY introuvable dans $ENV_FILE) : $subject"
    return 1
  fi

  # jq construit le JSON : le corps contient des retours ligne et des guillemets
  # issus des sorties de commandes, une interpolation naïve casserait le payload.
  local payload
  payload=$(jq -n \
    --arg from "Exilium Watchdog <noreply@exilium-game.com>" \
    --arg to "$ALERT_TO" \
    --arg subject "$subject" \
    --arg text "$body" \
    '{from: $from, to: [$to], subject: $subject, text: $text}')

  local resp
  resp=$(curl -s -m 20 -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $key" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1)

  if echo "$resp" | grep -q '"id"'; then
    log "alerte envoyée à $ALERT_TO : $subject"
  else
    log "ÉCHEC d'envoi de l'alerte : $resp"
  fi
}

# ---------------------------------------------------------------- diagnostic

# Sonde publique = ce que vit réellement un joueur (DNS + TLS + Caddy + API + DB + Redis).
# curl écrit déjà « 000 » via -w quand la connexion échoue ; on ne double donc pas
# avec un `|| echo 000` (ça produisait « 000000 »). On ne couvre que le cas où
# curl ne sort rien du tout.
probe_public() { local c; c=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$PUBLIC_URL" 2>/dev/null); echo "${c:-000}"; }
# Sonde locale = isole l'API. Publique KO + locale OK ⇒ le problème est devant l'API.
probe_local()  { local c; c=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$LOCAL_URL"  2>/dev/null); echo "${c:-000}"; }

pm2_api_status() {
  pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
    procs = [p for p in json.load(sys.stdin) if p.get('name') == 'exilium-api']
except Exception:
    print('inconnu'); sys.exit()
if not procs:
    print('absent')
else:
    print(','.join(sorted({p['pm2_env'].get('status', '?') for p in procs})))
" 2>/dev/null || echo "inconnu"
}

collect_diagnostic() {
  echo "Sonde publique  : HTTP $(probe_public)  ($PUBLIC_URL)"
  echo "Sonde locale    : HTTP $(probe_local)  ($LOCAL_URL)"
  echo "PM2 exilium-api : $(pm2_api_status)"
  echo "PM2 worker      : $(pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
    print(next(p['pm2_env'].get('status','?') for p in json.load(sys.stdin) if p.get('name')=='exilium-worker'))
except Exception:
    print('absent')
" 2>/dev/null)"
  echo "Caddy           : $(systemctl is-active caddy 2>/dev/null)"
  echo "Postgres        : $(systemctl is-active postgresql 2>/dev/null)"
  echo "Redis           : $(redis-cli ping 2>/dev/null || echo injoignable)"
  echo "Disque /        : $(df -h / | awk 'NR==2 {print $4" libres ("$5" utilisé)"}')"
  echo "Charge          : $(uptime | sed 's/.*load average/load average/')"
  echo
  echo "--- 15 dernières lignes du log d'erreur API ---"
  local errlog
  errlog=$(pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
    print(next(p['pm2_env'].get('pm_err_log_path','') for p in json.load(sys.stdin) if p.get('name')=='exilium-api'))
except Exception:
    print('')
" 2>/dev/null)
  if [ -n "$errlog" ] && [ -f "$errlog" ]; then tail -15 "$errlog" 2>/dev/null; else echo "(log introuvable)"; fi
  echo
  echo "--- journal PM2 ---"
  grep -i 'exilium-api' /home/ubuntu/.pm2/pm2.log 2>/dev/null | tail -8 || echo "(rien)"
}

# ---------------------------------------------------------------- auto-réparation

# On ne tente une relance que si PM2 déclare l'API arrêtée/en erreur. Pendant un
# `pm2 reload` normal le statut reste `online` — on ne veut surtout pas se battre
# avec un déploiement en cours.
attempt_heal() {
  local status now last
  status=$(pm2_api_status)
  case "$status" in
    *stopped*|*errored*|absent) ;;
    *) log "pas d'auto-réparation (statut PM2 = $status)"; return 1 ;;
  esac

  now=$(date +%s)
  last=$(cat "$HEAL_FILE" 2>/dev/null || echo 0)
  if [ $((now - last)) -lt "$HEAL_COOLDOWN" ]; then
    log "auto-réparation en cooldown ($(( (HEAL_COOLDOWN - (now - last)) / 60 )) min restantes)"
    return 1
  fi
  echo "$now" > "$HEAL_FILE"

  log "tentative d'auto-réparation : relance de exilium-api (statut=$status)"
  cd /opt/exilium || return 1
  pm2 delete exilium-api >/dev/null 2>&1
  pm2 start ecosystem.config.cjs --only exilium-api >/dev/null 2>&1
  sleep 12
  pm2 save >/dev/null 2>&1

  local code
  code=$(probe_local)
  if [ "$code" = "200" ]; then
    log "auto-réparation réussie (health local = 200)"
    return 0
  fi
  log "auto-réparation échouée (health local = $code)"
  return 1
}

# ---------------------------------------------------------------- vérifs annexes

# Vérifications silencieuses : elles n'alertent qu'en cas de dépassement, et une
# seule fois par jour pour ne pas noyer les alertes de disponibilité.
check_side_concerns() {
  local avail_pct stamp today
  today=$(date -u +%Y-%m-%d)

  avail_pct=$(df --output=pcent / | tail -1 | tr -dc '0-9')
  if [ -n "$avail_pct" ] && [ "$((100 - avail_pct))" -lt "$DISK_MIN_PCT" ]; then
    stamp="$STATE_DIR/warned-disk-$today"
    if [ ! -f "$stamp" ]; then
      touch "$stamp"
      send_alert "[Exilium] Disque presque plein" \
"Il reste moins de ${DISK_MIN_PCT}% d'espace libre sur /.

$(df -h /)

Postgres et les backups s'arrêteront net si le disque se remplit."
    fi
  fi

  # Un backup qui ne tourne plus est invisible jusqu'au jour où on en a besoin.
  local newest age_h
  newest=$(ls -t /opt/backups/postgres/exilium-*.dump 2>/dev/null | head -1)
  if [ -n "$newest" ]; then
    age_h=$(( ( $(date +%s) - $(stat -c %Y "$newest") ) / 3600 ))
    if [ "$age_h" -gt "$BACKUP_MAX_AGE_H" ]; then
      stamp="$STATE_DIR/warned-backup-$today"
      if [ ! -f "$stamp" ]; then
        touch "$stamp"
        send_alert "[Exilium] Backup Postgres périmé" \
"Le backup le plus récent date de ${age_h}h (seuil : ${BACKUP_MAX_AGE_H}h).

Fichier : $newest
Cron attendu : 0 3 * * * /opt/exilium/scripts/backup-postgres.sh

Dernières lignes de /opt/backups/postgres/backup.log :
$(tail -10 /opt/backups/postgres/backup.log 2>/dev/null)"
      fi
    fi
  fi

  find "$STATE_DIR" -name 'warned-*' -mtime +7 -delete 2>/dev/null || true
}

# ---------------------------------------------------------------- boucle principale

main() {
  local code prev fails
  code=$(probe_public)
  prev=$(cat "$STATE_FILE" 2>/dev/null || echo "UP")
  fails=$(cat "$FAIL_FILE" 2>/dev/null || echo 0)

  if [ "$code" = "200" ]; then
    echo 0 > "$FAIL_FILE"
    if [ "$prev" = "DOWN" ]; then
      log "RÉTABLI (HTTP 200)"
      echo "UP" > "$STATE_FILE"
      send_alert "[Exilium] ✅ Rétabli" \
"Le jeu répond de nouveau normalement.

$(collect_diagnostic)"
    else
      log "ok (HTTP 200)"
    fi
    check_side_concerns
    return 0
  fi

  fails=$((fails + 1))
  echo "$fails" > "$FAIL_FILE"
  log "échec $fails/$FAIL_THRESHOLD (HTTP $code)"
  [ "$fails" -lt "$FAIL_THRESHOLD" ] && return 0

  # Seuil atteint : on tente de réparer avant d'alerter, pour que le mail dise
  # « c'était tombé, c'est déjà reparti » plutôt que de réveiller pour rien.
  local healed="non tentée"
  if attempt_heal; then
    healed="réussie — le service est reparti tout seul"
    echo 0 > "$FAIL_FILE"
    echo "UP" > "$STATE_FILE"
    send_alert "[Exilium] ⚠️ Panne détectée et réparée automatiquement" \
"Le watchdog a détecté que le jeu ne répondait plus, a relancé l'API, et le service est rétabli.

Aucune action requise, mais ça mérite un coup d'œil : une panne qui se répète cache un vrai problème.

$(collect_diagnostic)"
    return 0
  fi
  healed="échouée ou non applicable"

  if [ "$prev" = "DOWN" ]; then
    log "toujours DOWN, alerte déjà envoyée — silence"
    return 0
  fi

  echo "DOWN" > "$STATE_FILE"
  log "ALERTE : le jeu est injoignable"
  send_alert "[Exilium] 🔴 LE JEU EST DOWN" \
"Le jeu ne répond plus depuis au moins $((FAIL_THRESHOLD * 2)) minutes.

Sonde publique : HTTP $code sur $PUBLIC_URL
Auto-réparation : $healed

$(collect_diagnostic)

--- Pistes ---
• API arrêtée         : cd /opt/exilium && pm2 start ecosystem.config.cjs --only exilium-api && pm2 save
• PM2 entièrement mort : sudo systemctl start pm2-ubuntu
• Caddy KO            : sudo systemctl restart caddy
• Runbook complet     : /opt/exilium/docs/reference/runbook.md"
}

# `--test-alert` : vérifie de bout en bout que le canal d'alerte fonctionne.
# À relancer après tout changement de clé Resend ou de domaine d'envoi — une
# alerte qu'on n'a jamais vue arriver n'est pas une alerte.
if [ "${1:-}" = "--test-alert" ]; then
  log "envoi d'une alerte de TEST vers $ALERT_TO"
  send_alert "[Exilium] 🧪 Test du watchdog — ceci n'est PAS une panne" \
"Ceci est un message de test envoyé manuellement pour vérifier que le canal d'alerte fonctionne.

Si tu lis ceci, le watchdog saura te joindre le jour où le jeu tombera.

État actuel de la stack :

$(collect_diagnostic)"
  exit 0
fi

main "$@"
