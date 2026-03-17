import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { main } from "./desktop_preview.js";

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
});
