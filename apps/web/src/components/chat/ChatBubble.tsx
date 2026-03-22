import { UserAvatar } from './UserAvatar';

interface ChatBubbleProps {
  body: string;
  isSent: boolean;
  senderUsername?: string;
  createdAt: Date | string;
}

export function ChatBubble({ body, isSent, senderUsername, createdAt }: ChatBubbleProps) {
  const time = new Date(createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (isSent) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground text-sm">
          <p className="whitespace-pre-wrap break-words">{body}</p>
          <div className="text-[10px] opacity-60 text-right mt-0.5">{time}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-end max-w-[75%]">
      {senderUsername && <UserAvatar username={senderUsername} size="sm" />}
      <div className="rounded-xl rounded-bl-sm bg-muted/50 px-3 py-2 text-foreground text-sm">
        <p className="whitespace-pre-wrap break-words">{body}</p>
        <div className="text-[10px] text-muted-foreground mt-0.5">{time}</div>
      </div>
    </div>
  );
}
