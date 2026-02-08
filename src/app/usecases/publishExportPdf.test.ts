import { describe, expect, it, vi } from "vitest";

import { publishExportPdf, ExportLockedError } from "./publishExportPdf.js";
import * as replaceModule from "../../infra/fs/replaceFileAtomic.js";

describe("publishExportPdf", () => {
  it("throws ExportLockedError when destination is locked", async () => {
    const error = Object.assign(new Error("locked"), { code: "EPERM" });
    const spy = vi
      .spyOn(replaceModule, "replaceFileAtomic")
      .mockRejectedValue(error);

    await expect(
      publishExportPdf({
        sourcePdfPath: "/tmp/source.pdf",
        exportRoot: "/tmp/exports",
        pdfFileName: "output.pdf",
      })
    ).rejects.toBeInstanceOf(ExportLockedError);

    spy.mockRestore();
  });
});
