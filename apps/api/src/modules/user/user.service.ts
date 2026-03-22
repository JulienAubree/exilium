import { ilike, ne, and } from 'drizzle-orm';
import { users } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';

export function createUserService(db: Database) {
  return {
    async searchUsers(currentUserId: string, query: string) {
      const escaped = query.replace(/[%_]/g, '\\$&');
      return db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(and(
          ilike(users.username, `%${escaped}%`),
          ne(users.id, currentUserId),
        ))
        .limit(10);
    },
  };
}
