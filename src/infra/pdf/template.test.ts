import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { DocumentViewModel } from "../../domain/model/types.js";
import { buildDocument } from "../../domain/pipeline/buildDocument.js";
import { loadRepository } from "../fs/repo.js";
import { pdfLayout } from "./layout.js";
import {
  createPdfRendererFixtureProject,
  createPdfRendererFixtureRoot,
} from "./pdfRendererFixture.js";
import { buildStageplanPlan } from "./sections/stageplan.js";
import { renderInputlistHtml } from "./template.js";

/**
 * Builds a real, fully-populated `DocumentViewModel` for template-level tests
 * that render a view model directly (i.e. without going through
 * `buildDocument`). Every required field carries a plausible default value;
 * pass `overrides` to vary just the parts a test cares about.
 *
 * Later PDF-rendering tests (header, footer, table) should reuse this rather
 * than hand-assembling view models.
 */
type DocumentViewModelFixtureOverrides = Partial<
  Omit<DocumentViewModel, "meta">
> & {
  meta?: Partial<DocumentViewModel["meta"]>;
};

function createDocumentViewModelFixture(
  overrides: DocumentViewModelFixtureOverrides = {},
): DocumentViewModel {
  const { meta: metaOverrides, ...rest } = overrides;

  return {
    meta: {
      projectId: "fixture-project",
      bandName: "Fixture Band",
      purpose: "generic",
      documentDate: "2026-01-01",
      header: { contextParts: ["Meta"], updatedDate: "1. 1. 2026" },
      ...metaOverrides,
    },
    inputs: [],
    inputRows: [
      {
        no: "1",
        label: "Lead vocal",
        note: "BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)",
      },
    ],
    monitors: [],
    notes: { inputs: [], monitors: [] },
    monitorTableRows: [],
    stageplan: {
      lineupByRole: {},
      inputs: [],
      monitorOutputs: [],
      powerByRole: {},
    },
    ...rest,
  };
}

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
      expect(page2Html).not.toContain("stageplanHeading");

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

  it("hides names only on stageplan; contact line is a no-op until task 7 restores it in the footer", async () => {
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

      expect(html).not.toContain("Kontaktní osoba");
      expect(html).toContain("BASS");
      expect(html).not.toContain("BASS – MATEJ");
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });


  it("renders full input note text including trailing parenthetical suffix", () => {
    const vm = createDocumentViewModelFixture({
      meta: { bandName: "Band" },
    });

    const html = renderInputlistHtml(vm, {
      tabTitle: "Stageplan",
      baseHref: "file:///tmp/",
    });

    expect(html).toContain("BETA 58A, SE V7, SM58 – boom mic stand (provided by FOH)");
  });


});

describe("document header", () => {
  const vm = createDocumentViewModelFixture({
    meta: {
      bandName: "Friday Night Band",
      header: {
        contextParts: ["22. 8. 2026", "Zámek Bon Repos"],
        updatedDate: "12. 8. 2026",
      },
    },
  });

  it("labels page one INPUT LIST and page two STAGE PLAN", () => {
    const html = renderInputlistHtml(vm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
    });

    const page2Start = html.indexOf(`id="${pdfLayout.ids.page2}"`);
    const page1Html = html.slice(0, page2Start);
    const page2Html = html.slice(page2Start);

    expect(page1Html).toContain("INPUT LIST · 22. 8. 2026 · Zámek Bon Repos");
    expect(page2Html).toContain("STAGE PLAN · 22. 8. 2026 · Zámek Bon Repos");
  });

  it("stamps the tool and the update date on both pages", () => {
    const html = renderInputlistHtml(vm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
    });

    expect(html.match(/STAGEPILOT/g) ?? []).toHaveLength(2);
    expect(html.match(/UPD 12\. 8\. 2026/g) ?? []).toHaveLength(2);
  });

  it("prints only the document kind when the project carries no context", () => {
    const noContextVm = createDocumentViewModelFixture({
      meta: {
        bandName: "Friday Night Band",
        header: { contextParts: [], updatedDate: "1. 1. 2026" },
      },
    });

    const html = renderInputlistHtml(noContextVm, {
      tabTitle: "Doc",
      baseHref: "file:///tmp/",
    });

    expect(html).toContain(">INPUT LIST<");
    expect(html).not.toContain("INPUT LIST ·");
  });

  // Stylopis je vložený do <head> a obsahuje obě třídy vždycky, takže hledat
  // je v celém dokumentu by nic neprokázalo. Assertce míří jen do <body>.
  const bodyOf = (html: string) => html.slice(html.indexOf("<body>"));

  it("falls back to the XLR mark when the band has no logo", () => {
    const body = bodyOf(
      renderInputlistHtml(vm, { tabTitle: "Doc", baseHref: "file:///tmp/" }),
    );

    expect(body).toContain("docHeader__mark");
    expect(body).not.toContain("docHeader__logo");
  });

  it("prefers the band logo over the XLR mark", () => {
    const body = bodyOf(
      renderInputlistHtml(vm, {
        tabTitle: "Doc",
        baseHref: "file:///tmp/",
        logoHref: "file:///tmp/logo.png",
      }),
    );

    expect(body).toContain("docHeader__logo");
    expect(body).not.toContain("docHeader__mark");
  });
});
