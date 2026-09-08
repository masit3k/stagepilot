import { describe, expect, it } from "vitest";
import { reconcileOverlaysAfterLineupChange } from "./reconcileOverlaysAfterLineupChange.js";

const SINGERS = new Set([
  "krecmer_matej",
  "ernst_filip",
  "plasil_pavel",
  "cetel_tomas",
  "mludek_tomas",
]);

const canSing = (musicianId: string): boolean => SINGERS.has(musicianId);

describe("reconcileOverlaysAfterLineupChange", () => {
  it("keeps overlays untouched when no slot changed", () => {
    const overlays = {
      leadVocals: ["krecmer_matej"],
      backVocals: ["cetel_tomas", "plasil_pavel"],
    };

    expect(
      reconcileOverlaysAfterLineupChange({
        overlays,
        slotChanges: [],
        canSing,
      }),
    ).toEqual(overlays);
  });

  it("replaces a back vocalist with the singing musician who took the slot", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: { backVocals: ["plasil_pavel", "cetel_tomas"] },
        slotChanges: [
          {
            previousMusicianId: "plasil_pavel",
            nextMusicianId: "mludek_tomas",
          },
        ],
        canSing,
      }),
    ).toEqual({ backVocals: ["mludek_tomas", "cetel_tomas"] });
  });

  it("keeps the replacement at the array position the removed musician held", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: {
          backVocals: ["krecmer_matej", "plasil_pavel", "cetel_tomas"],
        },
        slotChanges: [
          { previousMusicianId: "plasil_pavel", nextMusicianId: "ernst_filip" },
        ],
        canSing,
      }),
    ).toEqual({
      backVocals: ["krecmer_matej", "ernst_filip", "cetel_tomas"],
    });
  });

  it("only removes the outgoing musician when the replacement cannot sing", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: { backVocals: ["plasil_pavel", "cetel_tomas"] },
        slotChanges: [
          {
            previousMusicianId: "plasil_pavel",
            nextMusicianId: "skalicka_vit",
          },
        ],
        canSing,
      }),
    ).toEqual({ backVocals: ["cetel_tomas"] });
  });

  it("only removes the outgoing musician when the slot is cleared", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: { backVocals: ["plasil_pavel", "cetel_tomas"] },
        slotChanges: [
          { previousMusicianId: "plasil_pavel", nextMusicianId: "" },
        ],
        canSing,
      }),
    ).toEqual({ backVocals: ["cetel_tomas"] });
  });

  it("does not add a singing replacement when the outgoing musician had no overlay", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: { backVocals: ["cetel_tomas"] },
        slotChanges: [
          { previousMusicianId: "plasil_jan", nextMusicianId: "mludek_tomas" },
        ],
        canSing,
      }),
    ).toEqual({ backVocals: ["cetel_tomas"] });
  });

  it("reconciles lead vocals by the same rule", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: { leadVocals: ["plasil_pavel"], backVocals: [] },
        slotChanges: [
          { previousMusicianId: "plasil_pavel", nextMusicianId: "ernst_filip" },
        ],
        canSing,
      }),
    ).toEqual({ leadVocals: ["ernst_filip"], backVocals: [] });
  });

  it("reconciles both overlay roles in one pass", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: {
          leadVocals: ["krecmer_matej"],
          backVocals: ["plasil_pavel"],
        },
        slotChanges: [
          {
            previousMusicianId: "krecmer_matej",
            nextMusicianId: "ernst_filip",
          },
          { previousMusicianId: "plasil_pavel", nextMusicianId: "cetel_tomas" },
        ],
        canSing,
      }),
    ).toEqual({
      leadVocals: ["ernst_filip"],
      backVocals: ["cetel_tomas"],
    });
  });

  it("applies several slot changes hitting the same overlay array", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: {
          backVocals: ["plasil_pavel", "cetel_tomas", "krecmer_matej"],
        },
        slotChanges: [
          {
            previousMusicianId: "plasil_pavel",
            nextMusicianId: "skalicka_vit",
          },
          { previousMusicianId: "cetel_tomas", nextMusicianId: "mludek_tomas" },
        ],
        canSing,
      }),
    ).toEqual({ backVocals: ["mludek_tomas", "krecmer_matej"] });
  });

  it("does not duplicate a replacement who is already in the overlay", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: { backVocals: ["plasil_pavel", "mludek_tomas"] },
        slotChanges: [
          {
            previousMusicianId: "plasil_pavel",
            nextMusicianId: "mludek_tomas",
          },
        ],
        canSing,
      }),
    ).toEqual({ backVocals: ["mludek_tomas"] });
  });

  it("hands a lead-vocalist replacement to the invariant, which drops the double role", () => {
    const reconciled = reconcileOverlaysAfterLineupChange({
      overlays: {
        leadVocals: ["ernst_filip"],
        backVocals: ["plasil_pavel"],
      },
      slotChanges: [
        { previousMusicianId: "plasil_pavel", nextMusicianId: "ernst_filip" },
      ],
      canSing,
    });

    // Reconcile jen dosadí náhradu. Dvojroli lead+back řeší jediný zdroj
    // pravdy — `enforceVocalSelectionInvariant` v `packages/desktop`, kterým
    // volající projede výsledek; druhá kontrola tady by dala druhé pravidlo
    // o téže věci. Složení obou hlídá test u volajícího.
    expect(reconciled).toEqual({
      leadVocals: ["ernst_filip"],
      backVocals: ["ernst_filip"],
    });
  });

  it("ignores a slot change that only re-seats the same musician", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: { backVocals: ["plasil_pavel"] },
        slotChanges: [
          {
            previousMusicianId: "plasil_pavel",
            nextMusicianId: "plasil_pavel",
          },
        ],
        canSing,
      }),
    ).toEqual({ backVocals: ["plasil_pavel"] });
  });

  it("preserves overlay keys that are absent from the input", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: { backVocals: ["plasil_pavel"] },
        slotChanges: [
          {
            previousMusicianId: "plasil_pavel",
            nextMusicianId: "mludek_tomas",
          },
        ],
        canSing,
      }),
    ).not.toHaveProperty("leadVocals");
  });

  it("reproduces the reported bug: two non-singing replacements drop both back vocals", () => {
    expect(
      reconcileOverlaysAfterLineupChange({
        overlays: {
          backVocals: [
            "krecmer_matej",
            "ernst_filip",
            "plasil_pavel",
            "cetel_tomas",
          ],
        },
        slotChanges: [
          {
            previousMusicianId: "plasil_pavel",
            nextMusicianId: "skalicka_vit",
          },
          { previousMusicianId: "cetel_tomas", nextMusicianId: "pisa_karel" },
        ],
        canSing,
      }),
    ).toEqual({ backVocals: ["krecmer_matej", "ernst_filip"] });
  });
});
