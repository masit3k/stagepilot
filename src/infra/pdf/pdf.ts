import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import type { Browser, LaunchOptions } from "puppeteer";

import type { DocumentViewModel } from "../../domain/model/types.js";
import { renderInputlistHtml } from "./template.js";
import { pdfLayout } from "./layout.js";

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

export interface RenderPdfOptions {
    outFile: string;         // absolutní nebo relativní
    contactLine?: string;    // volitelné (doplníš z usecase)
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
        contactLine: opts.contactLine,
        logoHref,
    });

    await fs.mkdir(path.dirname(opts.outFile), { recursive: true });

    const executablePath = resolveChromiumExecutablePath();
    const dumpio = process.env.STAGEPILOT_PDF_DUMPIO === "1";
    const baseLaunchOptions = {
        headless: true,
        dumpio,
        args: DESKTOP_CHROMIUM_ARGS,
    } as const satisfies LaunchOptions;

    const launchStrategies: LaunchStrategy[] = [];

    if (executablePath) {
        launchStrategies.push({
            name: process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
                ? "env:PUPPETEER_EXECUTABLE_PATH"
                : "puppeteer.executablePath()",
            executablePath,
            launchOptions: {
                ...baseLaunchOptions,
                executablePath,
            },
        });
    } else {
        launchStrategies.push({
            name: "puppeteer default resolution",
            launchOptions: {
                ...baseLaunchOptions,
            },
        });
    }

    if (!process.env.PUPPETEER_EXECUTABLE_PATH?.trim()) {
        launchStrategies.push(...getSystemBrowserFallbacks(baseLaunchOptions));
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

    let browser;
    browser = await launchWithFallback(launchStrategies);

    try {
        const page = await browser.newPage();

        // setContent stačí "load" – fonty se načtou přes file://
        await page.setContent(html, { waitUntil: "load" });

        // Overflow check: každý #content musí být uvnitř svého #page (A4/stránka).
        const pairs = [
            { pageId: pdfLayout.ids.page, contentId: pdfLayout.ids.content },
            { pageId: pdfLayout.ids.page2, contentId: pdfLayout.ids.content2 },
        ];

        const overflow = await page.evaluate((pairsArg) => {
            const d = globalThis as any;
            const doc = d.document as any;
            const pairs = pairsArg;

            const tolerancePx = 2;
            for (const pair of pairs) {
                const pageEl = doc.getElementById(pair.pageId);
                const contentEl = doc.getElementById(pair.contentId);
                if (!pageEl || !contentEl) {
                    return { ok: false, reason: `missing #${pair.pageId} or #${pair.contentId}` };
                }

                const pageRect = pageEl.getBoundingClientRect();
                const contentRect = contentEl.getBoundingClientRect();
                const overflowPx = contentRect.bottom - pageRect.bottom;
                if (overflowPx > tolerancePx) {
                    return { ok: false, overflowPx, pageId: pair.pageId };
                }
            }

            return { ok: true };
        }, pairs);

        if (!("ok" in overflow) || overflow.ok === false) {
            const msg =
                "PDF overflow: content does not fit A4 page. " +
                (typeof overflow === "object" && overflow && "overflowPx" in overflow
                    ? `pageId=${String((overflow as any).pageId)} overflowPx=${String((overflow as any).overflowPx)}`
                    : "");
            throw new Error(msg);
        }

        await page.pdf({
            path: opts.outFile,
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
        });
    } finally {
        await browser?.close();
    }
}
