import { useState } from 'react';
import { Link } from 'react-router';
import { trpc } from '@/trpc';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/common/Skeleton';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'text-emerald-400' },
  in_mission: { label: 'En mission', color: 'text-blue-400' },
  incapacitated: { label: 'Incapacit\u00e9', color: 'text-red-400' },
};

const DRIVE_LABELS: Record<string, string> = {
  combustion: 'Combustion',
  impulsion: 'Impulsion',
  hyperespace: 'Hyperespace',
};

function FlagshipSkeleton() {
  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
        <div className="space-y-4">
          <div className="glass-card p-4 flex flex-col items-center gap-3">
            <Skeleton className="h-32 w-32 rounded-lg" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <Skeleton className="h-5 w-20" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FlagshipProfile() {
  const utils = trpc.useUtils();
  const { data: flagship, isLoading } = trpc.flagship.get.useQuery();
  const { data: flagshipImages } = trpc.flagship.listImages.useQuery();

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const renameMutation = trpc.flagship.rename.useMutation({
    onSuccess: () => {
      utils.flagship.get.invalidate();
      setEditingName(false);
    },
  });

  const imageMutation = trpc.flagship.updateImage.useMutation({
    onSuccess: () => {
      utils.flagship.get.invalidate();
    },
  });

  if (isLoading) return <FlagshipSkeleton />;

  if (!flagship) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Vaisseau amiral" />
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">Vous n'avez pas encore de vaisseau amiral.</p>
        </div>
      </div>
    );
  }

  const status = STATUS_LABELS[flagship.status] ?? { label: flagship.status, color: 'text-muted-foreground' };
  const effectiveStats = 'effectiveStats' in flagship ? (flagship as any).effectiveStats : null;
  const talentBonuses = 'talentBonuses' in flagship ? (flagship as any).talentBonuses as Record<string, number> : {};

  const driveType = effectiveStats?.driveType ?? flagship.driveType;

  function startEditName() {
    setName(flagship!.name);
    setDescription(flagship!.description);
    setEditingName(true);
  }

  function handleRename() {
    if (name.length < 2 || name.length > 32) return;
    renameMutation.mutate({ name, description: description || undefined });
  }

  function handleImageSelect(imageId: string) {
    imageMutation.mutate({ imageId });
    setShowImagePicker(false);
  }

  const stats = [
    { label: 'Armes', base: flagship.weapons, bonus: talentBonuses.weapons, value: effectiveStats?.weapons ?? flagship.weapons },
    { label: 'Bouclier', base: flagship.shield, bonus: talentBonuses.shield, value: effectiveStats?.shield ?? flagship.shield },
    { label: 'Coque', base: flagship.hull, bonus: talentBonuses.hull, value: effectiveStats?.hull ?? flagship.hull },
    { label: 'Blindage', base: flagship.baseArmor, bonus: talentBonuses.baseArmor, value: effectiveStats?.baseArmor ?? flagship.baseArmor },
    { label: 'Tirs', base: flagship.shotCount, bonus: talentBonuses.shotCount, value: effectiveStats?.shotCount ?? flagship.shotCount },
    { label: 'Cargo', base: flagship.cargoCapacity, bonus: talentBonuses.cargoCapacity, value: effectiveStats?.cargoCapacity ?? flagship.cargoCapacity },
    { label: 'Vitesse', base: flagship.baseSpeed, bonus: talentBonuses.speedPercent ? Math.round(flagship.baseSpeed * talentBonuses.speedPercent) : undefined, value: effectiveStats?.baseSpeed ?? flagship.baseSpeed },
    { label: 'Carburant', base: flagship.fuelConsumption, bonus: talentBonuses.fuelConsumption, value: effectiveStats?.fuelConsumption ?? flagship.fuelConsumption },
    { label: 'Propulsion', value: DRIVE_LABELS[driveType] ?? driveType },
  ];

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Vaisseau amiral" />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
        {/* ===== Left column — Identity ===== */}
        <div className="space-y-4">
          {/* Image + Name */}
          <div className="glass-card p-4 flex flex-col items-center gap-3">
            <div className="relative">
              {flagship.imageId ? (
                <img
                  src={`/assets/flagships/${flagship.imageId}.webp`}
                  alt={flagship.name}
                  className="h-32 w-32 rounded-lg object-cover border-2 border-white/10"
                />
              ) : (
                <div className="h-32 w-32 rounded-lg bg-primary/20 flex items-center justify-center text-4xl font-bold text-primary border-2 border-white/10">
                  VA
                </div>
              )}
            </div>
            {flagshipImages && flagshipImages.length > 0 && (
              <button
                onClick={() => setShowImagePicker(true)}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Changer l'image
              </button>
            )}

            {editingName ? (
              <div className="w-full space-y-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={32}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-center"
                  autoFocus
                />
                <div className="text-right text-xs text-muted-foreground">{name.length}/32</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={256}
                  rows={2}
                  placeholder="Description (optionnel)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                />
                <div className="text-right text-xs text-muted-foreground">{description.length}/256</div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingName(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleRename}
                    disabled={name.length < 2 || renameMutation.isPending}
                    className="text-xs text-primary hover:text-primary/80 disabled:opacity-50"
                  >
                    {renameMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-center">{flagship.name}</h2>
                {flagship.description && (
                  <p className="text-xs text-muted-foreground text-center">{flagship.description}</p>
                )}
                <button
                  onClick={startEditName}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Renommer
                </button>
              </>
            )}

            <span className={`inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold ${status.color}`}>
              {status.label}
            </span>
          </div>

          {/* Talents link */}
          <Link
            to="/flagship/talents"
            className="glass-card p-4 flex items-center justify-between hover:bg-accent/50 transition-colors group"
          >
            <div>
              <h3 className="text-sm font-semibold">Arbre de talents</h3>
              <p className="text-xs text-muted-foreground">G\u00e9rer les talents du vaisseau</p>
            </div>
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">&rarr;</span>
          </Link>
        </div>

        {/* ===== Right column — Stats ===== */}
        <div className="space-y-4">
          {/* Stats grid */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Statistiques</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg bg-accent/50 p-3 text-center">
                  <div className="text-lg font-bold text-primary">
                    {typeof stat.value === 'number' ? stat.value.toLocaleString('fr-FR') : stat.value}
                  </div>
                  {stat.bonus != null && stat.bonus !== 0 && typeof stat.bonus === 'number' && (
                    <div className="text-[10px] text-emerald-400">
                      {stat.base?.toLocaleString('fr-FR')} {stat.bonus > 0 ? '+' : ''}{stat.bonus.toLocaleString('fr-FR')}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Repair info */}
          {flagship.status === 'incapacitated' && flagship.repairEndsAt && (
            <div className="glass-card p-4 border border-red-500/30">
              <h3 className="text-sm font-semibold text-red-400">En r\u00e9paration</h3>
              <p className="text-xs text-muted-foreground mt-1">
                R\u00e9paration automatique : {new Date(flagship.repairEndsAt).toLocaleString('fr-FR')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Image picker modal */}
      {showImagePicker && flagshipImages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowImagePicker(false)}>
          <div className="glass-card max-w-lg w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Choisir une image</h3>
            {flagshipImages.length === 0 ? (
              <div className="text-muted-foreground text-sm">Aucune image disponible</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                {flagshipImages.map(id => (
                  <button
                    key={id}
                    onClick={() => handleImageSelect(id)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                      id === flagship!.imageId ? 'border-primary ring-2 ring-primary/50' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <img src={`/assets/flagships/${id}.webp`} alt={id} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowImagePicker(false)} className="text-sm text-muted-foreground hover:text-foreground">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
