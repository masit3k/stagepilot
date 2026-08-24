import { describe, expect, it } from "vitest";
import {
  INPUTS_MODAL_ROLES,
  resolveInputsFieldSections,
  supportsInputsModal,
} from "./resolveInputsFieldSections";

describe("supportsInputsModal", () => {
  it("offers the modal for bass, guitar and keys", () => {
    expect(INPUTS_MODAL_ROLES).toEqual(["bass", "guitar", "keys"]);
    for (const role of ["bass", "guitar", "keys"] as const) {
      expect(supportsInputsModal(role)).toBe(true);
    }
  });

  it("does not offer the modal for drums — the kit is edited through Edit kit", () => {
    expect(supportsInputsModal("drums")).toBe(false);
  });

  it("does not offer the modal for vocs or talkback — the document never reads that patch", () => {
    // Measured (F5d OQ-1): a vocal preset never reaches `document.inputs` at
    // all — `buildMusicianInstrumentInputs` sets it aside as `vocalCapability`
    // — and the printed row is keyed `voc_lead_{slot}`, built from the
    // musician's unpatched presets. A mic-type dropdown here would change the
    // UI preview and nothing in the PDF.
    expect(supportsInputsModal("vocs")).toBe(false);
    expect(supportsInputsModal("talkback")).toBe(false);
  });
});

describe("resolveInputsFieldSections", () => {
  it("gives bass a single unlabelled section on the bass catalog", () => {
    // Bass bypasses the slice split entirely, exactly as `01` does today
    // (`ProjectSetupPage.tsx:2144-2153`).
    expect(
      resolveInputsFieldSections({
        role: "bass",
        effectiveInputs: [
          { key: "el_bass_xlr_amp", label: "Electric bass guitar" },
        ],
      }),
    ).toEqual([{ key: "bass", label: "", catalog: "bass" }]);
  });

  it("keeps bass on one section even with no channels left", () => {
    expect(
      resolveInputsFieldSections({ role: "bass", effectiveInputs: [] }),
    ).toEqual([{ key: "bass", label: "", catalog: "bass" }]);
  });

  it("gives a keys player the keys catalog for the bare `keys` key", () => {
    // M4: this is the mono-keys trap. Before F5d step A both prefix copies
    // dropped `keys`, the shim kicked in and the modal handed out
    // LEAD_VOCS_FIELDS. The channel is verbatim from
    // `data/assets/presets/groups/keys/keys_mono_xlr.json`, which carries no
    // `group` field — so it has to pass on the key alone.
    expect(
      resolveInputsFieldSections({
        role: "keys",
        effectiveInputs: [
          { key: "keys", label: "Keys", note: "XLR out from rack" },
        ],
      }),
    ).toEqual([{ key: "keys", label: "keys", catalog: "keys" }]);
  });

  it("gives a keys player the keys catalog for a stereo pair", () => {
    expect(
      resolveInputsFieldSections({
        role: "keys",
        effectiveInputs: [
          { key: "keys_l", label: "Keys L" },
          { key: "keys_r", label: "Keys R" },
        ],
      }),
    ).toEqual([{ key: "keys", label: "keys", catalog: "keys" }]);
  });

  it("splits a guitarist with an electric and an acoustic into two guitar sections", () => {
    // Both channels carry `group: "guitar"`, which is what
    // `getGroupDefaultPreset` stamps on them (F5d step A) and what
    // `data/assets/presets/groups/guitar/ac_guitar.json` declares. Measured:
    // without that field copy 1 drops `ac_guitar` — see the next test.
    expect(
      resolveInputsFieldSections({
        role: "guitar",
        effectiveInputs: [
          { key: "el_guitar_mic", label: "Electric guitar", group: "guitar" },
          { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
        ],
      }),
    ).toEqual([
      { key: "electric_guitar", label: "electric guitar", catalog: "guitar" },
      { key: "acoustic_guitar", label: "acoustic guitar", catalog: "guitar" },
    ]);
  });

  it("splits the same way when the acoustic channel carries no group", () => {
    // Kanál odvozený z presetu pole `group` **nenese** — žádný z 16 souborů
    // v `data/assets/presets/groups/` ho na prvcích `inputs[]` nemá. Kopie 1
    // pozná `ac_guitar` jen pod sekcí `"acoustic_guitar"`, ne pod `"guitar"`,
    // takže modál se musí zeptat na obě: role `guitar` pokrývá obě
    // schopnostní sekce. Kanál je doslova z
    // `data/assets/presets/groups/guitar/ac_guitar.json`.
    expect(
      resolveInputsFieldSections({
        role: "guitar",
        effectiveInputs: [
          { key: "el_guitar_mic", label: "Electric guitar" },
          {
            key: "ac_guitar",
            label: "Acoustic guitar",
            note: "TS jack 6.3mm – DI box",
          },
        ],
      }),
    ).toEqual([
      { key: "electric_guitar", label: "electric guitar", catalog: "guitar" },
      { key: "acoustic_guitar", label: "acoustic guitar", catalog: "guitar" },
    ]);
  });

  it("gives an acoustic-only guitarist the guitar catalog, not the lead-vocs shim", () => {
    // Změřeno: dřív tenhle kytarista propadl na `{ key: "vocs", catalog:
    // "lead_vocs" }`, takže mu modál `Edit inputs` nabídl výběr vokálního
    // mikrofonu. OQ-1 dává modál rolím `bass`, `guitar` a `keys` — akustická
    // kytara **je** guitar, takže mezera byla v rozpoznání kanálu, ne v bráně.
    expect(
      resolveInputsFieldSections({
        role: "guitar",
        effectiveInputs: [
          {
            key: "ac_guitar",
            label: "Acoustic guitar",
            note: "TS jack 6.3mm – DI box",
          },
        ],
      }),
    ).toEqual([
      { key: "acoustic_guitar", label: "acoustic guitar", catalog: "guitar" },
    ]);
  });

  it("counts a group-stamped acoustic channel once, not twice", () => {
    // `getGroupDefaultPreset` razítkuje `group: "guitar"`, takže takový kanál
    // vyhoví oběma schopnostním sekcím. Sjednocení musí být podle klíče.
    expect(
      resolveInputsFieldSections({
        role: "guitar",
        effectiveInputs: [
          { key: "ac_guitar", label: "Acoustic guitar", group: "guitar" },
        ],
      }),
    ).toEqual([
      { key: "acoustic_guitar", label: "acoustic guitar", catalog: "guitar" },
    ]);
  });

  it("does not hand an acoustic guitar channel to a modal of another role", () => {
    // Sjednocení se smí týkat výhradně role `guitar`.
    expect(
      resolveInputsFieldSections({
        role: "keys",
        effectiveInputs: [{ key: "ac_guitar", label: "Acoustic guitar" }],
      }),
    ).toEqual([{ key: "vocs", label: "", catalog: "lead_vocs" }]);
  });

  it("ignores channels that belong to another slice of the same owner", () => {
    // A guitarist who also sings carries a vocal channel; the guitar modal
    // must not grow a vocal section out of it.
    expect(
      resolveInputsFieldSections({
        role: "guitar",
        effectiveInputs: [
          { key: "el_guitar_mic", label: "Electric guitar" },
          { key: "voc_input", label: "Vocal", group: "vocs" },
        ],
      }),
    ).toEqual([
      { key: "electric_guitar", label: "electric guitar", catalog: "guitar" },
    ]);
  });

  it("falls back to a single lead-vocs section when no channel is recognised (OQ-2)", () => {
    // Today's shim, carried over unchanged. After step A the only way to get
    // here is having no channels of your own slice at all.
    expect(
      resolveInputsFieldSections({ role: "guitar", effectiveInputs: [] }),
    ).toEqual([{ key: "vocs", label: "", catalog: "lead_vocs" }]);
  });

  it("returns no sections for a role the modal is not offered for", () => {
    expect(
      resolveInputsFieldSections({ role: "drums", effectiveInputs: [] }),
    ).toEqual([]);
    expect(
      resolveInputsFieldSections({
        role: "vocs",
        effectiveInputs: [{ key: "voc_input", label: "Vocal" }],
      }),
    ).toEqual([]);
  });
});
