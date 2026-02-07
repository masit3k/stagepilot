import { exportPdf } from "../app/usecases/exportPdf.js";
import { generateDocument } from "../app/usecases/generateDocument.js";
import {
  listProjectVersions,
  loadProjectVersion,
} from "../infra/fs/versionStore.js";

console.log("ARGV:", process.argv);

function getProjectId(args: string[]): string | undefined {
  const idx = args.indexOf("--project");
  if (idx >= 0) return args[idx + 1];

  const first = args.find((a) => !a.startsWith("-"));
  return first;
}

function argValue(args: string[], key: string): string | undefined {
  const idx = args.indexOf(key);
  if (idx >= 0) return args[idx + 1];
  return undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const projectId = getProjectId(args);
  const wantPdf = args.includes("--pdf");
  const wantJson = args.includes("--json");

  const wantsVersions = args.includes("--versions");
  const versionsProjectId = argValue(args, "--versions");
  if (wantsVersions) {
    if (!versionsProjectId) {
      console.error("Usage: --versions <projectId> [--json]");
      process.exit(1);
    }
    const versions = await listProjectVersions(versionsProjectId);
    if (wantJson) {
      console.log(JSON.stringify(versions, null, 2));
      return;
    }

    for (const v of versions) {
      const eventDate = v.eventDate ?? "-";
      const eventVenue = v.eventVenue ?? "-";
      const purpose = v.purpose ?? "-";
      console.log(
        [
          v.versionId,
          v.documentDate,
          eventDate,
          eventVenue,
          v.bandRef,
          purpose,
          v.pdfFileName,
        ].join("  ")
      );
    }
    return;
  }

  const wantsShowVersion = args.includes("--show-version");
  const showProjectId = argValue(args, "--show-version");
  if (wantsShowVersion) {
    if (!showProjectId) {
      console.error("Usage: --show-version <projectId> <versionId> [--json]");
      process.exit(1);
    }
    const showIdx = args.indexOf("--show-version");
    const versionId = showIdx >= 0 ? args[showIdx + 2] : undefined;
    if (!versionId) {
      console.error("Usage: --show-version <projectId> <versionId> [--json]");
      process.exit(1);
    }

    const { meta } = await loadProjectVersion(showProjectId, versionId);
    if (wantJson) {
      console.log(JSON.stringify(meta, null, 2));
      return;
    }

    const eventDate = meta.eventDate ?? "-";
    const eventVenue = meta.eventVenue ?? "-";
    const purpose = meta.purpose ?? "-";
    console.log(`projectId: ${meta.projectId}`);
    console.log(`versionId: ${meta.versionId}`);
    console.log(`documentDate: ${meta.documentDate}`);
    console.log(`generatedAt: ${meta.generatedAt}`);
    console.log(`purpose: ${purpose}`);
    console.log(`bandRef: ${meta.bandRef}`);
    console.log(`eventDate: ${eventDate}`);
    console.log(`eventVenue: ${eventVenue}`);
    console.log(`pdf: ${meta.paths.pdf}`);
    console.log(`projectJson: ${meta.paths.projectJson}`);
    console.log(`metaJson: ${meta.paths.metaJson}`);
    return;
  }

  if (!projectId) {
    console.error("Usage:");
    console.error("  npm run dev:export -- --project <id> [--pdf]");
    console.error("  npm run dev:export -- <id> [--pdf]");
    console.error("  npm run dev:export -- --versions <projectId> [--json]");
    console.error("  npm run dev:export -- --show-version <projectId> <versionId> [--json]");
    process.exit(1);
  }

  if (wantPdf) {
    const { pdfPath, versionId, versionPath } = await exportPdf(projectId);
    console.log(
      JSON.stringify({ ok: true, projectId, pdfPath, versionId, versionPath }, null, 2)
    );
    return;
  }

  const vm = await generateDocument(projectId);
  console.log(JSON.stringify(vm, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
