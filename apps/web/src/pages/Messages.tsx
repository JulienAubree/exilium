import { useState } from 'react';
import { trpc } from '@/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Messages() {
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [newMsg, setNewMsg] = useState({ recipientUsername: '', subject: '', body: '' });
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const { data: inbox, isLoading } = trpc.message.inbox.useQuery(
    typeFilter ? { type: typeFilter as any } : undefined,
  );
  const { data: detail } = trpc.message.detail.useQuery(
    { messageId: selectedId! },
    { enabled: !!selectedId },
  );

  const sendMutation = trpc.message.send.useMutation({
    onSuccess: () => {
      utils.message.inbox.invalidate();
      utils.message.unreadCount.invalidate();
      setShowCompose(false);
      setNewMsg({ recipientUsername: '', subject: '', body: '' });
    },
  });

  const deleteMutation = trpc.message.delete.useMutation({
    onSuccess: () => {
      utils.message.inbox.invalidate();
      utils.message.unreadCount.invalidate();
      setSelectedId(null);
    },
  });

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Button size="sm" onClick={() => { setShowCompose(!showCompose); setSelectedId(null); }}>
          {showCompose ? 'Annuler' : 'Nouveau message'}
        </Button>
      </div>

      {showCompose && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouveau message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Destinataire</label>
              <Input
                value={newMsg.recipientUsername}
                onChange={(e) => setNewMsg({ ...newMsg, recipientUsername: e.target.value })}
                placeholder="Nom du joueur"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sujet</label>
              <Input
                value={newMsg.subject}
                onChange={(e) => setNewMsg({ ...newMsg, subject: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Message</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={4}
                value={newMsg.body}
                onChange={(e) => setNewMsg({ ...newMsg, body: e.target.value })}
              />
            </div>
            {sendMutation.error && (
              <p className="text-sm text-destructive">{sendMutation.error.message}</p>
            )}
            <Button
              onClick={() => sendMutation.mutate(newMsg)}
              disabled={sendMutation.isPending || !newMsg.recipientUsername || !newMsg.subject || !newMsg.body}
            >
              Envoyer
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Tous', value: undefined },
          { label: 'Système', value: 'system' },
          { label: 'Joueur', value: 'player' },
          { label: 'Combat', value: 'combat' },
          { label: 'Espionnage', value: 'espionage' },
          { label: 'Colonisation', value: 'colonization' },
        ].map(({ label, value }) => (
          <Button
            key={label}
            variant={typeFilter === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        {/* Inbox list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Boîte de réception</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {!inbox || inbox.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun message.</p>
            ) : (
              inbox.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => { setSelectedId(msg.id); setShowCompose(false); }}
                  className={`w-full text-left rounded px-3 py-2 text-sm transition-colors ${
                    selectedId === msg.id ? 'bg-primary/10' : 'hover:bg-accent'
                  } ${!msg.read ? 'font-bold' : ''}`}
                >
                  <div className="flex justify-between">
                    <span className="truncate">{msg.subject}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(msg.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {msg.senderUsername ?? 'Système'}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        {selectedId && detail && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{detail.subject}</CardTitle>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate({ messageId: selectedId })}
                  disabled={deleteMutation.isPending}
                >
                  Supprimer
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                De : {detail.senderUsername ?? 'Système'} — {new Date(detail.createdAt).toLocaleString('fr-FR')}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{detail.body}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
