import type Redis from 'ioredis';

export interface NotificationEvent {
  type: string;
  payload: Record<string, unknown>;
}

export function publishNotification(redis: Redis, userId: string, event: NotificationEvent) {
  return redis.publish(`notifications:${userId}`, JSON.stringify(event));
}
