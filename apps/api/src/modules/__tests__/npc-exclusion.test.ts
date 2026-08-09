import { afterAll, beforeAll, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { users, planets, rankings } from '@exilium/db';
import { testDb, closeTestDb } from '../../test/test-db.js';
import { createGameConfigService } from '../admin/game-config.service.js';
import { createUserService } from '../user/user.service.js';
import { createPlayerAdminService } from '../admin/player-admin.service.js';
import { rankingUpdate } from '../../cron/ranking-update.js';

/**
 * Les capitaines des Premiers sont des lignes `users`.
 *
 * C'était le choix le moins cher — leurs systèmes deviennent des empires
 * ordinaires, et tout le code de flotte, de combat et d'espionnage fonctionne
 * sans chemin parallèle. Mais il a un prix : sans le drapeau `is_npc`, un
 * pirate apparaîtrait dans le classement, dans la recherche de joueurs et dans
 * le back-office, mêlé aux amis de Julien.
 *
 * Ce test est le filet. Il crée un capitaine et un vrai joueur, tous deux
 * pourvus de planètes, et exige que seul le second soit visible partout où l'on
 * énumère des JOUEURS.
 *
 * Prérequis : `bash scripts/setup-test-db.sh` + seed de la base de test.
 */

const JOUEUR = '00000000-0000-4000-8000-00000000bb01';
const CAPITAINE = '00000000-0000-4000-8000-00000000bb02';
const TOUS = [JOUEUR, CAPITAINE];

let userService: ReturnType<typeof createUserService>;
let playerAdminService: ReturnType<typeof createPlayerAdminService>;
let gameConfigService: ReturnType<typeof createGameConfigService>;

beforeAll(async () => {
  gameConfigService = createGameConfigService(testDb);
  userService = createUserService(testDb, '/tmp');
  playerAdminService = createPlayerAdminService(testDb);

  await testDb.delete(planets).where(inArray(planets.userId, TOUS));
  await testDb.delete(users).where(inArray(users.id, TOUS));

  await testDb.insert(users).values([
    { id: JOUEUR, email: 'npc-joueur@test.local', username: 'varek_le_joueur', passwordHash: 'x', isNpc: false },
    // Nom volontairement proche : la recherche par pseudo doit exclure sur le
    // drapeau, pas sur une heuristique de nom.
    { id: CAPITAINE, email: 'npc-capitaine@test.local', username: 'varek_le_premier', passwordHash: 'x', isNpc: true },
  ]);

  // Les deux possèdent une planète : le capitaine a de quoi marquer des points.
  await testDb.insert(planets).values([
    { id: '00000000-0000-4000-8000-00000000bb11', userId: JOUEUR, galaxy: 7, system: 300, position: 5, diameter: 12000, minTemp: -10, maxTemp: 40 },
    { id: '00000000-0000-4000-8000-00000000bb12', userId: CAPITAINE, galaxy: 7, system: 300, position: 6, diameter: 12000, minTemp: -10, maxTemp: 40 },
  ]);
});

afterAll(async () => {
  await testDb.delete(planets).where(inArray(planets.userId, TOUS));
  await testDb.delete(users).where(inArray(users.id, TOUS));
  await closeTestDb();
});

it('la recherche de joueurs ne propose pas un capitaine des Premiers', async () => {
  const resultats = await userService.searchUsers(JOUEUR, 'varek_le');
  const pseudos = resultats.map((r) => r.username);
  // Le joueur courant s'exclut lui-même : la recherche ne doit donc rien
  // rendre du tout, alors qu'elle rendrait le capitaine sans le filtre.
  expect(pseudos).not.toContain('varek_le_premier');
});

it('le back-office ne compte pas les capitaines parmi les joueurs', async () => {
  const { players } = await playerAdminService.listPlayers(0, 100, 'varek_le');
  const pseudos = players.map((p) => p.username);
  expect(pseudos).toContain('varek_le_joueur');
  expect(pseudos).not.toContain('varek_le_premier');
});

it('le classement ne note que les joueurs', async () => {
  await rankingUpdate(testDb, gameConfigService);

  const [ligneJoueur] = await testDb.select().from(rankings).where(eq(rankings.userId, JOUEUR));
  const [ligneCapitaine] = await testDb.select().from(rankings).where(eq(rankings.userId, CAPITAINE));

  expect(ligneJoueur, 'le vrai joueur doit etre classe').toBeDefined();
  expect(ligneCapitaine, 'le capitaine ne doit PAS etre classe').toBeUndefined();
});
