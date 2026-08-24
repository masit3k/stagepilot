import { useState } from "react";
import { ModalOverlay, useModalBehavior } from "../../../components/ui/Modal";
import { Close } from "../../../components/ui/icons";
import type { InputsOverlayEditorModel } from "../../domain/roles/inputsOverlayEditor";
import { ChangeBackVocsModal } from "../roles/modals/ChangeBackVocsModal";
import { ChangeLeadVocsModal } from "../roles/modals/ChangeLeadVocsModal";

type InputsOverlayActionsProps = {
  model: InputsOverlayEditorModel;
  disabled: boolean;
  onSaveVocals: (next: { leadIds: string[]; backIds: string[] }) => void;
  onSaveTalkback: (ownerId: string | null) => void;
};

/**
 * Co? Tři akce pod tabulkou `INPUT LIST`, kterými obrazovka `02` edituje
 * overlays: lead vokály, back vokály a talkback (F5d R7).
 *
 * Proč vlastní komponenta? Tři modály jsou ~130 řádků JSX; v
 * `ProjectInputsPage.tsx` by soubor přerostl mez, kterou pro tenhle task
 * stanovil plán. Rozhodování tady žádné není — model přichází hotový z
 * `resolveInputsOverlayEditorModel`, ven jdou jen dva callbacky.
 *
 * **Žádná z těch akcí nezapisuje `presetOverride`.** Přidání ani odebrání
 * vokalisty není patch kanálu: existenci vokálních a talkback řádků řídí
 * výhradně `overlays` (O1). `inputs.add` na vokálním nebo talkback slotu by
 * doména nezahodila — vytiskla by trvalý osiřelý řádek — takže se sem taková
 * akce nesmí dostat ani omylem.
 */
export function InputsOverlayActions({
  model,
  disabled,
  onSaveVocals,
  onSaveTalkback,
}: InputsOverlayActionsProps) {
  const [isLeadVocsModalOpen, setIsLeadVocsModalOpen] = useState(false);
  const [isBackVocsModalOpen, setIsBackVocsModalOpen] = useState(false);
  const [isTalkbackModalOpen, setIsTalkbackModalOpen] = useState(false);

  const leadVocsModalRef = useModalBehavior(isLeadVocsModalOpen, () =>
    setIsLeadVocsModalOpen(false),
  );
  const backVocsModalRef = useModalBehavior(isBackVocsModalOpen, () =>
    setIsBackVocsModalOpen(false),
  );
  const talkbackModalRef = useModalBehavior(isTalkbackModalOpen, () =>
    setIsTalkbackModalOpen(false),
  );

  const { vocals } = model;

  return (
    <>
      <div className="inputsSectionActions">
        <button
          type="button"
          className="button-secondary"
          disabled={disabled || !vocals.hasCandidates}
          onClick={() => setIsLeadVocsModalOpen(true)}
        >
          Lead vocals
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={disabled || !vocals.hasCandidates}
          onClick={() => setIsBackVocsModalOpen(true)}
        >
          Back vocals
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={disabled || model.talkbackCandidates.length === 0}
          onClick={() => setIsTalkbackModalOpen(true)}
        >
          Talkback
        </button>
      </div>

      <ModalOverlay
        open={isLeadVocsModalOpen}
        onClose={() => setIsLeadVocsModalOpen(false)}
      >
        <div ref={leadVocsModalRef}>
          <ChangeLeadVocsModal
            open={isLeadVocsModalOpen}
            suggestedCandidates={
              vocals.leadSections.suggestedLeadVocalCandidates
            }
            otherCandidates={vocals.leadSections.otherLeadVocalCandidates}
            initialSelectedIds={vocals.selectedLeadIds}
            defaultSelectedIds={model.defaultLeadIds}
            disabledSelectedIds={vocals.selectedBackIds}
            onCancel={() => setIsLeadVocsModalOpen(false)}
            onSave={(nextSelectedIds) => {
              onSaveVocals({
                leadIds: nextSelectedIds,
                backIds: vocals.selectedBackIds,
              });
              setIsLeadVocsModalOpen(false);
            }}
          />
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={isBackVocsModalOpen}
        onClose={() => setIsBackVocsModalOpen(false)}
      >
        <div ref={backVocsModalRef}>
          <ChangeBackVocsModal
            open={isBackVocsModalOpen}
            suggestedCandidates={vocals.backSections.suggested}
            additionalCandidates={vocals.backSections.additional}
            initialSelectedIds={vocals.selectedBackIds}
            defaultSelectedIds={model.defaultBackIds}
            onCancel={() => setIsBackVocsModalOpen(false)}
            onSave={(nextSelectedIds) => {
              onSaveVocals({
                leadIds: vocals.selectedLeadIds,
                backIds: nextSelectedIds,
              });
              setIsBackVocsModalOpen(false);
            }}
          />
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={isTalkbackModalOpen}
        onClose={() => setIsTalkbackModalOpen(false)}
      >
        <div
          className="selector-dialog selector-dialog--musician-select"
          // biome-ignore lint/a11y/useSemanticElements: `useModalBehavior` typuje svůj ref jako `HTMLDivElement`, takže `<dialog>` by se sem nedal navěsit bez obalového divu; týž konstrukt drží `InputsSetupSection.tsx` i oba modály v `ProjectInputsPage.tsx`.
          role="dialog"
          aria-modal="true"
          aria-labelledby="inputs-talkback-title"
          ref={talkbackModalRef}
        >
          <button
            type="button"
            className="modal-close"
            onClick={() => setIsTalkbackModalOpen(false)}
            aria-label="Close"
          >
            <Close />
          </button>
          <div className="panel__header panel__header--stack selector-dialog__title">
            <h3 id="inputs-talkback-title">Select talkback owner</h3>
          </div>
          <div className="selector-dialog__divider section-divider" />
          <div className="selector-dialog__body selector-list">
            {[
              { id: "", name: "Nobody assigned" },
              ...model.talkbackCandidates,
            ].map((member) => (
              <button
                type="button"
                key={member.id}
                className={
                  member.id === model.talkbackOwnerId
                    ? "selector-option selector-option--selected"
                    : "selector-option"
                }
                onClick={() => {
                  onSaveTalkback(member.id || null);
                  setIsTalkbackModalOpen(false);
                }}
              >
                {member.name}
              </button>
            ))}
          </div>
        </div>
      </ModalOverlay>
    </>
  );
}
