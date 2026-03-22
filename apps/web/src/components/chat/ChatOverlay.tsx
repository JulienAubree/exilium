import { useLocation } from 'react-router';
import { useChatStore } from '@/stores/chat.store';
import { UserAvatar } from './UserAvatar';
import { ChatOverlayWindow } from './ChatOverlayWindow';

export function ChatOverlay() {
  const { pathname } = useLocation();
  const { windows, expandChat, closeChat } = useChatStore();

  // Hide on /messages page (page takes over) and on mobile (lg:flex)
  if (pathname === '/messages') return null;

  const expanded = windows.filter((w) => !w.minimized);
  const minimized = windows.filter((w) => w.minimized);

  return (
    <div className="hidden lg:flex fixed bottom-0 right-4 z-30 items-end gap-2">
      {/* Expanded windows */}
      {expanded.map((w) => (
        <ChatOverlayWindow
          key={w.userId}
          userId={w.userId}
          username={w.username}
          threadId={w.threadId}
        />
      ))}

      {/* Minimized bubbles */}
      {minimized.map((w) => (
        <div key={w.userId} className="relative mb-2">
          <button
            onClick={() => expandChat(w.userId)}
            title={w.username}
          >
            <UserAvatar username={w.username} size="lg" className="shadow-lg cursor-pointer hover:scale-105 transition-transform" />
          </button>
          <button
            onClick={() => closeChat(w.userId)}
            aria-label={`Fermer ${w.username}`}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
