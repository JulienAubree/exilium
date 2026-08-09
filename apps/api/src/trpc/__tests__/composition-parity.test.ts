import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Parité des deux racines de composition.
 *
 * L'API (`trpc/app-router.ts`) et le worker (`workers/worker.ts`) instancient
 * chacun leur graphe de services, à la main, avec des arguments **positionnels**.
 * Quand l'un est mis à jour et pas l'autre, le service se retrouve avec une
 * dépendance `undefined` — silencieusement. Ni le compilateur ni les tests ne
 * peuvent le voir, parce que tous ces paramètres sont optionnels.
 *
 * Cette classe de bug a touché la production **quatre fois** :
 *   - 4d6ed998, fec097e3 (historique)
 *   - f94eb44e (2026-08-08) : `talentService` absent de `createFleetService` dans
 *     le worker → le bonus de minage de la coque industrielle n'était pas
 *     appliqué à 9 joueurs, pendant des mois.
 *   - 2940bb93 (2026-08-09) : `talentService` absent de `createFlagshipService`
 *     dans le worker → le bonus de réparation de coque, pourtant affiché au
 *     joueur, était ignoré.
 *
 * Le test compare les listes d'arguments des factories appelées **des deux
 * côtés** et échoue sur toute divergence non déclarée.
 *
 * ## Pourquoi une analyse statique et pas un import
 *
 * `worker.ts` n'est pas importable dans un test : il a un `await` de niveau
 * module, instancie 4 files BullMQ à l'import et démarre 4 workers + 8 crons au
 * chargement. On lit donc le texte des deux fichiers.
 */

const here = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(here, '../app-router.ts');
const WORKER_ROOT = resolve(here, '../../workers/worker.ts');

/**
 * Divergences connues entre les deux racines, **figees** pour que le test passe
 * au vert aujourd hui tout en rendant chacune visible.
 *
 * `statut` vaut :
 *   - `assume`     : verifie, le worker n a reellement pas besoin de cet argument
 *   - `a_trancher` : divergence non analysee — **c est une dette, pas un choix**
 *
 * Toute divergence absente de cette liste fait echouer le test. Pour retirer une
 * entree `a_trancher`, il faut soit corriger le cablage, soit verifier que le
 * service ne se sert pas de l argument dans un chemin atteignable depuis le
 * worker, et la passer en `assume` avec la preuve.
 */
type Ecart = { manquantsCoteWorker: string[]; statut: 'assume' | 'a_trancher'; raison: string };

const ECARTS_CONNUS: Record<string, Ecart> = {
  createFlagshipService: {
    manquantsCoteWorker: ['env.ASSETS_DIR', 'resourceService', 'reportService'],
    statut: 'assume',
    raison:
      "assetsDir ne sert qu a create/listImages/changeHull, reportService qu a scan — aucun n est " +
      'atteignable depuis le worker (get / incapacitate / setInMission / returnFromMission). ' +
      'talentService, lui, EST requis par incapacitate et a ete ajoute en 2940bb93.',
  },
  createBuildingService: {
    manquantsCoteWorker: ['talentService', 'dailyQuestService'],
    statut: 'a_trancher',
    raison: 'Le worker termine les constructions : verifier si le temps de build et les hooks de quete en dependent.',
  },
  createResearchService: {
    manquantsCoteWorker: ['talentService', 'dailyQuestService', 'exiliumService'],
    statut: 'a_trancher',
    raison: 'Trois dependances absentes. Le worker termine les recherches — hooks de quete et gains d exilium probablement muets.',
  },
  createMarketService: {
    manquantsCoteWorker: ['talentService', 'gameEventService'],
    statut: 'a_trancher',
    raison: 'Le worker traite l expiration des offres : verifier si un game_event devrait etre emis.',
  },
  createPveService: {
    manquantsCoteWorker: ['talentService', 'exiliumService'],
    statut: 'a_trancher',
    raison: 'Le worker resout les missions PvE : les gains d exilium passent-ils par ce service ?',
  },
  createTutorialService: {
    manquantsCoteWorker: ['exiliumService'],
    statut: 'a_trancher',
    raison: 'Le worker valide des quetes de tutoriel : la recompense en exilium est-elle versee ?',
  },
};

/** Extrait la liste d'arguments d'un appel `createXService(...)`, multi-lignes compris. */
function extraireArguments(source: string, factory: string): string[] | null {
  const marqueur = `${factory}(`;
  const debut = source.indexOf(marqueur);
  if (debut === -1) return null;

  let profondeur = 0;
  let i = debut + marqueur.length - 1;
  let fin = -1;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === '(') profondeur++;
    else if (c === ')') {
      profondeur--;
      if (profondeur === 0) {
        fin = i;
        break;
      }
    }
  }
  if (fin === -1) return null;

  const brut = source.slice(debut + marqueur.length, fin);

  // Découpe sur les virgules de premier niveau uniquement : un argument peut
  // être un objet ou un appel imbriqué contenant ses propres virgules.
  const args: string[] = [];
  let courant = '';
  let niveau = 0;
  for (const c of brut) {
    if (c === '(' || c === '{' || c === '[') niveau++;
    if (c === ')' || c === '}' || c === ']') niveau--;
    if (c === ',' && niveau === 0) {
      args.push(courant.trim());
      courant = '';
    } else {
      courant += c;
    }
  }
  if (courant.trim()) args.push(courant.trim());

  // Nettoie les commentaires de fin de ligne et les retours à la ligne.
  return args
    .map((a) => a.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function factoriesAppelees(source: string): Set<string> {
  return new Set(Array.from(source.matchAll(/\b(create[A-Za-z]+Service)\(/g), (m) => m[1]));
}

describe('parité des racines de composition (app-router vs worker)', () => {
  const api = readFileSync(API_ROOT, 'utf8');
  const worker = readFileSync(WORKER_ROOT, 'utf8');

  const communes = [...factoriesAppelees(api)]
    .filter((f) => factoriesAppelees(worker).has(f))
    .sort();

  it('les deux racines instancient bien un ensemble commun de services', () => {
    // Garde-fou du test lui-même : si l'extraction casse, on veut le savoir ici
    // plutôt que de voir le test passer sur un ensemble vide.
    expect(communes.length).toBeGreaterThan(15);
  });

  it.each(communes)('%s reçoit les mêmes dépendances des deux côtés', (factory) => {
    const argsApi = extraireArguments(api, factory);
    const argsWorker = extraireArguments(worker, factory);

    expect(argsApi, `arguments introuvables pour ${factory} dans app-router.ts`).not.toBeNull();
    expect(argsWorker, `arguments introuvables pour ${factory} dans worker.ts`).not.toBeNull();

    const ecart = ECARTS_CONNUS[factory];
    const attendus = ecart
      ? argsApi!.filter((a) => !ecart.manquantsCoteWorker.includes(a))
      : argsApi!;

    expect(
      argsWorker,
      `\nDivergence de câblage sur ${factory}.\n` +
        `  app-router : ${argsApi!.join(', ')}\n` +
        `  worker     : ${argsWorker!.join(', ')}\n\n` +
        `Si le worker doit vraiment recevoir moins, declare-le dans ECARTS_CONNUS\n` +
        `avec la raison — après avoir vérifié que le service ne s'en sert pas dans\n` +
        `un chemin atteignable depuis le worker. Sinon, corrige le câblage.\n`,
    ).toEqual(attendus);
  });
});
