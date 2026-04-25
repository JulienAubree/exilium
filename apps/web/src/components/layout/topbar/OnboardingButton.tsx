import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Star } from 'lucide-react';
import { trpc } from '@/trpc';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon } from '@/components/common/ResourceIcons';

interface Props {
  showNamingModal: () => void;
}

export function OnboardingButton({ showNamingModal }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, open, () => setOpen(false));

  const { data: tutorialData } = trpc.tutorial.getCurrent.useQuery();
  if (!tutorialData || tutorialData.isComplete) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground touch-feedback hover:bg-accent"
      >
        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
        {tutorialData.chapter && (
          <span className="text-sm font-medium tabular-nums text-amber-400">
            {tutorialData.chapter.completedInChapter}/{tutorialData.chapter.questCount}
          </span>
        )}
        {tutorialData.pendingCompletion && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
        )}
      </button>

      {open && <OnboardingDropdown data={tutorialData} onClose={() => setOpen(false)} showNamingModal={showNamingModal} />}
    </div>
  );
}

function OnboardingDropdown({ data, onClose, showNamingModal }: {
  data: any;
  onClose: () => void;
  showNamingModal: () => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [introSeen, setIntroSeen] = useState(false);

  const completeQuest = trpc.tutorial.completeQuest.useMutation({
    onSuccess: () => {
      utils.tutorial.getCurrent.invalidate();
      utils.resource.production.invalidate();
      utils.planet.empire.invalidate();
    },
  });

  const quest = data.quest;
  const chapter = data.chapter;
  if (!quest && !chapter) return null;

  const chapterNumber = chapter ? chapter.id.replace('chapter_', '') : '?';
  const completedInChapter = chapter?.completedInChapter ?? 0;
  const questCount = chapter?.questCount ?? 0;
  const chapterProgressPercent = questCount > 0 ? (completedInChapter / questCount) * 100 : 0;

  const isChapterIntro = chapter && completedInChapter === 0 && !data.pendingCompletion && quest && !introSeen;

  let journalEntry = data.journalEntry ?? '';
  if (data.playerCoords) {
    journalEntry = journalEntry
      .replace(/\{galaxy\}/g, String(data.playerCoords.galaxy))
      .replace(/\{system\}/g, String(data.playerCoords.system));
  }

  const currentProgress = data.currentProgress;
  const targetValue = data.targetValue;
  const objectiveLabel = data.objectiveLabel ?? quest?.objectiveLabel;
  const progressPercent = targetValue > 0 ? Math.min((currentProgress / targetValue) * 100, 100) : 0;
  const isPending = data.pendingCompletion;

  const getActionLink = (): { label: string; action: () => void } | null => {
    if (!quest || isPending) return null;
    if (quest.id === 'quest_11') return null;
    if (quest.id === 'quest_12' && data.playerCoords) {
      const { galaxy, system } = data.playerCoords;
      return { label: 'Envoyer la flotte \u2192', action: () => { navigate(`/fleet/send?galaxy=${galaxy}&system=${system}&position=8&mission=transport`); onClose(); } };
    }
    if (quest.id === 'quest_17' && data.playerCoords && data.tutorialMiningMissionId) {
      const { galaxy, system } = data.playerCoords;
      return { label: 'Envoyer la flotte \u2192', action: () => { navigate(`/fleet/send?galaxy=${galaxy}&system=${system}&position=8&mission=mine&pveMissionId=${data.tutorialMiningMissionId}`); onClose(); } };
    }
    const { condition } = quest;
    switch (condition.type) {
      case 'building_level': return { label: 'Aller aux Batiments \u2192', action: () => { navigate('/buildings'); onClose(); } };
      case 'research_level': return { label: 'Aller a la Recherche \u2192', action: () => { navigate('/research'); onClose(); } };
      case 'ship_count':
        if (condition.targetId === 'interceptor') return { label: 'Aller au Centre de commandement \u2192', action: () => { navigate('/command-center'); onClose(); } };
        return { label: 'Aller au Chantier \u2192', action: () => { navigate('/shipyard'); onClose(); } };
      case 'defense_count': return { label: 'Aller aux Défenses \u2192', action: () => { navigate('/defense'); onClose(); } };
      case 'mission_complete': return { label: 'Aller aux Missions \u2192', action: () => { navigate('/missions'); onClose(); } };
      default: return null;
    }
  };

  const actionLink = getActionLink();
  const reward = quest?.reward;

  return (
    <div className="fixed right-2 left-2 top-12 z-50 mt-1 sm:absolute sm:left-auto sm:top-full sm:right-0 sm:w-80 rounded-md border border-amber-500/30 bg-card/95 backdrop-blur-lg shadow-lg animate-slide-up">
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">{'\u2605'}</span>
          <span className="text-xs font-semibold text-amber-400">
            Chapitre {chapterNumber} : {chapter?.title}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{completedInChapter}/{questCount}</span>
      </div>

      <div className="px-3 pt-2">
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${chapterProgressPercent}%` }} />
        </div>
      </div>

      {isChapterIntro && chapter ? (
        <div className="p-3">
          <p className="border-l-2 border-amber-500/30 pl-3 text-[11px] italic leading-relaxed text-muted-foreground">
            {chapter.journalIntro}
          </p>
          <button
            onClick={() => setIntroSeen(true)}
            className="mt-3 w-full rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/30"
          >
            Commencer
          </button>
        </div>
      ) : quest ? (
        <div className="p-3 space-y-2">
          {journalEntry && (
            <p className="border-l-2 border-amber-500/30 pl-3 text-[11px] italic leading-relaxed text-muted-foreground">
              {journalEntry}
            </p>
          )}

          <div className="rounded-md bg-background/50 px-2.5 py-2">
            <p className="text-[11px] font-medium text-foreground">{objectiveLabel}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isPending ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground">{currentProgress}/{targetValue}</span>
            </div>
          </div>

          {reward && (
            <div className="flex items-center gap-3 rounded bg-background/50 px-2 py-1.5">
              <span className="text-[10px] text-muted-foreground">Recompense :</span>
              <div className="flex items-center gap-2 text-[10px]">
                {reward.minerai > 0 && <span className="flex items-center gap-0.5 text-minerai"><MineraiIcon size={10} />{reward.minerai.toLocaleString()}</span>}
                {reward.silicium > 0 && <span className="flex items-center gap-0.5 text-silicium"><SiliciumIcon size={10} />{reward.silicium.toLocaleString()}</span>}
                {reward.hydrogene > 0 && <span className="flex items-center gap-0.5 text-hydrogene"><HydrogeneIcon size={10} />{reward.hydrogene.toLocaleString()}</span>}
              </div>
            </div>
          )}

          {isPending ? (
            <button
              onClick={() => completeQuest.mutate()}
              disabled={completeQuest.isPending}
              className="w-full rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
            >
              {completeQuest.isPending ? '...' : 'Suivant \u2192'}
            </button>
          ) : (
            <>
              {actionLink && (
                <button
                  onClick={actionLink.action}
                  className="text-[11px] font-medium text-amber-400 underline underline-offset-2 transition-colors hover:text-amber-300"
                >
                  {actionLink.label}
                </button>
              )}
              {quest.id === 'quest_11' && (
                <button
                  onClick={() => { showNamingModal(); onClose(); }}
                  className="text-[11px] font-medium text-amber-400 underline underline-offset-2 transition-colors hover:text-amber-300"
                >
                  Nommer votre vaisseau {'\u2192'}
                </button>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
