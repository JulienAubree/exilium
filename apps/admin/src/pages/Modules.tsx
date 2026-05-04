import { useEffect, useMemo, useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@exilium/api/trpc';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { ModuleImageSlot } from '@/components/ui/ModuleImageSlot';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Save, Plus, Trash2, ChevronRight, Atom } from 'lucide-react';

type ModuleDef = inferRouterOutputs<AppRouter>['modules']['admin']['list'][number];

const HULLS = ['combat', 'scientific', 'industrial'] as const;
type Hull = typeof HULLS[number];
const RARITIES = ['common', 'rare', 'epic'] as const;
type Rarity = typeof RARITIES[number];

const HULL_TONE: Record<Hull, string> = {
  combat:     'text-rose-300',
  scientific: 'text-hull-300',
  industrial: 'text-amber-300',
};

const EFFECT_TEMPLATES = {
  stat:        '{ "type": "stat", "stat": "damage", "value": 0.05 }',
  conditional: '{ "type": "conditional", "trigger": "first_round", "effect": { "stat": "damage", "value": 0.50 } }',
  active:      '{ "type": "active", "ability": "repair", "magnitude": 0.50 }',
};

export default function Modules() {
  const { data: modules, isLoading, refetch } = trpc.modules.admin.list.useQuery();
  const upsertMutation = trpc.modules.admin.upsert.useMutation();
  const deleteMutation = trpc.modules.admin.delete.useMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ModuleDef | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && modules) {
      const found = modules.find((m) => m.id === selectedId);
      if (found) setDraft(structuredClone(found));
    } else {
      setDraft(null);
    }
  }, [selectedId, modules]);

  const grouped = useMemo(() => {
    const out: Record<Hull, Record<Rarity, ModuleDef[]>> = {
      combat: { common: [], rare: [], epic: [] },
      scientific: { common: [], rare: [], epic: [] },
      industrial: { common: [], rare: [], epic: [] },
    };
    for (const m of modules ?? []) {
      const h = m.hullId as Hull;
      const r = m.rarity as Rarity;
      if (out[h] && out[h][r]) out[h][r].push(m);
    }
    return out;
  }, [modules]);

  if (isLoading || !modules) return <PageSkeleton />;

  function newModule(hull: Hull, rarity: Rarity) {
    const id = `${hull}-new-${Math.random().toString(36).slice(2, 7)}`;
    setSelectedId(null);
    setDraft({
      id,
      hullId: hull,
      rarity,
      name: 'Nouveau module',
      description: 'À remplir',
      image: '',
      enabled: true,
      kind: 'passive',
      effect: { type: 'stat', stat: 'damage', value: 0.05 } as ModuleDef['effect'],
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaveError(null);
    try {
      await upsertMutation.mutateAsync(draft);
      setSavedAt(Date.now());
      await refetch();
      setSelectedId(draft.id);
      setTimeout(() => setSavedAt(null), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync({ id });
      setDeleteConfirm(null);
      setSelectedId(null);
      await refetch();
    } catch (err) {
      alert(`Suppression échouée : ${err instanceof Error ? err.message : 'inconnue'}`);
    }
  }

  return (
    <div className="-m-4 md:-m-6 flex h-[calc(100vh-3.5rem)] md:h-screen flex-col bg-bg/40">
      <header className="shrink-0 border-b border-panel-border bg-bg/95 backdrop-blur px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Atom className="h-5 w-5 text-hull-300" />
          <div>
            <h1 className="text-sm font-bold uppercase tracking-[0.18em] text-hull-300">Modules / Catalogue</h1>
            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
              {modules.length} modules · 3 coques · 3 raretés
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[340px_1fr] overflow-hidden">
        {/* Rail */}
        <aside className="border-r border-panel-border bg-bg/60 overflow-y-auto p-2 space-y-3">
          {HULLS.map((hull) => (
            <div key={hull} className="space-y-1">
              <div className={`px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${HULL_TONE[hull]}`}>
                {hull}
              </div>
              {RARITIES.map((rarity) => (
                <div key={rarity} className="ml-2">
                  <div className="flex items-center justify-between px-1 py-0.5">
                    <span className="text-[9px] uppercase tracking-wider text-gray-500">
                      {rarity} ({grouped[hull][rarity].length})
                    </span>
                    <button onClick={() => newModule(hull, rarity)} className="text-hull-300 hover:text-hull-200" title="Nouveau">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  {grouped[hull][rarity].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full text-left px-2 py-1 text-xs rounded ${
                        selectedId === m.id ? 'bg-hull-950/40 text-hull-200' : 'text-gray-400 hover:bg-panel/40'
                      } ${!m.enabled ? 'line-through opacity-60' : ''} flex items-center gap-1`}
                    >
                      <span className="truncate flex-1">{m.name}</span>
                      {selectedId === m.id && <ChevronRight className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </aside>

        {/* Detail */}
        <main className="overflow-y-auto bg-bg/40 p-5 space-y-4">
          {!draft ? (
            <div className="flex h-full items-center justify-center text-gray-500 text-sm">
              Sélectionne un module à gauche, ou crée-en un nouveau.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-mono text-sm uppercase tracking-wider text-hull-300">
                  {draft.name}
                </h2>
                <div className="flex items-center gap-2">
                  {selectedId && (
                    <button onClick={() => setDeleteConfirm(draft.id)} className="text-gray-500 hover:text-red-400 text-xs flex items-center gap-1">
                      <Trash2 className="h-3 w-3" /> Supprimer
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={upsertMutation.isPending}
                    className="inline-flex items-center gap-1 rounded bg-hull-600 hover:bg-hull-500 px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    <Save className="h-3 w-3" />
                    {upsertMutation.isPending ? 'Enregistrement…' : savedAt ? 'Enregistré' : 'Enregistrer'}
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                  <span className="font-semibold">Erreur :</span> {saveError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">ID (immutable)</span>
                  <input
                    type="text" value={draft.id}
                    onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                    disabled={!!selectedId}
                    className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-sm disabled:opacity-50"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Coque</span>
                  <select
                    value={draft.hullId}
                    onChange={(e) => setDraft({ ...draft, hullId: e.target.value as Hull })}
                    className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-sm"
                  >
                    {HULLS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Rareté</span>
                  <select
                    value={draft.rarity}
                    onChange={(e) => setDraft({ ...draft, rarity: e.target.value as Rarity })}
                    className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-sm"
                  >
                    {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="block flex items-center gap-2 mt-4">
                  <input
                    type="checkbox" checked={draft.enabled}
                    onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                  />
                  <span className="text-xs text-gray-400">Actif</span>
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Nom (max 80)</span>
                <input
                  type="text" value={draft.name} maxLength={80}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Description</span>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3}
                  className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-sm"
                />
              </label>

              <ModuleImageSlot
                slot={draft.id}
                value={draft.image}
                aspect="1/1"
                label="Image"
                hint="Optionnel — 800×800 recommandé"
                onChange={(path) => setDraft({ ...draft, image: path })}
              />

              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Effet (JSON)</span>
                <div className="flex gap-1 mb-1">
                  {(Object.keys(EFFECT_TEMPLATES) as Array<keyof typeof EFFECT_TEMPLATES>).map((tpl) => (
                    <button
                      key={tpl}
                      onClick={() => {
                        try {
                          setDraft({ ...draft, effect: JSON.parse(EFFECT_TEMPLATES[tpl]) });
                        } catch { /* unreachable */ }
                      }}
                      className="text-[10px] rounded border border-panel-border bg-panel/30 px-2 py-0.5 hover:bg-hull-900/30"
                    >
                      Template: {tpl}
                    </button>
                  ))}
                </div>
                <textarea
                  value={JSON.stringify(draft.effect, null, 2)}
                  onChange={(e) => {
                    try {
                      setDraft({ ...draft, effect: JSON.parse(e.target.value) });
                      setSaveError(null);
                    } catch (err) {
                      setSaveError(`JSON invalide : ${err instanceof Error ? err.message : 'parse error'}`);
                    }
                  }}
                  rows={6}
                  className="w-full rounded border border-panel-border bg-bg/60 px-2 py-1 text-xs font-mono"
                />
              </div>
            </>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Supprimer ce module ?"
        message="Le module sera retiré du catalogue et désinventaire des joueurs qui le possédaient (cascade)."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
