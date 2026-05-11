import { desc, eq } from 'drizzle-orm';
import { explorationContent } from '@exilium/db';
import type { Database } from '@exilium/db';
import {
  DEFAULT_EXPLORATION_CONTENT,
  explorationContentSchema,
  type ExplorationContent,
} from './exploration-content.types.js';

/**
 * Service de gestion du contenu administrable des missions d'exploration
 * en espace profond. Pattern singleton calque sur `anomaly-content.service`.
 *
 * Le contenu est stocké en une seule ligne JSONB, validée par Zod à
 * chaque lecture (fallback DEFAULT si invalide) et à chaque écriture
 * (rejet si non conforme).
 */
export function createExplorationContentService(db: Database) {
  async function readContent(): Promise<ExplorationContent> {
    const [row] = await db
      .select()
      .from(explorationContent)
      .orderBy(desc(explorationContent.updatedAt))
      .limit(1);

    if (!row) return DEFAULT_EXPLORATION_CONTENT;

    const parsed = explorationContentSchema.safeParse(row.content);
    if (!parsed.success) {
      // Blob invalide → fallback defaults. La prochaine sauvegarde admin
      // ré-aligne. Log pour debug.
      console.warn('[exploration-content] invalid content, fallback defaults', parsed.error.issues.slice(0, 3));
      return DEFAULT_EXPLORATION_CONTENT;
    }

    return parsed.data;
  }

  async function writeContent(content: ExplorationContent): Promise<ExplorationContent> {
    const parsed = explorationContentSchema.parse(content);

    const [existing] = await db
      .select({ id: explorationContent.id })
      .from(explorationContent)
      .limit(1);

    if (!existing) {
      await db
        .insert(explorationContent)
        .values({ content: parsed, updatedAt: new Date() });
    } else {
      await db
        .update(explorationContent)
        .set({ content: parsed, updatedAt: new Date() })
        .where(eq(explorationContent.id, existing.id));
    }

    return parsed;
  }

  return {
    /** Lecture (fallback defaults si vide/invalide). */
    async getContent(): Promise<ExplorationContent> {
      return readContent();
    },
    /** Écriture admin (parse strict, throw si invalide). */
    async updateContent(content: ExplorationContent): Promise<ExplorationContent> {
      return writeContent(content);
    },
    /** Restaure le seed initial. */
    async resetContent(): Promise<ExplorationContent> {
      return writeContent(DEFAULT_EXPLORATION_CONTENT);
    },
    /** Active/désactive la génération de nouvelles missions globalement. */
    async setKillSwitch(killSwitch: boolean): Promise<ExplorationContent> {
      const current = await readContent();
      return writeContent({ ...current, killSwitch });
    },
  };
}

export type ExplorationContentService = ReturnType<typeof createExplorationContentService>;
