import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { usePlanetStore } from '@/stores/planet.store';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { ProfileIcon, HistoryIcon } from '@/lib/icons';

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const clearActivePlanet = usePlanetStore((s) => s.clearActivePlanet);

  useOutsideClick(ref, open, () => setOpen(false));

  const handleLogout = () => {
    clearActivePlanet();
    clearAuth();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors lg:pr-3',
          open ? 'bg-accent' : 'hover:bg-accent',
        )}
      >
        {user?.avatarId ? (
          <img
            src={`/assets/avatars/${user.avatarId}-icon.webp`}
            alt={user.username}
            className={cn('h-8 w-8 rounded-full object-cover', open && 'ring-2 ring-primary')}
          />
        ) : (
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-xs font-bold text-white',
              open && 'ring-2 ring-primary',
            )}
          >
            {user?.username?.slice(0, 2).toUpperCase() ?? '??'}
          </div>
        )}
        <span className="hidden text-sm font-medium lg:inline">{user?.username ?? ''}</span>
        <ChevronDown className="hidden h-3 w-3 text-muted-foreground lg:block" />
      </button>

      {open && (
        <div className="fixed right-2 top-12 z-50 mt-1 w-48 sm:absolute sm:top-full sm:right-0 rounded-lg border border-white/10 bg-card/95 backdrop-blur-lg shadow-lg animate-slide-up">
          <div className="p-1.5">
            <button
              onClick={() => { navigate('/profile'); setOpen(false); }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ProfileIcon width={16} height={16} />
              Profil
            </button>
            <button
              onClick={() => { navigate('/profile?tab=notifications'); setOpen(false); }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              Notifications
            </button>
            <button
              onClick={() => { navigate('/history'); setOpen(false); }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <HistoryIcon width={16} height={16} />
              Historique
            </button>
          </div>
          <div className="mx-2 border-t border-white/5" />
          <div className="p-1.5">
            <button
              onClick={() => { setOpen(false); handleLogout(); }}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
