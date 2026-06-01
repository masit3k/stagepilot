import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import { loadRepository } from "../fs/repo.js";
import { buildDocument } from "../../domain/pipeline/buildDocument.js";
import { renderInputlistHtml } from "./template.js";
import { pdfLayout } from "./layout.js";
import { buildStageplanPlan } from "./sections/stageplan.js";
import {
  createPdfRendererFixtureProject,
  createPdfRendererFixtureRoot,
} from "./pdfRendererFixture.js";

describe("inputlist template layout", () => {
  it("renders page 1 without stageplan and page 2 with stageplan boxes", async () => {
    const tmpRoot = await createPdfRendererFixtureRoot();

    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("stageplan-template");

      const vm = buildDocument(project, repo);
      const html = renderInputlistHtml(vm, {
        tabTitle: "Stageplan",
        baseHref: "file:///tmp/",
      });

      const page1Start = html.indexOf(`id="${pdfLayout.ids.page}"`);
      const page2Start = html.indexOf(`id="${pdfLayout.ids.page2}"`);
      expect(page1Start).toBeGreaterThan(-1);
      expect(page2Start).toBeGreaterThan(page1Start);

      const page1Html = html.slice(page1Start, page2Start);
      const page2Html = html.slice(page2Start);

      expect(page1Html).not.toContain("stageplanSection");
      expect(page2Html).toContain("Stageplan");

      const boxMatches = page2Html.match(/class="stageplanBox\b/g) ?? [];
      expect(boxMatches).toHaveLength(5);

      const plan = buildStageplanPlan(vm.stageplan);
      for (const box of plan.boxes) {
        expect(page2Html).toContain(
          `left:${box.position.xMm}mm; top:${box.position.yMm}mm;`
        );
      }
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it("keeps contact line while hiding names only on stageplan", async () => {
    const tmpRoot = await createPdfRendererFixtureRoot();

    try {
      const repo = await loadRepository({ userDataRoot: tmpRoot });
      const project = createPdfRendererFixtureProject("stageplan-hide-names");

      const vm = buildDocument(project, repo);
      const html = renderInputlistHtml(vm, {
        tabTitle: "Stageplan",
        baseHref: "file:///tmp/",
        contactLine: "Kontaktní osoba – Test User, + 420 111 222 333",
        stageplan: { hideMusicianNames: true },
      });

      expect(html).toContain("Kontaktní osoba – Test User");
      expect(html).toContain("BASS");
      expect(html).not.toContain("BASS – MATEJ");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });


  it("renders full input note text including trailing parenthetical suffix", () => {
    const html = renderInputlistHtml(
      {
        meta: {
          bandName: "Band",
          metaLine: { kind: "plain", value: "Meta" },
        },
        inputRows: [
          {
            no: "1",
            label: "Lead vocal",
            note: "BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)",
          },
        ],
        notes: { inputs: [], monitors: [] },
        stageplan: {
          lineupByRole: {},
          inputs: [],
          monitorOutputs: [],
          powerByRole: {},
        },
      } as any,
      {
        tabTitle: "Stageplan",
        baseHref: "file:///tmp/",
      }
    );

    expect(html).toContain("BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)");
  });


});
