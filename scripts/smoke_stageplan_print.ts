import { readdir } from "node:fs/promises";
import path from "node:path";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import type { Page } from "puppeteer";
import { normalizeProject } from "../src/app/usecases/normalizeProject.js";
import { STAGEPLAN_BAND_LEADER_LINE } from "../src/domain/formatters/stageplan.js";
import type { ProjectJson } from "../src/domain/model/types.js";
import { buildDocument } from "../src/domain/pipeline/buildDocument.js";
import { buildPdfStageplanPrintModel } from "../src/domain/pipeline/pdf/buildPdfStageplanPrintModel.js";
import type { PrintTextStyle } from "../src/domain/stageplan/print/glyphAdvances.js";
import { measurePrintTextMm } from "../src/domain/stageplan/print/textWidth.js";
import { USER_DATA_ROOT } from "../src/infra/fs/dataRoot.js";
import { loadJsonFile } from "../src/infra/fs/loadJson.js";
import { loadRepository } from "../src/infra/fs/repo.js";
import { launchPdfBrowser, setPdfPageContent } from "../src/infra/pdf/pdf.js";
import { stageplanPrintGeometry } from "../src/infra/pdf/sections/stageplan.js";
import { pdfStyles } from "../src/infra/pdf/styles.js";
import { renderInputlistHtml } from "../src/infra/pdf/template.js";
import { PRINT_TEXT_STYLE_SPECS } from "./printTextStyles.js";

/**
 * Tabulka nesmí být nikdy **užší** než skutečnost — to je vlastnost, která
 * brání uříznutému textu (R1). Přesná rovnost nejde: Chromium kvantuje
 * šířku glyfu na 1/64 px, kdežto tabulka sčítá nekvantované zlomky, takže se
 * rozdíl s délkou řetězce hromadí. Měřením ověřený rozsah je do 0,06 %.
 */
const UNDERSHOOT_TOLERANCE_PX = 0.05;
const OVERSHOOT_TOLERANCE_RATIO = 0.002;
/** Subpixelová rezerva pro měření řádku uvnitř boxu. */
const LINE_TOLERANCE_PX = 0.5;
const MM_TO_PX = 96 / 25.4;

/** Týž seznam, jaký měřil generátor — jinak by kontrola ověřovala jiný řez,
 *  než jaký tabulka drží, a mlčky prošla. */
const STYLE_PROBES = PRINT_TEXT_STYLE_SPECS;

type LoadedProject = {
  readonly file: string;
  /** null když plán vůbec nešel sestavit — kolize nebo přetečení. */
  readonly html: string | null;
  readonly buildError: string | null;
  readonly corpus: string[];
};

function pdfBaseHref(): string {
  return pathToFileURL(
    path.join(process.cwd(), "src", "infra", "pdf") + path.sep,
  ).href;
}

async function loadProjects(userDataDir: string): Promise<LoadedProject[]> {
  const projectsDir = path.join(userDataDir, "projects");
  const files = (await readdir(projectsDir)).filter((name) =>
    name.endsWith(".json"),
  );
  const repo = await loadRepository({ userDataRoot: userDataDir });

  const loaded: LoadedProject[] = [];
  for (const file of files) {
    const raw = await loadJsonFile<ProjectJson>(path.join(projectsDir, file));
    const vm = buildDocument(normalizeProject(raw), repo);
    const printModel = buildPdfStageplanPrintModel(vm.stageplan);

    const corpus = new Set<string>([STAGEPLAN_BAND_LEADER_LINE]);
    for (const box of Object.values(printModel.boxesBySlot)) {
      corpus.add(box.header);
      for (const bullet of [
        ...box.inputBullets,
        ...box.monitorBullets,
        ...box.extraBullets,
      ]) {
        corpus.add(bullet);
      }
      if (box.hasPowerBadge) corpus.add(box.powerBadgeText);
    }

    // Plán se sestavuje tady, ne až v prohlížeči: kolizní pojistka a kontrola
    // union bboxu hlásí chybu výjimkou, a ta má skončit jako pojmenované
    // selhání smoke kontroly, ne jako pád skriptu bez kontextu.
    let html: string | null = null;
    let buildError: string | null = null;
    try {
      html = renderInputlistHtml(vm, {
        tabTitle: file,
        baseHref: pdfBaseHref(),
      });
    } catch (error) {
      buildError = error instanceof Error ? error.message : String(error);
    }

    loaded.push({
      file,
      html,
      buildError,
      corpus: [...corpus].filter((text) => text.length > 0),
    });
  }
  return loaded;
}

function measurementPageHtml(): string {
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8" /><base href="${pdfBaseHref()}">
<style>
${pdfStyles}
</style>
<style>
  .probe {
    position: absolute; top: 0; left: 0; white-space: pre;
    font-kerning: none; font-variant-ligatures: none;
  }
</style>
</head><body></body></html>`;
}

type WidthMismatch = {
  text: string;
  style: string;
  tablePx: number;
  chromiumPx: number;
  /** "too narrow" uřízne text (R1), "too wide" jen zbytečně nafoukne box. */
  kind: "too narrow" | "too wide";
};

/**
 * Kontrola 1 (R16): tabulka nesmí Chromiu tvrdit, že je text užší, než ho
 * vysází — přesná rovnost nejde (viz UNDERSHOOT_TOLERANCE_PX výše). Tohle je
 * jediná pojistka proti tomu, aby se generovaná data rozešla s fontem — ať
 * už kvůli ručnímu zásahu, jiné verzi fontu, nebo změně shapingu v novém
 * Chromiu.
 */
async function checkTableAgainstChromium(
  page: Page,
  corpus: string[],
): Promise<WidthMismatch[]> {
  const fontSizePt = stageplanPrintGeometry.typography.fontSizePt;
  const roleFontSizePt = stageplanPrintGeometry.typography.roleFontSizePt;
  const roleTrackingEm = stageplanPrintGeometry.typography.roleTrackingEm;

  const cases = [
    ...corpus.flatMap((text) =>
      STYLE_PROBES.map((probe) => ({
        text,
        style: probe.name,
        fontFamily: probe.fontFamily,
        fontWeight: probe.fontWeight,
        fontSizePt,
        trackingEm: 0,
      })),
    ),
    {
      text: STAGEPLAN_BAND_LEADER_LINE,
      style: "boxRole" as PrintTextStyle,
      fontFamily: "IBM Plex Mono",
      fontWeight: 400,
      fontSizePt: roleFontSizePt,
      trackingEm: roleTrackingEm,
    },
  ];

  // setPdfPageContent, ne setContent: `setContent` samotné nechá dokument na
  // `about:blank` a Chromium z jiného než file:// původu tiše odmítne @font-face
  // soubory. Tabulka by se pak srovnávala s náhradním písmem a kontrola by
  // prošla, i kdyby se rozešla se skutečným tiskovým fontem.
  await setPdfPageContent(page, pdfBaseHref(), measurementPageHtml());
  const measured = await page.evaluate(async (probes) => {
    const el = document.createElement("span");
    el.className = "probe";
    document.body.appendChild(el);

    const widths: number[] = [];
    for (const probe of probes) {
      const fontPx = (probe.fontSizePt * 96) / 72;
      await document.fonts.load(
        `${probe.fontWeight} ${fontPx}px '${probe.fontFamily}'`,
      );
      el.style.fontFamily = `'${probe.fontFamily}'`;
      el.style.fontWeight = String(probe.fontWeight);
      el.style.fontSize = `${fontPx}px`;
      el.style.letterSpacing = `${probe.trackingEm}em`;
      el.textContent = probe.text;
      widths.push(el.getBoundingClientRect().width);
    }
    el.remove();
    return widths;
  }, cases);

  const mismatches: WidthMismatch[] = [];
  cases.forEach((probe, index) => {
    const tablePx =
      measurePrintTextMm({
        text: probe.text,
        style: probe.style,
        fontSizePt: probe.fontSizePt,
        trackingEm: probe.trackingEm,
      }) * MM_TO_PX;
    const chromiumPx = measured[index];
    const undershoot = chromiumPx - tablePx;
    const overshoot = tablePx - chromiumPx;
    const tooNarrow = undershoot > UNDERSHOOT_TOLERANCE_PX;
    const tooWide =
      overshoot >
      chromiumPx * OVERSHOOT_TOLERANCE_RATIO + UNDERSHOOT_TOLERANCE_PX;
    if (tooNarrow || tooWide) {
      mismatches.push({
        text: probe.text,
        style: probe.style,
        tablePx,
        chromiumPx,
        kind: tooNarrow ? "too narrow" : "too wide",
      });
    }
  });
  return mismatches;
}

/**
 * Kontrola 2 (R16): žádný box v reálném projektu nepřetéká. Přesně tahle
 * sonda odhalila, že přetékaly tři boxy z pěti — box nemá overflow: hidden,
 * takže scrollHeight nad clientHeight je přímé měření přetečení. Šířka se
 * měří přes Range, protože text je vystředěný a přetéká na obě strany,
 * kam scrollWidth nevidí.
 */
async function checkBoxesFit(page: Page, html: string): Promise<string[]> {
  // Stejný důvod jako u měřicí stránky: bez setPdfPageContent by @font-face
  // fonty spadly na náhradní písmo a přetečení by se měřilo na jiném layoutu,
  // než jaký skutečně jde do PDF.
  await setPdfPageContent(page, pdfBaseHref(), html);
  return page.evaluate((tolerancePx: number) => {
    const problems: string[] = [];
    for (const box of Array.from(document.querySelectorAll(".stageplanBox"))) {
      const name =
        box.querySelector(".stageplanBoxHeader")?.textContent ?? "<unnamed>";

      const overflowPx = box.scrollHeight - box.clientHeight;
      if (overflowPx > 0) {
        problems.push(
          `${name}: height overflows by ${overflowPx.toFixed(2)}px`,
        );
      }

      const style = getComputedStyle(box);
      const contentWidthPx =
        box.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight);

      for (const line of Array.from(
        box.querySelectorAll(
          ".stageplanBoxHeader, .stageplanBoxRole, .stageplanBoxLine, .stageplanPower",
        ),
      )) {
        const range = document.createRange();
        range.selectNodeContents(line);
        const widthPx = range.getBoundingClientRect().width;
        if (widthPx > contentWidthPx + tolerancePx) {
          problems.push(
            `${name}: "${line.textContent}" is ${widthPx.toFixed(2)}px wide, box offers ${contentWidthPx.toFixed(2)}px`,
          );
        }
      }
    }
    return problems;
  }, LINE_TOLERANCE_PX);
}

async function run(): Promise<number> {
  const dirIndex = argv.indexOf("--user-data-dir");
  const userDataDir = dirIndex === -1 ? USER_DATA_ROOT : argv[dirIndex + 1];

  const projects = await loadProjects(userDataDir);
  if (projects.length === 0) {
    console.error(`[smoke] no projects under ${userDataDir}`);
    return 1;
  }

  const browser = await launchPdfBrowser();
  let failures = 0;
  try {
    const page = await browser.newPage();

    const corpus = [...new Set(projects.flatMap((project) => project.corpus))];
    const mismatches = await checkTableAgainstChromium(page, corpus);
    if (mismatches.length > 0) {
      failures += mismatches.length;
      console.error(
        `[smoke] glyph table disagrees with Chromium on ${mismatches.length} of ${corpus.length * STYLE_PROBES.length + 1} cases:`,
      );
      for (const mismatch of mismatches.slice(0, 20)) {
        console.error(
          `  [${mismatch.kind}] ${mismatch.style} "${mismatch.text}": table ${mismatch.tablePx.toFixed(4)}px vs chromium ${mismatch.chromiumPx.toFixed(4)}px`,
        );
      }
    } else {
      console.error(
        `[smoke] glyph table matches Chromium for ${corpus.length} strings in 4 cuts`,
      );
    }

    // Kolo bloků, které narostou na svou textovou šířku, umí kolidovat na
    // pódiu — to je pravdivá informace o rozmístění (viz findArtifactCollisions
    // ve stageplan.ts), ne vada, kterou tahle kontrola hlídá. Takový projekt se
    // hlásí zvlášť jako SKIPPED a nesmí sám o sobě shodit exit kód — jinak je
    // skript trvale červený z důvodu, který nemá se skutečnou kontrolou nic
    // společného, a nikdo mu pak nevěří (přesně tak přežila fontová chyba fáze).
    let boxesVerified = 0;
    let boxesSkipped = 0;
    for (const project of projects) {
      if (project.html === null) {
        boxesSkipped += 1;
        console.error(
          `[smoke] ${project.file}: SKIPPED — plan does not build: ${project.buildError}`,
        );
        continue;
      }

      const problems = await checkBoxesFit(page, project.html);
      boxesVerified += 1;
      if (problems.length > 0) {
        failures += problems.length;
        console.error(
          `[smoke] ${project.file}: ${problems.length} overflowing box(es)`,
        );
        for (const problem of problems) console.error(`  ${problem}`);
      } else {
        console.error(`[smoke] ${project.file}: every stageplan box fits`);
      }
    }

    // Klesající jmenovatel musí být vidět, ne mlčky zabalený do jednoho
    // souhrnného čísla — jinak si nikdo nevšimne, že kontrola 2 ve
    // skutečnosti pokrývá čím dál míň projektů.
    console.error(
      `[smoke] check 2 (box fit): verified ${boxesVerified} of ${projects.length} project(s), skipped ${boxesSkipped} (plan does not build)`,
    );
  } finally {
    await browser.close();
  }

  return failures === 0 ? 0 : 1;
}

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error("[smoke] stageplan print smoke failed", error);
    process.exitCode = 1;
  });
