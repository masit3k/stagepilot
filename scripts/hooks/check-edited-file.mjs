// Claude Code PostToolUse hook: runs Biome on the single file that was just edited.
// The whole repo is not checked because `npm run lint` has known pre-existing failures.
// Exit 2 feeds Biome's output back to Claude via stderr.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECKED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".json",
  ".css",
]);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function readEditedFilePath() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  return input?.tool_input?.file_path;
}

function shouldCheck(filePath) {
  if (typeof filePath !== "string" || !existsSync(filePath)) return false;
  if (!CHECKED_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    return false;
  const relative = path.relative(repoRoot, path.resolve(filePath));
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

const filePath = readEditedFilePath();
if (!shouldCheck(filePath)) process.exit(0);

const result = spawnSync(
  "npx",
  ["biome", "check", "--no-errors-on-unmatched", `"${path.resolve(filePath)}"`],
  { cwd: repoRoot, shell: true, encoding: "utf8" },
);

if (result.error) {
  process.stderr.write(
    `check-edited-file: failed to run Biome: ${result.error.message}\n`,
  );
  process.exit(2);
}
if (result.status !== 0) {
  process.stderr.write(`${result.stdout}${result.stderr}`);
  process.exit(2);
}
process.exit(0);
