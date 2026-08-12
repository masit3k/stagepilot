import type { NewProjectPayload } from "../../shell/types";

/**
 * Co? Orazítkuje projekt časem podle záměru zápisu.
 * Proč? `contentUpdatedAt` jde do hlavičky PDF, `updatedAt` řadí seznam projektů.
 * Lifecycle akce (archivace, koš) nemají posouvat datum rideru.
 */
export type SaveIntent = "content" | "lifecycle" | "system";

export function stampProjectUpdate(
  payload: NewProjectPayload,
  intent: SaveIntent,
  nowIso: string,
): NewProjectPayload {
  if (intent === "system") return payload;
  if (intent === "lifecycle") return { ...payload, updatedAt: nowIso };
  return { ...payload, updatedAt: nowIso, contentUpdatedAt: nowIso };
}
