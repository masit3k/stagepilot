import type { DrumSetup, PadChannels, PadMode } from "./drumSetup.js";

export type DrumCatalogEntry = {
  key: string;
  label: string;
  note?: string;
};

const DRUM_NOTES = {
  kickOut: "Beta 52A / SE V Kick / e602 / D6 / D112 – kick mic stand",
  kickIn: "TG D71 / SE BL8 / Beta 91A",
  snareTop: "SM57 / Beta 57A / i5 / TG D57 – small boom mic stand",
  snareBottom: "e904 / e604 (alt. SM57 / Beta 57A) – small boom mic stand",
  hihat: "Condenser mic – small boom mic stand",
  tom: "e904 / e604 / D2",
  floorTom: "e904 / e604 / D4 (alt. D112)",
  overhead: "Condenser mic – boom mic stand",
  snareExtra: "SM57 / Beta 57A / i5 – small boom mic stand",
  pad: "TS jack 6.3mm – DI box",
} as const;

function padLabel(mode: PadMode, channels: PadChannels): string {
  const modeLabel = mode === "backing" ? "BACKING" : "SFX";
  if (channels === "stereo") return `PAD L/R (${modeLabel}, stereo)`;
  return `PAD (${modeLabel}, mono)`;
}

export function drumCatalogForSetup(setup: DrumSetup): DrumCatalogEntry[] {
  const entries: DrumCatalogEntry[] = [
    { key: "dr_kick_out", label: "Kick OUT", note: DRUM_NOTES.kickOut },
    { key: "dr_kick_in", label: "Kick IN", note: DRUM_NOTES.kickIn },
    { key: "dr_snare1_top", label: "Snare 1 TOP", note: DRUM_NOTES.snareTop },
    { key: "dr_snare1_bottom", label: "Snare 1 BOTTOM", note: DRUM_NOTES.snareBottom },
  ];

  if (setup.hasHiHat) entries.push({ key: "dr_hihat", label: "Hi-hat", note: DRUM_NOTES.hihat });

  for (let i = 1; i <= setup.tomCount; i++) {
    entries.push({ key: `dr_tom_${i}`, label: `Tom ${i}`, note: DRUM_NOTES.tom });
  }

  for (let i = 1; i <= setup.floorTomCount; i++) {
    entries.push({ key: `dr_floor_${i}`, label: `Floor ${i}`, note: DRUM_NOTES.floorTom });
  }

  if (setup.hasOverheads) {
    entries.push({ key: "dr_oh_l", label: "OH L", note: DRUM_NOTES.overhead });
    entries.push({ key: "dr_oh_r", label: "OH R", note: DRUM_NOTES.overhead });
  }

  for (let i = 0; i < setup.extraSnareCount; i++) {
    const snareIndex = i + 2;
    entries.push({
      key: `dr_snare${snareIndex}_top`,
      label: `Snare ${snareIndex} TOP`,
      note: DRUM_NOTES.snareExtra,
    });
  }

  if (setup.pad.enabled) {
    if (setup.pad.channels === "mono") {
      entries.push({
        key: `dr_pad_${setup.pad.channels}_${setup.pad.mode}`,
        label: padLabel(setup.pad.mode, setup.pad.channels),
        note: DRUM_NOTES.pad,
      });
    } else {
      entries.push({
        key: `dr_pad_${setup.pad.channels}_${setup.pad.mode}_l`,
        label: `PAD L (${setup.pad.mode === "backing" ? "BACKING" : "SFX"}, stereo)`,
        note: DRUM_NOTES.pad,
      });
      entries.push({
        key: `dr_pad_${setup.pad.channels}_${setup.pad.mode}_r`,
        label: `PAD R (${setup.pad.mode === "backing" ? "BACKING" : "SFX"}, stereo)`,
        note: DRUM_NOTES.pad,
      });
    }
  }

  return entries;
}
