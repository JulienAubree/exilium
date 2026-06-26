/**
 * Types partagés pour la vue arbre des recherches (S1 research-trees).
 */

export type ResearchItem = {
  id: string;
  name: string;
  description: string;
  currentLevel: number;
  maxLevel: number | null;
  nextLevelCost: { minerai: number; silicium: number; hydrogene: number };
  nextLevelTime: number;
  prerequisitesMet: boolean;
  missingPrerequisites: string[];
  isResearching: boolean;
  researchEndTime: string | null;
  branchId: string | null;
  tier: number | null;
  forkId: string | null;
  forkPath: string | null;
  locked: boolean;
};

export type ForkChoices = Record<string, { path: string; respecCount: number }>;

/** Groupe de recherches dans un tier (peut être un fork ou une liste simple). */
export type TierGroup =
  | { kind: 'linear'; items: ResearchItem[] }
  | { kind: 'fork'; forkId: string; paths: Record<string, ResearchItem[]> };

export type BranchDef = {
  id: string;
  label: string;
};

export const BRANCHES: BranchDef[] = [
  { id: 'economy', label: 'Économie' },
  { id: 'propulsion', label: 'Propulsion' },
  { id: 'armament', label: 'Armement' },
  { id: 'defense', label: 'Défense' },
  { id: 'intel', label: 'Renseignement' },
];
