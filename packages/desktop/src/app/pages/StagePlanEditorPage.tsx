import { useEffect, useState } from "react";
import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanLayout,
  StageplanStageSize,
} from "../../../../../src/domain/model/types";
import {
  nudgeBlockBy,
  rotateBlockBy,
} from "../../../../../src/domain/stageplan/layout/blockOps";
import {
  NOMINAL_STAGE,
  buildDefaultLayout,
} from "../../../../../src/domain/stageplan/layout/defaultLayout";
import { mergeWithLineup } from "../../../../../src/domain/stageplan/layout/mergeWithLineup";
import { rescaleForStage } from "../../../../../src/domain/stageplan/layout/rescaleForStage";
import { BlockInspector } from "../components/stageplan/BlockInspector";
import { EditorToolbar } from "../components/stageplan/EditorToolbar";
import { StageCanvas } from "../components/stageplan/StageCanvas";
import { useEditorKeyboard } from "../components/stageplan/useEditorKeyboard";
import { useLayoutHistory } from "../components/stageplan/useLayoutHistory";
import { resolveBlockSlotsFromPayload } from "../domain/stageplan/resolveBlockSlotsFromPayload";
import { parseProjectPayload, readProject } from "../services/projectsApi";
import type { NewProjectPayload } from "../shell/types";
import type { ProjectRouteProps } from "./shared/pageTypes";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; project: NewProjectPayload; layout: StageplanLayout };

export function StagePlanEditorPage({ id, navigate }: ProjectRouteProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedSlot, setSelectedSlot] = useState<StageplanBlockSlot | null>(
    null,
  );
  /** Snap je nástroj, ne vlastnost projektu — proto se neukládá. */
  const [snap, setSnap] = useState(true);
  const history = useLayoutHistory();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const project = parseProjectPayload(await readProject(id));
        // Sloučení běží jen tady. Nikde jinde se layout nedopočítává.
        const layout = mergeWithLineup(project.stageplan?.layout, {
          slots: resolveBlockSlotsFromPayload(project),
          stage: project.stageplan?.layout?.stage ?? null,
        });
        if (cancelled) return;
        history.reset();
        setState({ kind: "ready", project, layout });
        setSelectedSlot(layout.blocks[0]?.slot ?? null);
      } catch (error) {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Projekt se nepodařilo načíst.",
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, history.reset]);

  function updateBlock(slot: StageplanBlockSlot, next: StageplanBlock) {
    setState((current) => {
      if (current.kind !== "ready") return current;
      return {
        ...current,
        layout: {
          stage: current.layout.stage,
          blocks: current.layout.blocks.map((block) =>
            block.slot === slot ? next : block,
          ),
        },
      };
    });
  }

  function nudgeSelectedBy(delta: { xM: number; yM: number }) {
    setState((current) => {
      if (current.kind !== "ready" || selectedSlot === null) return current;
      const area = current.layout.stage ?? NOMINAL_STAGE;
      history.push(current.layout);
      return {
        ...current,
        layout: {
          stage: current.layout.stage,
          blocks: current.layout.blocks.map((block) =>
            block.slot === selectedSlot
              ? nudgeBlockBy(block, delta, { area })
              : block,
          ),
        },
      };
    });
  }

  function rotateSelectedBy(deltaDeg: number) {
    setState((current) => {
      if (current.kind !== "ready" || selectedSlot === null) return current;
      const area = current.layout.stage ?? NOMINAL_STAGE;
      history.push(current.layout);
      return {
        ...current,
        layout: {
          stage: current.layout.stage,
          blocks: current.layout.blocks.map((block) =>
            block.slot === selectedSlot
              ? rotateBlockBy(block, deltaDeg, { area, snap })
              : block,
          ),
        },
      };
    });
  }

  function resetArrangement() {
    setState((current) => {
      if (current.kind !== "ready") return current;
      history.push(current.layout);
      const layout = buildDefaultLayout({
        slots: resolveBlockSlotsFromPayload(current.project),
        stage: current.layout.stage,
      });
      setSelectedSlot(layout.blocks[0]?.slot ?? null);
      return { ...current, layout };
    });
  }

  function applyStageSize(next: StageplanStageSize | null) {
    setState((current) => {
      if (current.kind !== "ready") return current;
      history.push(current.layout);
      // Jediné místo, kde se souřadnice přepočítávají — R6.
      return { ...current, layout: rescaleForStage(current.layout, next) };
    });
  }

  useEditorKeyboard({
    enabled: selectedSlot !== null,
    onNudge: (delta) => nudgeSelectedBy(delta),
    onRotateBy: (deltaDeg) => rotateSelectedBy(deltaDeg),
    onUndo: () =>
      setState((current) => {
        if (current.kind !== "ready") return current;
        const previous = history.undo(current.layout);
        return previous ? { ...current, layout: previous } : current;
      }),
    onRedo: () =>
      setState((current) => {
        if (current.kind !== "ready") return current;
        const next = history.redo(current.layout);
        return next ? { ...current, layout: next } : current;
      }),
    onClearSelection: () => setSelectedSlot(null),
  });

  if (state.kind === "loading")
    return <div className="stage-editor__status">Načítám…</div>;
  if (state.kind === "error")
    return <div className="stage-editor__status">{state.message}</div>;

  const area = state.layout.stage ?? NOMINAL_STAGE;

  return (
    <div className="stage-editor">
      <EditorToolbar
        stage={state.layout.stage}
        snap={snap}
        onToggleSnap={() => setSnap((current) => !current)}
        onChangeStage={applyStageSize}
        onOpenPreview={() =>
          navigate(`/projects/${encodeURIComponent(id)}/preview`)
        }
      />
      {state.layout.blocks.length === 0 ? (
        <div className="stage-editor__empty">
          <p>Projekt nemá obsazený lineup, takže na pódiu není co rozmístit.</p>
          <button
            type="button"
            onClick={() => navigate(`/projects/${encodeURIComponent(id)}/setup`)}
          >
            Otevřít Lineup Setup
          </button>
        </div>
      ) : (
        <div className="stage-editor__body">
          <StageCanvas
            area={area}
            blocks={state.layout.blocks}
            selectedSlot={selectedSlot}
            snap={snap}
            onSelect={setSelectedSlot}
            onChangeBlock={updateBlock}
            onGestureStart={() =>
              setState((current) => {
                if (current.kind === "ready") history.push(current.layout);
                return current;
              })
            }
            onGestureEnd={() => undefined}
          />
          <BlockInspector
            blocks={state.layout.blocks}
            selectedSlot={selectedSlot}
            onSelect={setSelectedSlot}
            onRotateBy={rotateSelectedBy}
            onReset={resetArrangement}
          />
        </div>
      )}
    </div>
  );
}
