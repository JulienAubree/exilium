import { useState, useEffect } from 'react';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TablePageSkeleton } from '@/components/common/PageSkeleton';
import { PageHeader } from '@/components/common/PageHeader';

type Tab = 'inbox' | 'sent';

const TYPE_FILTERS = [
  { label: 'Tous', value: undefined },
  { label: 'Système', value: 'system' },
  { label: 'Joueur', value: 'player' },
  { label: 'Combat', value: 'combat' },
  { label: 'Espionnage', value: 'espionage' },
  { label: 'Colonisation', value: 'colonization' },
  { label: 'Alliance', value: 'alliance' },
] as const;

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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
      setDeleteConfirm(null);
    },
  });

  useEffect(() => {
    if (detail) {
      utils.message.unreadCount.invalidate();
      utils.message.inbox.invalidate();
    }
  }, [detail?.id]);

  useEffect(() => {
    if (thread && thread.length > 0) {
      utils.message.unreadCount.invalidate();
      utils.message.inbox.invalidate();
    }
  }, [thread]);

  if (isLoading && tab === 'inbox') {
    return <TablePageSkeleton />;
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

  const replyTargetId = threadId && thread && thread.length > 0
    ? thread[thread.length - 1].id
    : selectedId;

  /* ---- Shared sub-components ---- */

  const typeFilterPills = tab === 'inbox' && (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {TYPE_FILTERS.map(({ label, value }) => (
        <button
          key={label}
          onClick={() => setTypeFilter(value)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors ${
            typeFilter === value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const messageList = (
    <section className="glass-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">
        {tab === 'inbox' ? 'Boîte de réception' : 'Messages envoyés'}
      </h2>
      <div className="space-y-1">
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
      </div>
    </section>
  );

  const replyForm = (
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
  );

  const detailPanel = (
    <>
      {threadId && thread && thread.length > 0 ? (
        <section className="glass-card p-4 hidden lg:block">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              {thread[0].subject}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setThreadId(null); setSelectedId(null); }}
            >
              Fermer
            </Button>
          </div>
          <div className="space-y-4">
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

            {thread[0].type === 'player' && (
              showReply ? replyForm : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowReply(true)}
                >
                  Répondre
                </Button>
              )
            )}
          </div>
        </section>
      ) : selectedId && detail ? (
        <section className="glass-card p-4 hidden lg:block">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-foreground">{detail.subject}</h2>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteConfirm(selectedId)}
              disabled={deleteMutation.isPending}
            >
              Supprimer
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            De : {detail.senderUsername ?? 'Système'} — {new Date(detail.createdAt).toLocaleString('fr-FR')}
          </div>
          <div className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{detail.body}</p>

            {detail.type === 'player' && (
              showReply ? replyForm : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowReply(true)}
                >
                  Répondre
                </Button>
              )
            )}
          </div>
        </section>
      ) : null}
    </>
  );

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader
        title="Messages"
        actions={
          <Button size="sm" onClick={() => { setShowCompose(!showCompose); setSelectedId(null); setThreadId(null); }}>
            {showCompose ? 'Annuler' : 'Nouveau message'}
          </Button>
        }
      />

      {/* Compose form */}
      {showCompose && (
        <section className="glass-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Nouveau message</h2>
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
        </section>
      )}

      {/* Tab pills - hidden on xl where sidebar takes over */}
      <div className="flex gap-2 xl:hidden">
        <button
          onClick={() => handleTabChange('inbox')}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
            tab === 'inbox'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          Réception
        </button>
        <button
          onClick={() => handleTabChange('sent')}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
            tab === 'sent'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          Envoyés
        </button>
      </div>

      {/* Type filter pills - hidden on xl where sidebar has them */}
      <div className="xl:hidden">
        {typeFilterPills}
      </div>

      {/* Main layout: mobile=stack, md=2col, xl=3col with sidebar */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-[1fr_1fr] xl:grid-cols-[200px_1fr_1.5fr]">
        {/* xl: mailbox sidebar */}
        <div className="hidden xl:block">
          <nav className="glass-card p-3 space-y-1">
            <button
              onClick={() => handleTabChange('inbox')}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                tab === 'inbox' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              Réception
            </button>
            <button
              onClick={() => handleTabChange('sent')}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                tab === 'sent' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              Envoyés
            </button>
            {tab === 'inbox' && (
              <div className="border-t border-border pt-2 mt-2 space-y-1">
                {TYPE_FILTERS.map(({ label, value }) => (
                  <button
                    key={label}
                    onClick={() => setTypeFilter(value)}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                      typeFilter === value ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </nav>
        </div>

        {/* Message list */}
        {messageList}

        {/* Detail / Thread panel (lg+ desktop) */}
        {detailPanel}
      </div>

      {/* Mobile/tablet detail overlay (below lg) */}
      {(selectedId || threadId) && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background/95 overflow-y-auto p-4 animate-slide-up">
          <Button
            variant="outline"
            size="sm"
            className="mb-4"
            onClick={() => { setSelectedId(null); setThreadId(null); setShowReply(false); }}
          >
            ← Retour
          </Button>
          {threadId && thread && thread.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{thread[0].subject}</h2>
              {thread.map((msg) => (
                <div key={msg.id} className="rounded border border-border p-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>De : {msg.senderUsername ?? 'Système'}</span>
                    <span>{new Date(msg.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                </div>
              ))}
              {thread[0].type === 'player' && (
                showReply ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      rows={3}
                      placeholder="Votre réponse..."
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { if (replyTargetId) replyMutation.mutate({ messageId: replyTargetId, body: replyBody }); }} disabled={replyMutation.isPending || !replyBody.trim()}>Envoyer</Button>
                      <Button variant="outline" size="sm" onClick={() => { setShowReply(false); setReplyBody(''); }}>Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setShowReply(true)}>Répondre</Button>
                )
              )}
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{detail.subject}</h2>
                <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(selectedId)}>Supprimer</Button>
              </div>
              <div className="text-xs text-muted-foreground">
                De : {detail.senderUsername ?? 'Système'} — {new Date(detail.createdAt).toLocaleString('fr-FR')}
              </div>
              <p className="text-sm whitespace-pre-wrap">{detail.body}</p>
              {detail.type === 'player' && (
                showReply ? (
                  <div className="space-y-2">
                    <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Votre réponse..." />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => replyMutation.mutate({ messageId: selectedId!, body: replyBody })} disabled={replyMutation.isPending || !replyBody.trim()}>Envoyer</Button>
                      <Button variant="outline" size="sm" onClick={() => { setShowReply(false); setReplyBody(''); }}>Annuler</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setShowReply(true)}>Répondre</Button>
                )
              )}
            </div>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onConfirm={() => { if (deleteConfirm) deleteMutation.mutate({ messageId: deleteConfirm }); }}
        onCancel={() => setDeleteConfirm(null)}
        title="Supprimer ce message ?"
        description="Cette action est irréversible."
        variant="destructive"
        confirmLabel="Supprimer"
      />
    </div>
  );
}
