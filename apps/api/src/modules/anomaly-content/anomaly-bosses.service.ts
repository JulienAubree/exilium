import { bossEntrySchema, type BossEntry, tierForBossDepth, BOSS_DEPTHS } from './anomaly-bosses.types.js';
import { DEFAULT_ANOMALY_BOSSES } from './anomaly-bosses.seed.js';
import type { createAnomalyContentService } from './anomaly-content.service.js';

/**
 * V9 Boss — service singleton qui expose la pool de boss + helpers
 * de tirage (par tier / depth, anti-répétition intra-run).
 *
 * V9.2 — La pool est désormais lue depuis `anomaly_content.bosses` (admin
 * éditable). Fallback automatique sur le seed in-memory si :
 *  - la row content est vide (premier déploiement)
 *  - la row contient bosses=[] (admin a tout supprimé)
 *  - le service content n'est pas fourni (boot fail-soft / tests)
 *
 * `getPool` est async pour qu'on puisse refetch le content à chaque tirage.
 * Cache léger en mémoire (TTL 30s) pour éviter de hit la DB à chaque combat.
 */
export function createAnomalyBossesService(
  anomalyContentService?: ReturnType<typeof createAnomalyContentService>,
) {
  // Parse-once du seed in-memory pour appliquer les defaults zod.
  // Sert de fallback quand anomalyContent.bosses est vide ou indisponible.
  const seedPool: BossEntry[] = DEFAULT_ANOMALY_BOSSES
    .map(b => bossEntrySchema.parse(b));

  // Cache : {pool, fetchedAt}. TTL 30s pour ne pas surcharger la DB sur
  // chaque combat boss (10 par run × N players).
  const CACHE_TTL_MS = 30_000;
  let cache: { pool: BossEntry[]; fetchedAt: number } | null = null;

  async function getPool(): Promise<BossEntry[]> {
    if (!anomalyContentService) return seedPool;
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.pool;
    try {
      const content = await anomalyContentService.getContent();
      const pool = (content.bosses && content.bosses.length > 0)
        ? content.bosses
        : seedPool;
      cache = { pool, fetchedAt: now };
      return pool;
    } catch {
      // DB hiccup — retombe sur le seed pour ne pas casser le combat.
      return seedPool;
    }
  }

  /** Sync helper for callers déjà dans une chaîne async. */
  function getPoolSync(): BossEntry[] {
    return cache?.pool ?? seedPool;
  }

  /** Force le refresh du cache au prochain getPool (appelé après update admin). */
  function invalidateCache(): void {
    cache = null;
  }

  /**
   * True si la depth donnée est une "boss depth" (1, 5, 10, 15, 20).
   */
  function isBossDepth(depth: number): boolean {
    return (BOSS_DEPTHS as readonly number[]).includes(depth);
  }

  /**
   * Tire un boss éligible pour la depth demandée, en excluant ceux déjà
   * vaincus dans la run en cours. Retourne null si la pool est épuisée
   * pour ce tier (cas extrême — ne doit jamais arriver vu qu'il y a 5 boss/run
   * et 15+ par tier). Le caller fallback sur un combat normal.
   */
  async function pickBossForDepth(
    depth: number,
    defeatedIds: string[],
    rng: () => number = Math.random,
  ): Promise<BossEntry | null> {
    const pool = await getPool();
    const tier = tierForBossDepth(depth);
    const seen = new Set(defeatedIds);
    const eligible = pool.filter(b => b.enabled && b.tier === tier && !seen.has(b.id));
    if (eligible.length === 0) {
      // Fallback : si tous les boss du tier ont été vaincus (test E2E,
      // future feature avec 30+ boss/run), reprendre un boss du tier
      // déjà vaincu (autorise répétition plutôt que combat normal).
      const fallback = pool.filter(b => b.enabled && b.tier === tier);
      if (fallback.length === 0) return null;
      return fallback[Math.floor(rng() * fallback.length)];
    }
    return eligible[Math.floor(rng() * eligible.length)];
  }

  return {
    getPool,
    getPoolSync,
    invalidateCache,
    isBossDepth,
    pickBossForDepth,
  };
}

export type AnomalyBossesService = ReturnType<typeof createAnomalyBossesService>;
