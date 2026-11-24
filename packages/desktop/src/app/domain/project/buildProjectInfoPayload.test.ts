import { describe, expect, it } from "vitest";
import {
  formatProjectDisplayName,
  formatProjectSlug,
} from "../../../projectRules";
import { toPersistableProject } from "../../shell/types";
import type { NewProjectPayload } from "../../shell/types";
import { buildProjectInfoPayload } from "./buildProjectInfoPayload";

const band = { id: "band-1", code: "BND", name: "The Band" };
const todayIso = "2026-11-12";
const nowIso = "2026-11-12T10:00:00.000Z";

const layout = {
  stage: { widthM: 10, depthM: 6 },
  blocks: [
    {
      slot: "drums" as const,
      centerXM: 1.5,
      centerYM: 4.2,
      widthM: 2.8,
      depthM: 1.6,
      rotationDeg: 45,
    },
  ],
};

const storedExtras = {
  stageplan: {
    layout,
    powerOverridesByMusician: { "bass-1": { voltage: 230, sockets: 5 } },
  },
  inputOrder: ["kick_in", "snare_top"],
  notes: {
    disabled: ["drum_riser_required"],
    overrides: { no_foh_engineer: "Custom wording." },
  },
};

const existingEvent = {
  id: "p-1",
  slug: "old-slug",
  displayName: "Old name",
  purpose: "event",
  templateType: "event",
  status: "active",
  eventDate: "2027-01-10",
  eventVenue: "Old Town",
  bandRef: "band-1",
  documentDate: "2026-10-01",
  createdAt: "2026-10-01T08:00:00.000Z",
  updatedAt: "2026-10-02T08:00:00.000Z",
  contentUpdatedAt: "2026-10-02T08:00:00.000Z",
  lineup: { drums: ["d1"], vocs: ["v1"] },
  overlays: { leadVocals: ["v1"], backVocals: [] },
  bandLeaderId: "d1",
  ...storedExtras,
  futureField: { kept: true },
} as NewProjectPayload;

const existingGeneric = {
  id: "p-2",
  slug: "old-generic-slug",
  displayName: "Old generic name",
  purpose: "generic",
  templateType: "generic",
  status: "active",
  note: "Tour 2026",
  bandRef: "band-1",
  documentDate: "2026-01-01",
  createdAt: "2026-01-05T08:00:00.000Z",
  lineup: { drums: ["d1"] },
  overlays: { leadVocals: [], backVocals: [] },
  bandLeaderId: "d1",
  ...storedExtras,
  futureField: { kept: true },
} as NewProjectPayload;

const eventForm = {
  purpose: "event" as const,
  eventDate: "2027-03-05",
  eventVenue: " New Town ",
  documentDate: todayIso,
};

describe("buildProjectInfoPayload: editing an event project", () => {
  const payload = buildProjectInfoPayload({
    existingProject: existingEvent,
    id: "p-1",
    band,
    form: eventForm,
    nowIso,
  });

  it("keeps stageplan, inputOrder and notes of the stored project", () => {
    expect(payload.stageplan).toEqual(storedExtras.stageplan);
    expect(payload.inputOrder).toEqual(storedExtras.inputOrder);
    expect(payload.notes).toEqual(storedExtras.notes);
  });

  it("keeps a field the payload type does not know", () => {
    expect(payload).toHaveProperty("futureField", { kept: true });
  });

  it("keeps lineup, overlays, band leader and creation time", () => {
    expect(payload.lineup).toEqual(existingEvent.lineup);
    expect(payload.overlays).toEqual(existingEvent.overlays);
    expect(payload.bandLeaderId).toBe("d1");
    expect(payload.createdAt).toBe("2026-10-01T08:00:00.000Z");
  });

  it("overwrites the fields the form edits and the ones derived from them", () => {
    const namingSource = {
      purpose: "event" as const,
      eventDate: "2027-03-05",
      eventVenue: " New Town ",
      documentDate: todayIso,
    };
    expect(payload.eventDate).toBe("2027-03-05");
    expect(payload.eventVenue).toBe("New Town");
    expect(payload.bandRef).toBe("band-1");
    expect(payload.documentDate).toBe(todayIso);
    expect(payload.slug).toBe(formatProjectSlug(namingSource, band));
    expect(payload.displayName).toBe(
      formatProjectDisplayName(namingSource, band),
    );
    expect(payload.updatedAt).toBe(nowIso);
    expect(payload.contentUpdatedAt).toBe(nowIso);
  });

  it("still carries stageplan, inputOrder and notes after the persistence whitelist", () => {
    const persisted = toPersistableProject(payload);

    expect(persisted.stageplan).toEqual(storedExtras.stageplan);
    expect(persisted.inputOrder).toEqual(storedExtras.inputOrder);
    expect(persisted.notes).toEqual(storedExtras.notes);
  });

  it("does not mutate the stored project", () => {
    expect(existingEvent.eventVenue).toBe("Old Town");
    expect(existingEvent.slug).toBe("old-slug");
  });
});

describe("buildProjectInfoPayload: editing a generic project", () => {
  it("keeps stageplan, inputOrder, notes and an unknown field", () => {
    const payload = buildProjectInfoPayload({
      existingProject: existingGeneric,
      id: "p-2",
      band,
      form: { purpose: "generic", validityYear: "2027", note: " Tour 2027 " },
      nowIso,
    });

    expect(payload.stageplan).toEqual(storedExtras.stageplan);
    expect(payload.inputOrder).toEqual(storedExtras.inputOrder);
    expect(payload.notes).toEqual(storedExtras.notes);
    expect(payload).toHaveProperty("futureField", { kept: true });
    expect(payload.note).toBe("Tour 2027");
    expect(payload.documentDate).toBe("2027-01-01");
  });

  it("removes the stored note when the form clears it", () => {
    const payload = buildProjectInfoPayload({
      existingProject: existingGeneric,
      id: "p-2",
      band,
      form: { purpose: "generic", validityYear: "2026", note: "  " },
      nowIso,
    });

    expect("note" in payload).toBe(false);
  });
});

describe("buildProjectInfoPayload: editing a project that is not active", () => {
  const archived = {
    ...existingEvent,
    status: "archived",
    archivedAt: "2026-10-20T08:00:00.000Z",
    trashedAt: "2026-10-21T08:00:00.000Z",
    purgeAt: "2026-11-20T08:00:00.000Z",
  } as NewProjectPayload;

  const payload = buildProjectInfoPayload({
    existingProject: archived,
    id: "p-1",
    band,
    form: eventForm,
    nowIso,
  });

  it("saves the project as active, as it did before the extraction", () => {
    expect(payload.status).toBe("active");
  });

  it("does not carry the archive and trash markers over", () => {
    expect("archivedAt" in payload).toBe(false);
    expect("trashedAt" in payload).toBe(false);
    expect("purgeAt" in payload).toBe(false);
  });

  it("still keeps stageplan, inputOrder and notes", () => {
    expect(payload.stageplan).toEqual(storedExtras.stageplan);
    expect(payload.inputOrder).toEqual(storedExtras.inputOrder);
    expect(payload.notes).toEqual(storedExtras.notes);
  });
});

describe("buildProjectInfoPayload: new project", () => {
  it("builds the same event payload as before the extraction", () => {
    const namingSource = {
      purpose: "event" as const,
      eventDate: "2027-03-05",
      eventVenue: " New Town ",
      documentDate: todayIso,
    };

    const payload = buildProjectInfoPayload({
      existingProject: null,
      id: "new-1",
      band,
      form: eventForm,
      nowIso,
    });

    expect(payload).toStrictEqual({
      id: "new-1",
      slug: formatProjectSlug(namingSource, band),
      displayName: formatProjectDisplayName(namingSource, band),
      purpose: "event",
      templateType: "event",
      status: "active",
      eventDate: "2027-03-05",
      eventVenue: "New Town",
      bandRef: "band-1",
      documentDate: todayIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      contentUpdatedAt: nowIso,
      lineup: undefined,
      overlays: undefined,
      bandLeaderId: undefined,
    });
  });

  it("builds the same generic payload as before the extraction", () => {
    const namingSource = {
      purpose: "generic" as const,
      documentDate: "2027-01-01",
      note: " Tour ",
    };

    const payload = buildProjectInfoPayload({
      existingProject: null,
      id: "new-2",
      band,
      form: { purpose: "generic", validityYear: "2027", note: " Tour " },
      nowIso,
    });

    expect(payload).toStrictEqual({
      id: "new-2",
      slug: formatProjectSlug(namingSource, band),
      displayName: formatProjectDisplayName(namingSource, band),
      purpose: "generic",
      templateType: "generic",
      status: "active",
      bandRef: "band-1",
      documentDate: "2027-01-01",
      note: "Tour",
      createdAt: nowIso,
      updatedAt: nowIso,
      contentUpdatedAt: nowIso,
      lineup: undefined,
      overlays: undefined,
      bandLeaderId: undefined,
    });
  });

  it("omits the note key for a generic project without a note", () => {
    const payload = buildProjectInfoPayload({
      existingProject: null,
      id: "new-3",
      band,
      form: { purpose: "generic", validityYear: "2027", note: "" },
      nowIso,
    });

    expect("note" in payload).toBe(false);
  });
});
