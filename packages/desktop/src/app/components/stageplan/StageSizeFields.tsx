import { useEffect, useState } from "react";
import type { StageplanStageSize } from "../../../../../../src/domain/model/types";

type StageSizeFieldsProps = {
  stage: StageplanStageSize | null;
  onChange: (next: StageplanStageSize | null) => void;
};

function toDraft(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function parseMeters(value: string): number | null {
  const numeric = Number(value.trim().replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/**
 * Přepočet se pouští teprve na blur nebo Enter. Při každém stisku klávesy by se
 * rozmístění přeškálovalo znovu a znovu a zaokrouhlení by se sčítalo.
 */
export function StageSizeFields({ stage, onChange }: StageSizeFieldsProps) {
  const [widthDraft, setWidthDraft] = useState(toDraft(stage?.widthM));
  const [depthDraft, setDepthDraft] = useState(toDraft(stage?.depthM));

  useEffect(() => {
    setWidthDraft(toDraft(stage?.widthM));
    setDepthDraft(toDraft(stage?.depthM));
  }, [stage]);

  function commit() {
    const widthM = parseMeters(widthDraft);
    const depthM = parseMeters(depthDraft);
    if (widthM !== null && depthM !== null) {
      if (widthM !== stage?.widthM || depthM !== stage?.depthM) {
        onChange({ widthM, depthM });
      }
      return;
    }
    // Prázdná nebo neplatná pole znamenají „rozměr nezadán", ne chybu.
    if (widthDraft.trim() === "" && depthDraft.trim() === "") {
      if (stage !== null) onChange(null);
      return;
    }
    setWidthDraft(toDraft(stage?.widthM));
    setDepthDraft(toDraft(stage?.depthM));
  }

  return (
    <div className="stage-size">
      <span className="stage-size__label">STAGE</span>
      <input
        className="stage-size__input"
        aria-label="Stage width in metres"
        inputMode="decimal"
        placeholder="?"
        value={widthDraft}
        onChange={(event) => setWidthDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span className="stage-size__times">×</span>
      <input
        className="stage-size__input"
        aria-label="Stage depth in metres"
        inputMode="decimal"
        placeholder="?"
        value={depthDraft}
        onChange={(event) => setDepthDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span className="stage-size__unit">{stage ? "m" : "m · NOT SET"}</span>
    </div>
  );
}
