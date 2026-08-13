import { useEffect, useState } from "react";
import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanLayout,
} from "../../../../../src/domain/model/types";
import { NOMINAL_STAGE } from "../../../../../src/domain/stageplan/layout/defaultLayout";
import { mergeWithLineup } from "../../../../../src/domain/stageplan/layout/mergeWithLineup";
import { EditorToolbar } from "../components/stageplan/EditorToolbar";
import { StageCanvas } from "../components/stageplan/StageCanvas";
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
  }, [id]);

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

  if (state.kind === "loading")
    return <div className="stage-editor__status">Načítám…</div>;
  if (state.kind === "error")
    return <div className="stage-editor__status">{state.message}</div>;

  const area = state.layout.stage ?? NOMINAL_STAGE;

  return (
    <div className="stage-editor">
      <EditorToolbar
        stage={state.layout.stage}
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
        <StageCanvas
          area={area}
          blocks={state.layout.blocks}
          selectedSlot={selectedSlot}
          snap={true}
          onSelect={setSelectedSlot}
          onChangeBlock={updateBlock}
          onGestureStart={() => undefined}
          onGestureEnd={() => undefined}
        />
      )}
    </div>
  );
}
