import { useEffect, useState } from 'react';
import type { Blason } from '@exilium/shared';
import { AllianceBlason } from './AllianceBlason';
import { BlasonPicker } from './BlasonPicker';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

type Props = {
  blason: Blason;
  motto: string | null;
  onBlasonChange: (b: Blason) => void;
  onMottoChange: (m: string | null) => void;
  allianceName?: string;
  allianceTag?: string;
};

export function BlasonEditor({
  blason,
  motto,
  onBlasonChange,
  onMottoChange,
  allianceName,
  allianceTag,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftBlason, setDraftBlason] = useState<Blason>(blason);
  const [draftMotto, setDraftMotto] = useState<string | null>(motto);

  // When the modal is closed, keep the draft aligned with the committed props so that
  // reopening starts from the current (possibly server-refreshed) state.
  useEffect(() => {
    if (!open) {
      setDraftBlason(blason);
      setDraftMotto(motto);
    }
  }, [open, blason, motto]);

  const handleOpen = () => {
    setDraftBlason(blason);
    setDraftMotto(motto);
    setOpen(true);
  };

  const handleValidate = () => {
    onBlasonChange(draftBlason);
    onMottoChange(draftMotto);
    setOpen(false);
  };

  return (
    <>
      <div className="flex items-start gap-4 rounded-lg border border-border bg-card/40 p-3">
        <AllianceBlason blason={blason} size={72} className="shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          {(allianceName || allianceTag) && (
            <div className="text-sm font-semibold truncate">
              {allianceName}
              {allianceTag ? <span className="ml-1 text-primary">[{allianceTag}]</span> : null}
            </div>
          )}
          {motto ? (
            <p className="border-l-2 border-primary/40 pl-2 text-xs italic text-muted-foreground line-clamp-2">
              {motto}
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground">Aucune devise.</p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleOpen} className="shrink-0">
          Personnaliser
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Blason & devise"
        className="lg:max-w-3xl"
      >
        <div className="space-y-4">
          <BlasonPicker
            blason={draftBlason}
            motto={draftMotto}
            onBlasonChange={setDraftBlason}
            onMottoChange={setDraftMotto}
            allianceName={allianceName}
            allianceTag={allianceTag}
          />
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleValidate}>
              Valider
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
