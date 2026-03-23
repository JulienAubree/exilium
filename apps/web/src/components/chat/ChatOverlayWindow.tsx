import { useEffect } from 'react';
import { trpc } from '@/trpc';
import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { UserAvatar } from './UserAvatar';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';

interface ChatOverlayWindowProps {
  userId: string;
  username: string;
  threadId: string | null;
}

export function ChatOverlayWindow({ userId: otherUserId, username, threadId }: ChatOverlayWindowProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { closeChat, minimizeChat, setThreadId } = useChatStore();
  const utils = trpc.useUtils();

  // Resolve threadId from conversations when not provided
  const { data: conversations } = trpc.message.conversations.useQuery(undefined, {
    enabled: !threadId,
  });

  useEffect(() => {
    if (threadId || !conversations) return;
    const conv = conversations.find((c) => c?.otherUser.id === otherUserId);
    if (conv?.threadId) {
      setThreadId(otherUserId, conv.threadId);
    }
  }, [threadId, conversations, otherUserId, setThreadId]);

  const { data: thread } = trpc.message.thread.useQuery(
    { threadId: threadId! },
    { enabled: !!threadId },
  );

  const replyMutation = trpc.message.reply.useMutation({
    onSuccess: () => {
      utils.message.thread.invalidate({ threadId: threadId! });
      utils.message.conversations.invalidate();
      utils.message.unreadCount.invalidate();
    },
  });

  const sendMutation = trpc.message.send.useMutation({
    onSuccess: (msg) => {
      if (msg.threadId) {
        setThreadId(otherUserId, msg.threadId);
        utils.message.thread.invalidate({ threadId: msg.threadId });
      }
      utils.message.conversations.invalidate();
      utils.message.unreadCount.invalidate();
    },
  });

  const handleSend = (body: string) => {
    if (thread && thread.length > 0) {
      replyMutation.mutate({ messageId: thread[thread.length - 1].id, body });
    } else {
      sendMutation.mutate({ recipientUsername: username, body });
    }
  };

  return (
    <div className="w-[300px] h-[400px] flex flex-col rounded-t-xl overflow-hidden border border-border/30 bg-card shadow-xl">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-primary/20 cursor-pointer"
        onClick={() => minimizeChat(otherUserId)}
      >
        <UserAvatar username={username} size="sm" />
        <span className="text-sm font-semibold text-foreground flex-1 truncate">{username}</span>
        <button
          onClick={(e) => { e.stopPropagation(); minimizeChat(otherUserId); }}
          aria-label="Réduire"
          className="text-muted-foreground hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); closeChat(otherUserId); }}
          aria-label="Fermer"
          className="text-muted-foreground hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Messages */}
      {thread && currentUserId ? (
        <ChatMessageList messages={thread} currentUserId={currentUserId} className="flex-1" />
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Début de conversation
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={replyMutation.isPending || sendMutation.isPending}
        placeholder="Aa"
      />
    </div>
  );
}
