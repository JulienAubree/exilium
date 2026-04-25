import { POSITIONS, EFFECT_TYPES } from './constants';

// ── Branch helpers ──

export function defaultBranchForm(): Record<string, string | number> {
  return { id: '', name: '', description: '', color: '#ef4444', sortOrder: 0 };
}

export function branchToForm(b: any): Record<string, string | number> {
  return { name: b.name, description: b.description ?? '', color: b.color, sortOrder: b.sortOrder ?? 0 };
}

// ── Talent helpers ──

export function talentFields(branches: { id: string; name: string }[], talents: { id: string; name: string }[]) {
  return [
    { key: 'id', label: 'ID (slug)', type: 'text' as const },
    { key: 'branchId', label: 'Branche', type: 'select' as const, options: branches.map((b) => ({ value: b.id, label: b.name })) },
    { key: 'tier', label: 'Tier', type: 'number' as const },
    { key: 'position', label: 'Position', type: 'select' as const, options: POSITIONS },
    { key: 'name', label: 'Nom', type: 'text' as const },
    { key: 'description', label: 'Description', type: 'textarea' as const },
    { key: 'maxRanks', label: 'Rangs max', type: 'number' as const },
    { key: 'prerequisiteId', label: 'Prerequis (talent ID)', type: 'select' as const, options: [{ value: '', label: '— Aucun —' }, ...talents.map((t) => ({ value: t.id, label: `${t.name} (${t.id})` }))] },
    { key: 'effectType', label: "Type d'effet", type: 'select' as const, options: EFFECT_TYPES },
    { key: 'effectParams', label: 'Parametres effet (JSON)', type: 'textarea' as const },
    { key: 'sortOrder', label: 'Ordre', type: 'number' as const },
  ];
}

export function defaultTalentForm(branchId?: string): Record<string, string | number> {
  return {
    id: '', branchId: branchId ?? '', tier: 1, position: 'center',
    name: '', description: '', maxRanks: 1, prerequisiteId: '',
    effectType: 'modify_stat', effectParams: '{}', sortOrder: 0,
  };
}

export function talentToForm(t: any): Record<string, string | number> {
  return {
    branchId: t.branchId, tier: t.tier, position: t.position,
    name: t.name, description: t.description ?? '', maxRanks: t.maxRanks ?? 1,
    prerequisiteId: t.prerequisiteId ?? '', effectType: t.effectType,
    effectParams: JSON.stringify(t.effectParams, null, 2), sortOrder: t.sortOrder ?? 0,
  };
}

export function formToTalentData(values: Record<string, string | number>) {
  let effectParams: Record<string, unknown> = {};
  try { effectParams = JSON.parse(String(values.effectParams)); } catch {}
  return {
    branchId: String(values.branchId),
    tier: Number(values.tier),
    position: String(values.position),
    name: String(values.name),
    description: String(values.description),
    maxRanks: Number(values.maxRanks),
    prerequisiteId: values.prerequisiteId ? String(values.prerequisiteId) : null,
    effectType: String(values.effectType),
    effectParams,
    sortOrder: Number(values.sortOrder),
  };
}

export function effectParamsSummary(effectType: string, params: any): string {
  if (!params) return '';
  if (effectType === 'modify_stat') return `${params.stat}: ${params.valuePerRank > 0 ? '+' : ''}${params.valuePerRank}/rang`;
  if (effectType === 'global_bonus') return `${params.stat}: ${params.percentPerRank > 0 ? '+' : ''}${params.percentPerRank}%/rang`;
  if (effectType === 'planet_bonus') return `${params.stat}: ${params.percentPerRank > 0 ? '+' : ''}${params.percentPerRank}%/rang`;
  if (effectType === 'timed_buff') return `${params.stat}: ${params.value} (${params.durationSeconds}s)`;
  if (effectType === 'unlock') return `${params.key}`;
  return JSON.stringify(params);
}
