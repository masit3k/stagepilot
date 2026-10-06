import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { buildBandDraftContext } from "../../../../../src/domain/band/buildBandDraftContext";
import type { BandDraft } from "../../../../../src/domain/band/buildBandFromDraft";
import type { Musician } from "../../../../../src/domain/model/types";
import {
  describeApiError,
  listBandSummaries,
  loadBandFormData,
  saveBandDraft,
} from "./bandsApi";

const invokeMock = vi.mocked(invoke);

const BASSIST: Musician = {
  id: "krecmer_matej",
  firstName: "Matěj",
  lastName: "Krečmer",
  group: "bass",
  presets: [],
};

const CONTEXT = buildBandDraftContext({
  musicians: [BASSIST],
  presets: [],
  bands: [],
});

function draft(overrides: Partial<BandDraft> = {}): BandDraft {
  return {
    name: "Duo Band",
    code: "DB",
    bandLeaderId: "krecmer_matej",
    lineup: { bass: ["krecmer_matej"] },
    leadVocalIds: [],
    contact: { musicianId: "krecmer_matej", phone: "+420731247870" },
    ...overrides,
  };
}

function commandsCalled(): string[] {
  return invokeMock.mock.calls.map((call) => call[0]);
}

function argsOf(callIndex: number): Record<string, unknown> {
  const args = invokeMock.mock.calls[callIndex]?.[1];
  if (
    !args ||
    Array.isArray(args) ||
    args instanceof ArrayBuffer ||
    args instanceof Uint8Array
  ) {
    throw new Error(`invoke call ${callIndex} has no object arguments`);
  }
  return args;
}

beforeEach(() => {
  invokeMock.mockReset();
});

describe("saveBandDraft", () => {
  it("writes the contact before the band", async () => {
    invokeMock.mockResolvedValue(undefined);

    const result = await saveBandDraft(draft(), CONTEXT);

    expect(result).toEqual({ ok: true, bandId: "duo_band" });
    expect(commandsCalled()).toEqual(["write_contact", "write_band"]);
    expect(argsOf(0).contactId).toBe("krecmer_matej");
    expect(argsOf(1)).toMatchObject({ bandId: "duo_band", expectNew: true });
    expect(JSON.parse(String(argsOf(1).json))).toMatchObject({
      id: "duo_band",
      bandLeader: "krecmer_matej",
      bandLeaderId: "krecmer_matej",
      defaultContactId: "krecmer_matej",
    });
  });

  it("writes nothing when the domain rejects the draft", async () => {
    const result = await saveBandDraft(draft({ name: "" }), CONTEXT);

    expect(result.ok ? null : result.kind).toBe("invalid");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("writes only the band when there is no contact", async () => {
    invokeMock.mockResolvedValue(undefined);

    await saveBandDraft(draft({ contact: undefined }), CONTEXT);

    expect(commandsCalled()).toEqual(["write_band"]);
  });

  it("updates an existing band without expectNew", async () => {
    invokeMock.mockResolvedValue(undefined);

    await saveBandDraft(
      draft({ existingId: "duo_band", contact: undefined }),
      CONTEXT,
    );

    expect(argsOf(0)).toMatchObject({ bandId: "duo_band", expectNew: false });
  });

  it("turns BAND_EXISTS into a name error and reports the written contact", async () => {
    invokeMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce({
      code: "BAND_EXISTS",
      message: "A band already exists at x.",
    });

    const result = await saveBandDraft(draft(), CONTEXT);

    expect(result).toEqual({
      ok: false,
      kind: "bandExists",
      contactWritten: true,
      errors: [
        { field: "name", message: "A band with this name already exists." },
      ],
    });
  });

  it("does not write the band when the contact write fails", async () => {
    invokeMock.mockRejectedValueOnce({
      code: "CONTACT_WRITE_FAILED",
      message: "disk full",
    });

    const result = await saveBandDraft(draft(), CONTEXT);

    expect(result).toEqual({
      ok: false,
      kind: "writeFailed",
      message: "disk full",
      contactWritten: false,
    });
    expect(commandsCalled()).toEqual(["write_contact"]);
  });

  it("reports a band write failure after the contact was written", async () => {
    invokeMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ code: "BAND_WRITE_FAILED", message: "locked" });

    const result = await saveBandDraft(draft(), CONTEXT);

    expect(result).toEqual({
      ok: false,
      kind: "writeFailed",
      message: "locked",
      contactWritten: true,
    });
  });
});

describe("describeApiError", () => {
  it("reads code and message from an ApiError, a string and an Error", () => {
    expect(
      describeApiError({
        code: "BAND_READ_FAILED",
        message: "Invalid JSON in x.json",
      }),
    ).toEqual({
      code: "BAND_READ_FAILED",
      message: "Invalid JSON in x.json",
    });
    expect(describeApiError("plain")).toEqual({ code: null, message: "plain" });
    expect(describeApiError(new Error("boom"))).toEqual({
      code: null,
      message: "boom",
    });
  });
});

describe("listBandSummaries", () => {
  it("combines list_bands with the lineup from each band file", async () => {
    invokeMock
      .mockResolvedValueOnce([{ id: "duo_band", name: "Duo Band", code: "DB" }])
      .mockResolvedValueOnce({
        id: "duo_band",
        bandLeaderId: "krecmer_matej",
        defaultLineup: { bass: ["krecmer_matej"] },
      });

    await expect(listBandSummaries()).resolves.toEqual([
      {
        kind: "ok",
        id: "duo_band",
        name: "Duo Band",
        code: "DB",
        memberCount: 1,
        isIncomplete: false,
      },
    ]);
    expect(commandsCalled()).toEqual(["list_bands", "read_band"]);
  });

  it("turns a missing or broken band file into an error item and keeps the others", async () => {
    invokeMock
      .mockResolvedValueOnce([
        { id: "duo_band", name: "Duo Band", code: "DB" },
        { id: "lost_band", name: "Lost Band", code: "LB" },
        { id: "broken_band", name: "Broken Band", code: "BB" },
      ])
      .mockResolvedValueOnce({
        id: "duo_band",
        bandLeaderId: "krecmer_matej",
        defaultLineup: { bass: ["krecmer_matej"] },
      })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce({
        code: "BAND_READ_FAILED",
        message:
          "Invalid JSON in C:/StagePilot/catalog/bands/broken_band.json (EOF)",
      });

    const items = await listBandSummaries();

    expect(items.map((item) => item.kind)).toEqual(["ok", "error", "error"]);
    expect(items[1]).toMatchObject({
      kind: "error",
      id: "lost_band",
      name: "Lost Band",
    });
    expect(items[1]?.kind === "error" ? items[1].message : "").toContain(
      "catalog/bands/lost_band.json",
    );
    expect(items[2]).toEqual({
      kind: "error",
      id: "broken_band",
      name: "Broken Band",
      message:
        "Invalid JSON in C:/StagePilot/catalog/bands/broken_band.json (EOF)",
    });
  });
});

describe("loadBandFormData", () => {
  it("reads the default contact of the edited band", async () => {
    invokeMock
      .mockResolvedValueOnce([BASSIST])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({
        id: "duo_band",
        defaultContactId: "krecmer_matej",
      })
      .mockResolvedValueOnce({
        id: "krecmer_matej",
        firstName: "Matěj",
        lastName: "Krečmer",
        phone: "1",
      });

    const data = await loadBandFormData("duo_band");

    expect(commandsCalled()).toEqual([
      "list_catalog_musicians",
      "list_presets",
      "list_bands",
      "read_band",
      "read_contact",
    ]);
    expect(argsOf(4)).toEqual({ contactId: "krecmer_matej" });
    expect(data.contact?.phone).toBe("1");
  });
});
