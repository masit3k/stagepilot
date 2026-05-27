import { describe, expect, it } from "vitest";
import type { ProjectJsonV2 } from "../../domain/model/types.js";
import {
  normalizeLegacyVocalOverlayArrayForCleanup,
  normalizeProject,
} from "./normalizeProject.js";

const base: ProjectJsonV2 = {
  id: "p-1",
  bandRef: "band-1",
  purpose: "generic",
  documentDate: "2026-01-01",
  lineup: { vocs: ["voc-1", "voc-2"], guitar: ["gtr-1"] },
};

describe("normalizeLegacyVocalOverlayArrayForCleanup", () => {
  it("passes through canonical string arrays unchanged", () => {
    expect(normalizeLegacyVocalOverlayArrayForCleanup(["a", "b", "c"])).toEqual(
      ["a", "b", "c"],
    );
  });

  it("converts {slot, musicianId} objects to strings sorted by slot", () => {
    expect(
      normalizeLegacyVocalOverlayArrayForCleanup([
        { slot: 2, musicianId: "b" },
        { slot: 1, musicianId: "a" },
        { slot: 3, musicianId: "c" },
      ]),
    ).toEqual(["a", "b", "c"]);
  });

  it("falls back to array order when slot is absent", () => {
    expect(
      normalizeLegacyVocalOverlayArrayForCleanup([
        { musicianId: "x" },
        { musicianId: "y" },
      ]),
    ).toEqual(["x", "y"]);
  });

  it("deduplicates musician IDs preserving first occurrence by slot order", () => {
    expect(
      normalizeLegacyVocalOverlayArrayForCleanup([
        { slot: 2, musicianId: "a" },
        { slot: 1, musicianId: "a" },
        { slot: 3, musicianId: "b" },
      ]),
    ).toEqual(["a", "b"]);
  });

  it("skips objects missing musicianId", () => {
    expect(
      normalizeLegacyVocalOverlayArrayForCleanup([
        { slot: 1, musicianId: "a" },
        { slot: 2 },
        { slot: 3, musicianId: "b" },
      ]),
    ).toEqual(["a", "b"]);
  });

  it("returns empty array for non-array input", () => {
    expect(normalizeLegacyVocalOverlayArrayForCleanup(null)).toEqual([]);
    expect(normalizeLegacyVocalOverlayArrayForCleanup(undefined)).toEqual([]);
    expect(normalizeLegacyVocalOverlayArrayForCleanup("string")).toEqual([]);
  });

  it("is idempotent — strings pass through unchanged", () => {
    const input = ["lead-1", "lead-2"];
    const first = normalizeLegacyVocalOverlayArrayForCleanup(input);
    const second = normalizeLegacyVocalOverlayArrayForCleanup(first);
    expect(second).toEqual(["lead-1", "lead-2"]);
  });
});

describe("normalizeProject", () => {
  it("keeps only canonical overlays in normalized project", () => {
    const normalized = normalizeProject({
      ...base,
      overlays: {
        leadVocals: ["voc-2"],
        backVocals: ["gtr-1"],
        talkback: { mode: "assigned", ownerId: "gtr-1" },
      },
      talkbackOverride: { mode: "assigned", musicianId: "legacy" },
    } as ProjectJsonV2);

    expect(normalized.overlays).toEqual({
      leadVocals: ["voc-2"],
      backVocals: ["gtr-1"],
      talkback: { mode: "assigned", ownerId: "gtr-1" },
    });
    expect(normalized.talkbackOverride).toBeUndefined();
  });

  it("drops invalid talkback owner outside lineup", () => {
    const normalized = normalizeProject({
      ...base,
      overlays: {
        talkback: { mode: "assigned", ownerId: "ghost" },
      },
    } as ProjectJsonV2);

    expect(normalized.overlays?.talkback).toEqual({
      mode: "none",
      ownerId: null,
    });
  });

  it("converts legacy {slot, musicianId} overlay objects to strings in project", () => {
    const normalized = normalizeProject({
      ...base,
      overlays: {
        leadVocals: [
          { slot: 2, musicianId: "voc-2" },
          { slot: 1, musicianId: "voc-1" },
        ] as unknown as string[],
        backVocals: [{ slot: 1, musicianId: "gtr-1" }] as unknown as string[],
      },
    } as ProjectJsonV2);

    expect(normalized.overlays?.leadVocals).toEqual(["voc-1", "voc-2"]);
    expect(normalized.overlays?.backVocals).toEqual(["gtr-1"]);
  });

  it("deduplicates overlay musician IDs and preserves first occurrence", () => {
    const normalized = normalizeProject({
      ...base,
      overlays: {
        leadVocals: ["voc-1", "voc-2", "voc-1"],
        backVocals: ["gtr-1", "gtr-1"],
      },
    } as ProjectJsonV2);

    expect(normalized.overlays?.leadVocals).toEqual(["voc-1", "voc-2"]);
    expect(normalized.overlays?.backVocals).toEqual(["gtr-1"]);
  });

  it("normalizes lineup roles and removes duplicate musicians per role", () => {
    const normalized = normalizeProject({
      ...base,
      lineup: {
        drums: ["dr-1", "dr-2", "dr-1"],
        bass: "b-1",
        guitar: null,
      },
    } as ProjectJsonV2);

    expect(normalized.lineup).toEqual({
      drums: [
        { slot: 1, musicianId: "dr-1" },
        { slot: 2, musicianId: "dr-2" },
      ],
      bass: [{ slot: 1, musicianId: "b-1" }],
      guitar: [],
      keys: [],
      vocs: [],
    });
  });
});
