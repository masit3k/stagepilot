import { useState } from "react";
import type { Group } from "../../../../../../src/domain/model/groups";
import type { PresetOverridePatch } from "../../../../../../src/domain/model/types";
import { normalizeSetupOverridePatch } from "../../../../../../src/domain/rules/presetOverride";
import { ModalOverlay, useModalBehavior } from "../../../components/ui/Modal";
import { Close } from "../../../components/ui/icons";
import {
  type DroppedUserEdit,
  resolveDroppedUserEdits,
} from "../../domain/inputs/resolveDroppedUserEdits";
import {
  type InputsFieldCatalogId,
  resolveInputsFieldSections,
} from "../../domain/inputs/resolveInputsFieldSections";
import type { buildSetupFieldCatalog } from "../../pages/shared/setupConstants";
import { SchemaRenderer } from "../setup/SchemaRenderer";
import { SetupSection } from "../setup/SetupSection";
import type { EventSetupEditState } from "../setup/adapters/eventSetupAdapter";

type FieldCatalog = ReturnType<typeof buildSetupFieldCatalog>;

type PendingSwitch = {
  patch: PresetOverridePatch | undefined;
  dropped: DroppedUserEdit[];
};

/**
 * Tělo modálu `Edit inputs` bez overlaye.
 *
 * Proč zvlášť, a ne jedna komponenta: `ModalOverlay` je `createPortal` do
 * `document.body`, takže `renderToStaticMarkup` na něm v `environment: "node"`
 * padá na `document is not defined` (změřeno) a repozitář jsdom nezavádí (R8).
 * Overlay drží `InputsSetupSection`, obsah drží tohle — týž rozklad, jaký na
 * `01` už mají `ChangeBackVocsModal` a `SetupModalShell`, kde overlay leží ve
 * stránce a dialog v komponentě.
 */
export function InputsSetupDialog({
  title,
  role,
  state,
  fieldCatalog,
  onPatch,
  onClose,
}: {
  title: string;
  role: Group;
  state: EventSetupEditState;
  fieldCatalog: FieldCatalog;
  onPatch: (nextPatch: PresetOverridePatch | undefined) => void;
  onClose: () => void;
}) {
  const dialogRef = useModalBehavior(true, onClose);

  const sections = resolveInputsFieldSections({
    role,
    effectiveInputs: state.effectivePreset.inputs,
  });
  const isModified = Boolean(state.patch?.inputs);

  function fieldsFor(catalog: InputsFieldCatalogId) {
    if (catalog === "bass") return fieldCatalog.bassFields;
    if (catalog === "guitar") return fieldCatalog.guitarFields;
    if (catalog === "keys") return fieldCatalog.keysFields;
    return fieldCatalog.leadVocsFields;
  }

  return (
    <div
      className="selector-dialog"
      // biome-ignore lint/a11y/useSemanticElements: `useModalBehavior` typuje svůj ref jako `HTMLDivElement`, takže `<dialog>` by se sem nedal navěsit bez obalového divu; oba sourozenecké modály na obrazovce `02` (`ProjectInputsPage.tsx:1534`, `:1588`) drží týž konstrukt.
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-inputs-title"
      ref={dialogRef}
    >
      <button
        type="button"
        className="modal-close"
        onClick={onClose}
        aria-label="Close"
      >
        <Close />
      </button>
      <div className="panel__header panel__header--stack selector-dialog__title">
        <h3 id="edit-inputs-title">{title}</h3>
        <p className="subtle">
          Changes here apply only to this event. Musician defaults are not
          modified.
        </p>
      </div>
      <div className="selector-dialog__divider section-divider" />
      <div className="selector-dialog__body setup-editor-stack">
        {sections.map((section) => (
          <SetupSection
            key={section.key}
            title={section.label ? `Input – ${section.label}` : "Inputs"}
            modified={isModified}
          >
            <SchemaRenderer
              fields={fieldsFor(section.catalog)}
              state={state}
              onPatch={onPatch}
            />
          </SetupSection>
        ))}
      </div>
      <div className="modal-actions">
        <button type="button" className="button-secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

/**
 * Potvrzení destruktivního přepnutí zapojení (F5d R5) bez overlaye.
 *
 * Vypisuje `label` a `note` z `resolveDroppedUserEdits`, tedy **efektivní**
 * podobu kanálu — jméno a poznámku, které tam napsal uživatel, ne popisek
 * z presetu. Jinak by nepoznal, o co přichází.
 */
export function DropUserEditsDialog({
  dropped,
  onCancel,
  onConfirm,
}: {
  dropped: DroppedUserEdit[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useModalBehavior(true, onCancel);

  return (
    <div
      className="selector-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="drop-user-edits-title"
      aria-describedby="drop-user-edits-body"
      ref={dialogRef}
    >
      <div className="panel__header panel__header--stack selector-dialog__title">
        <h3 id="drop-user-edits-title">Switch connection?</h3>
        <p id="drop-user-edits-body" className="subtle">
          This removes channels you renamed or annotated. Their names and notes
          are discarded and cannot be restored by switching back.
        </p>
      </div>
      <ul className="selector-dialog__body">
        {dropped.map((item) => (
          <li key={item.key}>
            {item.label}
            {item.note ? ` — ${item.note}` : ""}
          </li>
        ))}
      </ul>
      <div className="modal-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="button-danger" onClick={onConfirm}>
          Switch and discard
        </button>
      </div>
    </div>
  );
}

/**
 * Modál `Edit inputs` obrazovky `02` (F5d R4). Sourozenec `Edit kit`: bubeník
 * má v inspektoru `Edit kit`, kytarista, basák a klávesista dostanou tohle.
 *
 * Proč modál a ne inline v inspektoru: obojí je destruktivní přepis celé sady
 * kanálů slotu, ne editace jednoho řádku, a úzký postranní panel tu váhu
 * neukáže. Inspektor nese operace na řádku (rename, note, remove/restore),
 * modály nesou operace na sadě.
 *
 * Rozdělení na sekce a výběr katalogu polí sem nepatří — je to čistá funkce
 * `resolveInputsFieldSections`, protože kontraktní test 7 z R8 potřebuje
 * asertovat „modál dostane KEYS_FIELDS" a repozitář nemá jsdom.
 *
 * Potvrzení destruktivního přepnutí (R5): zamýšlený patch se PARKUJE, dokud
 * uživatel nepotvrdí, takže „dopředu" je doslova pravda. Stejný idiom, jaký na
 * `02` už mají `Reset to defaults?` a `Save as musician default` —
 * `ModalOverlay` s `role="alertdialog"`, `Cancel` a nebezpečná akce.
 *
 * `normalizeSetupOverridePatch` se volá tady, ne ve stránce: je to ta funkce,
 * která z patche udělá `undefined`, jakmile se efektivní preset vrátí na
 * default. Bez ní by v projektu zůstal patch, který nic nemění, a `DEVIATIONS N`
 * by lhal.
 */
export function InputsSetupSection({
  open,
  title,
  role,
  state,
  fieldCatalog,
  onPatch,
  onClose,
}: {
  open: boolean;
  title: string;
  role: Group;
  state: EventSetupEditState;
  fieldCatalog: FieldCatalog;
  onPatch: (nextPatch: PresetOverridePatch | undefined) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<PendingSwitch | null>(null);

  function handlePatch(rawPatch: PresetOverridePatch | undefined) {
    const nextPatch = normalizeSetupOverridePatch(
      state.defaultPreset,
      rawPatch,
    );
    const dropped = resolveDroppedUserEdits({
      defaultPreset: state.defaultPreset,
      currentPatch: state.patch,
      nextPatch,
    });
    if (dropped.length > 0) {
      setPending({ patch: nextPatch, dropped });
      return;
    }
    onPatch(nextPatch);
  }

  return (
    <>
      <ModalOverlay open={open} onClose={onClose}>
        <InputsSetupDialog
          title={title}
          role={role}
          state={state}
          fieldCatalog={fieldCatalog}
          onPatch={handlePatch}
          onClose={onClose}
        />
      </ModalOverlay>

      <ModalOverlay open={pending !== null} onClose={() => setPending(null)}>
        <DropUserEditsDialog
          dropped={pending?.dropped ?? []}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const confirmed = pending;
            setPending(null);
            if (confirmed) onPatch(confirmed.patch);
          }}
        />
      </ModalOverlay>
    </>
  );
}
