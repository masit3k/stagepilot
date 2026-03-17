import type { DrumDefinition } from "./drumDefinition.js";
import { resolveDrumDefinitionInputs } from "./resolveDrumDefinitionInputs.js";
import { drumRankByResolvedKey } from "./drumInputIds.js";

export function resolveDrumInputs(definition: DrumDefinition) {
  return resolveDrumDefinitionInputs(definition);
}

export { drumRankByResolvedKey };
