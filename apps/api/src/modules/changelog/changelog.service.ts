import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { changelogs, changelogComments, users } from '@exilium/db';
import type { Database } from '@exilium/db';
import { execSync } from 'child_process';

export function createChangelogService(db: Database) {
  return {
    async list(cursor?: string) {
      const limit = 20;
      const conditions = [eq(changelogs.published, true)];

      if (cursor) {
        conditions.push(
          sql`${changelogs.date} < (SELECT date FROM changelogs WHERE id = ${cursor})`,
        );
      }

      const rows = await db
        .select({
          id: changelogs.id,
          date: changelogs.date,
          title: changelogs.title,
          content: changelogs.content,
          commentCount: changelogs.commentCount,
          createdAt: changelogs.createdAt,
        })
        .from(changelogs)
        .where(and(...conditions))
        .orderBy(desc(changelogs.date))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1].id : undefined,
      };
    },

    async detail(id: string) {
      const [changelog] = await db
        .select({
          id: changelogs.id,
          date: changelogs.date,
          title: changelogs.title,
          content: changelogs.content,
          commentCount: changelogs.commentCount,
          createdAt: changelogs.createdAt,
          updatedAt: changelogs.updatedAt,
        })
        .from(changelogs)
        .where(and(eq(changelogs.id, id), eq(changelogs.published, true)))
        .limit(1);

      if (!changelog) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Changelog introuvable' });
      }

      const comments = await db
        .select({
          id: changelogComments.id,
          userId: changelogComments.userId,
          username: users.username,
          content: changelogComments.content,
          isAdmin: changelogComments.isAdmin,
          createdAt: changelogComments.createdAt,
        })
        .from(changelogComments)
        .leftJoin(users, eq(users.id, changelogComments.userId))
        .where(eq(changelogComments.changelogId, id))
        .orderBy(changelogComments.createdAt);

      return { ...changelog, comments };
    },

    async comment(userId: string, changelogId: string, content: string) {
      const [changelog] = await db
        .select({ id: changelogs.id })
        .from(changelogs)
        .where(eq(changelogs.id, changelogId))
        .limit(1);

      if (!changelog) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Changelog introuvable' });
      }

      const [user] = await db
        .select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const [comment] = await db
        .insert(changelogComments)
        .values({ changelogId, userId, content, isAdmin: user?.isAdmin ?? false })
        .returning();

      await db.update(changelogs).set({
        commentCount: sql`${changelogs.commentCount} + 1`,
        updatedAt: new Date(),
      }).where(eq(changelogs.id, changelogId));

      return comment;
    },

    async deleteComment(userId: string, commentId: string) {
      const [comment] = await db
        .select({
          id: changelogComments.id,
          userId: changelogComments.userId,
          changelogId: changelogComments.changelogId,
        })
        .from(changelogComments)
        .where(eq(changelogComments.id, commentId))
        .limit(1);

      if (!comment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Commentaire introuvable' });
      }

      if (comment.userId !== userId) {
        const [user] = await db
          .select({ isAdmin: users.isAdmin })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user?.isAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Non autorise' });
        }
      }

      await db.delete(changelogComments).where(eq(changelogComments.id, commentId));
      await db.update(changelogs).set({
        commentCount: sql`GREATEST(${changelogs.commentCount} - 1, 0)`,
        updatedAt: new Date(),
      }).where(eq(changelogs.id, comment.changelogId));

      return { success: true };
    },

    async adminList() {
      return db
        .select({
          id: changelogs.id,
          date: changelogs.date,
          title: changelogs.title,
          content: changelogs.content,
          published: changelogs.published,
          commentCount: changelogs.commentCount,
          createdAt: changelogs.createdAt,
          updatedAt: changelogs.updatedAt,
        })
        .from(changelogs)
        .orderBy(desc(changelogs.date));
    },

    async adminUpdate(id: string, input: { title?: string; content?: string; published?: boolean }) {
      const [changelog] = await db
        .select({ id: changelogs.id })
        .from(changelogs)
        .where(eq(changelogs.id, id))
        .limit(1);

      if (!changelog) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Changelog introuvable' });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) updates.title = input.title;
      if (input.content !== undefined) updates.content = input.content;
      if (input.published !== undefined) updates.published = input.published;

      const [updated] = await db
        .update(changelogs)
        .set(updates)
        .where(eq(changelogs.id, id))
        .returning();

      return updated;
    },

    async adminDelete(id: string) {
      await db.delete(changelogs).where(eq(changelogs.id, id));
      return { success: true };
    },

    async adminGenerate() {
      let gitLog: string;
      try {
        gitLog = execSync('git log --oneline --since="24 hours ago" --no-merges', {
          encoding: 'utf-8',
          timeout: 10000,
        }).trim();
      } catch {
        gitLog = '';
      }

      const categories: Record<string, string[]> = {
        feat: [],
        fix: [],
        refactor: [],
        other: [],
      };

      const categoryLabels: Record<string, string> = {
        feat: 'Nouvelles fonctionnalites',
        fix: 'Corrections',
        refactor: 'Ameliorations techniques',
        other: 'Autres',
      };

      if (gitLog) {
        for (const line of gitLog.split('\n')) {
          const match = line.match(/^[a-f0-9]+ (.+)$/);
          if (!match) continue;
          const message = match[1];

          const prefixMatch = message.match(/^(\w+)(?:\(.+?\))?:\s*(.+)$/);
          if (prefixMatch) {
            const prefix = prefixMatch[1].toLowerCase();
            const description = prefixMatch[2];
            if (categories[prefix] !== undefined) {
              categories[prefix].push(description);
            } else {
              categories.other.push(description);
            }
          } else {
            categories.other.push(message);
          }
        }
      }

      const sections: string[] = [];
      for (const key of ['feat', 'fix', 'refactor', 'other']) {
        if (categories[key].length > 0) {
          sections.push(`### ${categoryLabels[key]}\n${categories[key].map(d => `- ${d}`).join('\n')}`);
        }
      }

      const content = sections.length > 0
        ? sections.join('\n\n')
        : 'Aucun commit trouve dans les dernieres 24 heures.';

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const titleDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const title = `Nouveautes du ${titleDate}`;

      const [existing] = await db
        .select({ id: changelogs.id })
        .from(changelogs)
        .where(eq(changelogs.date, dateStr))
        .limit(1);

      let result;
      if (existing) {
        [result] = await db
          .update(changelogs)
          .set({ title, content, updatedAt: new Date() })
          .where(eq(changelogs.id, existing.id))
          .returning();
      } else {
        [result] = await db
          .insert(changelogs)
          .values({ date: dateStr, title, content, published: false })
          .returning();
      }

      return result;
    },
  };
}
