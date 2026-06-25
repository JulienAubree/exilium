import { afterAll, expect, it } from 'vitest';
import { users } from '@exilium/db';
import { testDb, closeTestDb } from './test-db.js';

afterAll(async () => {
  await closeTestDb();
});

// Test témoin du filet de test : prouve que la connexion à `exilium_test`
// fonctionne ET que le schéma y est poussé (la table `users` est interrogeable).
// Si ce test échoue, lancer `bash scripts/setup-test-db.sh`.
it('connecte la base de test et le schéma est présent', async () => {
  const rows = await testDb.select().from(users).limit(1);
  expect(Array.isArray(rows)).toBe(true);
});
