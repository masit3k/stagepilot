import fs from "node:fs/promises";
import path from "node:path";
import {
  renderAuditReport,
  runUserDataVocalAudit,
} from "./userDataVocalsAudit.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const rootArg = args.find((arg) => !arg.startsWith("--"));
  const outIndex = args.findIndex((arg) => arg === "--out");
  const outPath = outIndex >= 0 ? args[outIndex + 1] : undefined;

  const root = path.resolve(rootArg ?? process.cwd());
  const report = await runUserDataVocalAudit(root);
  const rendered = renderAuditReport(report);

  if (outPath) {
    const target = path.resolve(outPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${rendered}\n`, "utf8");
  }

  process.stdout.write(`${rendered}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `Audit failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
