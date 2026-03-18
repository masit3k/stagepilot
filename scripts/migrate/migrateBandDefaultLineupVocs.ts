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
    musiciansRoot: paths.musicians,
    writeChanges: !dryRun,
  });

  const changed = results.filter((item) => item.changed);
  const unchanged = results.length - changed.length;

  process.stdout.write(`Band lineup VOCS migration ${dryRun ? "(dry-run)" : "(write)"}\n`);
  process.stdout.write(`Root: ${resolvedRoot}\n`);
  for (const result of results) {
    const status = result.changed ? "UPDATED" : "UNCHANGED";
    const added = result.addedVocalMembers.length > 0 ? ` added=[${result.addedVocalMembers.join(", ")}]` : "";
    process.stdout.write(`- ${status} ${result.bandId}${added}\n`);
  }
  process.stdout.write(`Summary: total=${results.length} updated=${changed.length} unchanged=${unchanged}\n`);
}

main().catch((error) => {
  process.stderr.write(`Band lineup VOCS migration failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
