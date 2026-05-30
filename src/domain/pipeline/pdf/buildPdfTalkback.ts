import type { DataRepository } from "../../../infra/fs/repo.js";
import type { Group } from "../../model/groups.js";
import type { Musician } from "../../model/types.js";

export type PdfTalkbackInput = {
  key: string;
  label: string;
  group: Group;
  note?: string;
  ownerRole: Group;
  ownerMusicianId: string;
};

function normalizeTalkbackLabel(label: string): string {
  return label.replace(
    /^Talkback\s*(?:[-\u2013\u2014]|\()\s*([^)]+?)\)?$/i,
    (_all, owner: string) => `Talkback (${owner.trim()})`,
  );
}

export function buildPdfTalkbackInputs(args: {
  talkbackOwnerId: string | undefined;
  membersById: Map<string, Musician>;
  ownerGroupByMusicianId: Map<string, Group>;
  repo: DataRepository;
}): PdfTalkbackInput[] {
  const { talkbackOwnerId, membersById, ownerGroupByMusicianId, repo } = args;
  if (!talkbackOwnerId) return [];

  const talkbackOwner = membersById.get(talkbackOwnerId);
  const talkbackOwnerGroup = ownerGroupByMusicianId.get(talkbackOwnerId);
  if (!talkbackOwner || !talkbackOwnerGroup) return [];

  const context = `while resolving talkback for musician "${talkbackOwner.id}" (role: ${talkbackOwnerGroup})`;
  let ent: ReturnType<DataRepository["getPreset"]>;
  try {
    ent = repo.getPreset("talkback");
  } catch {
    throw new Error(`Missing talkback preset reference "talkback" ${context}.`);
  }

  if (ent.type !== "talkback_type") {
    throw new Error(
      `PresetItem(kind=talkback) ref="talkback" points to type="${ent.type}" ${context}.`,
    );
  }

  return [
    {
      key: ent.input.key.replace("{ownerKey}", talkbackOwnerGroup),
      label: normalizeTalkbackLabel(
        ent.input.label
          .replace("{ownerKey}", talkbackOwnerGroup)
          .replace("{ownerLabel}", talkbackOwnerGroup),
      ),
      group: ent.group,
      note: ent.input.note
        ? ent.input.note
            .replace("{ownerKey}", talkbackOwnerGroup)
            .replace("{ownerLabel}", talkbackOwnerGroup)
        : undefined,
      ownerRole: talkbackOwnerGroup,
      ownerMusicianId: talkbackOwner.id,
    },
  ];
}
