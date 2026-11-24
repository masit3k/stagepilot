import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closePdfBrowser, finalizeRenderedPdf } from "./pdf.js";

// Žádný z těchto testů nespouští prohlížeč: jde jen o úklid kolem něj.
describe("PDF render cleanup", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "stagepilot-pdf-cleanup-"),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("removes the temp file when moving it onto outFile fails", async () => {
    const tempOutFile = path.join(tmpRoot, "doc.pdf.tmp-test");
    // Cílová složka neexistuje, takže rename spadne.
    const outFile = path.join(tmpRoot, "missing-dir", "doc.pdf");
    await fs.writeFile(tempOutFile, "/Type /Page\n/Type /Page\n");

    await expect(
      finalizeRenderedPdf(tempOutFile, outFile),
    ).rejects.toMatchObject({ code: "ENOENT" });

    await expect(fs.access(tempOutFile)).rejects.toThrow();
  });

  it("does not throw when closing the browser fails, and logs it", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const browser = {
      close: () => Promise.reject(new Error("browser already gone")),
    };

    await expect(closePdfBrowser(browser)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errorSpy.mock.calls[0])).toContain(
      "browser already gone",
    );
  });

  it("lets the render error through when the browser also fails to close", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const renderError = new Error("PDF overflow");
    const browser = {
      close: () => Promise.reject(new Error("browser already gone")),
    };

    const run = async () => {
      try {
        throw renderError;
      } finally {
        await closePdfBrowser(browser);
      }
    };

    await expect(run()).rejects.toBe(renderError);
  });

  it("closes the browser", async () => {
    const close = vi.fn(() => Promise.resolve());

    await closePdfBrowser({ close });

    expect(close).toHaveBeenCalledTimes(1);
  });
});
