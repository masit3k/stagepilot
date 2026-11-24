import { describe, expect, it } from "vitest";
import type { DocumentViewModel } from "../../../domain/model/types.js";
import { renderStageplanSection } from "./stageplan.js";

/** Jeden box basy uprostřed pódia; texty dodává každý test sám. */
function vmWithBassBox(
  overrides: Partial<DocumentViewModel["stageplan"]>,
): DocumentViewModel {
  return {
    stageplan: {
      layout: {
        stage: null,
        blocks: [
          {
            slot: "bass",
            centerXM: 6,
            centerYM: 4,
            widthM: 2.7,
            depthM: 1.4,
            rotationDeg: 0,
          },
        ],
      },
      lineupByRole: {},
      leadVocals: [],
      inputs: [],
      monitorOutputs: [],
      powerByRole: {},
      ...overrides,
    },
  } as unknown as DocumentViewModel;
}

describe("stageplan HTML escaping", () => {
  it("prints a musician name with markup characters literally", () => {
    const html = renderStageplanSection(
      vmWithBassBox({
        lineupByRole: { bass: { firstName: 'A<b>&"B', isBandLeader: false } },
      } as Partial<DocumentViewModel["stageplan"]>),
    );

    expect(html).toContain(
      '<div class="stageplanBoxHeader">BASS – A&lt;B&gt;&amp;&quot;B</div>',
    );
    expect(html).not.toContain("<B>");
  });

  it("escapes input bullets", () => {
    const html = renderStageplanSection(
      vmWithBassBox({
        inputs: [
          {
            channelNo: 5,
            label: 'Bass <DI> & "amp"',
            group: "bass",
            ownerRole: "bass",
          },
        ],
      } as Partial<DocumentViewModel["stageplan"]>),
    );

    expect(html).toContain("Bass &lt;DI&gt; &amp; &quot;amp&quot;");
    expect(html).not.toContain("<DI>");
  });

  it("escapes the power line", () => {
    const html = renderStageplanSection(
      vmWithBassBox({
        powerByRole: {
          bass: { hasPowerBadge: true, powerBadgeText: '2x <230V> & "UPS"' },
        },
      } as Partial<DocumentViewModel["stageplan"]>),
    );

    expect(html).toContain(
      '<div class="stageplanPower">2x &lt;230V&gt; &amp; &quot;UPS&quot;</div>',
    );
  });
});
