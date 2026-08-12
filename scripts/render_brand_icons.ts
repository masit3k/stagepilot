/**
 * Generates every platform icon for the desktop app from the brand SVGs.
 *
 * Replaces the previous Makefile pipeline, which required inkscape, ImageMagick
 * and macOS iconutil. None of those are needed here: Chromium (already a
 * dependency via Puppeteer) rasterises the SVGs, `tauri icon` produces the
 * platform bundles, and the Windows .ico is assembled in process so that small
 * sizes can carry different artwork.
 *
 * Per the brand handoff, sizes below 24px drop the rounded tile and show the
 * bare mark — a tile at 16px leaves too few pixels for the ring to read.
 */

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import puppeteer, { type Browser, type LaunchOptions } from "puppeteer";

// Run from the repository root, matching the convention in src/infra/pdf/pdf.ts.
const repoRoot = process.cwd();
const brandDir = path.join(repoRoot, "packages", "desktop", "assets", "brand");
const tauriDir = path.join(repoRoot, "packages", "desktop", "src-tauri");
const outDir = path.join(repoRoot, "dist-icons", "stagepilot");

/** Sizes that use the rounded tile with the inverse mark. */
const TILED_SIZES = [32, 48, 64, 128, 256] as const;
/** Sizes that use the bare mark, no tile. */
const BARE_SIZES = [16, 20, 24] as const;
/** Master raster handed to `tauri icon`. */
const MASTER_SIZE = 1024;

async function launchBrowser(): Promise<Browser> {
  const baseOptions: LaunchOptions = { headless: true };
  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  const strategies: LaunchOptions[] = explicit
    ? [{ ...baseOptions, executablePath: explicit }]
    : [baseOptions, { ...baseOptions, channel: "chrome" }];

  let lastError: unknown;
  for (const options of strategies) {
    try {
      return await puppeteer.launch(options);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Could not launch Chromium to rasterise icons. Install a browser with \`npx puppeteer browsers install chrome\` or set PUPPETEER_EXECUTABLE_PATH. Cause: ${String(lastError)}`,
  );
}

async function rasterise(
  browser: Browser,
  svgPath: string,
  size: number,
): Promise<Buffer> {
  const svg = readFileSync(svgPath, "utf8");
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><meta charset="utf-8">
             <style>
               html,body{margin:0;padding:0;background:transparent}
               svg{display:block;width:${size}px;height:${size}px}
             </style>
             ${svg}`,
      { waitUntil: "load" },
    );
    const shot = await page.screenshot({ type: "png", omitBackground: true });
    return Buffer.from(shot);
  } finally {
    await page.close();
  }
}

/**
 * Assembles a PNG-payload .ico. Windows Vista and later read PNG-compressed
 * entries directly, so each layer is stored as-is.
 */
function buildIco(layers: { size: number; png: Buffer }[]): Buffer {
  const ICONDIR = 6;
  const ICONDIRENTRY = 16;
  const header = Buffer.alloc(ICONDIR);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(layers.length, 4);

  const directory = Buffer.alloc(ICONDIRENTRY * layers.length);
  let offset = ICONDIR + ICONDIRENTRY * layers.length;

  layers.forEach((layer, index) => {
    const at = index * ICONDIRENTRY;
    // 256 is encoded as 0 — the field is a single byte.
    directory.writeUInt8(layer.size >= 256 ? 0 : layer.size, at + 0);
    directory.writeUInt8(layer.size >= 256 ? 0 : layer.size, at + 1);
    directory.writeUInt8(0, at + 2); // palette size: not indexed
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(layer.png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += layer.png.length;
  });

  return Buffer.concat([
    header,
    directory,
    ...layers.map((layer) => layer.png),
  ]);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const tilePath = path.join(brandDir, "stagepilot-app-icon.svg");
  const markPath = path.join(brandDir, "stagepilot-mark.svg");

  const browser = await launchBrowser();
  try {
    const master = await rasterise(browser, tilePath, MASTER_SIZE);
    const masterPath = path.join(outDir, `icon-${MASTER_SIZE}.png`);
    writeFileSync(masterPath, master);
    console.log(`rasterised ${MASTER_SIZE}px master (${master.length} B)`);

    const layers: { size: number; png: Buffer }[] = [];
    for (const size of BARE_SIZES) {
      layers.push({ size, png: await rasterise(browser, markPath, size) });
      console.log(`rasterised ${size}px (bare mark)`);
    }
    for (const size of TILED_SIZES) {
      layers.push({ size, png: await rasterise(browser, tilePath, size) });
      console.log(`rasterised ${size}px (tile)`);
    }

    // `tauri icon` writes the full platform set, including its own icon.ico.
    console.log("running `tauri icon`…");
    // Runs through a shell as one command string: Node >=20 refuses to spawn
    // Windows .cmd shims directly (EINVAL), and passing an args array
    // alongside shell: true is deprecated (DEP0190).
    const iconsDir = path.join(tauriDir, "icons");
    execSync(`npx tauri icon "${masterPath}" --output "${iconsDir}"`, {
      cwd: path.join(repoRoot, "packages", "desktop"),
      stdio: "inherit",
    });

    // Desktop-only app: drop the mobile sets `tauri icon` always emits.
    for (const mobileDir of ["android", "ios"]) {
      rmSync(path.join(iconsDir, mobileDir), { recursive: true, force: true });
    }

    // Overwrite it with the per-size build so 16/20/24 keep the bare mark.
    const ico = buildIco(layers);
    writeFileSync(path.join(tauriDir, "icons", "icon.ico"), ico);
    writeFileSync(path.join(outDir, "stagepilot.ico"), ico);
    console.log(
      `wrote icon.ico with ${layers.length} layers (${layers.map((l) => l.size).join(", ")}px, ${ico.length} B)`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
