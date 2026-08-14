import type { StageplanStageSize } from "../../../../../../src/domain/model/types";
import { StageSizeFields } from "./StageSizeFields";

type EditorToolbarProps = {
  stage: StageplanStageSize | null;
  snap: boolean;
  scaleNote: string | null;
  onToggleSnap: () => void;
  onChangeStage: (next: StageplanStageSize | null) => void;
};

/**
 * Nástrojové čtverce z prototypu tu nejsou: tažení i rotace fungují přímo, tak
 * by to byly ovladače bez funkce — stejný důvod, proč vypadl popisek ZOOM.
 * Tab `PDF PREVIEW` vypadl v F6: dělal totéž co primary v patičce, jen bez
 * uložení, takže vedly na stejné místo dvě cesty s jinou semantikou (R2).
 */
export function EditorToolbar({
  stage,
  snap,
  scaleNote,
  onToggleSnap,
  onChangeStage,
}: EditorToolbarProps) {
  return (
    <div className="stage-toolbar">
      <div className="stage-toolbar__tabs">
        <span className="stage-tab stage-tab--active">STAGE PLAN</span>
        <span className="stage-tab stage-tab--disabled">INPUT LIST</span>
      </div>
      <button
        type="button"
        className={`stage-snap${snap ? " stage-snap--on" : ""}`}
        onClick={onToggleSnap}
      >
        {snap ? "SNAP 10 CM · 15°" : "SNAP OFF"}
      </button>
      <div className="stage-toolbar__meta">
        {scaleNote ? (
          <span className="stage-toolbar__scale">{scaleNote}</span>
        ) : null}
        <StageSizeFields stage={stage} onChange={onChangeStage} />
      </div>
    </div>
  );
}
