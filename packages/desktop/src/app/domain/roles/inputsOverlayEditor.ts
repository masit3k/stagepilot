import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  Musician,
  PresetEntity,
  PresetItem,
} from "../../../../../../src/domain/model/types";
import {
  type LineupMap,
  getRoleSlotLimit,
  normalizeLineupSlots,
} from "../../../projectRules";
import { CANONICAL_LINEUP_ROLE_ORDER } from "../../shell/lineupSerialize";
import type {
  BandSetupData,
  MemberOption,
  NewProjectPayload,
} from "../../shell/types";
import { ensureMusiciansInLineup } from "./ensureMusiciansInLineup";
import {
  type VocalOverlayEditorModel,
  resolveVocalOverlayEditorModel,
} from "./resolveVocalOverlayEditorModel";
import { enforceVocalSelectionInvariant } from "./vocalSelectionInvariant";

export type ProjectOverlays = NonNullable<NewProjectPayload["overlays"]>;

export type InputsOverlayEditorModel = {
  /** Kandidáti a vybraní pro modály `Change lead vocals` / `Change back vocals`. */
  readonly vocals: VocalOverlayEditorModel;
  /** Kapelní defaulty — jen pro tlačítko `Reset to default` uvnitř modálů. */
  readonly defaultLeadIds: string[];
  readonly defaultBackIds: string[];
  /** Kdo smí vlastnit talkback: výhradně členové sestavy projektu. */
  readonly talkbackCandidates: MemberOption[];
  /** `""` = nikdo; jiná hodnota je id vlastníka z `overlays.talkback`. */
  readonly talkbackOwnerId: string;
  /** Role muzikantů kapely — vstup do `ensureMusiciansInLineup` při ukládání. */
  readonly musiciansById: ReadonlyMap<string, Musician>;
};

function normalizeIds(value: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((musicianId) => musicianId.length > 0);
}

function unique(ids: readonly string[]): string[] {
  return Array.from(new Set(ids));
}

/**
 * Co? Všechno, co obrazovka `02` potřebuje k editaci overlays: kandidáty a
 * vybrané pro oba vokální modály, kapelní defaulty pro jejich `Reset`, seznam
 * kandidátů na talkback a jeho současného vlastníka.
 *
 * Proč tady? Obrazovka `01` má tutéž skládačku rozepsanou v šesti `useMemo`
 * blocích. Druhá kopie v `ProjectInputsPage.tsx` by dala dva zdroje pravdy o
 * vokálních kandidátech — přesně to, co F5d ruší u kanálů — a zároveň by
 * `ProjectInputsPage.tsx` přerostl mez, kterou plán pro tenhle task stanovil.
 *
 * **Výběr se čte z `project.overlays`, ne z kapelních defaultů.**
 * `resolveCanonicalOverlayAssignments` (`resolveProjectAudioAssignments.ts`)
 * i `normalizeCanonicalOverlays` (`normalizeProject.ts`) sahají výhradně na
 * `project.overlays`; kapelní `defaultOverlays` do dokumentu nevstupují vůbec.
 * Změřeno: projekt bez `overlays` nevytiskne jediný vokální řádek, i když
 * kapela svoje defaulty má. Kdyby modál nabízel kapelní default, `02` by
 * ukazovala jiný výběr, než jaký je v tabulce pod ním.
 */
export function resolveInputsOverlayEditorModel(args: {
  setupData: BandSetupData | null;
  presetCatalog: Record<string, PresetEntity>;
  lineup: LineupMap;
  overlays: ProjectOverlays | undefined;
}): InputsOverlayEditorModel {
  const { setupData, presetCatalog, lineup, overlays } = args;

  const catalogMembers: MemberOption[] = [];
  const seenMemberIds = new Set<string>();
  const catalogMusicians: Musician[] = [];
  for (const [group, members] of Object.entries(setupData?.members ?? {})) {
    for (const member of members) {
      if (seenMemberIds.has(member.id)) continue;
      seenMemberIds.add(member.id);
      catalogMembers.push(member);
      catalogMusicians.push({
        id: member.id,
        firstName: "",
        lastName: "",
        group: group as Group,
        presets: (setupData?.musicianPresetsById?.[member.id] ??
          []) as PresetItem[],
      });
    }
  }
  const membersById = new Map(
    catalogMembers.map((member) => [member.id, member]),
  );

  /**
   * Role muzikanta v sestavě přebíjí jeho katalogovou skupinu — basák, který
   * zpívá, je pro `resolveLineupVocalCandidates` `bass`, ne `vocs`. Zrcadlí
   * `selectedTemplateMusicians` z `ProjectSetupPage.tsx`.
   */
  const lineupRoleById = new Map<string, Group>();
  for (const role of CANONICAL_LINEUP_ROLE_ORDER) {
    for (const slot of normalizeLineupSlots(
      lineup[role],
      getRoleSlotLimit(role),
    )) {
      if (!slot.musicianId || lineupRoleById.has(slot.musicianId)) continue;
      lineupRoleById.set(slot.musicianId, role);
    }
  }
  const lineupMusicianIds = Array.from(lineupRoleById.keys());
  const lineupMembers = lineupMusicianIds
    .map((musicianId) => membersById.get(musicianId))
    .filter((member): member is MemberOption => Boolean(member));
  const lineupMusicians = lineupMusicianIds.map<Musician>((musicianId) => ({
    id: musicianId,
    firstName: "",
    lastName: "",
    group: lineupRoleById.get(musicianId) ?? "vocs",
    presets: (setupData?.musicianPresetsById?.[musicianId] ??
      []) as PresetItem[],
  }));

  const vocals = resolveVocalOverlayEditorModel({
    lineupMusicians,
    lineupMembers,
    catalogMusicians,
    catalogMembers,
    presetCatalog,
    rawLeadIds: normalizeIds(overlays?.leadVocals),
    rawBackIds: normalizeIds(overlays?.backVocals),
  });

  const defaultLeadIds = unique(
    normalizeIds(setupData?.defaultOverlays?.leadVocals),
  );
  const defaultLeadIdSet = new Set(defaultLeadIds);
  // Kapelní defaulty se v datech překrývají (změřeno: `voc-1` bývá v obou
  // seznamech). Nabídnout ho modálu back vokálů by porušilo týž invariant,
  // který se hned nato uplatní na uloženém výběru.
  const defaultBackIds = unique(
    normalizeIds(setupData?.defaultOverlays?.backVocals),
  ).filter((musicianId) => !defaultLeadIdSet.has(musicianId));

  const talkback = overlays?.talkback;
  const talkbackOwnerId =
    talkback && talkback.mode === "assigned" ? talkback.ownerId.trim() : "";

  return {
    vocals,
    defaultLeadIds,
    defaultBackIds,
    talkbackCandidates: lineupMembers,
    talkbackOwnerId,
    musiciansById: new Map(
      catalogMusicians.map((musician) => [musician.id, musician]),
    ),
  };
}

/**
 * Co? Zápis vokálního výběru z obrazovky `02` (R7) — vrací obě poloviny
 * snapshotu, které se tím mění, aby je volající zapsal jedním `setState`.
 *
 * **Nezapisuje žádný `presetOverride`, a nesmí začít.** `inputs.add` na
 * vokálním ani talkback slotu není no-op: `buildDocument.ts` vylučuje z
 * `eventOverride` jen `bass` a `drums`, takže `vocs` i `talkback` projdou do
 * `applyInputOverridePatch` a `add` vytiskne trvalý osiřelý řádek s
 * `ownerMusicianId: undefined`, který ukradne kanál 1 skutečnému lead vokálu.
 * Doména tuhle bránu neduplikuje — jediná ochrana je tady a v UI nad tím.
 * Existenci vokálních řádků řídí výhradně `overlays` (O1).
 *
 * Lineup se mění jen jedním směrem: vybraný muzikant, který v něm ještě není,
 * se do něj doplní. Bez toho by overlay ukazoval na někoho, koho
 * `resolveCanonicalOverlayAssignments` odfiltruje, a řádek by se nevytiskl.
 * Odebraný vokalista ze sestavy nemizí — jeho odchod z overlay je změna
 * ozvučení, ne obsazení, a monitor mix po něm uklidí `buildPdfMonitorRows`.
 */
export function applyVocalOverlaySelection(args: {
  lineup: LineupMap;
  overlays: ProjectOverlays | undefined;
  musiciansById: ReadonlyMap<string, { group: Group }>;
  candidateIds: Iterable<string>;
  leadIds: readonly string[];
  backIds: readonly string[];
}): { lineup: LineupMap; overlays: ProjectOverlays } {
  const normalized = enforceVocalSelectionInvariant({
    lineupCandidateIds: args.candidateIds,
    leadIds: args.leadIds,
    backIds: args.backIds,
  });

  return {
    lineup: ensureMusiciansInLineup(args.lineup, args.musiciansById, [
      ...normalized.leadIds,
      ...normalized.backIds,
    ]),
    overlays: {
      ...args.overlays,
      leadVocals: normalized.leadIds,
      backVocals: normalized.backIds,
    },
  };
}

/**
 * Zápis vlastníka talkbacku z obrazovky `02` (R7). Píše se rovnou
 * `overlays.talkback` — snapshot nese overlays přímo, takže mezikrok přes
 * `talkbackOwnerId` + `hasTalkbackOverride`, jaký drží `01`, je zbytečný.
 * Legacy `project.talkbackOverride` je doménou ignorované pole (Nález 4) a
 * nesahá se na něj.
 */
export function applyTalkbackSelection(
  overlays: ProjectOverlays | undefined,
  ownerId: string | null,
): ProjectOverlays {
  const trimmed = ownerId?.trim() ?? "";
  return {
    ...overlays,
    talkback: trimmed
      ? { mode: "assigned", ownerId: trimmed }
      : { mode: "none", ownerId: null },
  };
}
