import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import type { Browser, LaunchOptions, Page } from "puppeteer";

import type { DocumentViewModel } from "../../domain/model/types.js";
import { renderInputlistHtml } from "./template.js";
import type { PdfContact } from "./template.js";
import { pdfLayout } from "./layout.js";
import { countPdfPages } from "./pdfPageCount.js";
import type { StageplanRenderOptions } from "./stageplanRenderOptions.js";

/** Input list a stage plan. Třetí strana znamená, že se obsah nevešel. */
const EXPECTED_PAGE_COUNT = 2;

const DESKTOP_CHROMIUM_ARGS = [
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-sandbox",
    "--font-render-hinting=none",
];

function describeError(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            cause: error.cause,
        };
    }
    return { message: String(error) };
}

function resolveChromiumExecutablePath(): string | undefined {
    const explicit = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    if (explicit) return explicit;
    try {
        const bundled = puppeteer.executablePath();
        return bundled?.trim() ? bundled : undefined;
    } catch {
        return undefined;
    }
}

function hasExplicitExecutablePath(): boolean {
    return Boolean(process.env.PUPPETEER_EXECUTABLE_PATH?.trim());
}

type LaunchStrategy = {
    name: string;
    launchOptions: LaunchOptions;
    executablePath?: string;
};

function getIcuDataPath(chromeExecutablePath: string): string {
    return path.join(path.dirname(chromeExecutablePath), "icudtl.dat");
}

function getSystemBrowserFallbacks(baseLaunchOptions: LaunchOptions): LaunchStrategy[] {
    if (process.platform === "linux") {
        const linuxExecutables = [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
        ];

        const foundExecutable = linuxExecutables.find((candidate) => existsSync(candidate));
        return foundExecutable
            ? [
                {
                    name: "system-browser:linux-executable",
                    executablePath: foundExecutable,
                    launchOptions: {
                        ...baseLaunchOptions,
                        executablePath: foundExecutable,
                    },
                },
            ]
            : [];
    }

    return [
        {
            name: "system-browser:chrome-channel",
            launchOptions: {
                ...baseLaunchOptions,
                channel: "chrome",
            },
        },
    ];
}

async function launchWithFallback(strategies: LaunchStrategy[]): Promise<Browser> {
    let previousError: unknown;

    for (let index = 0; index < strategies.length; index += 1) {
        const strategy = strategies[index];
        const isFallbackAttempt = index > 0;

        if (isFallbackAttempt) {
            console.error("[pdf] retrying chromium launch with fallback strategy", {
                strategy: strategy.name,
            });
        }

        try {
            const browser = await puppeteer.launch(strategy.launchOptions);
            console.error("[pdf] chromium launch succeeded", {
                strategy: strategy.name,
                fallback: isFallbackAttempt,
            });
            return browser;
        } catch (error) {
            previousError = error;
            console.error("[pdf] chromium launch failed", {
                strategy: strategy.name,
                fallback: isFallbackAttempt,
                error: describeError(error),
            });

            if (strategy.executablePath) {
                console.error("[pdf] cached/bundled Chromium remediation", {
                    strategy: strategy.name,
                    chromiumExecutablePath: strategy.executablePath,
                    expectedIcuDataPath: getIcuDataPath(strategy.executablePath),
                    remediation:
                        "Delete Puppeteer cache and reinstall browsers, e.g. remove ~/.cache/puppeteer (or %USERPROFILE%\\.cache\\puppeteer on Windows) and run `npx puppeteer browsers install chrome`.",
                });
            }
        }
    }

    throw new Error(
        "PDF preview failed to launch browser. Please retry. If the problem persists, check desktop logs for Chromium diagnostics.",
        { cause: previousError instanceof Error ? previousError : undefined },
    );
}

/** Spuštění prohlížeče podle pořadí systémový Chrome → svázaný Chromium → env. */
export async function launchPdfBrowser(): Promise<Browser> {
    const executablePath = resolveChromiumExecutablePath();
    const dumpio = process.env.STAGEPILOT_PDF_DUMPIO === "1";
    const baseLaunchOptions = {
        headless: true,
        dumpio,
        args: DESKTOP_CHROMIUM_ARGS,
    } as const satisfies LaunchOptions;

    const launchStrategies: LaunchStrategy[] = [];
    const explicitExecutablePath = hasExplicitExecutablePath();

    if (!explicitExecutablePath) {
        launchStrategies.push(...getSystemBrowserFallbacks(baseLaunchOptions));
    }

    if (executablePath) {
        launchStrategies.push({
            name: explicitExecutablePath
                ? "env:PUPPETEER_EXECUTABLE_PATH"
                : "puppeteer.executablePath()",
            executablePath,
            launchOptions: { ...baseLaunchOptions, executablePath },
        });
    } else {
        launchStrategies.push({
            name: "puppeteer default resolution",
            launchOptions: { ...baseLaunchOptions },
        });
    }

    console.error("[pdf] chromium launch plan", {
        platform: process.platform,
        nodeVersion: process.versions.node,
        executablePath: executablePath ?? "<puppeteer default>",
        cwd: process.cwd(),
        dumpio,
        args: DESKTOP_CHROMIUM_ARGS,
        strategies: launchStrategies.map((strategy) => ({
            name: strategy.name,
            executablePath: strategy.executablePath ?? null,
            channel: strategy.launchOptions.channel ?? null,
        })),
    });

    return launchWithFallback(launchStrategies);
}

/**
 * Zapíše HTML do stránky tak, aby si zachovala **file:// původ**. Bez toho
 * Chromium odmítne .ttf soubory z @font-face a dokument se tiše vysází
 * náhradním písmem — přesně to se dělo do F7 a v exportech skončil Arial
 * místo Space Grotesk.
 *
 * `setContent` sám tohle nezařídí: provede `document.open()` nad `about:blank`
 * a URL rámce tím zůstane. Navigace na `baseHref` dá stránce file:// původ,
 * který jí `document.open()` zachová. `<base href>` to nezachrání — ten řeší
 * rozklad relativních URL, ne původ dokumentu.
 */
export async function setPdfPageContent(
    page: Page,
    baseHref: string,
    html: string,
): Promise<void> {
    await page.goto(baseHref, { waitUntil: "load" });
    await page.setContent(html, { waitUntil: "load" });
}

/**
 * Přesune ověřený render z dočasné cesty na finální outFile. Puppeteer píše
 * do tempOutFile, ne přímo do outFile — když se stránky nesedí, na místě,
 * kde volající čeká hotový dokument, nesmí zůstat nic. Selhání úklidu se
 * jen zaloguje; nikdy nenahradí ani nezahodí původní chybu o počtu stran.
 */
export async function finalizeRenderedPdf(tempOutFile: string, outFile: string): Promise<void> {
    const rendered = await fs.readFile(tempOutFile);
    const pageCount = countPdfPages(rendered);
    if (pageCount !== EXPECTED_PAGE_COUNT) {
        try {
            await fs.unlink(tempOutFile);
        } catch (cleanupError) {
            console.error("[pdf] failed to remove invalid page-count artifact", {
                tempOutFile,
                error: describeError(cleanupError),
            });
        }
        throw new Error(
            `PDF page count mismatch: expected ${EXPECTED_PAGE_COUNT}, got ${pageCount}. Content overflowed the A4 page.`,
        );
    }
    await fs.rename(tempOutFile, outFile);
}

export interface RenderPdfOptions {
    outFile: string;         // absolutní nebo relativní
    contact?: PdfContact;   // volitelné (doplníš z usecase)
    stageplan?: Partial<StageplanRenderOptions>;
}

/**
 * Render DocumentViewModel do PDF (A4).
 * Defaultně 1 stránka; výjimka je Stageplan na stránce 2.
 * Pokud obsah přeteče, je to ERROR (ne “layout feature”).
 */
export async function renderPdf(vm: DocumentViewModel, opts: RenderPdfOptions): Promise<void> {
    const baseName = path.basename(opts.outFile);
    const tabTitle = baseName.replace(/\.pdf$/i, "");

    // baseHref pro relativní assety (fonty) v CSS: ./fonts/...
    const pdfBaseDir = path.join(process.cwd(), "src", "infra", "pdf");
    const baseHref = pathToFileURL(pdfBaseDir + path.sep).href; // musí končit "/"

    const logoHref = vm.meta.logoFile
        ? pathToFileURL(path.resolve(process.cwd(), vm.meta.logoFile)).href
        : undefined;

    const html = renderInputlistHtml(vm, {
        tabTitle,
        baseHref,
        contact: opts.contact,
        logoHref,
        stageplan: opts.stageplan,
    });

    await fs.mkdir(path.dirname(opts.outFile), { recursive: true });

    const browser = await launchPdfBrowser();

    try {
        const page = await browser.newPage();

        await setPdfPageContent(page, baseHref, html);

        // Fonty jsou součást identity dokumentu, ne kosmetika: PDF vysázené
        // náhradním písmem je vadný výstup a má selhat, ne se vytisknout.
        const missingFonts = await page.evaluate(async (families: string[]) => {
            await document.fonts.ready;
            const missing: string[] = [];
            for (const family of families) {
                if (!document.fonts.check(`400 10px '${family}'`)) {
                    missing.push(family);
                }
            }
            return missing;
        }, [pdfLayout.typography.fontFamily, pdfLayout.typography.monoFamily]);

        if (missingFonts.length > 0) {
            throw new Error(
                `PDF fonts failed to load: ${missingFonts.join(", ")}. The document would be typeset in a fallback face.`,
            );
        }

        // #content je flex položka s pevnou výškou i šířkou stránky, takže
        // scrollHeight/scrollWidth nad clientHeight/clientWidth je přímé
        // měření přetečení v obou rozměrech. Předchozí verze porovnávala
        // rodiče s jeho vlastním dítětem a nemohla nikdy spadnout; a měřila
        // jen výšku, takže prvek širší než zrcadlo (např. .stageplanContainer)
        // proklouzl bez povšimnutí — Chromium na to reagovalo tichým
        // zmenšením celého dokumentu při tisku.
        //
        // .docHeader je sourozenec #content/#content2, ne jejich potomek, takže
        // tahle kontrola byla dřív jediné místo, které mohlo vidět, když se do
        // něj nevejde kontaktní řádek (nowrap, žádné šířkové omezení) — přesně
        // ten případ, kdy dlouhý kontakt uteče pod razítkový sloupec.
        const contentIds = [pdfLayout.ids.content, pdfLayout.ids.content2];

        // Kontrolované prvky se sbírají do jednoho plochého seznamu a projdou
        // jedinou smyčkou bez pomocné funkce: page.evaluate() posílá do
        // Chromia jen text callbacku přes toString(), a esbuild (tsx spouští
        // skripty přes něj) vnořenou pojmenovanou funkci obalí voláním
        // __name(...) kvůli zachování jejího jména při ladění. To volání se
        // do odeslaného textu dostane taky, ale helper __name žije jen v
        // Node procesu — v prohlížeči je nedefinovaný a evaluate spadne na
        // ReferenceError dřív, než se k samotné kontrole vůbec dostane.
        const overflow = await page.evaluate((ids: string[]) => {
            const tolerancePx = 2;

            const targets: Array<
                { readonly elementId: string; readonly el: Element } | { readonly missing: string }
            > = [];
            for (const id of ids) {
                const el = document.getElementById(id);
                targets.push(el ? { elementId: `#${id}`, el } : { missing: `#${id}` });
            }
            for (const header of Array.from(document.querySelectorAll(".docHeader"))) {
                const pageId = header.closest("[id]")?.id ?? "?";
                targets.push({ elementId: `#${pageId} .docHeader`, el: header });
            }

            for (const target of targets) {
                if ("missing" in target) {
                    return { ok: false as const, reason: `missing ${target.missing}` };
                }
                const heightOverflowPx = target.el.scrollHeight - target.el.clientHeight;
                if (heightOverflowPx > tolerancePx) {
                    return {
                        ok: false as const,
                        elementId: target.elementId,
                        dimension: "height" as const,
                        overflowPx: heightOverflowPx,
                    };
                }
                const widthOverflowPx = target.el.scrollWidth - target.el.clientWidth;
                if (widthOverflowPx > tolerancePx) {
                    return {
                        ok: false as const,
                        elementId: target.elementId,
                        dimension: "width" as const,
                        overflowPx: widthOverflowPx,
                    };
                }
            }

            return { ok: true as const };
        }, contentIds);

        if (!overflow.ok) {
            throw new Error(
                `PDF overflow: content does not fit A4 page. ${
                    "overflowPx" in overflow
                        ? `elementId=${overflow.elementId} dimension=${overflow.dimension} overflowPx=${overflow.overflowPx}`
                        : overflow.reason
                }`,
            );
        }

        // Render se nejdřív zapíše mimo outFile — teprve finalizeRenderedPdf ho
        // tam přesune, a jen když počet stran sedí. Volající tak nikdy nenajde
        // na outFile nedokončený nebo přetečený dokument.
        const tempOutFile = path.join(path.dirname(opts.outFile), `${baseName}.tmp-${randomUUID()}`);

        try {
            await page.pdf({
                path: tempOutFile,
                format: "A4",
                printBackground: true,
                preferCSSPageSize: true,
            });
        } catch (renderError) {
            // Když page.pdf() spadne, nesmí zůstat viset dočasný soubor vedle
            // výstupní složky. Selhání úklidu se jen zaloguje — nikdy nesmí
            // zastínit původní chybu renderu.
            try {
                await fs.unlink(tempOutFile);
            } catch (cleanupError) {
                console.error("[pdf] failed to remove temp render artifact after failed render", {
                    tempOutFile,
                    error: describeError(cleanupError),
                });
            }
            throw renderError;
        }

        await finalizeRenderedPdf(tempOutFile, opts.outFile);
    } finally {
        await browser.close();
    }
}
