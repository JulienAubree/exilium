module.exports = {
  apps: [
    {
      // API in cluster mode: PM2 + Node cluster share the port, each fork
      // handles its own requests. Rate-limit uses Redis, SSE uses Redis
      // pub/sub, JWT is stateless — all cluster-safe. The in-process
      // gameConfig cache is invalidated across forks via Redis pub/sub on
      // `game-config:invalidate` (see game-config.service.ts).
      name: 'exilium-api',
      script: 'apps/api/dist/index.js',
      cwd: __dirname,
      // Absolute path: in cluster mode the worker is `cluster.fork()`ed from
      // the PM2 daemon, and Node resolves --env-file at bootstrap — before
      // PM2 can chdir to `cwd`. A relative '.env' therefore resolves against
      // the daemon's cwd (often `/`), and the API dies with
      // `node: .env: not found` (exit 9). Fork-mode apps are unaffected
      // because PM2 spawns them with `cwd` already set.
      node_args: `--env-file=${__dirname}/.env`,
      exec_mode: 'cluster',
      instances: 4, // VPS has 4 cores
      autorestart: true,
      // Sans backoff, un échec *instantané* au démarrage (dépendance pas encore
      // prête après un reboot) consomme les 15 redémarrages autorisés en quelques
      // millisecondes, puis PM2 passe le process en "errored" et n'y revient
      // jamais. C'est ce qui a transformé le reboot du 08/07/2026 en panne d'un
      // mois. Avec le backoff exponentiel, PM2 espace ses tentatives et laisse
      // le temps à Postgres/Redis de démarrer.
      exp_backoff_restart_delay: 200,
      max_memory_restart: '1G',
    },
    {
      // Worker stays single-instance: BullMQ queues are already shared and
      // crons use Redis SETNX locks. Running multiple workers would only
      // multiply concurrent job processing, which isn't the bottleneck today.
      name: 'exilium-worker',
      script: 'apps/api/dist/workers/worker.js',
      cwd: __dirname,
      node_args: `--env-file=${__dirname}/.env`,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      exp_backoff_restart_delay: 200,
      max_memory_restart: '1G',
    },
  ],
};
