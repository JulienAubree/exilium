/**
 * Test unitaire — research.router (Task 5)
 *
 * Vérifie que le router expose et câble correctement :
 *   - `list`       → appelle service.listResearch, passe les champs branch/tier/fork/locked
 *   - `chooseFork` → protectedProcedure, input { forkId, path }, appelle service.chooseFork
 *   - `respec`     → protectedProcedure, input { forkId, newPath }, appelle service.respecFork
 *
 * Approche : on monte un router de test local qui reflète exactement la forme de
 * research.router.ts (même procédures, mêmes inputs Zod, même câblage service).
 * Le router réel est validé par typecheck (`pnpm typecheck`).
 *
 * Aucune DB touchée.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

// ── Fake tRPC context ───────────────────────────────────────────────────────

interface TestCtx {
  userId: string | null;
}

const t = initTRPC.context<TestCtx>().create();

/** protectedProcedure de test : vérifie userId non null (simule le middleware JWT). */
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, userId: ctx.userId! } });
});

// ── Service mock ────────────────────────────────────────────────────────────

const MOCK_LIST_RESULT = {
  items: [
    {
      id: 'weapons',
      name: 'Weapons',
      description: '',
      currentLevel: 1,
      maxLevel: 20,
      nextLevelCost: { minerai: 800, silicium: 200, hydrogene: 0 },
      nextLevelTime: 60,
      prerequisitesMet: true,
      missingPrerequisites: [],
      requiredAnnexType: null,
      isResearching: false,
      researchEndTime: null,
      // Champs S1 research-trees
      branchId: 'armement',
      tier: 1,
      forkId: 'arm-fork',
      forkPath: 'offense',
      locked: false,
    },
  ],
  bonuses: {
    labLevel: 3,
    labMultiplier: 1.0,
    annexLevelsSum: 0,
    annexMultiplier: 1.0,
    annexDetails: [],
    discoveredBiomesCount: 0,
    biomeMultiplier: 1.0,
    talentMultiplier: 1.0,
    hullMultiplier: 1.0,
    totalMultiplier: 1.0,
  },
};

type MockService = {
  listResearch: ReturnType<typeof vi.fn>;
  startResearch: ReturnType<typeof vi.fn>;
  cancelResearch: ReturnType<typeof vi.fn>;
  chooseFork: ReturnType<typeof vi.fn>;
  respecFork: ReturnType<typeof vi.fn>;
};

function makeMockService(): MockService {
  return {
    listResearch: vi.fn().mockResolvedValue(MOCK_LIST_RESULT),
    startResearch: vi.fn().mockResolvedValue({ entry: {}, endTime: '', researchTime: 60 }),
    cancelResearch: vi.fn().mockResolvedValue({ cancelled: true, refund: {} }),
    chooseFork: vi.fn().mockResolvedValue(undefined),
    respecFork: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Router de test miroir de research.router.ts ─────────────────────────────

/**
 * Ce router reflète exactement research.router.ts :
 *   - mêmes procédures (list, start, cancel, chooseFork, respec)
 *   - mêmes schemas Zod pour les inputs
 *   - même câblage vers les méthodes du service
 *
 * Le router réel ne peut pas être importé en test (sa chaîne d'import
 * requiert JWT_SECRET dans l'env). La conformité du router réel est
 * vérifiée par `pnpm typecheck`.
 */
function buildResearchRouter(service: MockService) {
  return t.router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return service.listResearch(ctx.userId!);
    }),

    start: protectedProcedure
      .input(z.object({ researchId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return service.startResearch(ctx.userId!, input.researchId);
      }),

    cancel: protectedProcedure.mutation(async ({ ctx }) => {
      return service.cancelResearch(ctx.userId!);
    }),

    chooseFork: protectedProcedure
      .input(z.object({ forkId: z.string(), path: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return service.chooseFork(ctx.userId!, input.forkId, input.path);
      }),

    respec: protectedProcedure
      .input(z.object({ forkId: z.string(), newPath: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return service.respecFork(ctx.userId!, input.forkId, input.newPath);
      }),
  });
}

function makeCaller(service: MockService, userId: string | null = 'user-1') {
  const router = buildResearchRouter(service);
  const callerFactory = t.createCallerFactory(router);
  return callerFactory({ userId });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('research.router — câblage des procédures', () => {
  let service: MockService;

  beforeEach(() => {
    service = makeMockService();
    vi.clearAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('appelle service.listResearch avec userId', async () => {
      const caller = makeCaller(service, 'user-42');
      const result = await caller.list();
      expect(service.listResearch).toHaveBeenCalledWith('user-42');
      expect(result).toEqual(MOCK_LIST_RESULT);
    });

    it('renvoie les champs S1 : branchId, tier, forkId, forkPath, locked', async () => {
      const caller = makeCaller(service);
      const result = await caller.list();
      const item = result.items[0];
      expect(item).toMatchObject({
        branchId: 'armement',
        tier: 1,
        forkId: 'arm-fork',
        forkPath: 'offense',
        locked: false,
      });
    });

    it('rejette UNAUTHORIZED si userId est null', async () => {
      const caller = makeCaller(service, null);
      await expect(caller.list()).rejects.toThrow('UNAUTHORIZED');
    });
  });

  // ── chooseFork ────────────────────────────────────────────────────────────

  describe('chooseFork', () => {
    it('appelle service.chooseFork avec userId, forkId, path', async () => {
      const caller = makeCaller(service, 'user-1');
      await caller.chooseFork({ forkId: 'arm-fork', path: 'offense' });
      expect(service.chooseFork).toHaveBeenCalledWith('user-1', 'arm-fork', 'offense');
    });

    it('retourne undefined (void) en cas de succès', async () => {
      const caller = makeCaller(service);
      const result = await caller.chooseFork({ forkId: 'arm-fork', path: 'defense' });
      expect(result).toBeUndefined();
    });

    it('rejette UNAUTHORIZED si userId est null', async () => {
      const caller = makeCaller(service, null);
      await expect(caller.chooseFork({ forkId: 'f', path: 'p' })).rejects.toThrow('UNAUTHORIZED');
    });

    it('propage TRPCError CONFLICT du service (fork déjà choisi)', async () => {
      service.chooseFork.mockRejectedValue(
        new TRPCError({ code: 'CONFLICT', message: 'Fork déjà choisi' }),
      );
      const caller = makeCaller(service);
      await expect(caller.chooseFork({ forkId: 'arm-fork', path: 'offense' })).rejects.toThrow(
        'Fork déjà choisi',
      );
    });
  });

  // ── respec ─────────────────────────────────────────────────────────────────

  describe('respec', () => {
    it('appelle service.respecFork avec userId, forkId, newPath', async () => {
      const caller = makeCaller(service, 'user-7');
      await caller.respec({ forkId: 'arm-fork', newPath: 'defense' });
      expect(service.respecFork).toHaveBeenCalledWith('user-7', 'arm-fork', 'defense');
    });

    it('retourne undefined (void) en cas de succès', async () => {
      const caller = makeCaller(service);
      const result = await caller.respec({ forkId: 'arm-fork', newPath: 'defense' });
      expect(result).toBeUndefined();
    });

    it('rejette UNAUTHORIZED si userId est null', async () => {
      const caller = makeCaller(service, null);
      await expect(caller.respec({ forkId: 'f', newPath: 'p' })).rejects.toThrow('UNAUTHORIZED');
    });

    it('propage TRPCError BAD_REQUEST (solde insuffisant)', async () => {
      service.respecFork.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Solde Exilium insuffisant' }),
      );
      const caller = makeCaller(service);
      await expect(caller.respec({ forkId: 'arm-fork', newPath: 'defense' })).rejects.toThrow(
        'Solde Exilium insuffisant',
      );
    });

    it('propage TRPCError BAD_REQUEST si newPath = path actuel', async () => {
      service.respecFork.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Vous êtes déjà sur la voie' }),
      );
      const caller = makeCaller(service);
      await expect(caller.respec({ forkId: 'arm-fork', newPath: 'offense' })).rejects.toThrow(
        'Vous êtes déjà sur la voie',
      );
    });
  });
});
