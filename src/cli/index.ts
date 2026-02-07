import { generateDocument } from "../app/usecases/generateDocument.js";
import { exportPdf } from "../app/usecases/exportPdf.js";

console.log("ARGV:", process.argv);

function getProjectId(args: string[]): string | undefined {
  const idx = args.indexOf("--project");
  if (idx >= 0) return args[idx + 1];

  const first = args.find((a) => !a.startsWith("-"));
  return first;
}

const args = process.argv.slice(2);
const projectId = getProjectId(args);
const wantPdf = args.includes("--pdf");

if (!projectId) {
  console.error("Usage:");
  console.error("  npm run dev:export -- --project <id> [--pdf]");
  console.error("  npm run dev:export -- <id> [--pdf]");
  process.exit(1);
}

if (wantPdf) {
  const { pdfPath } = await exportPdf(projectId);
  console.log(JSON.stringify({ ok: true, projectId, pdfPath }, null, 2));
} else {
  const vm = await generateDocument(projectId);
  console.log(JSON.stringify(vm, null, 2));
}