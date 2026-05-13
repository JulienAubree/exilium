// Staging ecosystem — used by scripts/deploy-staging.sh.
// Smaller footprint than prod (fork x1, 512MB) since staging serves only
// internal QA traffic. Process names suffixed -staging so pm2 keeps them
// separate from the prod processes running on the same host.
module.exports = {
  apps: [
    {
      name: 'exilium-api-staging',
      script: 'apps/api/dist/index.js',
      cwd: __dirname,
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
    {
      name: 'exilium-worker-staging',
      script: 'apps/api/dist/workers/worker.js',
      cwd: __dirname,
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};
