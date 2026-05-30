import {
  compactStereoInputChannelsForPdf,
  resolveStereoPair,
} from "../../formatters/index.js";
import type { Group } from "../../model/groups.js";

export type PdfInputForChannelAssignment = {
  key: string;
  label: string;
  baseLabel?: string;
  compactGroupKey?: string;
  channel?: "L" | "R";
  group: Group;
  note?: string;
  ownerRole: Group;
  ownerMusicianId?: string;
};

export type PdfInputWithChannel = PdfInputForChannelAssignment & {
  ch: number;
};

/**
 * Implements the current PDF channel-numbering behavior documented in
 * docs/architecture/pdf-input-numbering.md.
 */
export function assignPdfChannels(
  sorted: PdfInputForChannelAssignment[],
): PdfInputWithChannel[] {
  const out: PdfInputWithChannel[] = [];
  let nextCh = 1;

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];

    const stereo = b ? resolveStereoPair(a, b) : null;

    if (stereo) {
      const mustStartOdd = stereo.shouldCollapse;

      if (mustStartOdd && nextCh % 2 === 0) {
        out.push({
          ch: nextCh,
          key: `spare_ch_${nextCh}`,
          label: "---",
          group: a.group,
          note: "---",
          ownerRole: a.ownerRole,
        });
        nextCh++;
      }

      const first = stereo.aSide === "L" ? a : b;
      const second = stereo.aSide === "L" ? b : a;

      out.push({ ch: nextCh, ...first });
      out.push({ ch: nextCh + 1, ...second });
      nextCh += 2;

      i++;
      continue;
    }

    out.push({ ch: nextCh, ...a });
    nextCh++;
  }

  return out;
}

export function buildPdfInputRows(inputsWithCh: PdfInputWithChannel[]) {
  return compactStereoInputChannelsForPdf(inputsWithCh);
}
