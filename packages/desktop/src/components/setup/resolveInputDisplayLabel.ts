import type { InputChannel } from "../../../../../src/domain/model/types";

export function resolveInputDisplayLabel(input: InputChannel): string {
  const normalized = input.label.trim();
  return normalized.length > 0 ? normalized : input.key;
}
