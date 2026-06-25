import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, type Database } from '@exilium/db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Connexion à la base de TEST (`exilium_test`), strictement séparée de la prod
 * (`exilium`). On NE passe PAS par apps/api `env.ts` (qui exige JWT_SECRET & co
 * au parse) — un helper de test n'a besoin que d'une URL.
 *
 * Résolution de l'URL :
 * - CI : `TEST_DATABASE_URL` est fourni (service postgres du workflow).
 * - Local : dérivé du `.env` du repo (mêmes creds que prod, DB `exilium_test`).
 *
 * Prérequis : la DB de test doit exister + son schéma poussé
 * (`bash scripts/setup-test-db.sh`).
 */
function resolveTestUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envPath = path.resolve(__dirname, '../../../../.env');
  try {
    const line = readFileSync(envPath, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('DATABASE_URL='));
    if (!line) throw new Error('DATABASE_URL absent de .env');
    const url = line.slice('DATABASE_URL='.length).trim();
    // Swappe uniquement le nom de DB en fin d'URL : .../exilium -> .../exilium_test
    return url.replace(/\/exilium(\?|$)/, '/exilium_test$1');
  } catch (e) {
    throw new Error(
      `Impossible de résoudre l'URL de la base de test. Définis TEST_DATABASE_URL, ` +
        `ou assure-toi que ${envPath} contient DATABASE_URL. (${(e as Error).message})`,
    );
  }
}

export const TEST_DATABASE_URL = resolveTestUrl();
export const testDb: Database = createDb(TEST_DATABASE_URL);

/** Ferme la connexion postgres-js sous-jacente (à appeler en `afterAll`). */
export async function closeTestDb(): Promise<void> {
  await testDb.$client.end();
}
