module.exports = {
  apps: [
    {
      name: 'ogame-api',
      script: 'apps/api/dist/index.js',
      cwd: __dirname,
      node_args: '--env-file=.env',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
    {
      name: 'ogame-worker',
      script: 'apps/api/dist/workers/worker.js',
      cwd: __dirname,
      node_args: '--env-file=.env',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};
