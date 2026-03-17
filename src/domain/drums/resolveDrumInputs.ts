import type { DrumDefinition } from "./drumDefinition.js";
import { drumRankByResolvedKey } from "./drumInputCatalog.js";
import { resolveDrumDefinitionInputs } from "./resolveDrumDefinitionInputs.js";

export function resolveDrumInputs(definition: DrumDefinition) {
  return resolveDrumDefinitionInputs(definition);
}

export { drumRankByResolvedKey };
