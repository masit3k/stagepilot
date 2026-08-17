import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectNotesOverride } from "../../../../../src/domain/model/types";
import { useToast } from "../../components/ui/toast/useToast";
import type { LineupMap } from "../../projectRules";
import { InputTable } from "../components/inputs/InputTable";
import { buildInputEditorRows } from "../domain/inputs/buildInputEditorRows";
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
  const [selectedInputKey, setSelectedInputKey] = useState<string | null>(
    null,
  );
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
  const inputOrder = state.kind === "ready" ? state.snapshot.inputOrder : undefined;

  const inputRows = useMemo(
    () =>
      buildInputEditorRows({
        lineup,
        roleOrder: CANONICAL_LINEUP_ROLE_ORDER,
        inputOrder,
        setupForSlot,
      }),
    [lineup, inputOrder, setupForSlot],
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
