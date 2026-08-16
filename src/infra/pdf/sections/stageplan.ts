import { STAGEPLAN_BAND_LEADER_LINE } from "../../../domain/formatters/stageplan.js";
import type {
  DocumentViewModel,
  StageplanBlockSlot,
  StageplanStageSize,
} from "../../../domain/model/types.js";
import {
  type StageplanPrintBox,
  buildPdfStageplanPrintModel,
} from "../../../domain/pipeline/pdf/buildPdfStageplanPrintModel.js";
import {
  type PrintRect,
  findPrintCollisions,
  rectAabbMm,
} from "../../../domain/stageplan/print/printCollisions.js";
import {
  type PrintTypography,
  computePrintFootprintMm,
} from "../../../domain/stageplan/print/printFootprint.js";
import {
  type PrintScale,
  resolvePrintScale,
} from "../../../domain/stageplan/print/printScale.js";
import { parsePt, pdfChromeHeights, pdfLayout } from "../layout.js";
import {
  type StageplanRenderOptions,
  resolveStageplanRenderOptions,
} from "../stageplanRenderOptions.js";

const MM_TO_PT = 72 / 25.4;

function ptToMm(pt: number): number {
  return pt / MM_TO_PT;
}

function pxToMm(px: number): number {
  return ptToMm(px * 0.75); // 1px = 0.75pt (96px = 72pt)
}

const containerMarginTopPt = 24;
const containerPadPt = 24;
/** .stageplanContainer border-width — konstanta pro styles.ts i pro rozpočet. */
const containerBorderPx = 1;
const captionGapPt = 4;
/**
 * Řádek popisku rozměru pódia se rezervuje vždy, i když se rozměr netiskne —
 * jinak by měřítko plánu záviselo na tom, jestli uživatel rozměr vyplnil (R6).
 */
const captionHeightPt =
  parsePt(pdfLayout.typography.tableHead.size) *
    pdfLayout.typography.tableHead.lineHeight +
  captionGapPt;

/**
 * Finding 1 (F4): .stageplanContainer je inline-block, takže když areaWidthMm
 * nesedí s paddingem a rámečkem, je kontejner širší než tiskové zrcadlo a
 * Chromium na to reaguje tichým zmenšením *celého* dokumentu. Odvozovat, ne
 * opisovat.
 */
const areaWidthMm =
  pdfLayout.page.contentWidthMm -
  2 * ptToMm(containerPadPt) -
  2 * pxToMm(containerBorderPx);

const availableHeightMm =
  pdfLayout.page.contentHeightMm -
  pdfChromeHeights.headerMm -
  pdfChromeHeights.footerMm;

const areaHeightMm =
  availableHeightMm -
  ptToMm(containerMarginTopPt) -
  2 * ptToMm(containerPadPt) -
  2 * pxToMm(containerBorderPx) -
  ptToMm(captionHeightPt);

/**
 * Šířka dnešního čtyřsloupcového boxu. Není to odhad — je to geometrie, o
 * které z dosavadního exportu víme, že se do ní odrážky při 8 pt vejdou (R3).
 */
const minBoxWidthMm = (areaWidthMm - 2 * 2 - 3 * 4.5) / 4;

const bulletSpacingPx = 4;

const printTypography: PrintTypography = {
  fontSizePt: parsePt(pdfLayout.typography.table.size) - 1,
  lineHeight: 1.25,
  roleFontSizePt: parsePt(pdfLayout.typography.tableHead.size),
  roleTrackingEm: Number.parseFloat(pdfLayout.typography.tableHead.tracking),
  titleGapPt: 6,
  // R7: jedna hodnota na všechny čtyři strany. Dřívější dolní odsazení
  // pocházelo z table.padY, tedy z odsazení řádku tabulky — jiné veličiny,
  // která do tiskového boxu nepatří.
  padPt: 6,
  bulletSpacingPx,
  minBoxWidthMm,
};

/** Co potřebuje editor, aby si tiskovou stopu spočítal stejnou funkcí (R12). */
export const stageplanPrintGeometry = {
  area: { widthMm: areaWidthMm, heightMm: areaHeightMm },
  typography: printTypography,
} as const;

/** Konstanty pro styles.ts — CSS a rozpočet se nesmí rozejít. */
export const stageplanLayout = {
  containerMarginTop: `${containerMarginTopPt}pt`,
  containerPad: `${containerPadPt}pt`,
  containerBorderPx,
  areaWidthMm,
  areaHeightMm,
  captionGap: `${captionGapPt}pt`,
  captionSize: pdfLayout.typography.tableHead.size,
  captionTracking: pdfLayout.typography.tableHead.tracking,
  boxRoleSize: pdfLayout.typography.tableHead.size,
  boxRoleTracking: pdfLayout.typography.tableHead.tracking,
  padX: pdfLayout.table.padX,
  padY: pdfLayout.table.padY,
  boxPad: `${printTypography.padPt}pt`,
  boxTitleGap: `${printTypography.titleGapPt}pt`,
  /** Dočasné: CSS boxu se srovná s modelem až v Tasku 6 (R7). */
  boxPaddingBottom: pdfLayout.table.padY,
  textSize: `${printTypography.fontSizePt}pt`,
  textLineHeight: printTypography.lineHeight,
  /** Řádková výška boxu v bodech — CSS i stopa boxu musí říkat totéž. */
  boxLine: `${printTypography.fontSizePt * printTypography.lineHeight}pt`,
  bulletSpacingPx,
} as const;

export type StageplanBoxPlan = StageplanPrintBox & {
  /** Levý horní roh neotočeného boxu v souřadnicích kontejneru. */
  readonly xMm: number;
  readonly yMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly rotationDeg: number;
};

export type StageplanPlan = {
  readonly container: { readonly widthMm: number; readonly heightMm: number };
  readonly stage: {
    readonly xMm: number;
    readonly yMm: number;
    readonly widthMm: number;
    readonly heightMm: number;
    readonly caption: string | null;
  };
  readonly typography: PrintTypography;
  readonly boxes: readonly StageplanBoxPlan[];
};

function formatStageCaption(stage: StageplanStageSize | null): string | null {
  if (!stage) return null;
  const format = (value: number) => value.toFixed(1).replace(".", ",");
  return `PÓDIUM ${format(stage.widthM)} × ${format(stage.depthM)} m`;
}

/** Nezávislé na pořadí páru — kolize se srovnávají mezi dvěma sadami obdélníků. */
function collisionKey(a: StageplanBlockSlot, b: StageplanBlockSlot): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Finding 1: kolize se hlídá dvakrát — jednou nad tištěnými boxy (co se
 * skutečně tiskne) a jednou nad holými zónami (co F5a uložila). Pár, který
 * koliduje jako zóna, je pravdivá informace o namačkaném pódiu (F5a) a tiskne
 * se; pár, který koliduje jen jako box, je artefakt toho, že box narostl nad
 * zónu, aby unesl text (R1), a to je přesně ten případ, kdy má export selhat.
 */
function findArtifactCollisions(
  boxRects: readonly PrintRect[],
  zoneRects: readonly PrintRect[],
): Array<readonly [StageplanBlockSlot, StageplanBlockSlot]> {
  const zoneCollisionKeys = new Set(
    findPrintCollisions(zoneRects).map(([a, b]) => collisionKey(a, b)),
  );
  return findPrintCollisions(boxRects).filter(
    ([a, b]) => !zoneCollisionKeys.has(collisionKey(a, b)),
  );
}

/** Milimetrová tolerance pro srovnání s hranou rámu pódia. */
const OVERFLOW_EPSILON_MM = 0.01;

type RectAabb = ReturnType<typeof rectAabbMm>;

/**
 * Finding 4: union bbox se sází z jednotlivých obdélníků, takže viník
 * přetečení je vždycky některý z nich — box, jehož opsaný obdélník sahá za
 * hranu rámu pódia ve směru, který přetekl.
 */
function findOverflowCulprits(
  rectAabbs: readonly { readonly rect: PrintRect; readonly aabb: RectAabb }[],
  scale: Pick<PrintScale, "planWidthMm" | "planHeightMm">,
  widthOverflow: boolean,
  heightOverflow: boolean,
): StageplanBlockSlot[] {
  return rectAabbs
    .filter(({ aabb }) => {
      const pastWidth =
        widthOverflow &&
        (aabb.minXMm < -OVERFLOW_EPSILON_MM ||
          aabb.maxXMm > scale.planWidthMm + OVERFLOW_EPSILON_MM);
      const pastHeight =
        heightOverflow &&
        (aabb.minYMm < -OVERFLOW_EPSILON_MM ||
          aabb.maxYMm > scale.planHeightMm + OVERFLOW_EPSILON_MM);
      return pastWidth || pastHeight;
    })
    .map(({ rect }) => rect.slot);
}

export function buildStageplanPlan(
  vm: DocumentViewModel["stageplan"],
  options?: Partial<StageplanRenderOptions>,
): StageplanPlan {
  const resolvedOptions = resolveStageplanRenderOptions(options);
  const printModel = buildPdfStageplanPrintModel(vm, {
    hideMusicianNames: resolvedOptions.hideMusicianNames,
  });
  const scale = resolvePrintScale({
    stage: vm.layout.stage,
    blocks: vm.layout.blocks,
    area: stageplanPrintGeometry.area,
    minBoxWidthMm: printTypography.minBoxWidthMm,
  });

  const footprintBySlot = new Map(
    vm.layout.blocks.map((block) => [
      block.slot,
      computePrintFootprintMm({
        box: printModel.boxesBySlot[block.slot],
        typography: printTypography,
      }),
    ]),
  );

  const rects: PrintRect[] = vm.layout.blocks.map((block) => {
    const footprint = footprintBySlot.get(block.slot);
    if (!footprint) {
      throw new Error(`Missing print footprint for block ${block.slot}`);
    }

    return {
      slot: block.slot,
      centerXMm: scale.toMm(block.centerXM),
      centerYMm: scale.toMm(block.centerYM),
      widthMm: footprint.widthMm,
      heightMm: footprint.heightMm,
      rotationDeg: block.rotationDeg,
    };
  });

  // Zóny při stejném středu a otočení jako boxy, ale v rozměru zóny samotné
  // (F5a) — druhá sada rozhoduje, které kolize jsou pravdivá informace o
  // namačkaném pódiu a které jsou artefakt boxu přerostlého nad zónu (Finding 1).
  const zoneRects: PrintRect[] = vm.layout.blocks.map((block) => ({
    slot: block.slot,
    centerXMm: scale.toMm(block.centerXM),
    centerYMm: scale.toMm(block.centerYM),
    widthMm: scale.toMm(block.widthM),
    heightMm: scale.toMm(block.depthM),
    rotationDeg: block.rotationDeg,
  }));

  const artifactCollisions = findArtifactCollisions(rects, zoneRects);
  if (artifactCollisions.length > 0) {
    const pairs = artifactCollisions.map(([a, b]) => `${a} × ${b}`).join(", ");
    throw new Error(
      `Stageplan print collision: ${pairs}. Blocks overlap on paper — rearrange them in the editor.`,
    );
  }

  // Union bbox rámu pódia a všech boxů. Přerostlý box nesmí kontejner rozšířit
  // nad zrcadlo, jinak Chromium zmenší celý dokument (past z F4).
  const rectAabbs = rects.map((rect) => ({ rect, aabb: rectAabbMm(rect) }));
  let minXMm = 0;
  let minYMm = 0;
  let maxXMm = scale.planWidthMm;
  let maxYMm = scale.planHeightMm;
  for (const { aabb } of rectAabbs) {
    minXMm = Math.min(minXMm, aabb.minXMm);
    minYMm = Math.min(minYMm, aabb.minYMm);
    maxXMm = Math.max(maxXMm, aabb.maxXMm);
    maxYMm = Math.max(maxYMm, aabb.maxYMm);
  }

  const container = { widthMm: maxXMm - minXMm, heightMm: maxYMm - minYMm };
  const widthOverflow = container.widthMm > areaWidthMm;
  const heightOverflow = container.heightMm > areaHeightMm;
  if (widthOverflow || heightOverflow) {
    // Finding 4: pojmenuj viníka, po vzoru kolizní hlášky výše — ne jen milimetry.
    const culprits = findOverflowCulprits(
      rectAabbs,
      scale,
      widthOverflow,
      heightOverflow,
    );
    const blockNote =
      culprits.length > 0
        ? ` Block${culprits.length > 1 ? "s" : ""} ${culprits.join(", ")} extend${culprits.length > 1 ? "" : "s"} past the area — move ${culprits.length > 1 ? "them" : "it"} closer to the centre of the stage in the editor.`
        : "";
    throw new Error(
      `Stageplan layout overflow: required ${container.widthMm.toFixed(2)} × ${container.heightMm.toFixed(2)}mm exceeds available ${areaWidthMm.toFixed(2)} × ${areaHeightMm.toFixed(2)}mm.${blockNote}`,
    );
  }

  return {
    container,
    stage: {
      xMm: -minXMm,
      yMm: -minYMm,
      widthMm: scale.planWidthMm,
      heightMm: scale.planHeightMm,
      caption: formatStageCaption(vm.layout.stage),
    },
    typography: printTypography,
    boxes: rects.map((rect) => {
      const printBox = printModel.boxesBySlot[rect.slot];
      return {
        ...printBox,
        xMm: rect.centerXMm - minXMm - rect.widthMm / 2,
        yMm: rect.centerYMm - minYMm - rect.heightMm / 2,
        widthMm: rect.widthMm,
        heightMm: rect.heightMm,
        rotationDeg: rect.rotationDeg,
      };
    }),
  };
}

function renderBox(
  box: StageplanBoxPlan,
  typography: StageplanPlan["typography"],
): string {
  const lines: string[] = [
    `<div class="stageplanBoxHeader">${box.header}</div>`,
  ];

  // Jméno a role patří k sobě — mezi ně mezera nepatří (R3, R9).
  if (box.hasBandLeaderLine) {
    lines.push(
      `<div class="stageplanBoxRole">${STAGEPLAN_BAND_LEADER_LINE}</div>`,
    );
  }

  const hasBody =
    box.inputBullets.length > 0 ||
    box.monitorBullets.length > 0 ||
    box.extraBullets.length > 0;
  if (hasBody) lines.push(`<div class="stageplanTitleGap"></div>`);

  const addBullets = (bullets: string[]) => {
    for (const bullet of bullets) {
      lines.push(
        `<div class="stageplanBoxLine"><span class="bullet" style="margin-right:${typography.bulletSpacingPx}px;">•</span><span class="text">${bullet}</span></div>`,
      );
    }
  };

  addBullets(box.inputBullets);
  if (box.monitorBullets.length > 0) {
    if (box.inputBullets.length > 0)
      lines.push(`<div class="stageplanGap"></div>`);
    addBullets(box.monitorBullets);
  }
  if (box.extraBullets.length > 0) {
    if (box.monitorBullets.length > 0 || box.inputBullets.length > 0)
      lines.push(`<div class="stageplanGap"></div>`);
    addBullets(box.extraBullets);
  }
  // Napájení je řádek v toku, ne badge v rohu — výška boxu s ním počítá (R5).
  if (box.hasPowerBadge) {
    lines.push(`<div class="stageplanPower">${box.powerBadgeText}</div>`);
  }

  return `<div class="stageplanBox" style="left:${box.xMm}mm; top:${box.yMm}mm; width:${box.widthMm}mm; height:${box.heightMm}mm; transform:rotate(${box.rotationDeg}deg);">${lines.join("")}</div>`;
}

export function renderStageplanSection(
  vm: DocumentViewModel,
  options?: Partial<StageplanRenderOptions>,
): string {
  const plan = buildStageplanPlan(vm.stageplan, options);
  const boxesHtml = plan.boxes
    .map((box) => renderBox(box, plan.typography))
    .join("\n");

  // Finding 2 (F5b fix): width/height jde na .stageplanPlanArea, ne na
  // .stageplanContainer — jinak je container padding mrtvý a jeho border-box
  // je jen areaWidthMm místo celého zrcadla (viz styles.ts).
  return `
<section class="stageplanSection">\n  <div class="stageplanCaption">${plan.stage.caption ?? ""}</div>\n  <div class="stageplanContainer">\n    <div class="stageplanPlanArea" style="width:${plan.container.widthMm}mm; height:${plan.container.heightMm}mm;">\n      <div class="stageplanStage" style="left:${plan.stage.xMm}mm; top:${plan.stage.yMm}mm; width:${plan.stage.widthMm}mm; height:${plan.stage.heightMm}mm;">\n        <div class="stageplanDownstage">DOWNSTAGE · PUBLIKUM</div>\n      </div>\n      ${boxesHtml}\n    </div>\n  </div>\n</section>`.trim();
}
