import type { FastifyInstance } from 'fastify';
import { jwtVerify } from 'jose';
import Redis from 'ioredis';

export function registerSSE(app: FastifyInstance, redisUrl: string, jwtSecret: Uint8Array) {
  app.get('/sse', async (req, reply) => {
    const token = (req.query as { token?: string }).token;
    if (!token) return reply.status(401).send({ error: 'Missing token' });

    let userId: string;
    try {
      const { payload } = await jwtVerify(token, jwtSecret);
      userId = payload.userId as string;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    reply.hijack();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    });

    const subscriber = new Redis(redisUrl);
    const channel = `notifications:${userId}`;
    await subscriber.subscribe(channel);

    subscriber.on('message', (_ch: string, message: string) => {
      reply.raw.write(`data: ${message}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(':ping\n\n');
    }, 30_000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe(channel);
      subscriber.quit();
    });
  });
}
