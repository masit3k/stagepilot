// src/domain/rules/validateDocument.ts

import type { DocumentViewModel } from "../model/types.js";

export function validateDocument(vm: DocumentViewModel): void {
  if (vm.inputs.length === 0) {
    throw new Error("No inputs generated. Check band.defaultLineup and musician.presets mapping.");
  }

  const MAX_INPUTS = 32;
  if (vm.inputs.length > MAX_INPUTS) {
    throw new Error(`Too many inputs: ${vm.inputs.length} (max ${MAX_INPUTS})`);
  }

  const keys = new Set<string>();
  for (const ch of vm.inputs) {
    if (keys.has(ch.key)) {
      throw new Error(`Duplicate input key: "${ch.key}"`);
    }
    keys.add(ch.key);
  }
}