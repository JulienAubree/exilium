import { useState } from 'react';
import { Key, Search, Zap, Shield, FlaskConical, Factory, Coins } from 'lucide-react';

// ── Complete registry of all gameplay keys ──

interface GameplayKey {
  key: string;
  label: string;
  description: string;
  category: string;
  source: string;
  consumer: string;
  formula: string;
  example?: string;
}

const CATEGORIES = [
  { id: 'hull_passive', label: 'Bonus passifs de coque', icon: Shield, color: 'text-cyan-400' },
  { id: 'hull_time', label: 'Reductions de temps (coque)', icon: Zap, color: 'text-cyan-400' },
  { id: 'building_bonus', label: 'Bonus batiments (resolveBonus)', icon: Factory, color: 'text-orange-400' },
  { id: 'research_bonus', label: 'Bonus recherches (resolveBonus)', icon: FlaskConical, color: 'text-green-400' },
  { id: 'economy', label: 'Economie & marche', icon: Coins, color: 'text-yellow-400' },
];

const KEYS: GameplayKey[] = [
  // ── Hull passive (stat bonuses) ──
  { key: 'bonus_weapons', label: 'Armes', description: '+N armes du flagship quand stationne', category: 'hull_passive', source: 'Hull config passiveBonuses', consumer: 'flagship.service.ts get()', formula: 'effectiveWeapons = base + bonus_weapons', example: 'bonus_weapons: 8 → +8 armes' },
  { key: 'bonus_armor', label: 'Blindage', description: '+N blindage du flagship quand stationne', category: 'hull_passive', source: 'Hull config passiveBonuses', consumer: 'flagship.service.ts get()', formula: 'effectiveArmor = base + bonus_armor', example: 'bonus_armor: 6 → +6 blindage' },
  { key: 'bonus_shot_count', label: 'Attaques', description: '+N attaques du flagship quand stationne', category: 'hull_passive', source: 'Hull config passiveBonuses', consumer: 'flagship.service.ts get()', formula: 'effectiveShots = base + bonus_shot_count', example: 'bonus_shot_count: 2 → +2 tirs/round' },

  // ── Hull time reductions ──
  { key: 'combat_build_time_reduction', label: 'Construction militaire', description: 'Reduit le temps de construction des vaisseaux du Centre de commandement', category: 'hull_time', source: 'Hull config passiveBonuses', consumer: 'shipyard.service.ts (4 endroits)', formula: 'time = baseTime × (1 - reduction)', example: '0.20 → -20% temps' },
  { key: 'industrial_build_time_reduction', label: 'Construction industrielle', description: 'Reduit le temps de construction des vaisseaux du Chantier spatial', category: 'hull_time', source: 'Hull config passiveBonuses', consumer: 'shipyard.service.ts (4 endroits)', formula: 'time = baseTime × (1 - reduction)', example: '0.20 → -20% temps' },
  { key: 'research_time_reduction', label: 'Recherche', description: 'Reduit le temps de recherche sur la planete du flagship', category: 'hull_time', source: 'Hull config passiveBonuses', consumer: 'research.service.ts (2 endroits)', formula: 'time = baseTime × (1 - reduction)', example: '0.20 → -20% temps' },

  // ── resolveBonus (building/research) ──
  { key: 'research_time', label: 'Temps recherche (bat.)', description: 'Reduction du temps de recherche par niveau de batiment', category: 'building_bonus', source: 'Building bonus config', consumer: 'research.service.ts', formula: 'time = base × resolveBonus()', example: 'Labo: -15%/niveau' },
  { key: 'ship_build_time', label: 'Temps vaisseaux (bat.)', description: 'Reduction du temps de construction par batiment', category: 'building_bonus', source: 'Building bonus config', consumer: 'shipyard.service.ts', formula: 'time = base × resolveBonus()', example: 'Chantier/CC: -15%/niveau' },
  { key: 'defense_build_time', label: 'Temps defenses (bat.)', description: 'Reduction du temps de construction defenses', category: 'building_bonus', source: 'Building bonus config', consumer: 'shipyard.service.ts', formula: 'time = base × resolveBonus()', example: 'Arsenal: -15%/niveau' },
  { key: 'building_time', label: 'Temps batiments', description: 'Reduction du temps de construction batiments', category: 'building_bonus', source: 'Building bonus config', consumer: 'building.service.ts', formula: 'time = base × resolveBonus()', example: 'Nanites: -X%/niveau' },
  { key: 'weapons (research)', label: 'Armes (recherche)', description: 'Bonus d\'armes par niveau de recherche', category: 'research_bonus', source: 'Research bonus config', consumer: 'combat + ship details', formula: 'weapons = base × resolveBonus()', example: 'Tech armes: +X%/niveau' },
  { key: 'shielding', label: 'Bouclier (recherche)', description: 'Bonus bouclier par niveau de recherche', category: 'research_bonus', source: 'Research bonus config', consumer: 'combat + ship details', formula: 'shield = base × resolveBonus()', example: 'Tech bouclier: +X%/niveau' },
  { key: 'armor', label: 'Blindage (recherche)', description: 'Bonus blindage par niveau de recherche', category: 'research_bonus', source: 'Research bonus config', consumer: 'combat + ship details', formula: 'hull = base × resolveBonus()', example: 'Tech blindage: +X%/niveau' },
  { key: 'ship_speed', label: 'Vitesse (recherche)', description: 'Bonus vitesse par type de propulsion', category: 'research_bonus', source: 'Research bonus config', consumer: 'fleet speed calc', formula: 'speed = base × resolveBonus(driveType)', example: 'Combustion/Impulsion/Hyper' },
  { key: 'mining_extraction', label: 'Extraction miniere', description: 'Bonus extraction miniere', category: 'research_bonus', source: 'Research bonus config', consumer: 'mine.handler.ts', formula: 'extraction = base × resolveBonus()', example: 'Tech fracturation: +X%' },
];

export default function GameplayKeys() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const q = search.toLowerCase().trim();
  const filtered = KEYS.filter(k => {
    if (activeCategory && k.category !== activeCategory) return false;
    if (!q) return true;
    return k.key.toLowerCase().includes(q) || k.label.toLowerCase().includes(q) || k.description.toLowerCase().includes(q);
  });

  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    keys: filtered.filter(k => k.category === cat.id),
  })).filter(g => g.keys.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Key className="w-5 h-5 text-cyan-400" />
          <h1 className="text-lg font-semibold text-gray-100">Cles de gameplay</h1>
          <span className="text-xs text-gray-500">{KEYS.length} cles</span>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Reference de toutes les cles utilisees dans le moteur de jeu. Ces cles sont lues par le code backend pour appliquer les bonus, reductions et effets.
        Pour qu'une nouvelle cle fonctionne, elle doit etre lue quelque part dans le code.
      </p>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher une cle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="admin-input pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
              !activeCategory ? 'bg-cyan-900/40 border-cyan-700/50 text-cyan-400' : 'bg-gray-800/40 border-gray-700/50 text-gray-500 hover:text-gray-300'
            }`}
          >
            Toutes ({KEYS.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = KEYS.filter(k => k.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                  activeCategory === cat.id ? 'bg-cyan-900/40 border-cyan-700/50 text-cyan-400' : 'bg-gray-800/40 border-gray-700/50 text-gray-500 hover:text-gray-300'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {grouped.map(group => (
        <div key={group.id} className="admin-card mb-4">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-panel-border">
            <group.icon className={`w-4 h-4 ${group.color}`} />
            <span className="font-semibold text-gray-100">{group.label}</span>
            <span className="text-xs text-gray-500">{group.keys.length}</span>
          </div>
          <div className="divide-y divide-panel-border">
            {group.keys.map(k => (
              <div key={k.key} className="px-4 py-3 hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center gap-3 mb-1">
                  <code className="text-[11px] font-mono text-cyan-400 bg-cyan-900/20 px-1.5 py-0.5 rounded border border-cyan-800/20">{k.key}</code>
                  <span className="text-sm font-medium text-gray-200">{k.label}</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{k.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
                  <span>Source : <span className="text-gray-400">{k.source}</span></span>
                  <span>Lu par : <span className="text-gray-400">{k.consumer}</span></span>
                  <span>Formule : <span className="text-gray-400 font-mono">{k.formula}</span></span>
                  {k.example && <span>Exemple : <span className="text-gray-400">{k.example}</span></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="admin-card p-8 text-center text-gray-500">Aucune cle trouvee.</div>
      )}
    </div>
  );
}
