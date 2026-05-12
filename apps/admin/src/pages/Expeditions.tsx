import { useEffect, useMemo, useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@exilium/api/trpc';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExpeditionImageSlot } from '@/components/ui/ExpeditionImageSlot';
import {
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  MapPin,
  Sparkles,
  Compass,
  Activity,
  Power,
  AlertCircle,
  Copy,
  Download,
} from 'lucide-react';

type ExplorationContent = inferRouterOutputs<AppRouter>['expeditionContent']['get'];
type Sector = ExplorationContent['sectors'][number];
type EventEntry = ExplorationContent['events'][number];
type ChoiceEntry = EventEntry['choices'][number];
type Requirement = ChoiceEntry['requirements'][number];
type Outcome = ChoiceEntry['outcome'];

const TIERS = ['early', 'mid', 'deep'] as const;
type Tier = (typeof TIERS)[number];

const TIER_LABEL: Record<Tier, string> = {
  early: 'Initial',
  mid: 'Intermédiaire',
  deep: 'Profond',
};

const TIER_COLOR: Record<Tier, string> = {
  early: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  mid: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
  deep: 'bg-violet-500/10 border-violet-500/30 text-violet-300',
};

const TONES = ['positive', 'negative', 'risky', 'neutral'] as const;
type Tone = (typeof TONES)[number];

function emptyOutcome(): Outcome {
  return {
    minerai: 0,
    silicium: 0,
    hydrogene: 0,
    exilium: 0,
    resolutionText: '',
  };
}

function emptyChoice(): ChoiceEntry {
  return {
    label: 'Nouveau choix',
    tone: 'neutral',
    hidden: false,
    requirements: [],
    outcome: emptyOutcome(),
  };
}

function emptyEvent(): EventEntry {
  return {
    id: `evt-${Date.now()}`,
    tier: 'early',
    title: 'Nouvel événement',
    description: '',
    weight: 1,
    enabled: true,
    choices: [emptyChoice(), emptyChoice()],
  };
}

function emptySector(): Sector {
  return {
    id: `sec-${Date.now()}`,
    name: 'Nouveau secteur',
    tier: 'early',
    briefingTemplate: '',
    enabled: true,
  };
}

export default function ExpeditionsAdmin() {
  const { data, isLoading, refetch } = trpc.expeditionContent.get.useQuery();
  const updateMutation = trpc.expeditionContent.admin.update.useMutation();
  const resetMutation = trpc.expeditionContent.admin.reset.useMutation();
  const killSwitchMutation = trpc.expeditionContent.admin.setKillSwitch.useMutation();

  const [draft, setDraft] = useState<ExplorationContent | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [tab, setTab] = useState<'sectors' | 'events' | 'live'>('sectors');

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const dirty = useMemo(() => {
    if (!data || !draft) return false;
    return JSON.stringify(data) !== JSON.stringify(draft);
  }, [data, draft]);

  if (isLoading || !draft) return <PageSkeleton />;

  const handleSave = async () => {
    setSaveError(null);
    try {
      await updateMutation.mutateAsync(draft);
      setSavedAt(Date.now());
      await refetch();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur inconnue');
    }
  };

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync();
      setResetConfirm(false);
      setSavedAt(Date.now());
      await refetch();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur inconnue');
    }
  };

  const handleKillSwitch = async () => {
    try {
      const next = !draft.killSwitch;
      await killSwitchMutation.mutateAsync({ killSwitch: next });
      await refetch();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur inconnue');
    }
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Compass className="h-5 w-5 text-cyan-300" />
          <h1 className="text-lg font-bold">Missions d'exploration en espace profond</h1>
          {draft.killSwitch && (
            <span className="px-2 py-0.5 rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-300 text-[11px] font-semibold uppercase tracking-wider">
              Génération désactivée
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleKillSwitch}
            className={`px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 ${
              draft.killSwitch
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                : 'border-border/40 bg-card/60 hover:bg-card/80'
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            Kill-switch
          </button>
          <button
            type="button"
            onClick={() => setResetConfirm(true)}
            className="px-3 py-1.5 rounded-md border border-border/40 bg-card/60 hover:bg-card/80 text-xs font-semibold flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            type="button"
            disabled={!dirty || updateMutation.isPending}
            onClick={handleSave}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs font-semibold flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {updateMutation.isPending ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}
      {savedAt && Date.now() - savedAt < 5000 && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          Sauvegardé.
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 border-b border-border/30">
        <TabButton
          active={tab === 'sectors'}
          onClick={() => setTab('sectors')}
          icon={<MapPin className="h-3.5 w-3.5" />}
        >
          Secteurs ({draft.sectors.length})
        </TabButton>
        <TabButton
          active={tab === 'events'}
          onClick={() => setTab('events')}
          icon={<Sparkles className="h-3.5 w-3.5" />}
        >
          Événements ({draft.events.length})
        </TabButton>
        <TabButton
          active={tab === 'live'}
          onClick={() => setTab('live')}
          icon={<Activity className="h-3.5 w-3.5" />}
        >
          Missions live
        </TabButton>
      </div>

      {tab === 'sectors' && <SectorsTab draft={draft} setDraft={setDraft} />}
      {tab === 'events' && <EventsTab draft={draft} setDraft={setDraft} />}
      {tab === 'live' && <LiveMissionsTab />}

      <ConfirmDialog
        open={resetConfirm}
        onCancel={() => setResetConfirm(false)}
        onConfirm={handleReset}
        title="Restaurer le contenu par défaut ?"
        message="Toutes les modifications non sauvegardées seront perdues. Les missions en cours ne sont pas affectées."
        confirmLabel="Restaurer"
        danger
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
        active
          ? 'text-foreground border-primary'
          : 'text-muted-foreground border-transparent hover:text-foreground'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Onglet Secteurs ──────────────────────────────────────────────────────

function SectorsTab({
  draft,
  setDraft,
}: {
  draft: ExplorationContent;
  setDraft: (d: ExplorationContent) => void;
}) {
  const addSector = () => {
    setDraft({ ...draft, sectors: [...draft.sectors, emptySector()] });
  };
  const duplicateSector = (i: number) => {
    const s = draft.sectors[i];
    const copy = { ...s, id: `${s.id}-copy-${Date.now()}`, name: `${s.name} (copie)` };
    const next = [...draft.sectors];
    next.splice(i + 1, 0, copy);
    setDraft({ ...draft, sectors: next });
  };
  const removeSector = (i: number) => {
    setDraft({ ...draft, sectors: draft.sectors.filter((_, j) => j !== i) });
  };
  const updateSector = (i: number, patch: Partial<Sector>) => {
    const next = draft.sectors.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setDraft({ ...draft, sectors: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Lieux narratifs abstraits. Chaque mission engagée tire un secteur pondéré par le palier du
          joueur.
        </p>
        <button
          type="button"
          onClick={addSector}
          className="px-3 py-1.5 rounded-md bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>

      <div className="space-y-2">
        {draft.sectors.map((s, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 ${s.enabled ? 'border-border/40 bg-card/40' : 'border-border/20 bg-card/20 opacity-60'}`}
          >
            <div className="grid grid-cols-12 gap-3 items-start">
              <div className="col-span-2 row-span-2">
                <ExpeditionImageSlot
                  slot={`sector-${s.id}`}
                  value={s.imageRef ?? ''}
                  aspect="16/9"
                  label="Illustration"
                  hint="Hero du secteur (~1280×720)"
                  onChange={(path) => updateSector(i, { imageRef: path || undefined })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  ID
                </label>
                <input
                  type="text"
                  value={s.id}
                  onChange={(e) => updateSector(i, { id: e.target.value })}
                  className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-xs font-mono"
                />
              </div>
              <div className="col-span-3">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Nom
                </label>
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => updateSector(i, { name: e.target.value })}
                  className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Palier
                </label>
                <select
                  value={s.tier}
                  onChange={(e) => updateSector(i, { tier: e.target.value as Tier })}
                  className={`w-full border rounded px-2 py-1 text-xs ${TIER_COLOR[s.tier as Tier]}`}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 flex flex-col gap-1 items-end pt-4">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => updateSector(i, { enabled: !s.enabled })}
                    className="p-1 rounded hover:bg-white/5"
                    title={s.enabled ? 'Désactiver' : 'Activer'}
                  >
                    {s.enabled ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateSector(i)}
                    className="p-1 rounded hover:bg-white/5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSector(i)}
                    className="p-1 rounded hover:bg-rose-500/10 text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="col-span-10 col-start-3">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Briefing
                </label>
                <textarea
                  value={s.briefingTemplate}
                  onChange={(e) => updateSector(i, { briefingTemplate: e.target.value })}
                  className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-xs"
                  rows={2}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Onglet Événements ────────────────────────────────────────────────────

function EventsTab({
  draft,
  setDraft,
}: {
  draft: ExplorationContent;
  setDraft: (d: ExplorationContent) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  const addEvent = () => {
    const next = [...draft.events, emptyEvent()];
    setDraft({ ...draft, events: next });
    setSelectedIdx(next.length - 1);
  };
  const removeEvent = (i: number) => {
    const next = draft.events.filter((_, j) => j !== i);
    setDraft({ ...draft, events: next });
    setSelectedIdx(Math.max(0, selectedIdx - 1));
  };
  const updateEvent = (i: number, patch: Partial<EventEntry>) => {
    const next = draft.events.map((e, j) => (j === i ? { ...e, ...patch } : e));
    setDraft({ ...draft, events: next });
  };
  const updateChoice = (eventIdx: number, choiceIdx: number, patch: Partial<ChoiceEntry>) => {
    const event = draft.events[eventIdx];
    const choices = event.choices.map((c, j) => (j === choiceIdx ? { ...c, ...patch } : c));
    updateEvent(eventIdx, { choices });
  };
  const addChoice = (eventIdx: number) => {
    const event = draft.events[eventIdx];
    updateEvent(eventIdx, { choices: [...event.choices, emptyChoice()] });
  };
  const removeChoice = (eventIdx: number, choiceIdx: number) => {
    const event = draft.events[eventIdx];
    if (event.choices.length <= 2) return; // minimum 2 par schéma Zod
    updateEvent(eventIdx, { choices: event.choices.filter((_, j) => j !== choiceIdx) });
  };

  const selected = draft.events[selectedIdx];

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* Liste à gauche */}
      <div className="col-span-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-muted-foreground">Liste</span>
          <button
            type="button"
            onClick={addEvent}
            className="px-2 py-1 rounded-md bg-primary/15 border border-primary/30 text-primary text-[11px] font-semibold flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Ajouter
          </button>
        </div>
        <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
          {TIERS.map((tier) => (
            <div key={tier}>
              <p
                className={`text-[10px] uppercase tracking-wider font-semibold mb-1 mt-2 px-1 ${TIER_COLOR[tier]}`}
              >
                {TIER_LABEL[tier]}
              </p>
              {draft.events
                .filter((e) => e.tier === tier)
                .map((event) => {
                  const idx = draft.events.indexOf(event);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedIdx(idx)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                        idx === selectedIdx
                          ? 'bg-primary/20 border border-primary/40'
                          : 'hover:bg-white/5 border border-transparent'
                      } ${!event.enabled ? 'opacity-50' : ''}`}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{event.id}</div>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {/* Editor à droite */}
      <div className="col-span-9 space-y-3">
        {selected ? (
          <>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-3">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  ID
                </label>
                <input
                  type="text"
                  value={selected.id}
                  onChange={(e) => updateEvent(selectedIdx, { id: e.target.value })}
                  className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-xs font-mono"
                />
              </div>
              <div className="col-span-5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Titre
                </label>
                <input
                  type="text"
                  value={selected.title}
                  onChange={(e) => updateEvent(selectedIdx, { title: e.target.value })}
                  className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Palier
                </label>
                <select
                  value={selected.tier}
                  onChange={(e) => updateEvent(selectedIdx, { tier: e.target.value as Tier })}
                  className={`w-full border rounded px-2 py-1 text-xs ${TIER_COLOR[selected.tier as Tier]}`}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Poids
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={selected.weight}
                  onChange={(e) =>
                    updateEvent(selectedIdx, { weight: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-xs"
                />
              </div>
              <div className="col-span-1 flex flex-col gap-1 items-end pt-4">
                <button
                  type="button"
                  onClick={() => updateEvent(selectedIdx, { enabled: !selected.enabled })}
                  className="p-1 rounded hover:bg-white/5"
                >
                  {selected.enabled ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeEvent(selectedIdx)}
                  className="p-1 rounded hover:bg-rose-500/10 text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-3">
                <ExpeditionImageSlot
                  slot={`event-${selected.id}`}
                  value={selected.imageRef ?? ''}
                  aspect="16/9"
                  label="Illustration"
                  hint="Hero de l'événement"
                  onChange={(path) => updateEvent(selectedIdx, { imageRef: path || undefined })}
                />
              </div>
              <div className="col-span-9">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Description narrative
                </label>
                <textarea
                  value={selected.description}
                  onChange={(e) => updateEvent(selectedIdx, { description: e.target.value })}
                  className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-sm h-full"
                  rows={5}
                />
              </div>
            </div>

            {/* Choix */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Choix ({selected.choices.length})
                </span>
                {selected.choices.length < 5 && (
                  <button
                    type="button"
                    onClick={() => addChoice(selectedIdx)}
                    className="px-2 py-1 rounded-md bg-primary/15 border border-primary/30 text-primary text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Ajouter
                  </button>
                )}
              </div>
              {selected.choices.map((c, ci) => (
                <ChoiceEditor
                  key={ci}
                  choice={c}
                  onUpdate={(patch) => updateChoice(selectedIdx, ci, patch)}
                  onRemove={() => removeChoice(selectedIdx, ci)}
                  canRemove={selected.choices.length > 2}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground p-8 text-center">
            Aucun événement. Cliquez sur « Ajouter » pour commencer.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Choix éditeur ────────────────────────────────────────────────────────

function ChoiceEditor({
  choice,
  onUpdate,
  onRemove,
  canRemove,
}: {
  choice: ChoiceEntry;
  onUpdate: (patch: Partial<ChoiceEntry>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/30 p-3 space-y-2">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-5">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Libellé
          </label>
          <input
            type="text"
            value={choice.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-xs"
          />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ton</label>
          <select
            value={choice.tone}
            onChange={(e) => onUpdate({ tone: e.target.value as Tone })}
            className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-xs"
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex items-end pb-1">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={choice.hidden}
              onChange={(e) => onUpdate({ hidden: e.target.checked })}
            />
            Caché (???)
          </label>
        </div>
        <div className="col-span-3 flex items-end justify-end pb-1">
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded hover:bg-rose-500/10 text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Requirements */}
      <RequirementsEditor
        requirements={choice.requirements}
        onChange={(reqs) => onUpdate({ requirements: reqs })}
      />

      {/* Outcome */}
      <OutcomeEditor
        outcome={choice.outcome}
        onChange={(o) => onUpdate({ outcome: o })}
        label="Effet (succès)"
      />

      {/* Failure outcome */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          checked={choice.failureOutcome !== undefined}
          onChange={(e) =>
            onUpdate({ failureOutcome: e.target.checked ? emptyOutcome() : undefined })
          }
          id={`fo-${choice.label}`}
        />
        <label htmlFor={`fo-${choice.label}`} className="text-[11px] text-muted-foreground">
          Tentative risquée (effet si requirements non remplies)
        </label>
      </div>
      {choice.failureOutcome && (
        <OutcomeEditor
          outcome={choice.failureOutcome}
          onChange={(o) => onUpdate({ failureOutcome: o })}
          label="Effet (échec — tentative risquée)"
        />
      )}
    </div>
  );
}

// ─── Requirements éditeur ─────────────────────────────────────────────────

function RequirementsEditor({
  requirements,
  onChange,
}: {
  requirements: Requirement[];
  onChange: (reqs: Requirement[]) => void;
}) {
  const addReq = (kind: 'research' | 'shipRole' | 'shipId') => {
    const next: Requirement =
      kind === 'research'
        ? { kind: 'research', researchId: '', minLevel: 1 }
        : kind === 'shipRole'
          ? { kind: 'shipRole', role: '', minCount: 1 }
          : { kind: 'shipId', shipId: '', minCount: 1 };
    onChange([...requirements, next]);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Requirements
        </span>
        <button
          type="button"
          onClick={() => addReq('research')}
          className="text-[10px] px-1.5 py-0.5 rounded border border-border/40 hover:bg-white/5"
        >
          + recherche
        </button>
        <button
          type="button"
          onClick={() => addReq('shipRole')}
          className="text-[10px] px-1.5 py-0.5 rounded border border-border/40 hover:bg-white/5"
        >
          + rôle
        </button>
        <button
          type="button"
          onClick={() => addReq('shipId')}
          className="text-[10px] px-1.5 py-0.5 rounded border border-border/40 hover:bg-white/5"
        >
          + vaisseau
        </button>
      </div>
      {requirements.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center text-xs">
          <span className="col-span-2 text-muted-foreground">{r.kind}</span>
          {r.kind === 'research' && (
            <>
              <input
                type="text"
                value={r.researchId}
                onChange={(e) => {
                  const next = [...requirements];
                  next[i] = { ...r, researchId: e.target.value };
                  onChange(next);
                }}
                placeholder="researchId"
                className="col-span-5 bg-background/60 border border-border/30 rounded px-2 py-1 font-mono"
              />
              <span className="col-span-1">niv.</span>
              <input
                type="number"
                min={1}
                value={r.minLevel}
                onChange={(e) => {
                  const next = [...requirements];
                  next[i] = { ...r, minLevel: parseInt(e.target.value) || 1 };
                  onChange(next);
                }}
                className="col-span-3 bg-background/60 border border-border/30 rounded px-2 py-1"
              />
            </>
          )}
          {r.kind === 'shipRole' && (
            <>
              <input
                type="text"
                value={r.role}
                onChange={(e) => {
                  const next = [...requirements];
                  next[i] = { ...r, role: e.target.value };
                  onChange(next);
                }}
                placeholder="ex: recycler"
                className="col-span-5 bg-background/60 border border-border/30 rounded px-2 py-1 font-mono"
              />
              <span className="col-span-1">×</span>
              <input
                type="number"
                min={1}
                value={r.minCount}
                onChange={(e) => {
                  const next = [...requirements];
                  next[i] = { ...r, minCount: parseInt(e.target.value) || 1 };
                  onChange(next);
                }}
                className="col-span-3 bg-background/60 border border-border/30 rounded px-2 py-1"
              />
            </>
          )}
          {r.kind === 'shipId' && (
            <>
              <input
                type="text"
                value={r.shipId}
                onChange={(e) => {
                  const next = [...requirements];
                  next[i] = { ...r, shipId: e.target.value };
                  onChange(next);
                }}
                placeholder="ex: explorer"
                className="col-span-5 bg-background/60 border border-border/30 rounded px-2 py-1 font-mono"
              />
              <span className="col-span-1">×</span>
              <input
                type="number"
                min={1}
                value={r.minCount}
                onChange={(e) => {
                  const next = [...requirements];
                  next[i] = { ...r, minCount: parseInt(e.target.value) || 1 };
                  onChange(next);
                }}
                className="col-span-3 bg-background/60 border border-border/30 rounded px-2 py-1"
              />
            </>
          )}
          <button
            type="button"
            onClick={() => onChange(requirements.filter((_, j) => j !== i))}
            className="col-span-1 p-1 rounded hover:bg-rose-500/10 text-rose-400 justify-self-end"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Outcome éditeur ──────────────────────────────────────────────────────

function OutcomeEditor({
  outcome,
  onChange,
  label,
}: {
  outcome: Outcome;
  onChange: (o: Outcome) => void;
  label: string;
}) {
  const update = (patch: Partial<Outcome>) => onChange({ ...outcome, ...patch });
  return (
    <div className="space-y-1.5 rounded border border-border/20 bg-background/30 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <NumField
          label="Minerai"
          value={outcome.minerai}
          onChange={(v) => update({ minerai: v })}
        />
        <NumField
          label="Silicium"
          value={outcome.silicium}
          onChange={(v) => update({ silicium: v })}
        />
        <NumField
          label="Hydrogène"
          value={outcome.hydrogene}
          onChange={(v) => update({ hydrogene: v })}
        />
        <NumField
          label="Exilium"
          value={outcome.exilium}
          onChange={(v) => update({ exilium: v })}
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Narration résolution
        </label>
        <textarea
          value={outcome.resolutionText}
          onChange={(e) => update({ resolutionText: e.target.value })}
          rows={2}
          className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground">{label}</label>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-background/60 border border-border/30 rounded px-2 py-1 text-xs tabular-nums"
      />
    </div>
  );
}

// ─── Onglet Missions live ─────────────────────────────────────────────────

function LiveMissionsTab() {
  const [filter, setFilter] = useState<{ status?: string; tier?: string; zombie?: boolean }>({});
  const { data, isLoading, refetch } = trpc.expeditionContent.admin.listMissions.useQuery({
    status: filter.status as any,
    tier: filter.tier as any,
    zombie: filter.zombie,
    limit: 100,
  });
  const expireMutation = trpc.expeditionContent.admin.expireMission.useMutation({
    onSuccess: () => refetch(),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={filter.status ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}
          className="bg-background/60 border border-border/30 rounded px-2 py-1"
        >
          <option value="">Tous statuts</option>
          <option value="available">available</option>
          <option value="engaged">engaged</option>
          <option value="awaiting_decision">awaiting_decision</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
          <option value="expired">expired</option>
        </select>
        <select
          value={filter.tier ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, tier: e.target.value || undefined }))}
          className="bg-background/60 border border-border/30 rounded px-2 py-1"
        >
          <option value="">Tous paliers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input
            type="checkbox"
            checked={filter.zombie ?? false}
            onChange={(e) => setFilter((f) => ({ ...f, zombie: e.target.checked || undefined }))}
          />
          Zombies (awaiting_decision &gt; 7j)
        </label>
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto px-2 py-1 rounded border border-border/30 hover:bg-white/5"
        >
          Rafraîchir
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (data?.missions?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Aucune mission ne correspond aux filtres.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-border/30">
          <table className="w-full text-xs">
            <thead className="bg-card/40 text-muted-foreground">
              <tr>
                <th className="text-left px-2 py-1.5">Joueur</th>
                <th className="text-left px-2 py-1.5">Secteur</th>
                <th className="text-left px-2 py-1.5">Palier</th>
                <th className="text-left px-2 py-1.5">Statut</th>
                <th className="text-left px-2 py-1.5">Étape</th>
                <th className="text-left px-2 py-1.5">Créée</th>
                <th className="text-right px-2 py-1.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data!.missions.map((m) => (
                <tr key={m.id} className="border-t border-border/20 hover:bg-white/[0.02]">
                  <td className="px-2 py-1.5 font-mono text-[10px]">
                    {String(m.userId).slice(0, 8)}…
                  </td>
                  <td className="px-2 py-1.5">{m.sectorName}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${TIER_COLOR[m.tier as Tier]}`}
                    >
                      {TIER_LABEL[m.tier as Tier]}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">{m.status}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {m.currentStep}/{m.totalSteps}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {new Date(m.createdAt as unknown as string).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {(m.status === 'available' ||
                      m.status === 'engaged' ||
                      m.status === 'awaiting_decision') && (
                      <button
                        type="button"
                        onClick={() => expireMutation.mutate({ missionId: m.id })}
                        className="px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-300 text-[10px] hover:bg-rose-500/10"
                      >
                        Expirer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
