import { Queue } from 'bullmq';
import { env } from '../config/env.js';

const connection = { url: env.REDIS_URL };

export const buildCompletionQueue = new Queue('build-completion', { connection });
export const fleetQueue = new Queue('fleet', { connection });
