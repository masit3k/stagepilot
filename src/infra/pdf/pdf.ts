import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

import type { DocumentViewModel } from "../../domain/model/types.js";
import { renderInputlistHtml } from "./template.js";

export interface RenderPdfOptions {
    outFile: string;         // absolutní nebo relativní
    contactLine?: string;    // volitelné (doplníš z usecase)
}

/**
 * Render DocumentViewModel do PDF (A4, přesně 1 stránka).
 * Pokud obsah přeteče, je to ERROR (ne “layout feature”).
 */
export async function renderPdf(vm: DocumentViewModel, opts: RenderPdfOptions): Promise<void> {
    const baseName = path.basename(opts.outFile);
    const tabTitle = baseName.replace(/\.pdf$/i, "");

    // baseHref pro relativní assety (fonty) v CSS: ./fonts/...
    const pdfBaseDir = path.join(process.cwd(), "src", "infra", "pdf");
    const baseHref = pathToFileURL(pdfBaseDir + path.sep).href; // musí končit "/"

    const html = renderInputlistHtml(vm, {
        tabTitle,
        baseHref,
        contactLine: opts.contactLine,
    });

    await fs.mkdir(path.dirname(opts.outFile), { recursive: true });

    const browser = await puppeteer.launch({ headless: true });

    try {
        const page = await browser.newPage();

        // setContent stačí "load" – fonty se načtou přes file://
        await page.setContent(html, { waitUntil: "load" });

        // Overflow check: #content musí být uvnitř #page (A4/1 page).
        const overflow = await page.evaluate(() => {
            const d = globalThis as any;
            const doc = d.document as any;

            const pageEl = doc.getElementById("page");
            const contentEl = doc.getElementById("content");
            if (!pageEl || !contentEl) return { ok: false, reason: "missing #page or #content" };

            const pageRect = pageEl.getBoundingClientRect();
            const contentRect = contentEl.getBoundingClientRect();

            const tolerancePx = 2;
            const overflowPx = contentRect.bottom - pageRect.bottom;

            return { ok: overflowPx <= tolerancePx, overflowPx };
        });

        if (!("ok" in overflow) || overflow.ok === false) {
            const msg =
                "PDF overflow: content does not fit A4/1 page. " +
                (typeof overflow === "object" && overflow && "overflowPx" in overflow
                    ? `overflowPx=${String((overflow as any).overflowPx)}`
                    : "");
            throw new Error(msg);
        }

        await page.pdf({
            path: opts.outFile,
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
            pageRanges: "1",
        });
    } finally {
        await browser.close();
    }
}
