import type { DrumDefinition } from "./drumDefinition.js";

export type DrumValidationErrorCode =
  | "kick_count"
  | "kick_source"
  | "snare_count"
  | "snare_source"
  | "tom_count"
  | "floor_count";

export type DrumValidationError = {
  code: DrumValidationErrorCode;
  field: string;
  message: string;
};

export function validateDrumDefinition(definition: DrumDefinition): DrumValidationError[] {
  const errors: DrumValidationError[] = [];
  if (definition.kickCount !== 1 && definition.kickCount !== 2) {
    errors.push({ code: "kick_count", field: "kickCount", message: "Kick count must be 1 or 2." });
  }
  if (definition.snareCount < 1 || definition.snareCount > 3) {
    errors.push({ code: "snare_count", field: "snareCount", message: "Snare count must be between 1 and 3." });
  }
  if (definition.tomCount < 0 || definition.tomCount > 4) {
    errors.push({ code: "tom_count", field: "tomCount", message: "Tom count must be between 0 and 4." });
  }
  if (definition.floorCount < 0 || definition.floorCount > 3) {
    errors.push({ code: "floor_count", field: "floorCount", message: "Floor count must be between 0 and 3." });
  }

  for (let i = 0; i < definition.kickCount; i++) {
    const kick = definition.kicks[i];
    if (!kick?.in && !kick?.out) {
      errors.push({ code: "kick_source", field: `kicks.${i}`, message: `Kick ${i + 1} must have IN and/or OUT selected.` });
    }
  }

  for (let i = 0; i < definition.snareCount; i++) {
    const snare = definition.snares[i];
    if (!snare?.top && !snare?.bottom) {
      errors.push({ code: "snare_source", field: `snares.${i}`, message: `Snare ${i + 1} must have TOP and/or BOTTOM selected.` });
    }
  }

  return errors;
}
