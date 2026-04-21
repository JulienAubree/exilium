import { Link } from 'react-router';

interface Visibility {
  bio: boolean;
  playstyle: boolean;
  stats: boolean;
}

interface ProfilePreferencesCardProps {
  seekingAlliance: boolean;
  visibility: Visibility;
  onChange: (patch: {
    seekingAlliance?: boolean;
    profileVisibility?: Visibility;
  }) => void;
  isSaving?: boolean;
}

function Toggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function ProfilePreferencesCard({
  seekingAlliance,
  visibility,
  onChange,
  isSaving,
}: ProfilePreferencesCardProps) {
  return (
    <div className="glass-card p-4 space-y-4">
      <h3 className="text-sm font-semibold">Préférences</h3>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">Je cherche une alliance</span>
        <Toggle
          checked={seekingAlliance}
          onChange={() => onChange({ seekingAlliance: !seekingAlliance })}
          disabled={isSaving}
          ariaLabel="Je cherche une alliance"
        />
      </div>

      <div className="space-y-2 pt-3 border-t border-border/50">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visibilité du profil</h4>
        <p className="text-xs text-muted-foreground">Choisissez ce que les autres joueurs peuvent voir.</p>
        <div className="space-y-2">
          {([
            { key: 'bio' as const, label: 'Bio' },
            { key: 'playstyle' as const, label: 'Style de jeu' },
            { key: 'stats' as const, label: 'Statistiques' },
          ]).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={visibility[key]}
                disabled={isSaving}
                onChange={(e) =>
                  onChange({ profileVisibility: { ...visibility, [key]: e.target.checked } })
                }
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-border/50">
        <Link
          to="/settings/notifications"
          className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Préférences de notification →
        </Link>
      </div>
    </div>
  );
}
