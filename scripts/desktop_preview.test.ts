import path from "node:path";
import { pathToFileURL } from "node:url";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { isExecutedAsMainModule, main } from "./desktop_preview.js";

type StreamPair = {
  stdout: PassThrough;
  stderr: PassThrough;
};

function createIo(): StreamPair {
  return {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  };
}

function readStream(stream: PassThrough): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      output += chunk;
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(output));
  });
}

describe("desktop_preview entrypoint detection", () => {
  it("returns false when argv entrypoint is missing", () => {
    expect(isExecutedAsMainModule(undefined, "file:///module.ts")).toBe(false);
  });

  it("compares module URL with pathToFileURL-compatible filesystem path", () => {
    const entryPath = path.join(
      "/workspace/stagepilot",
      "scripts",
      "desktop_preview.ts",
    );

    expect(isExecutedAsMainModule(entryPath, pathToFileURL(entryPath).href)).toBe(
      true,
    );
    expect(
      isExecutedAsMainModule(entryPath, pathToFileURL(`${entryPath}.other`).href),
    ).toBe(false);
  });

  it("does not auto-run main when imported", async () => {
    const imported = await import("./desktop_preview.js");
    expect(typeof imported.main).toBe("function");
  });
});
describe("desktop_preview stdout/stderr protocol", () => {
  it("writes only JSON payload to stdout and sends diagnostics to stderr", async () => {
    const io = createIo();
    const stdoutResult = readStream(io.stdout);
    const stderrResult = readStream(io.stderr);

    const expectedResponse = {
      ok: true as const,
      result: { previewPdfPath: "/tmp/preview_test.pdf" },
    };

    const exitCode = await main(
      ["--project-id", "project-1", "--user-data-dir", "/tmp/user-data"],
      io,
      async (_args, log) => {
        log("[pdf-preview] buildDocument success", { inputCount: 3 });
        return expectedResponse;
      },
    );

    io.stdout.end();
    io.stderr.end();

    const stdout = await stdoutResult;
    const stderr = await stderrResult;

    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(JSON.parse(stdout)).toEqual(expectedResponse);
    expect(stdout).not.toContain("[pdf-preview]");
    expect(stderr).toContain("[pdf-preview] buildDocument success");
  });

  it("returns structured JSON error with phase metadata when runner throws", async () => {
    const io = createIo();
    const stdoutResult = readStream(io.stdout);
    const stderrResult = readStream(io.stderr);

    const exitCode = await main(
      ["--project-id", "project-1", "--user-data-dir", "/tmp/user-data"],
      io,
      async (_args, log) => {
        log("[pdf-preview] buildDocument start");
        throw new Error("boom");
      },
    );

    io.stdout.end();
    io.stderr.end();

    const stdout = await stdoutResult;
    const stderr = await stderrResult;
    const parsed = JSON.parse(stdout);

    expect(exitCode).toBe(0);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe("PREVIEW_FAILED");
    expect(parsed.error.phase).toBe("buildDocument start");
    expect(parsed.error.message).toBe("boom");
    expect(stderr).toContain("[preview-script] failed");
    expect(stderr).toContain("phase: 'buildDocument start'");
  });
});
