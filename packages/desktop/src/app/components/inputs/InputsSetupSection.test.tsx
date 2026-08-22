import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  MusicianSetupPreset,
  Preset,
} from "../../../../../../src/domain/model/types";
import {
  applyPresetOverride,
  normalizeSetupOverridePatch,
} from "../../../../../../src/domain/rules/presetOverride";
import { resolveDroppedUserEdits } from "../../domain/inputs/resolveDroppedUserEdits";
import { buildSetupFieldCatalog } from "../../pages/shared/setupConstants";
import type { EventSetupEditState } from "../setup/adapters/eventSetupAdapter";
import type { DropdownFieldDef } from "../setup/schema/types";
import {
  DropUserEditsDialog,
  InputsSetupDialog,
  InputsSetupSection,
} from "./InputsSetupSection";

/**
 * Fixture kopíruje `data/assets/presets/groups/**`, včetně `setupGroup`
 * a `presetRole` na basových presetech — bez nich `buildBassFields` nepostaví
 * dropdown `Connection` a test na basovou sekci by neměřil nic.
 */
const CATALOG: Record<string, Preset> = {
  el_bass_xlr_amp: {
    type: "preset",
    id: "el_bass_xlr_amp",
    label: "Electric bass guitar",
    group: "bass",
    setupGroup: "electric_bass",
    presetRole: "primary",
    inputs: [
      {
        key: "el_bass_xlr_amp",
        label: "Electric bass guitar",
        note: "XLR out from amp",
      },
    ],
  },
  el_bass_mic: {
    type: "preset",
    id: "el_bass_mic",
    label: "Electric bass cabinet mic",
    group: "bass",
    setupGroup: "bass_mic",
    presetRole: "addition",
    inputs: [
      { key: "el_bass_mic", label: "Electric bass cabinet mic", note: "D112" },
    ],
  },
  el_guitar_mic: {
    type: "preset",
    id: "el_guitar_mic",
    label: "Electric guitar (mic)",
    group: "guitar",
    inputs: [
      {
        key: "el_guitar_mic",
        label: "Electric guitar",
        note: "Mic on cabinet - small boom mic stand",
      },
    ],
  },
  el_guitar_xlr_mono: {
    type: "preset",
    id: "el_guitar_xlr_mono",
    label: "Electric guitar (XLR mono)",
    group: "guitar",
    inputs: [
      {
        key: "el_guitar_xlr",
        label: "Electric guitar",
        note: "XLR out from pedalboard",
      },
    ],
  },
  el_guitar_xlr_stereo: {
    type: "preset",
    id: "el_guitar_xlr_stereo",
    label: "Electric guitar (XLR stereo)",
    group: "guitar",
    inputs: [
      {
        key: "el_guitar_xlr_l",
        label: "Electric guitar L",
        baseLabel: "Electric guitar",
        compactGroupKey: "el_guitar_xlr_stereo",
        channel: "L",
        note: "XLR out from pedalboard",
      },
      {
        key: "el_guitar_xlr_r",
        label: "Electric guitar R",
        baseLabel: "Electric guitar",
        compactGroupKey: "el_guitar_xlr_stereo",
        channel: "R",
        note: "XLR out from pedalboard",
      },
    ],
  },
  keys_stereo_xlr: {
    type: "preset",
    id: "keys_stereo_xlr",
    label: "Keys stereo XLR",
    group: "keys",
    inputs: [
      {
        key: "keys_l",
        label: "Keys L",
        channel: "L",
        note: "XLR out from rack",
      },
      {
        key: "keys_r",
        label: "Keys R",
        channel: "R",
        note: "XLR out from rack",
      },
    ],
  },
  keys_mono_xlr: {
    type: "preset",
    id: "keys_mono_xlr",
    label: "Keys mono XLR",
    group: "keys",
    inputs: [{ key: "keys", label: "Keys", note: "XLR out from rack" }],
  },
  vocal_wireless: {
    type: "preset",
    id: "vocal_wireless",
    label: "Vocal (wireless)",
    group: "vocs",
    capabilities: ["vocal"],
    inputs: [
      {
        key: "voc_input",
        label: "Vocal",
        note: "Own wireless mic - boom mic stand",
      },
    ],
  },
};

const FIELDS = buildSetupFieldCatalog(CATALOG);

function presetOf(id: string): MusicianSetupPreset {
  const source = CATALOG[id];
  if (!source) throw new Error(`missing fixture preset ${id}`);
  return {
    inputs: source.inputs.map((input) => ({ ...input })),
    monitoring: { monitorRef: "wedge_foh" },
  };
}

/**
 * Props se skládají do objektu a rozbalují spreadem schválně: `role` je jméno
 * propu komponenty (`Group`), ale zapsané jako literál v JSX ho Biome čte jako
 * ARIA atribut a hlásí `lint/a11y/useValidAriaRole`.
 */
function dialogProps(args: {
  title: string;
  role: Group;
  state: EventSetupEditState;
}): Parameters<typeof InputsSetupDialog>[0] {
  return {
    ...args,
    fieldCatalog: FIELDS,
    onPatch: () => {},
    onClose: () => {},
  };
}

function render(node: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(node);
}

describe("InputsSetupSection", () => {
  it("renders nothing at all while closed", () => {
    const html = render(
      <InputsSetupSection
        open={false}
        {...dialogProps({
          title: "Edit inputs",
          role: "guitar",
          state: {
            defaultPreset: presetOf("el_guitar_mic"),
            effectivePreset: presetOf("el_guitar_mic"),
          },
        })}
      />,
    );

    expect(html).toBe("");
  });
});

describe("InputsSetupDialog", () => {
  it("gives a guitarist the guitar catalog under an electric-guitar heading", () => {
    const html = render(
      <InputsSetupDialog
        {...dialogProps({
          title: "Edit inputs — Matej",
          role: "guitar",
          state: {
            defaultPreset: presetOf("el_guitar_mic"),
            effectivePreset: presetOf("el_guitar_mic"),
          },
        })}
      />,
    );

    expect(html).toContain("Edit inputs — Matej");
    expect(html).toContain("Input – electric guitar");
    expect(html).toContain('aria-label="Connection"');
    expect(html).toContain('id="setup-guitar-connection"');
    expect(html).toContain("Electric guitar (XLR stereo)");
  });

  it("gives a mono keys player the keys catalog, not the vocal one (M4)", () => {
    const html = render(
      <InputsSetupDialog
        {...dialogProps({
          title: "Edit inputs",
          role: "keys",
          state: {
            defaultPreset: presetOf("keys_mono_xlr"),
            effectivePreset: presetOf("keys_mono_xlr"),
          },
        })}
      />,
    );

    expect(html).toContain("Input – keys");
    expect(html).toContain("Keys units");
    expect(html).toContain('id="setup-keys-unit-1-variant"');
    expect(html).not.toContain('aria-label="Mic"');
    expect(html).not.toContain('id="setup-guitar-connection"');
  });

  it("shows a bass slot one undivided Inputs section on the bass catalog", () => {
    const html = render(
      <InputsSetupDialog
        {...dialogProps({
          title: "Edit inputs",
          role: "bass",
          state: {
            defaultPreset: presetOf("el_bass_xlr_amp"),
            effectivePreset: presetOf("el_bass_xlr_amp"),
          },
        })}
      />,
    );

    expect(html).toContain(">Inputs");
    expect(html).toContain('id="setup-bass-connection"');
    expect(html).not.toContain("Input – ");
    expect(html).not.toContain('id="setup-guitar-connection"');
  });

  it("offers no section at all for a role the modal is not meant for (OQ-1)", () => {
    const html = render(
      <InputsSetupDialog
        {...dialogProps({
          title: "Edit inputs",
          role: "vocs",
          state: {
            defaultPreset: presetOf("vocal_wireless"),
            effectivePreset: presetOf("vocal_wireless"),
          },
        })}
      />,
    );

    expect(html).toContain("Edit inputs");
    expect(html).not.toContain("setup-section-card");
    expect(html).not.toContain('aria-label="Mic"');
  });

  it("marks the section modified only when the slot carries an input patch", () => {
    function markup(patch: EventSetupEditState["patch"]) {
      return render(
        <InputsSetupDialog
          {...dialogProps({
            title: "Edit inputs",
            role: "guitar",
            state: {
              defaultPreset: presetOf("el_guitar_mic"),
              effectivePreset: {
                ...presetOf("el_guitar_mic"),
                inputs: [
                  {
                    key: "el_guitar_mic",
                    label: patch ? "Tele" : "Electric guitar",
                  },
                ],
              },
              ...(patch ? { patch } : {}),
            },
          })}
        />,
      );
    }

    expect(
      markup({ inputs: { update: [{ key: "el_guitar_mic", label: "Tele" }] } }),
    ).toContain("• Modified");
    expect(markup(undefined)).not.toContain("• Modified");
  });
});

describe("DropUserEditsDialog", () => {
  it("names the dropped channel with the user's own label and note, not the preset's", () => {
    const defaultPreset = presetOf("el_guitar_xlr_mono");
    const currentPatch = {
      inputs: {
        update: [
          {
            key: "el_guitar_xlr",
            label: "Tele bridge",
            note: "keep it dry, no reverb",
          },
        ],
      },
    };
    const state = {
      defaultPreset,
      effectivePreset: applyPresetOverride(defaultPreset, currentPatch),
      patch: currentPatch,
    };
    const connection = FIELDS.guitarFields[0] as DropdownFieldDef;
    const nextPatch = normalizeSetupOverridePatch(
      defaultPreset,
      connection.setValue(state, "el_guitar_xlr_stereo"),
    );
    const dropped = resolveDroppedUserEdits({
      defaultPreset,
      currentPatch,
      nextPatch,
    });

    expect(dropped).toEqual([
      {
        key: "el_guitar_xlr",
        label: "Tele bridge",
        note: "keep it dry, no reverb",
      },
    ]);

    const html = render(
      <DropUserEditsDialog
        dropped={dropped}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(html).toContain('role="alertdialog"');
    expect(html).toContain("Switch connection?");
    expect(html).toContain("Tele bridge");
    expect(html).toContain("keep it dry, no reverb");
    expect(html).not.toContain("XLR out from pedalboard");
    expect(html).toContain("Switch and discard");
  });
});
