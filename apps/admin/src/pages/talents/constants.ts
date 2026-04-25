// ── Branch CRUD ──

export const BRANCH_FIELDS = [
  { key: 'id', label: 'ID (slug)', type: 'text' as const },
  { key: 'name', label: 'Nom', type: 'text' as const },
  { key: 'description', label: 'Description', type: 'textarea' as const },
  { key: 'color', label: 'Couleur (hex)', type: 'text' as const },
  { key: 'sortOrder', label: 'Ordre', type: 'number' as const },
];

export const BRANCH_EDIT_FIELDS = BRANCH_FIELDS.filter((f) => f.key !== 'id');

// ── Talent CRUD ──

export const EFFECT_TYPES = [
  { value: 'modify_stat', label: 'Modifier stat flagship' },
  { value: 'global_bonus', label: 'Bonus global (comme recherche)' },
  { value: 'planet_bonus', label: 'Bonus planete' },
  { value: 'timed_buff', label: 'Buff temporaire' },
  { value: 'unlock', label: 'Deblocage' },
];

export const POSITIONS = [
  { value: 'left', label: 'Gauche' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Droite' },
];

// ── Effect type display helpers ──

export const EFFECT_COLORS: Record<string, string> = {
  modify_stat: 'text-blue-400 bg-blue-900/20',
  global_bonus: 'text-amber-400 bg-amber-900/20',
  planet_bonus: 'text-emerald-400 bg-emerald-900/20',
  timed_buff: 'text-pink-400 bg-pink-900/20',
  unlock: 'text-purple-400 bg-purple-900/20',
};

// ── Hull / Flagship ──

export const HULL_TYPES = [
  { id: 'combat', label: 'Combat', color: 'text-red-400' },
  { id: 'industrial', label: 'Industrielle', color: 'text-amber-400' },
  { id: 'scientific', label: 'Scientifique', color: 'text-cyan-400' },
];

export const BONUS_LABELS: Record<string, string> = {
  combat_build_time_reduction: 'Temps construction militaire',
  industrial_build_time_reduction: 'Temps construction industrielle',
  research_time_reduction: 'Temps de recherche',
  bonus_armor: 'Blindage',
  bonus_shot_count: 'Attaques',
  bonus_weapons: 'Armes',
};
