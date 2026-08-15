import { useCallback, useEffect, useRef, useState } from "react";
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
import { isStageplanLayoutDirty } from "../../../../../src/domain/stageplan/layout/dirty";
import { mergeWithLineup } from "../../../../../src/domain/stageplan/layout/mergeWithLineup";
import { rescaleForStage } from "../../../../../src/domain/stageplan/layout/rescaleForStage";
import type { StageplanPrintGeometry } from "../../../../../src/domain/stageplan/print/printMetrics";
import { resolvePrintScale } from "../../../../../src/domain/stageplan/print/printScale";
import { useToast } from "../../components/ui/toast/useToast";
import { BlockInspector } from "../components/stageplan/BlockInspector";
import { EditorFooter } from "../components/stageplan/EditorFooter";
import { EditorToolbar } from "../components/stageplan/EditorToolbar";
import { StageCanvas } from "../components/stageplan/StageCanvas";
import {
  LABEL_BY_SLOT,
  formatScale,
  narrowestZoneSlot,
} from "../components/stageplan/blockContent";
import { resolveBlockPrint } from "../components/stageplan/blockPrint";
import { useEditorKeyboard } from "../components/stageplan/useEditorKeyboard";
import { useLayoutHistory } from "../components/stageplan/useLayoutHistory";
import { resolveBlockSlotsFromPayload } from "../domain/stageplan/resolveBlockSlotsFromPayload";
import {
  parseProjectPayload,
  readProject,
  saveProjectPayload,
} from "../services/projectsApi";
import { fetchStageplanPrintGeometry } from "../services/stageplanMetrics";
import type { NewProjectPayload } from "../shell/types";
import type { ProjectRouteProps } from "./shared/pageTypes";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; project: NewProjectPayload; layout: StageplanLayout };

export function StagePlanEditorPage({
  id,
  navigate,
  registerNavigationGuard,
}: ProjectRouteProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedSlot, setSelectedSlot] = useState<StageplanBlockSlot | null>(
    null,
  );
  /** Snap je nástroj, ne vlastnost projektu — proto se neukládá. */
  const [snap, setSnap] = useState(true);
  const history = useLayoutHistory();
  const [isSaving, setIsSaving] = useState(false);
  const [printGeometry, setPrintGeometry] =
    useState<StageplanPrintGeometry | null>(null);
  const { notify } = useToast();
  /** Stav, proti kterému se poznává dirty — po každém uložení se posune. */
  const initialLayoutRef = useRef<StageplanLayout | undefined>(undefined);

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
        // Uložený layout, ne výsledek sloučení: doplněný blok po změně lineupu
        // je sám o sobě dirty změna, protože na disku ještě není.
        initialLayoutRef.current = project.stageplan?.layout;
        setState({ kind: "ready", project, layout });
        setSelectedSlot(layout.blocks[0]?.slot ?? null);
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
  }, [id, history.reset]);

  useEffect(() => {
    let cancelled = false;
    fetchStageplanPrintGeometry(id)
      .then((geometry) => {
        if (!cancelled) setPrintGeometry(geometry);
      })
      .catch((error) => {
        // Bez metrik se stopa nenakreslí; editace tím netrpí.
        console.error("[stageplan] print metrics unavailable", error);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const saveLayout = useCallback(
    async (layout: StageplanLayout, project: NewProjectPayload) => {
      setIsSaving(true);
      try {
        await saveProjectPayload({
          projectId: project.id,
          payload: {
            ...project,
            stageplan: { ...project.stageplan, layout },
          },
          // Posunuté rozmístění je změna obsahu rideru, ne kosmetika.
          intent: "content",
        });
        initialLayoutRef.current = layout;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (state.kind !== "ready") return;
    const { project, layout } = state;
    registerNavigationGuard({
      isDirty: () => isStageplanLayoutDirty(initialLayoutRef.current, layout),
      save: () => saveLayout(layout, project),
      discard: () => {
        const initial = initialLayoutRef.current;
        if (initial)
          setState((current) =>
            current.kind === "ready"
              ? { ...current, layout: initial }
              : current,
          );
      },
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, saveLayout, state]);

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
    return <div className="stage-editor__status">Loading…</div>;
  if (state.kind === "error")
    return <div className="stage-editor__status">{state.message}</div>;

  const area = state.layout.stage ?? NOMINAL_STAGE;

  // Jedno měřítko pro plochu i pro čísla v panelu. Stejná funkce jako renderer (R10).
  const printScale = printGeometry
    ? resolvePrintScale({
        stage: area,
        blocks: state.layout.blocks,
        area: printGeometry.area,
        minBoxWidthMm: printGeometry.typography.minBoxWidthMm,
      })
    : null;

  const narrowestSlot = narrowestZoneSlot(state.layout.blocks);
  const scaleNote =
    printScale && narrowestSlot
      ? `SCALE ${formatScale(printScale.mmPerM)} · NARROWEST ZONE: ${LABEL_BY_SLOT[narrowestSlot]}`
      : null;

  const selectedBlock =
    state.layout.blocks.find((block) => block.slot === selectedSlot) ?? null;
  // Stejná funkce, jakou plocha kreslí karty — jiný zdroj by lhal (R10).
  const printedZone = selectedBlock
    ? resolveBlockPrint({
        block: selectedBlock,
        geometry: printGeometry,
        scale: printScale,
      })
    : null;

  return (
    <div className="stage-editor">
      <EditorToolbar
        stage={state.layout.stage}
        snap={snap}
        scaleNote={scaleNote}
        onToggleSnap={() => setSnap((current) => !current)}
        onChangeStage={applyStageSize}
      />
      {state.layout.blocks.length === 0 ? (
        <div className="stage-editor__empty">
          <p>
            This project has no lineup, so there is nothing to arrange on stage.
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(`/projects/${encodeURIComponent(id)}/setup`)
            }
          >
            Open Lineup Setup
          </button>
        </div>
      ) : (
        <div className="stage-editor__body">
          <StageCanvas
            area={area}
            blocks={state.layout.blocks}
            selectedSlot={selectedSlot}
            snap={snap}
            printGeometry={printGeometry}
            printScale={printScale}
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
            printedZone={printedZone}
            onSelect={setSelectedSlot}
            onRotateBy={rotateSelectedBy}
            onReset={resetArrangement}
          />
        </div>
      )}
      <EditorFooter
        isSaving={isSaving}
        isDirty={isStageplanLayoutDirty(initialLayoutRef.current, state.layout)}
        onBack={() => navigate(`/projects/${encodeURIComponent(id)}/setup`)}
        onBackToHub={() => navigate("/")}
        onContinue={async () => {
          if (state.kind !== "ready") return;
          if (isStageplanLayoutDirty(initialLayoutRef.current, state.layout)) {
            try {
              await saveLayout(state.layout, state.project);
            } catch (error) {
              console.error("[stageplan-editor] failed to save layout", error);
              notify("error", "Arrangement could not be saved.");
              return;
            }
            notify("success", "Arrangement saved.");
          }
          navigate(`/projects/${encodeURIComponent(id)}/preview`);
        }}
      />
    </div>
  );
}
