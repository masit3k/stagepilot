import { deriveBandCode } from "../../../../../../src/domain/band/bandCode";
import type { BandDraft } from "../../../../../../src/domain/band/buildBandFromDraft";
import {
  LINEUP_ASSIGNMENT_ROLES,
  type LineupRole,
  normalizeLineupAssignments,
} from "../../../../../../src/domain/lineup/lineupAssignments";
import type {
  Band,
  Contact,
  Musician,
} from "../../../../../../src/domain/model/types";
import { resolveMusicianDisplayName } from "../ui/musicianDisplayName";

// Co? Stav formuláře kapely a jeho přechody jako čisté funkce.
// Proč tady? Repo nemá jsdom; každé rozhodnutí formuláře (dopočet zkratky,
// odebrání člena, výchozí kontakt) musí být testovatelné bez Reactu.

export type BandFormContact =
  | { readonly mode: "none" }
  | {
      readonly mode: "member";
      readonly musicianId: string;
      readonly phone: string;
      readonly email: string;
    };

export type BandFormState = {
  readonly name: string;
  readonly code: string;
  /** `false` = zkratka se dopočítává z názvu (R5). */
  readonly codeTouched: boolean;
  readonly lineup: Readonly<Record<LineupRole, readonly string[]>>;
  readonly bandLeaderId: string;
  readonly leadVocalIds: readonly string[];
  readonly contact: BandFormContact;
};

export type BandFormUpdate = (
  update: (state: BandFormState) => BandFormState,
) => void;

const EMPTY_LINEUP: Readonly<Record<LineupRole, readonly string[]>> = {
  drums: [],
  bass: [],
  guitar: [],
  keys: [],
  vocs: [],
};

export function createEmptyBandForm(): BandFormState {
  return {
    name: "",
    code: "",
    codeTouched: false,
    lineup: EMPTY_LINEUP,
    bandLeaderId: "",
    leadVocalIds: [],
    contact: { mode: "none" },
  };
}

/** Ruling 13: uložená zkratka se bere jako ruční. Reálné soubory nesou jen `bandLeaderId`. */
export function bandFormFromBand(
  band: Band,
  contact: Contact | null,
): BandFormState {
  const contactId = band.defaultContactId?.trim() ?? "";
  return {
    name: band.name,
    code: band.code ?? "",
    codeTouched: true,
    lineup: normalizeLineupAssignments(band.defaultLineup),
    bandLeaderId:
      (band.bandLeader ?? "").trim() || (band.bandLeaderId ?? "").trim(),
    leadVocalIds: [...(band.defaultOverlays?.leadVocals ?? [])],
    contact: contactId
      ? {
          mode: "member",
          musicianId: contactId,
          phone: contact?.phone ?? "",
          email: contact?.email ?? "",
        }
      : { mode: "none" },
  };
}

/** Porovnávací otisk pro navigační guard (neuložené změny). */
export function serializeBandForm(state: BandFormState): string {
  return JSON.stringify(state);
}

export function lineupMemberIds(state: BandFormState): string[] {
  return LINEUP_ASSIGNMENT_ROLES.flatMap((role) => [...state.lineup[role]]);
}

/** Ruling 19: `Příjmení Jméno`, jako `MemberOption` z Rustu na `01 LINEUP`. */
export function musicianLabel(musician: Musician): string {
  return resolveMusicianDisplayName({
    musicianId: musician.id,
    preferredName: `${musician.lastName ?? ""} ${musician.firstName ?? ""}`,
  });
}

/** R6: nabízí jen muzikanty dané skupiny, kteří ještě nejsou v sestavě. */
export function availableMusiciansForGroup(
  musicians: readonly Musician[],
  role: LineupRole,
  state: BandFormState,
): Musician[] {
  const present = new Set(lineupMemberIds(state));
  return musicians
    .filter((musician) => musician.group === role && !present.has(musician.id))
    .sort((left, right) =>
      musicianLabel(left).localeCompare(musicianLabel(right)),
    );
}

export function setBandName(state: BandFormState, name: string): BandFormState {
  return {
    ...state,
    name,
    code: state.codeTouched ? state.code : deriveBandCode(name),
  };
}

export function setBandCode(state: BandFormState, code: string): BandFormState {
  return { ...state, code, codeTouched: true };
}

/** Ruling 14: kdo přibude do `vocs`, je předvyplněný jako lead vokál. */
export function addMembersToGroup(
  state: BandFormState,
  role: LineupRole,
  musicianIds: readonly string[],
): BandFormState {
  const present = new Set(lineupMemberIds(state));
  const added = [...new Set(musicianIds)].filter(
    (musicianId) => !present.has(musicianId),
  );
  if (added.length === 0) return state;
  return {
    ...state,
    lineup: { ...state.lineup, [role]: [...state.lineup[role], ...added] },
    leadVocalIds:
      role === "vocs" ? [...state.leadVocalIds, ...added] : state.leadVocalIds,
  };
}

/** R12: odebraný člen mizí z kapelníka i lead vokálů; kontakt si nechá telefon a e-mail. */
export function removeMember(
  state: BandFormState,
  musicianId: string,
): BandFormState {
  const without = (ids: readonly string[]) =>
    ids.filter((id) => id !== musicianId);
  const contact = state.contact;
  return {
    ...state,
    lineup: {
      drums: without(state.lineup.drums),
      bass: without(state.lineup.bass),
      guitar: without(state.lineup.guitar),
      keys: without(state.lineup.keys),
      vocs: without(state.lineup.vocs),
    },
    bandLeaderId: state.bandLeaderId === musicianId ? "" : state.bandLeaderId,
    leadVocalIds: without(state.leadVocalIds),
    contact:
      contact.mode === "member" && contact.musicianId === musicianId
        ? { ...contact, musicianId: "" }
        : contact,
  };
}

export function setBandLeader(
  state: BandFormState,
  musicianId: string,
): BandFormState {
  return { ...state, bandLeaderId: musicianId };
}

export function toggleLeadVocal(
  state: BandFormState,
  musicianId: string,
): BandFormState {
  const isLead = state.leadVocalIds.includes(musicianId);
  return {
    ...state,
    leadVocalIds: isLead
      ? state.leadVocalIds.filter((id) => id !== musicianId)
      : [...state.leadVocalIds, musicianId],
  };
}

/** R2: výchozí kontaktní osoba je kapelník, pokud je v sestavě; jinak první člen. */
export function defaultContactMemberId(state: BandFormState): string {
  const members = lineupMemberIds(state);
  if (state.bandLeaderId && members.includes(state.bandLeaderId))
    return state.bandLeaderId;
  return members[0] ?? "";
}

export function disableContact(state: BandFormState): BandFormState {
  return { ...state, contact: { mode: "none" } };
}

/** R12 blok 4: výběr člena předvyplní existující `contacts/<id>.json`, pokud je. */
export function setContactMember(
  state: BandFormState,
  musicianId: string,
  existing: Contact | null,
): BandFormState {
  return {
    ...state,
    contact: {
      mode: "member",
      musicianId,
      phone: existing?.phone ?? "",
      email: existing?.email ?? "",
    },
  };
}

export function setContactField(
  state: BandFormState,
  field: "phone" | "email",
  value: string,
): BandFormState {
  const contact = state.contact;
  if (contact.mode !== "member") return state;
  return {
    ...state,
    contact:
      field === "phone"
        ? { ...contact, phone: value }
        : { ...contact, email: value },
  };
}

export function toBandDraft(
  state: BandFormState,
  existingId: string | null,
): BandDraft {
  const contact = state.contact;
  return {
    name: state.name,
    code: state.code,
    ...(state.bandLeaderId ? { bandLeaderId: state.bandLeaderId } : {}),
    lineup: state.lineup,
    leadVocalIds: state.leadVocalIds,
    ...(contact.mode === "member"
      ? {
          contact: {
            musicianId: contact.musicianId,
            phone: contact.phone,
            email: contact.email,
          },
        }
      : {}),
    ...(existingId ? { existingId } : {}),
  };
}
