import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectNotesOverride } from "../../../../../src/domain/model/types";
import { useToast } from "../../components/ui/toast/useToast";
import type { LineupMap } from "../../projectRules";
import {
  parseProjectPayload,
  readProject,
  saveProjectPayload,
} from "../services/projectsApi";
import type { NewProjectPayload } from "../shell/types";
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
          {state.kind !== "ready"
            ? "Loading…"
            : isDirty
              ? "Save & Continue"
              : "Continue"}
        </button>
      </div>
    </section>
  );
}
