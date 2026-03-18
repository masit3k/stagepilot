import path from "node:path";
import { migrateBandsDefaultLineupVocs } from "./bandDefaultLineupVocsMigration.js";
import { catalogPathsForRoot, resolveStorageRoot } from "../../src/infra/storage/catalogPaths.js";

function resolveArgValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => arg === flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const rootArg = resolveArgValue("--root");
  const resolvedRoot = path.resolve(rootArg ?? resolveStorageRoot());
  const paths = catalogPathsForRoot(resolvedRoot);

  const results = await migrateBandsDefaultLineupVocs({
    bandsRoot: paths.bands,
  });

  const valid = results.filter((item) => item.isValidCanonicalModel);
  const invalid = results.length - valid.length;

  process.stdout.write(`Band canonical model validation ${dryRun ? "(dry-run)" : "(write disabled)"}\n`);
  process.stdout.write(`Root: ${resolvedRoot}\n`);
  for (const result of results) {
    const status = result.isValidCanonicalModel ? "VALID" : "INVALID";
    const issues = result.issues.length > 0 ? ` issues=[${result.issues.join(" | ")}]` : "";
    process.stdout.write(`- ${status} ${result.bandId}${issues}\n`);
  }
  process.stdout.write(`Summary: total=${results.length} valid=${valid.length} invalid=${invalid}\n`);
}

main().catch((error) => {
  process.stderr.write(`Band canonical model validation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
