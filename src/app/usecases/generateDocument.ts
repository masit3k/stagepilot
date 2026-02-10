// Co? Hlavní aplikační use-case „vygeneruj dokument“.
// Proč? Odděluje orchestrace od doménové logiky.

import { loadRepository } from "../../infra/fs/repo.js";
import { buildDocument } from "../../domain/pipeline/buildDocument.js";
import { validateDocument } from "../../domain/rules/validateDocument.js";
import { normalizeProject } from "./normalizeProject.js";

export async function generateDocument(projectId: string) {
  const repo = await loadRepository();
  const project = normalizeProject(repo.getProject(projectId));

  const vm = buildDocument(project, repo);
  validateDocument(vm);

  return vm;
}
