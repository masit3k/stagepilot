import type { Band, Musician, PresetEntity } from "../model/types.js";
import { resolveMusicianHasVocalCapability } from "../project/resolveMusicianHasVocalCapability.js";
import type { BandDraftContext } from "./buildBandFromDraft.js";

/** Co z kapely potřebuje kontrola kolizí: `BandOption` z desktopu tomu vyhoví. */
export type BandRefSummary = {
  readonly id: string;
  readonly code?: string | null;
};

/**
 * Co? Složí `BandDraftContext` ze tří katalogových seznamů, které desktop
 * načte přes Tauri (muzikanti, presety, kapely).
 *
 * Proč v doméně? Predikát `canSing` musí být stejný jako na `01 LINEUP`
 * (`applyDerivedVocalOverlays`), jinak by kapela a projekt odvodily jiné
 * back vokály. A vyřazení upravované kapely z kolizí je pravidlo, ne UI.
 */
export function buildBandDraftContext(args: {
  readonly musicians: readonly Musician[];
  readonly presets: readonly PresetEntity[];
  readonly bands: readonly BandRefSummary[];
  readonly existingBand?: Band;
  readonly reservedIds?: readonly string[];
}): BandDraftContext {
  const editingId = args.existingBand?.id.trim().toLowerCase();
  const otherBands = args.bands.filter(
    (band) => band.id.trim().toLowerCase() !== editingId,
  );
  const musiciansById: Record<string, Musician> = Object.fromEntries(
    args.musicians.map((musician) => [musician.id, musician]),
  );
  const presetCatalog: Record<string, PresetEntity> = Object.fromEntries(
    args.presets.map((preset) => [preset.id, preset]),
  );
  return {
    existingBandIds: new Set(
      otherBands.map((band) => band.id.trim().toLowerCase()),
    ),
    existingCodes: new Set(
      otherBands.flatMap((band) => {
        const code = band.code?.trim();
        return code ? [code.toLowerCase()] : [];
      }),
    ),
    musiciansById,
    canSing: (musicianId) => {
      const musician = musiciansById[musicianId];
      return musician
        ? resolveMusicianHasVocalCapability(musician, presetCatalog)
        : false;
    },
    reservedIds: new Set(
      (args.reservedIds ?? []).map((id) => id.toLowerCase()),
    ),
    ...(args.existingBand ? { existingBand: args.existingBand } : {}),
  };
}
