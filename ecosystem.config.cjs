module.exports = {
  apps: [
    {
      name: 'exilium-api',
      script: 'apps/api/dist/index.js',
      cwd: __dirname,
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
    },
    {
      name: 'exilium-worker',
      script: 'apps/api/dist/workers/worker.js',
      cwd: __dirname,
      node_args: '--env-file=.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
    },
  ],
};
