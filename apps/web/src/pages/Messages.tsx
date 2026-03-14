import { useState } from 'react';
import { trpc } from '@/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Tab = 'inbox' | 'sent';

export default function Messages() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>('inbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [newMsg, setNewMsg] = useState({ recipientUsername: '', subject: '', body: '' });
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const { data: inbox, isLoading } = trpc.message.inbox.useQuery(
    typeFilter ? { type: typeFilter as any } : undefined,
    { enabled: tab === 'inbox' },
  );

  const { data: sent } = trpc.message.sent.useQuery(
    undefined,
    { enabled: tab === 'sent' },
  );

  const { data: detail } = trpc.message.detail.useQuery(
    { messageId: selectedId! },
    { enabled: !!selectedId && !threadId },
  );

  const { data: thread } = trpc.message.thread.useQuery(
    { threadId: threadId! },
    { enabled: !!threadId },
  );

  const sendMutation = trpc.message.send.useMutation({
    onSuccess: () => {
      utils.message.inbox.invalidate();
      utils.message.sent.invalidate();
      utils.message.unreadCount.invalidate();
      setShowCompose(false);
      setNewMsg({ recipientUsername: '', subject: '', body: '' });
    },
  });

  const replyMutation = trpc.message.reply.useMutation({
    onSuccess: () => {
      utils.message.inbox.invalidate();
      utils.message.sent.invalidate();
      utils.message.thread.invalidate();
      utils.message.unreadCount.invalidate();
      setReplyBody('');
      setShowReply(false);
    },
  });

  const deleteMutation = trpc.message.delete.useMutation({
    onSuccess: () => {
      utils.message.inbox.invalidate();
      utils.message.sent.invalidate();
      utils.message.unreadCount.invalidate();
      setSelectedId(null);
      setThreadId(null);
    },
  });

  if (isLoading && tab === 'inbox') {
    return <div className="p-6 text-muted-foreground">Chargement...</div>;
  }

  const handleSelectMessage = (msgId: string, msgThreadId: string | null) => {
    setShowCompose(false);
    setShowReply(false);
    setReplyBody('');
    if (msgThreadId) {
      setThreadId(msgThreadId);
      setSelectedId(msgId);
    } else {
      setThreadId(null);
      setSelectedId(msgId);
    }
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setSelectedId(null);
    setThreadId(null);
    setShowCompose(false);
    setShowReply(false);
  };

  // Determine which message to reply to (last in thread or selected)
  const replyTargetId = threadId && thread && thread.length > 0
    ? thread[thread.length - 1].id
    : selectedId;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Button size="sm" onClick={() => { setShowCompose(!showCompose); setSelectedId(null); setThreadId(null); }}>
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

      {/* Tab selector */}
      <div className="flex gap-2">
        <Button
          variant={tab === 'inbox' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleTabChange('inbox')}
        >
          Réception
        </Button>
        <Button
          variant={tab === 'sent' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleTabChange('sent')}
        >
          Envoyés
        </Button>
      </div>

      {/* Type filter (inbox only) */}
      {tab === 'inbox' && (
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'Tous', value: undefined },
            { label: 'Système', value: 'system' },
            { label: 'Joueur', value: 'player' },
            { label: 'Combat', value: 'combat' },
            { label: 'Espionnage', value: 'espionage' },
            { label: 'Colonisation', value: 'colonization' },
            { label: 'Alliance', value: 'alliance' },
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
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        {/* Message list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tab === 'inbox' ? 'Boîte de réception' : 'Messages envoyés'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {tab === 'inbox' && (
              !inbox || inbox.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun message.</p>
              ) : (
                inbox.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg.id, msg.threadId)}
                    className={`w-full text-left rounded px-3 py-2 text-sm transition-colors ${
                      selectedId === msg.id || threadId === msg.threadId ? 'bg-primary/10' : 'hover:bg-accent'
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
              )
            )}
            {tab === 'sent' && (
              !sent || sent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun message envoyé.</p>
              ) : (
                sent.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg.id, msg.threadId)}
                    className={`w-full text-left rounded px-3 py-2 text-sm transition-colors ${
                      selectedId === msg.id || threadId === msg.threadId ? 'bg-primary/10' : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="truncate">{msg.subject}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant={msg.read ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                          {msg.read ? 'Lu' : 'Non lu'}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(msg.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      À : {msg.recipientUsername ?? '?'}
                    </div>
                  </button>
                ))
              )
            )}
          </CardContent>
        </Card>

        {/* Detail / Thread panel */}
        {threadId && thread && thread.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {thread[0].subject}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setThreadId(null); setSelectedId(null); }}
                >
                  Fermer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {thread.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded border border-border p-3 space-y-1"
                >
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>De : {msg.senderUsername ?? 'Système'}</span>
                    <span>{new Date(msg.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                </div>
              ))}

              {/* Reply form (only for player messages) */}
              {thread[0].type === 'player' && (
                showReply ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      rows={3}
                      placeholder="Votre réponse..."
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                    />
                    {replyMutation.error && (
                      <p className="text-sm text-destructive">{replyMutation.error.message}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (replyTargetId) {
                            replyMutation.mutate({ messageId: replyTargetId, body: replyBody });
                          }
                        }}
                        disabled={replyMutation.isPending || !replyBody.trim()}
                      >
                        Envoyer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowReply(false); setReplyBody(''); }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowReply(true)}
                  >
                    Répondre
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        ) : selectedId && detail ? (
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
            <CardContent className="space-y-3">
              <p className="text-sm whitespace-pre-wrap">{detail.body}</p>

              {/* Reply button (only for player messages) */}
              {detail.type === 'player' && (
                showReply ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      rows={3}
                      placeholder="Votre réponse..."
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                    />
                    {replyMutation.error && (
                      <p className="text-sm text-destructive">{replyMutation.error.message}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => replyMutation.mutate({ messageId: selectedId, body: replyBody })}
                        disabled={replyMutation.isPending || !replyBody.trim()}
                      >
                        Envoyer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowReply(false); setReplyBody(''); }}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowReply(true)}
                  >
                    Répondre
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
