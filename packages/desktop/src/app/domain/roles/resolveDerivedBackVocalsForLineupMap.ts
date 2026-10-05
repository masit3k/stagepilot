import type {
  Group,
  Musician,
  PresetEntity,
  PresetItem,
} from "../../../../../../src/domain/model/types";
import type { LineupMap } from "../../../projectRules";
import { getUniqueSelectedMusicians } from "../../../projectRules";
import { ROLE_ORDER } from "../../pages/shared/setupConstants";
import {
  type DerivedVocalOverlayResult,
  applyDerivedVocalOverlays,
} from "./applyDerivedVocalOverlays";

/**
 * Co? Derivace vokálních overlays z `LineupMap` — z tvaru, ve kterém sestava
 * leží v uloženém projektu i ve stavu obrazovky `01 LINEUP`.
 *
 * Proč zvlášť od `applyDerivedVocalOverlays`? Ten bere hotové `Musician[]`.
 * `ProjectSetupPage` je potřebuje na dvou místech, ale jen na jednom je má:
 * v renderu z mema `selectedTemplateMusicians`, zatímco init efekt (hydratace
 * uloženého projektu) drží jen `LineupMap` a `BandSetupData`. Baseline pro
 * dirty-tracking se staví právě tam, a musí se postavit z derivovaného stavu —
 * jinak by otevření projektu uloženého podle starého pravidla („dědí se jen
 * role, kterou předchůdce držel") vypadalo jako uživatelova editace.
 *
 * Pořadí je `ROLE_ORDER` (`getUniqueSelectedMusicians`), ne pořadí klíčů
 * v JSON: musí být deterministické, aby se uložený projekt neměnil při každém
 * otevření. Pořadí vokálů na PDF tohle neurčuje — o to se stará poziční had
 * (`vocalOrderRank` v `buildDocument`).
 */
export function resolveDerivedBackVocalsForLineupMap(args: {
  lineup: LineupMap;
  musicianPresetsById: Record<string, PresetItem[] | undefined> | undefined;
  presetCatalog: Record<string, PresetEntity | undefined>;
  leadVocalIds: readonly string[];
  backVocalIds: readonly string[];
}): DerivedVocalOverlayResult {
  const lineupMusicianIds = getUniqueSelectedMusicians(args.lineup, ROLE_ORDER);
  const groupByMusicianId = resolveGroupByMusicianId(args.lineup);

  const lineupMusicians: Musician[] = lineupMusicianIds.map((musicianId) => ({
    id: musicianId,
    firstName: "",
    lastName: "",
    group: groupByMusicianId.get(musicianId) ?? "vocs",
    presets: args.musicianPresetsById?.[musicianId] ?? [],
  }));

  return applyDerivedVocalOverlays({
    lineupMusicians,
    leadVocalIds: args.leadVocalIds,
    backVocalIds: args.backVocalIds,
    presetCatalog: args.presetCatalog,
  });
}

function resolveGroupByMusicianId(lineup: LineupMap): Map<string, Group> {
  const groupByMusicianId = new Map<string, Group>();
  for (const role of ROLE_ORDER) {
    for (const musicianId of getUniqueSelectedMusicians(
      { [role]: lineup[role] },
      [role],
    )) {
      if (groupByMusicianId.has(musicianId)) continue;
      groupByMusicianId.set(musicianId, role as Group);
    }
  }
  return groupByMusicianId;
}
