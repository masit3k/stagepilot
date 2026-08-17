import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeProject } from "../../../../../src/app/usecases/normalizeProject";
import type {
  DocumentViewModel,
  ProjectNotesOverride,
} from "../../../../../src/domain/model/types";
import { buildDocument } from "../../../../../src/domain/pipeline/buildDocument";
import { useToast } from "../../components/ui/toast/useToast";
import type { LineupMap } from "../../projectRules";
import { InputTable } from "../components/inputs/InputTable";
import {
  buildInputEditorRows,
  buildSlotKeyIndex,
  collectDisabledInputRows,
} from "../domain/inputs/buildInputEditorRows";
import { createDocumentRepository } from "../domain/inputs/createDocumentRepository";
import { useSetupOverrides } from "../domain/setup/useSetupOverrides";
import {
  getBandSetupData,
  parseProjectPayload,
  readProject,
  saveProjectPayload,
} from "../services/projectsApi";
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

export function ProjectInputsPage({
  id,
  navigate,
  registerNavigationGuard,
}: ProjectRouteProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [isSaving, setIsSaving] = useState(false);
  const [setupData, setSetupData] = useState<BandSetupData | null>(null);
  const [selectedInputKey, setSelectedInputKey] = useState<string | null>(null);
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
  const { setupForSlot } = useSetupOverrides({ setupData, presetCatalog });

  const lineup = state.kind === "ready" ? state.snapshot.lineup : {};
  const project = state.kind === "ready" ? state.project : null;

  /**
   * Dokument, jehož `inputs` obrazovka `02` zrcadlí (R1). `normalizeProject`
   * i `buildDocument` běží nad daty, která uživatel ručně edituje (JSON na
   * disku, kapelní presety) a obojí může vyhodit — nekompletní projekt,
   * chybějící preset, muzikanta nebo notes šablonu. Chyba se zachytí tady a
   * jde do `documentResult.kind === "error"`; render z ní nikdy nesmí spadnout
   * na bílou stránku.
   */
  const documentResult = useMemo<DocumentBuildResult>(() => {
    if (!project || !setupData) return { kind: "pending" };
    try {
      const normalizedProject = normalizeProject(project);
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
  }, [project, setupData, id]);

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
      <div className="setup-action-bar setup-action-bar--equal">
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
            navigate(`/projects/${encodeURIComponent(id)}/stageplan`);
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
    </section>
  );
}
