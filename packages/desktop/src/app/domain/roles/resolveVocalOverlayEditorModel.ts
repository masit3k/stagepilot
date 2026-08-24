import type {
  Group,
  Musician,
  PresetEntity,
} from "../../../../../../src/domain/model/types";
import type { MemberOption } from "../../shell/types";
import {
  type LeadVocalCandidateSections,
  resolveLeadVocalCandidates,
} from "./resolveLeadVocalCandidates";
import {
  type VocalCandidateReason,
  resolveLineupVocalCandidates,
} from "./resolveLineupVocalCandidates";
import { enforceVocalSelectionInvariant } from "./vocalSelectionInvariant";

/**
 * Structurally the `BackVocalCandidate` of `ChangeBackVocsModal`. Declared here
 * instead of imported so that `app/domain/**` keeps pointing at the domain only
 * and never at a component module.
 */
export type BackVocalCandidateOption = {
  id: string;
  name: string;
  primaryGroup: Group;
  hasVocalCapability: boolean;
  isInProjectLineup: boolean;
  reason: VocalCandidateReason;
  isDisabled: boolean;
  disabledReason: string | undefined;
};

export type VocalOverlayEditorModel = {
  /** Po uplatnění invariantu — nikdo není zároveň lead i back. */
  readonly selectedLeadIds: string[];
  readonly selectedBackIds: string[];
  /** Jména vybraných, v pořadí `selectedLeadIds` / `selectedBackIds`. */
  readonly leadMembers: MemberOption[];
  readonly backMembers: MemberOption[];
  readonly leadSections: LeadVocalCandidateSections;
  readonly backSections: {
    suggested: BackVocalCandidateOption[];
    additional: BackVocalCandidateOption[];
  };
  /** Id všech kandidátů — vstup do `enforceVocalSelectionInvariant` při ukládání. */
  readonly candidateIds: ReadonlySet<string>;
  /** `false` = `Change` se nedá nabídnout, není z čeho vybírat. */
  readonly hasCandidates: boolean;
};

/**
 * Co? Všechno, co potřebují modály `Change lead vocals` a `Change back
 * vocals`: id vybraných po uplatnění invariantu, jména vybraných, kandidáty
 * rozdělené na navržené a ostatní, a množinu všech kandidátů pro invariant
 * při ukládání.
 *
 * Proč tady? Do F5d to bylo ~110 řádků `useMemo` bloků uvnitř
 * `ProjectSetupPage.tsx`. Vlna 2 tytéž modály otevírá i z obrazovky `02`;
 * druhá kopie té skládačky by dala dva zdroje pravdy o vokálních kandidátech
 * — přesně to, co celá F5d ruší u kanálů. Je to assembly nad hotovými čistými
 * helpery (`resolveLineupVocalCandidates`, `resolveLeadVocalCandidates`,
 * `enforceVocalSelectionInvariant`), ne druhá implementace, takže sloučení je
 * levné.
 *
 * `defaultOverlays` kapely sem nepatří — je to uložená hodnota, ne odvození ze
 * sestavy. Stejně tak `extractOverlayMusicianIds`: každá obrazovka má id
 * uložená jinde (`01` ve stavu, `02` ve snapshotu), takže extrakci dělá
 * volající a sem chodí už hotová pole.
 */
export function resolveVocalOverlayEditorModel(args: {
  lineupMusicians: Musician[];
  lineupMembers: MemberOption[];
  catalogMusicians: Musician[];
  catalogMembers: MemberOption[];
  presetCatalog: Record<string, PresetEntity>;
  rawLeadIds: string[];
  rawBackIds: string[];
}): VocalOverlayEditorModel {
  const lineupVocalCandidates = resolveLineupVocalCandidates({
    lineupMusicians: args.lineupMusicians,
    lineupMembers: args.lineupMembers,
    catalogMusicians: args.catalogMusicians,
    catalogMembers: args.catalogMembers,
    presetCatalog: args.presetCatalog,
  });
  const candidateIds = new Set(
    lineupVocalCandidates.map((candidate) => candidate.id),
  );
  const { leadIds: selectedLeadIds, backIds: selectedBackIds } =
    enforceVocalSelectionInvariant({
      lineupCandidateIds: candidateIds,
      leadIds: args.rawLeadIds,
      backIds: args.rawBackIds,
    });

  const leadSections = resolveLeadVocalCandidates({
    lineupCandidates: lineupVocalCandidates
      .filter(
        (candidate) =>
          candidate.sectionByRole.lead === "suggested" ||
          candidate.isInProjectLineup ||
          candidate.primaryGroup === "vocs",
      )
      .map((candidate) => ({
        musicianId: candidate.id,
        displayName: candidate.name,
        primaryGroup: candidate.primaryGroup,
        source: candidate.source,
        section: candidate.sectionByRole.lead,
        reason: candidate.reasonByRole.lead,
        hasVocalCapability: candidate.hasVocalCapability,
        isInProjectLineup: candidate.isInProjectLineup,
      })),
    selectedLeadVocalistIds: selectedLeadIds,
  });

  const membersById = new Map(
    args.catalogMembers.map((item) => [item.id, item]),
  );
  const leadMembers = selectedLeadIds
    .map((idValue) => membersById.get(idValue))
    .filter((item): item is MemberOption => Boolean(item));
  const backMembers = selectedBackIds
    .map((idValue) => membersById.get(idValue))
    .filter((item): item is MemberOption => Boolean(item));

  const selectedLeadIdSet = new Set(selectedLeadIds);
  const backCandidates = lineupVocalCandidates.filter(
    (candidate) => candidate.hasVocalCapability || candidate.isInProjectLineup,
  );
  const candidates = backCandidates.map((candidate) => {
    const isDisabled = selectedLeadIdSet.has(candidate.id);
    return {
      id: candidate.id,
      name: candidate.name,
      primaryGroup: candidate.primaryGroup,
      hasVocalCapability: candidate.hasVocalCapability,
      isInProjectLineup: candidate.isInProjectLineup,
      reason: candidate.reasonByRole.back,
      isDisabled,
      disabledReason: isDisabled ? "Already selected as Lead Vocal" : undefined,
    } satisfies BackVocalCandidateOption;
  });
  const backSections = {
    suggested: candidates.filter(
      (candidate) =>
        backCandidates.find((item) => item.id === candidate.id)?.sectionByRole
          .back === "suggested",
    ),
    additional: candidates.filter(
      (candidate) =>
        backCandidates.find((item) => item.id === candidate.id)?.sectionByRole
          .back === "other_lineup_members",
    ),
  };

  return {
    selectedLeadIds,
    selectedBackIds,
    leadMembers,
    backMembers,
    leadSections,
    backSections,
    candidateIds,
    hasCandidates: lineupVocalCandidates.length > 0,
  };
}
