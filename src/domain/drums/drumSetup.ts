import type { InputChannel } from "../model/types.js";
import type { DrumDefinition } from "./drumDefinition.js";
import { createDefaultDrumDefinition } from "./drumDefinition.js";

export type DrumSetup = DrumDefinition;

export const STANDARD_10_SETUP = createDefaultDrumDefinition();
export const STANDARD_9_SETUP = createDefaultDrumDefinition();

export function inferDrumSetupFromLegacyInputs(_inputs: InputChannel[]): DrumDefinition {
  return createDefaultDrumDefinition();
}
