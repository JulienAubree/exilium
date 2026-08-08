# Units systemd

Copies versionnées des units installées sur le VPS de prod. Le fichier de référence
reste celui de `/etc/systemd/system/` — ces copies servent à reconstruire la machine
et à voir les changements passer en revue de code.

## Installation

```bash
sudo cp scripts/systemd/exilium-watchdog.service scripts/systemd/exilium-watchdog.timer \
  /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now exilium-watchdog.timer
```

Le watchdog stocke son état dans `/var/lib/exilium-watchdog` :

```bash
sudo mkdir -p /var/lib/exilium-watchdog && sudo chown ubuntu:ubuntu /var/lib/exilium-watchdog
```

Puis vérifier que le canal d'alerte fonctionne vraiment :

```bash
/opt/exilium/scripts/health-watchdog.sh --test-alert
```

## Unit non versionnée ici

`pm2-ubuntu.service` est **générée** par PM2, ne pas la recopier à la main :

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save
```

Voir [`docs/reference/uptime-monitoring.md`](../../docs/reference/uptime-monitoring.md).
