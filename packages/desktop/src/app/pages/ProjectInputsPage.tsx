import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeProject } from "../../../../../src/app/usecases/normalizeProject";
import type {
  DocumentViewModel,
  PresetOverridePatch,
  ProjectNotesOverride,
} from "../../../../../src/domain/model/types";
import { buildDocument } from "../../../../../src/domain/pipeline/buildDocument";
import { ModalOverlay, useModalBehavior } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/toast/useToast";
import { getRoleSlotLimit, normalizeLineupSlots } from "../../projectRules";
import type { LineupMap } from "../../projectRules";
import { InputRowInspector } from "../components/inputs/InputRowInspector";
import { InputTable } from "../components/inputs/InputTable";
import { areSetupsEqual } from "../components/setup/adapters/eventSetupAdapter";
import {
  type InputEditorRow,
  buildInputEditorRows,
  buildSlotKeyIndex,
  collectDisabledInputRows,
} from "../domain/inputs/buildInputEditorRows";
import { createDocumentRepository } from "../domain/inputs/createDocumentRepository";
import { updateInputRow } from "../domain/inputs/updateInputRow";
import { buildMusicianDefaultPayload } from "../domain/setup/buildMusicianDefaultPayload";
import { musicianDefaultsKey } from "../domain/setup/musicianDefaultsKey";
import { useSetupOverrides } from "../domain/setup/useSetupOverrides";
import {
  getBandSetupData,
  parseProjectPayload,
  readProject,
  saveProjectPayload,
  updateMusicianDefaults,
} from "../services/projectsApi";
import { nextStepPath, previousStepPath } from "../shell/chrome/processSteps";
import { CANONICAL_LINEUP_ROLE_ORDER } from "../shell/lineupSerialize";
import type { BandSetupData, NewProjectPayload } from "../shell/types";
import type { ProjectRouteProps } from "./shared/pageTypes";

/**
 * Výsledek přepočtu dokumentu pro obrazovku `02`. `normalizeProject` i
 * `buildDocument` vyhazují na nekompletní/ručně editovaná data (chybějící
 * preset, muzikant, povinné pole projektu) — chyba se nese jako hodnota, ne
 * jako výjimka, aby ji `useMemo` mohl bezpečně vrátit a stránka nespadla na
 * bílou stránku (nejdůležitější požadavek tohoto tasku).
 */
type DocumentBuildResult =
  | { kind: "pending" }
  | { kind: "ready"; document: DocumentViewModel }
  | { kind: "error"; message: string };

export type InputsEditorSnapshot = {
  inputOrder: readonly string[] | undefined;
  notes: ProjectNotesOverride | undefined;
  lineup: LineupMap;
};

/** Obranný výchozí stav, kdyby se ref ještě nestihl naplnit. */
const EMPTY_INPUTS_SNAPSHOT: InputsEditorSnapshot = {
  inputOrder: undefined,
  notes: undefined,
  lineup: {},
};

/**
 * Dirty stav obrazovky `02`. Srovnává jen to, co obrazovka edituje —
 * ruční pořadí, odchylky poznámek a patche na slotech lineupu.
 *
 * Porovnání přes serializaci je tady záměrné: struktura je malá, plochá
 * a ukládá se do JSONu, takže hlubší srovnání by jen opakovalo, co dělá
 * `JSON.stringify`, a snadněji by se rozešlo s tím, co se opravdu zapíše.
 */
export function isInputsDirty(
  initial: InputsEditorSnapshot,
  current: InputsEditorSnapshot,
): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current);
}

function snapshotFromProject(project: NewProjectPayload): InputsEditorSnapshot {
  return {
    inputOrder: project.inputOrder,
    notes: project.notes,
    lineup: project.lineup ?? {},
  };
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      project: NewProjectPayload;
      snapshot: InputsEditorSnapshot;
    };

/**
 * Stejná konvence jako `parseSlotIndex` v `ProjectSetupPage.tsx` (~ř. 1177) —
 * `row.slotKey` je `${role}:${index}`, vlastníkovu roli editor má vedle v
 * `row.ownerRole`, takže se tu parsuje jen index.
 */
function parseSlotIndex(slotKey: string): number {
  const [, rawIndex] = slotKey.split(":");
  const parsed = Number(rawIndex);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isOverridePatchEmpty(patch: PresetOverridePatch): boolean {
  return !patch.inputs && !patch.monitoring;
}

/**
 * Počet odchylek slotu od výchozí výbavy muzikanta — zobrazuje se v panelu
 * (R2) a řídí, jestli je `Reset to default` k něčemu. Počítá se přímo z
 * patche, ne z `diffMeta` (`computeSetupDiff`): ten značí jako `override` jen
 * přidané/odebrané kanály, přejmenování a poznámka (`inputs.update`) by tak
 * nikdy neprošly jako odchylka, přestože přesně tohle R6 zavádí.
 */
function countPatchDeviations(patch: PresetOverridePatch | undefined): number {
  if (!patch) return 0;
  const inputs = patch.inputs;
  const inputDeviations =
    (inputs?.add?.length ?? 0) +
    (inputs?.remove?.length ?? 0) +
    (inputs?.removeKeys?.length ?? 0) +
    (inputs?.replace?.length ?? 0) +
    (inputs?.update?.length ?? 0);
  const monitoringDeviations = patch.monitoring
    ? Object.keys(patch.monitoring).length
    : 0;
  return inputDeviations + monitoringDeviations;
}

/**
 * Aktuální `presetOverride` jednoho slotu, čtený přímo z editovaného
 * snapshotu — sdílí ho výpočet `deviationCount` pro panel (R2) a payload pro
 * `Save as musician default` (R5): obě potřebují ten samý patch, jaký na
 * obrazovce `02` právě platí, ne to, co je uložené na disku.
 */
function getSlotOverride(
  lineup: LineupMap,
  role: string,
  slotIndex: number,
): PresetOverridePatch | undefined {
  const slots = normalizeLineupSlots(lineup[role], getRoleSlotLimit(role));
  return slots[slotIndex]?.presetOverride;
}

/** Zapíše (nebo smaže) `presetOverride` jednoho slotu v `lineup`, beze změny tvaru pole/objektu, jaký `role` používá. */
function replaceSlotOverride(
  lineup: LineupMap,
  role: string,
  slotIndex: number,
  nextPatch: PresetOverridePatch | undefined,
): LineupMap {
  const roleSlotLimit = getRoleSlotLimit(role);
  const slots = normalizeLineupSlots(lineup[role], roleSlotLimit);
  if (!slots[slotIndex]) return lineup;

  const nextSlots = slots.map((slot, index) => {
    if (index !== slotIndex) return slot;
    return {
      musicianId: slot.musicianId,
      ...(nextPatch && !isOverridePatchEmpty(nextPatch)
        ? { presetOverride: nextPatch }
        : {}),
      ...(slot.drumDefinition ? { drumDefinition: slot.drumDefinition } : {}),
    };
  });

  const value = roleSlotLimit <= 1 ? nextSlots[0] : nextSlots;
  return { ...lineup, [role]: value as LineupMap[string] };
}

export function ProjectInputsPage({
  id,
  navigate,
  registerNavigationGuard,
}: ProjectRouteProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [isSaving, setIsSaving] = useState(false);
  const [setupData, setSetupData] = useState<BandSetupData | null>(null);
  const [selectedInputKey, setSelectedInputKey] = useState<string | null>(null);
  const [
    showSaveMusicianDefaultConfirmation,
    setShowSaveMusicianDefaultConfirmation,
  ] = useState(false);
  const [isSavingMusicianDefault, setIsSavingMusicianDefault] = useState(false);
  const { notify } = useToast();
  /** Stav, proti kterému se poznává dirty — po každém uložení se posune. */
  const initialSnapshotRef = useRef<InputsEditorSnapshot | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const project = parseProjectPayload(await readProject(id));
        if (cancelled) return;
        const snapshot = snapshotFromProject(project);
        initialSnapshotRef.current = snapshot;
        setState({ kind: "ready", project, snapshot });
      } catch (error) {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Project could not be loaded.",
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const bandRef = state.kind === "ready" ? state.project.bandRef : null;

  /**
   * Katalog presetů kapely, potřebný pro `setupForSlot`. Bez něj by řádky
   * ukazovaly jen obecné výchozí kanály skupiny (R1 by přestalo platit u
   * kapel s vlastními presety), takže se dotahuje samostatně od projektu.
   */
  useEffect(() => {
    if (!bandRef) return;
    let cancelled = false;

    getBandSetupData(bandRef)
      .then((data) => {
        if (!cancelled) setSetupData(data);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[project-inputs] failed to load band setup data", {
          projectId: id,
          bandRef,
          error,
        });
        notify(
          "error",
          "Band defaults could not be loaded. Input list may not match the band's setup.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [bandRef, id, notify]);

  const presetCatalog = setupData?.presetCatalog ?? {};
  const { setupForSlot, defaultPresetFor } = useSetupOverrides({
    setupData,
    presetCatalog,
  });

  const lineup = state.kind === "ready" ? state.snapshot.lineup : {};
  const project = state.kind === "ready" ? state.project : null;
  const snapshot = state.kind === "ready" ? state.snapshot : null;

  /**
   * Projekt, ze kterého se staví dokument — načtený projekt s právě
   * editovaným snapshotem (ruční pořadí, poznámky, patche lineupu) navrchu.
   * Patche z panelu (R6) chodí do `snapshot`, ne do `project`; kdyby dokument
   * dál stavěl z `project`, přejmenování by se v tabulce projevilo až po
   * uložení, protože `snapshot` a `project` by se do té doby rozešly.
   */
  const editedProject = useMemo<NewProjectPayload | null>(() => {
    if (!project || !snapshot) return null;
    return {
      ...project,
      inputOrder: snapshot.inputOrder,
      notes: snapshot.notes,
      lineup: snapshot.lineup,
    };
  }, [project, snapshot]);

  /**
   * Dokument, jehož `inputs` obrazovka `02` zrcadlí (R1). `normalizeProject`
   * i `buildDocument` běží nad daty, která uživatel ručně edituje (JSON na
   * disku, kapelní presety, právě editovaný snapshot) a obojí může vyhodit —
   * nekompletní projekt, chybějící preset, muzikanta nebo notes šablonu.
   * Chyba se zachytí tady a jde do `documentResult.kind === "error"`; render
   * z ní nikdy nesmí spadnout na bílou stránku.
   */
  const documentResult = useMemo<DocumentBuildResult>(() => {
    if (!editedProject || !setupData) return { kind: "pending" };
    try {
      const normalizedProject = normalizeProject(editedProject);
      const repo = createDocumentRepository({
        project: normalizedProject,
        setupData,
      });
      return {
        kind: "ready",
        document: buildDocument(normalizedProject, repo),
      };
    } catch (error) {
      console.error("[project-inputs] failed to build the document", {
        projectId: id,
        error,
      });
      return {
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The input list could not be built from the current project data.",
      };
    }
  }, [editedProject, setupData, id]);

  /**
   * Vypnuté kanály obsazených slotů a `slotKey` podle vlastníka — obojí se
   * čte přímo z lineupu, ne z dokumentu: pořadí muzikanta v `document.inputs`
   * se s pořadím v lineupu nemusí shodovat (vokály jdou přes overlay,
   * akustická kytara se řadí za elektrickou před rozlišením podle lineupu).
   * Selhání se nesmí strhnout aktivní řádky s sebou: bez vypnutých řádků a
   * bez `slotKey` se obrazovka pořád vykreslí, jen bez přeškrtnutí (R3) a
   * bez adresy pro Task 12.
   */
  const { disabledRows, slotKeysByOwner } = useMemo(() => {
    try {
      return {
        slotKeysByOwner: buildSlotKeyIndex({
          lineup,
          roleOrder: CANONICAL_LINEUP_ROLE_ORDER,
        }),
        disabledRows: collectDisabledInputRows({
          lineup,
          roleOrder: CANONICAL_LINEUP_ROLE_ORDER,
          setupForSlot,
        }),
      };
    } catch (error) {
      console.error("[project-inputs] failed to collect disabled rows", {
        projectId: id,
        error,
      });
      return { disabledRows: [], slotKeysByOwner: new Map<string, string>() };
    }
  }, [lineup, setupForSlot, id]);

  const inputRows = useMemo(
    () =>
      documentResult.kind === "ready"
        ? buildInputEditorRows({
            document: documentResult.document,
            disabledRows,
            slotKeysByOwner,
          })
        : [],
    [documentResult, disabledRows, slotKeysByOwner],
  );

  const selectedRow =
    inputRows.find((row) => row.key === selectedInputKey) ?? null;

  /** Jméno muzikanta pro panel (R2) — `setupData.members` je jediné místo, které už drží zobrazitelné jméno pro dané id. */
  const musicianNameById = useMemo(() => {
    const byId = new Map<string, string>();
    for (const members of Object.values(setupData?.members ?? {})) {
      for (const member of members) byId.set(member.id, member.name);
    }
    return byId;
  }, [setupData]);

  const ownerChannelCount = selectedRow
    ? inputRows.filter(
        (row) =>
          row.state === "active" &&
          row.ownerMusicianId === selectedRow.ownerMusicianId &&
          row.ownerRole === selectedRow.ownerRole,
      ).length
    : 0;

  const ownerDeviationCount = useMemo(() => {
    if (!selectedRow || !selectedRow.slotKey) return 0;
    const patch = getSlotOverride(
      lineup,
      selectedRow.ownerRole,
      parseSlotIndex(selectedRow.slotKey),
    );
    return countPatchDeviations(patch);
  }, [selectedRow, lineup]);

  /**
   * Jestli má smysl `Save as musician default` (R5) — na rozdíl od
   * `ownerDeviationCount` (počet polí v patchi) porovnává **hodnoty**: patch
   * se strukturou, který se přesně vrátí zpátky k defaultu, by jinak nechal
   * tlačítko aktivní, přestože by nebylo co povyšovat. Stejná podmínka jako
   * `canUpdateMusicianDefault` v `ProjectSetupPage.tsx` (~ř. 1991):
   * `!areSetupsEqual(effective, musicianDefaultPreset)`.
   */
  const canSaveAsMusicianDefault = useMemo(() => {
    if (!selectedRow || !selectedRow.slotKey) return false;
    const patch = getSlotOverride(
      lineup,
      selectedRow.ownerRole,
      parseSlotIndex(selectedRow.slotKey),
    );
    const { effective } = setupForSlot(
      selectedRow.ownerRole,
      selectedRow.ownerMusicianId,
      patch,
    );
    const musicianDefault = defaultPresetFor(
      selectedRow.ownerRole,
      selectedRow.ownerMusicianId,
    );
    return !areSetupsEqual(effective, musicianDefault);
  }, [selectedRow, lineup, setupForSlot, defaultPresetFor]);

  /**
   * Zapíše přejmenování/poznámku vybraného řádku do patche jeho slotu (R6).
   * Adresuje se přes `row.rawKey` (skutečný klíč kanálu), nikdy přes
   * `row.key` (opaque identita, u vypnutého řádku jmenný prostor vlastníka —
   * viz doc komentář `InputEditorRow.key`). Prázdný `slotKey` znamená, že
   * vlastník není v `project.lineup`, takže není kam patch zapsat.
   */
  const applyRowChange = useCallback(
    (row: InputEditorRow, change: { label?: string; note?: string }) => {
      if (!row.slotKey) return;
      const role = row.ownerRole;
      const slotIndex = parseSlotIndex(row.slotKey);
      setState((current) => {
        if (current.kind !== "ready") return current;
        const slots = normalizeLineupSlots(
          current.snapshot.lineup[role],
          getRoleSlotLimit(role),
        );
        const currentPatch = slots[slotIndex]?.presetOverride;
        const nextPatch = updateInputRow(currentPatch, {
          key: row.rawKey,
          ...change,
        });
        const nextLineup = replaceSlotOverride(
          current.snapshot.lineup,
          role,
          slotIndex,
          nextPatch,
        );
        return {
          ...current,
          snapshot: { ...current.snapshot, lineup: nextLineup },
        };
      });
    },
    [],
  );

  /** Zahodí celý `presetOverride` vlastníkova slotu (owner action v panelu, R2) — ne jen jednu vlastnost. */
  const resetOwnerToDefault = useCallback((row: InputEditorRow) => {
    if (!row.slotKey) return;
    const role = row.ownerRole;
    const slotIndex = parseSlotIndex(row.slotKey);
    setState((current) => {
      if (current.kind !== "ready") return current;
      const nextLineup = replaceSlotOverride(
        current.snapshot.lineup,
        role,
        slotIndex,
        undefined,
      );
      return {
        ...current,
        snapshot: { ...current.snapshot, lineup: nextLineup },
      };
    });
  }, []);

  /**
   * Povýší efektivní preset vybraného vlastníka na jeho trvalý default (R5,
   * Task 12b) — kanály z tohoto slotu tak nastartují každý příští projekt,
   * ne jen tenhle. `effective` se počítá stejně jako v `ProjectSetupPage.tsx`
   * (setup modál na obrazovce `01`): `setupForSlot` nad aktuálním patchem
   * slotu. Payload skládá `buildMusicianDefaultPayload` (testováno přímo) —
   * ta funkce patch vůbec nepřijímá, takže poslat ho omylem místo efektivního
   * presetu nejde. Mění data sdílená napříč projekty, proto se volá až po
   * potvrzení v modálu níž, a chybu nikdy nepolyká — jde přes existující
   * chybový kanál stránky (`notify`).
   */
  const saveSelectedRowAsMusicianDefault = useCallback(
    async (row: InputEditorRow) => {
      if (!row.slotKey) return;
      const role = row.ownerRole;
      const musicianId = row.ownerMusicianId;
      const patch = getSlotOverride(lineup, role, parseSlotIndex(row.slotKey));
      const { effective } = setupForSlot(role, musicianId, patch);
      const payload = buildMusicianDefaultPayload({
        ownerMusicianId: musicianId,
        ownerRole: role,
        effectivePreset: effective,
      });
      setIsSavingMusicianDefault(true);
      try {
        await updateMusicianDefaults(payload);
        setSetupData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            musicianDefaults: {
              ...(prev.musicianDefaults ?? {}),
              [musicianDefaultsKey(payload.musicianId, payload.role)]:
                payload.setup,
            },
          };
        });
        notify("success", "Musician defaults updated.");
        setShowSaveMusicianDefaultConfirmation(false);
      } catch (error) {
        console.error("[project-inputs] failed to update musician defaults", {
          projectId: id,
          musicianId,
          role,
          error,
        });
        notify("error", "Musician defaults could not be updated.");
      } finally {
        setIsSavingMusicianDefault(false);
      }
    },
    [lineup, setupForSlot, notify, id],
  );

  const saveSnapshot = useCallback(
    async (snapshot: InputsEditorSnapshot, project: NewProjectPayload) => {
      setIsSaving(true);
      try {
        await saveProjectPayload({
          projectId: project.id,
          payload: {
            ...project,
            inputOrder: snapshot.inputOrder,
            notes: snapshot.notes,
            lineup: snapshot.lineup,
          },
          // Ruční pořadí a poznámky jsou obsah rideru, ne kosmetika.
          intent: "content",
        });
        initialSnapshotRef.current = snapshot;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (state.kind !== "ready") return;
    const { project, snapshot } = state;
    registerNavigationGuard({
      isDirty: () =>
        isInputsDirty(
          initialSnapshotRef.current ?? EMPTY_INPUTS_SNAPSHOT,
          snapshot,
        ),
      save: () => saveSnapshot(snapshot, project),
      discard: () => {
        const initial = initialSnapshotRef.current;
        if (initial)
          setState((current) =>
            current.kind === "ready"
              ? { ...current, snapshot: initial }
              : current,
          );
      },
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, saveSnapshot, state]);

  /**
   * Na rozdíl od `StagePlanEditorPage` se tělo nezavírá za `loading`/`error` —
   * tři sekce jsou v tomto tasku prázdné hlavičky, které na data nečekají.
   * Uzavřít je za `ready` by je schovalo i tady, kde nic nenačítají.
   */
  const isDirty =
    state.kind === "ready" &&
    isInputsDirty(
      initialSnapshotRef.current ?? EMPTY_INPUTS_SNAPSHOT,
      state.snapshot,
    );

  const ownerName = selectedRow
    ? (musicianNameById.get(selectedRow.ownerMusicianId) ?? "Unknown musician")
    : "";

  const saveMusicianDefaultModalRef = useModalBehavior(
    showSaveMusicianDefaultConfirmation && Boolean(selectedRow?.slotKey),
    () => setShowSaveMusicianDefaultConfirmation(false),
  );

  return (
    <section className="panel panel--inputs">
      <div className="panel__header">
        <h2>Inputs</h2>
      </div>
      {state.kind === "error" ? (
        <div className="status status--error" role="alert">
          {state.message}
        </div>
      ) : null}
      {documentResult.kind === "error" ? (
        <div className="status status--error" role="alert">
          {documentResult.message}
        </div>
      ) : null}
      <div className="inputsBody">
        <div className="inputsBody__main">
          <section className="inputsSection" aria-label="Input list">
            <h2 className="inputsSectionTitle">INPUT LIST</h2>
            <InputTable
              rows={inputRows}
              selectedKey={selectedInputKey}
              onSelect={setSelectedInputKey}
            />
          </section>
          <section className="inputsSection" aria-label="Monitors">
            <h2 className="inputsSectionTitle">MONITORS</h2>
          </section>
          <section className="inputsSection" aria-label="Notes">
            <h2 className="inputsSectionTitle">NOTES</h2>
          </section>
        </div>
        <InputRowInspector
          row={selectedRow}
          ownerName={ownerName}
          channelCount={ownerChannelCount}
          deviationCount={ownerDeviationCount}
          canSaveAsMusicianDefault={canSaveAsMusicianDefault}
          onLabelChange={(label) =>
            selectedRow && applyRowChange(selectedRow, { label })
          }
          onNoteChange={(note) =>
            selectedRow && applyRowChange(selectedRow, { note })
          }
          onResetToDefault={() =>
            selectedRow && resetOwnerToDefault(selectedRow)
          }
          onSaveAsMusicianDefault={() =>
            setShowSaveMusicianDefaultConfirmation(true)
          }
        />
      </div>
      <div className="setup-action-bar setup-action-bar--equal">
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            const target = previousStepPath("inputs", id);
            if (target) navigate(target);
          }}
        >
          Back to Lineup
        </button>
        <button
          type="button"
          className="button-primary"
          disabled={isSaving || state.kind !== "ready"}
          onClick={async () => {
            if (state.kind !== "ready") return;
            if (isDirty) {
              try {
                await saveSnapshot(state.snapshot, state.project);
              } catch (error) {
                console.error("[project-inputs] failed to save", {
                  projectId: id,
                  error,
                });
                notify("error", "Inputs could not be saved.");
                return;
              }
              notify("success", "Inputs saved.");
            }
            const target = nextStepPath("inputs", id);
            if (target) navigate(target);
          }}
        >
          {state.kind === "loading"
            ? "Loading…"
            : state.kind === "error"
              ? "Unavailable"
              : isDirty
                ? "Save & Continue"
                : "Continue"}
        </button>
      </div>

      <ModalOverlay
        open={
          showSaveMusicianDefaultConfirmation && Boolean(selectedRow?.slotKey)
        }
        onClose={() => setShowSaveMusicianDefaultConfirmation(false)}
      >
        <div
          className="selector-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-musician-default-title"
          aria-describedby="save-musician-default-body"
          ref={saveMusicianDefaultModalRef}
        >
          <div className="panel__header panel__header--stack selector-dialog__title">
            <h3 id="save-musician-default-title">Save as musician default?</h3>
            <p id="save-musician-default-body" className="subtle">
              {`You are about to update default setup for: ${ownerName}.`}
            </p>
            <p className="subtle">
              This will affect all future projects and all bands.
            </p>
            <p className="subtle">This does not change the band defaults.</p>
          </div>
          <div className="selector-dialog__divider section-divider" />
          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setShowSaveMusicianDefaultConfirmation(false)}
              disabled={isSavingMusicianDefault}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={() =>
                selectedRow && saveSelectedRowAsMusicianDefault(selectedRow)
              }
              disabled={isSavingMusicianDefault}
            >
              Save default
            </button>
          </div>
        </div>
      </ModalOverlay>
    </section>
  );
}
