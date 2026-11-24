import { describe, expect, it } from "vitest";
import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Group,
  Musician,
  NotesTemplate,
  PresetEntity,
  PresetOverridePatch,
  Project,
} from "../model/types.js";
import { buildDocument } from "./buildDocument.js";

const presets: Record<string, PresetEntity> = {
  el_guitar: {
    type: "preset",
    id: "el_guitar",
    label: "Electric guitar",
    group: "guitar",
    inputs: [{ key: "el_guitar", label: "Electric guitar", group: "guitar" }],
  },
  keys_mono: {
    type: "preset",
    id: "keys_mono",
    label: "Keys",
    group: "keys",
    inputs: [{ key: "keys_mono", label: "Keys", group: "keys" }],
  },
  vocal_lead_no_mic: {
    type: "preset",
    id: "vocal_lead_no_mic",
    label: "Lead vocal",
    group: "vocs",
    inputs: [{ key: "voc_lead", label: "Lead vocal", group: "vocs" }],
  },
  wedge_foh: {
    type: "monitor",
    id: "wedge_foh",
    label: "Wedge",
    kind: "wedge",
    supplier: "foh",
  },
  talkback: {
    type: "talkback_type",
    id: "talkback",
    label: "Talkback",
    group: "talkback",
    input: { key: "tb_{ownerKey}", label: "Talkback ({ownerLabel})" },
  },
};

const notes: NotesTemplate = {
  id: "notes_default_cs",
  lang: "cs",
  inputs: [],
  monitors: [],
};

const PRESET_REF_BY_ROLE: Partial<Record<Group, string>> = {
  guitar: "el_guitar",
  keys: "keys_mono",
  vocs: "vocal_lead_no_mic",
};

/**
 * Dva muzikanti v téže roli se stejným presetem; `patches` říká, kdo z nich
 * nese jaký `presetOverride`. Vrací kanály dané skupiny tak, jak je dokument
 * vytiskne.
 */
function buildRoleInputs(
  role: "guitar" | "keys" | "vocs",
  patches: { first?: PresetOverridePatch; second?: PresetOverridePatch },
) {
  const ids = [`${role}-1`, `${role}-2`] as const;
  const musicians = new Map<string, Musician>(
    ids.map((id, index) => [
      id,
      {
        id,
        firstName: `${role}${index + 1}`,
        lastName: "Player",
        group: role,
        presets: [{ kind: "preset", ref: PRESET_REF_BY_ROLE[role] ?? "" }],
      },
    ]),
  );
  const band: Band = {
    id: "band",
    name: "Band",
    bandLeader: ids[0],
    defaultLineup: { [role]: [...ids] },
    defaultOverlays: { leadVocals: [], backVocals: [] },
  };
  const slot = (id: string, patch?: PresetOverridePatch) =>
    patch ? { musicianId: id, presetOverride: patch } : id;
  const project: Project = {
    id: "p-override-scope",
    bandRef: band.id,
    purpose: "event",
    documentDate: "2026-01-01",
    lineup: {
      [role]: [slot(ids[0], patches.first), slot(ids[1], patches.second)],
    },
  };
  const repo: DataRepository = {
    getBand: () => band,
    getMusician: (id) => {
      const musician = musicians.get(id);
      if (!musician) throw new Error(`unknown musician ${id}`);
      return musician;
    },
    getProject: () => project,
    getPreset: (id) => {
      const preset = presets[id];
      if (!preset) throw new Error(`unknown preset ${id}`);
      return preset;
    },
    getNotesTemplate: () => notes,
  };

  return buildDocument(project, repo)
    .inputs.filter((input) => input.group === role)
    .map((input) => ({
      label: input.label,
      note: input.note,
      owner: input.ownerMusicianId,
    }));
}

describe("buildDocument — a musician's presetOverride stays on that musician's channels", () => {
  describe.each([
    { role: "guitar" as const, key: "el_guitar", label: "Electric guitar" },
    { role: "keys" as const, key: "keys_mono", label: "Keys" },
  ])("$role", ({ role, key, label }) => {
    it("update on the second musician leaves the first one's channel and owner alone", () => {
      const rows = buildRoleInputs(role, {
        second: { inputs: { update: [{ key, note: "SECOND ONLY" }] } },
      });

      expect(rows).toEqual([
        { label: `${label} 1`, note: undefined, owner: `${role}-1` },
        { label: `${label} 2`, note: "SECOND ONLY", owner: `${role}-2` },
      ]);
    });

    it("remove on the second musician does not delete the first one's channel", () => {
      const rows = buildRoleInputs(role, {
        second: { inputs: { remove: [key] } },
      });

      // Číslo v názvu se přidává jen tehdy, když roli v dokumentu drží víc
      // muzikantů — tady zbyl jediný kanál.
      expect(rows).toEqual([{ label, note: undefined, owner: `${role}-1` }]);
    });

    it("add on the second musician is owned by the second musician", () => {
      const rows = buildRoleInputs(role, {
        second: {
          inputs: { add: [{ key: "extra", label: "Extra", group: role }] },
        },
      });

      expect(rows.map((row) => row.owner)).toEqual([
        `${role}-1`,
        `${role}-2`,
        `${role}-2`,
      ]);
    });

    it("a patch on the first musician does not reach the second one either", () => {
      const rows = buildRoleInputs(role, {
        first: { inputs: { update: [{ key, note: "FIRST ONLY" }] } },
      });

      expect(rows.map((row) => row.note)).toEqual(["FIRST ONLY", undefined]);
    });
  });

  describe("vocs", () => {
    const addFx: PresetOverridePatch = {
      inputs: { add: [{ key: "voc_fx", label: "Vocal FX", group: "vocs" }] },
    };

    it("update on the second vocalist does not rewrite a channel the first one added", () => {
      const rows = buildRoleInputs("vocs", {
        first: addFx,
        second: {
          inputs: { update: [{ key: "voc_fx", note: "SECOND ONLY" }] },
        },
      });

      expect(rows.map((row) => row.note)).toEqual([undefined]);
    });

    it("remove on the second vocalist does not delete a channel the first one added", () => {
      const rows = buildRoleInputs("vocs", {
        first: addFx,
        second: { inputs: { remove: ["voc_fx"] } },
      });

      expect(rows).toHaveLength(1);
    });

    it("both vocalists can add a channel with the same key", () => {
      const rows = buildRoleInputs("vocs", { first: addFx, second: addFx });

      expect(rows).toHaveLength(2);
    });
  });
});
