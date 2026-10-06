import {
  LINEUP_ASSIGNMENT_ROLES,
  type LineupAssignments,
  type LineupRole,
  normalizeLineupAssignments,
} from "../lineup/lineupAssignments.js";
import {
  getAllLineupMemberIds,
  normalizeBandToCanonicalShape,
  validateCanonicalBandModel,
} from "../model/bandLineup.js";
import type { Group } from "../model/groups.js";
import type { Band, Contact, Musician } from "../model/types.js";
import { deriveVocalOverlaysFromLineup } from "../project/deriveVocalOverlaysFromLineup.js";
import { isValidBandCode, normalizeBandCode } from "./bandCode.js";
import { deriveBandId } from "./bandId.js";

export type BandDraftField =
  | "name"
  | "code"
  | "lineup"
  | "bandLeader"
  | "leadVocals"
  | "contact";

export type BandDraftError = {
  readonly field: BandDraftField;
  readonly message: string;
};

export type BandDraftContact = {
  readonly musicianId: string;
  readonly phone?: string;
  readonly email?: string;
};

export type BandDraft = {
  readonly name: string;
  readonly code: string;
  readonly bandLeaderId?: string;
  readonly lineup: Partial<Record<Group, readonly string[]>>;
  readonly leadVocalIds: readonly string[];
  readonly contact?: BandDraftContact;
  /** Id upravované kapely. Bez něj se kapela zakládá a id se odvodí z názvu (R4). */
  readonly existingId?: string;
};

export type BandDraftContext = {
  /** Id ostatních kapel malými písmeny — upravovaná kapela v nich není. */
  readonly existingBandIds: ReadonlySet<string>;
  /** Zkratky ostatních kapel malými písmeny — upravovaná kapela v nich není. */
  readonly existingCodes: ReadonlySet<string>;
  readonly musiciansById: Readonly<Record<string, Musician | undefined>>;
  readonly canSing: (musicianId: string) => boolean;
  /** Id, která nesmí vzniknout, protože kolidují s routou (`new`). */
  readonly reservedIds?: ReadonlySet<string>;
  /** Upravovaná kapela, jak leží na disku: zdroj polí, která formulář nespravuje. */
  readonly existingBand?: Band;
};

export type BuildBandResult =
  | { readonly ok: true; readonly band: Band; readonly contact?: Contact }
  | { readonly ok: false; readonly errors: readonly BandDraftError[] };

/**
 * Co? Jediný vstupní bod domény editoru kapely (R9): z draftu formuláře
 * postaví kanonickou kapelu a případný kontakt, nebo vrátí chyby polí.
 *
 * Proč unie a ne `throw`? Formulář chyby zobrazuje u polí a potřebuje je
 * všechny najednou. Výjimky z `normalizeBandToCanonicalShape` a
 * `validateCanonicalBandModel` se proto převádí na chybu pole; pravidla
 * z R13 se kontrolují explicitně dřív, aby zprávy byly čitelné.
 *
 * `backVocals` se nikdy nečtou z draftu: vždy se odvodí ze sestavy přes
 * `canSing` (R8), takže soubor má stejný tvar jako existující kapely.
 */
export function buildBandFromDraft(
  draft: BandDraft,
  context: BandDraftContext,
): BuildBandResult {
  const errors: BandDraftError[] = [];
  const name = draft.name.trim();
  const id = resolveBandId(draft, name, context, errors);
  const code = resolveBandCode(draft.code, context, errors);
  const lineup = normalizeLineupAssignments(draft.lineup);
  errors.push(...collectLineupErrors(lineup, context));
  const memberIds = getAllLineupMemberIds(lineup);
  const members = new Set(memberIds);
  const bandLeaderId = (draft.bandLeaderId ?? "").trim();
  errors.push(
    ...collectRoleErrors(bandLeaderId, draft.leadVocalIds, members, context),
  );
  const contact = resolveContact(draft.contact, members, context, errors);
  if (errors.length > 0) return { ok: false, errors };

  const overlays = deriveVocalOverlaysFromLineup({
    lineupMusicianIds: memberIds,
    leadVocalIds: draft.leadVocalIds,
    canSing: context.canSing,
  });
  return finalizeBand(
    {
      type: "band",
      id,
      code,
      name,
      bandLeader: bandLeaderId,
      bandLeaderId,
      ...resolveTalkbackOwner(context.existingBand, members),
      ...(contact ? { defaultContactId: contact.id } : {}),
      defaultLineup: lineup,
      defaultOverlays: {
        leadVocals: [...overlays.leadVocalIds],
        backVocals: [...overlays.backVocalIds],
      },
      ...pickUnmanagedFields(context.existingBand),
    },
    contact,
  );
}

function resolveBandId(
  draft: BandDraft,
  name: string,
  context: BandDraftContext,
  errors: BandDraftError[],
): string {
  if (!name) errors.push({ field: "name", message: "Enter the band name." });
  if (draft.existingId) return draft.existingId;
  if (!name) return "";
  const id = deriveBandId(name);
  if (!id) {
    errors.push({
      field: "name",
      message: "The name needs at least one letter or digit.",
    });
  } else if (context.reservedIds?.has(id)) {
    errors.push({
      field: "name",
      message: "This name is reserved. Choose another one.",
    });
  } else if (context.existingBandIds.has(id) || context.existingCodes.has(id)) {
    // Ruling 2: catalogRepository mapuje id i code.toLowerCase() do jedné mapy.
    errors.push({
      field: "name",
      message: "A band with this name already exists.",
    });
  }
  return id;
}

function resolveBandCode(
  raw: string,
  context: BandDraftContext,
  errors: BandDraftError[],
): string {
  const code = normalizeBandCode(raw);
  if (!isValidBandCode(code)) {
    errors.push({
      field: "code",
      message: "The code must be 2–6 letters or digits.",
    });
    return code;
  }
  const alias = code.toLowerCase();
  if (context.existingCodes.has(alias) || context.existingBandIds.has(alias)) {
    errors.push({
      field: "code",
      message: "Another band already uses this code.",
    });
  }
  return code;
}

function collectLineupErrors(
  lineup: LineupAssignments,
  context: BandDraftContext,
): BandDraftError[] {
  const errors: BandDraftError[] = [];
  const groupById = new Map<string, LineupRole>();
  for (const role of LINEUP_ASSIGNMENT_ROLES) {
    for (const musicianId of lineup[role]) {
      const musician = context.musiciansById[musicianId];
      if (!musician) {
        errors.push({
          field: "lineup",
          message: `Musician '${musicianId}' is not in your library.`,
        });
        continue;
      }
      const label = musicianLabel(musician);
      if (musician.group !== role) {
        errors.push({
          field: "lineup",
          message: `${label} plays ${musician.group}, not ${role}.`,
        });
      }
      const previous = groupById.get(musicianId);
      if (previous) {
        errors.push({
          field: "lineup",
          message: `${label} is in both ${previous} and ${role}.`,
        });
      } else {
        groupById.set(musicianId, role);
      }
    }
  }
  return errors;
}

function collectRoleErrors(
  bandLeaderId: string,
  leadVocalIds: readonly string[],
  members: ReadonlySet<string>,
  context: BandDraftContext,
): BandDraftError[] {
  const errors: BandDraftError[] = [];
  if (!bandLeaderId && members.size > 0) {
    errors.push({ field: "bandLeader", message: "Choose the band leader." });
  }
  if (bandLeaderId && !members.has(bandLeaderId)) {
    errors.push({
      field: "bandLeader",
      message: "The band leader must be in the lineup.",
    });
  }
  for (const musicianId of leadVocalIds) {
    if (!members.has(musicianId.trim())) {
      errors.push({
        field: "leadVocals",
        message: `${labelFor(musicianId, context)} is not in the lineup.`,
      });
    }
  }
  return errors;
}

function resolveContact(
  draftContact: BandDraftContact | undefined,
  members: ReadonlySet<string>,
  context: BandDraftContext,
  errors: BandDraftError[],
): Contact | undefined {
  if (!draftContact) return undefined;
  const musicianId = draftContact.musicianId.trim();
  const musician = context.musiciansById[musicianId];
  if (!musician || !members.has(musicianId)) {
    errors.push({
      field: "contact",
      message: "The contact must be a member of the lineup.",
    });
    return undefined;
  }
  const phone = draftContact.phone?.trim() ?? "";
  const email = draftContact.email?.trim() ?? "";
  if (!phone && !email) {
    errors.push({
      field: "contact",
      message: "Enter a phone number or an e-mail address.",
    });
    return undefined;
  }
  return {
    id: musicianId,
    firstName: (musician.firstName ?? "").trim(),
    lastName: (musician.lastName ?? "").trim(),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  };
}

/** Ruling 5: uložený talkback owner přežije, jen když je pořád v sestavě. */
function resolveTalkbackOwner(
  existingBand: Band | undefined,
  members: ReadonlySet<string>,
): Pick<Band, "defaultTalkbackOwnerId"> {
  const previous = existingBand?.defaultTalkbackOwnerId?.trim() ?? "";
  return previous && members.has(previous)
    ? { defaultTalkbackOwnerId: previous }
    : {};
}

/** Ruling 4: pole, která formulář nenabízí (R14), se při úpravě nesmí ztratit. */
function pickUnmanagedFields(
  existingBand: Band | undefined,
): Pick<Band, "notesTemplateRef" | "logoFile"> {
  if (!existingBand) return {};
  return {
    ...(existingBand.notesTemplateRef
      ? { notesTemplateRef: existingBand.notesTemplateRef }
      : {}),
    ...(existingBand.logoFile ? { logoFile: existingBand.logoFile } : {}),
  };
}

function finalizeBand(
  candidate: Band,
  contact: Contact | undefined,
): BuildBandResult {
  try {
    const band = normalizeBandToCanonicalShape(candidate);
    validateCanonicalBandModel(band);
    return contact ? { ok: true, band, contact } : { ok: true, band };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errors: [
        {
          field: message.includes("leadVocals") ? "leadVocals" : "lineup",
          message,
        },
      ],
    };
  }
}

/** Ruling 19: stejné pořadí jako `MemberOption` z Rustu na `01 LINEUP`. */
function musicianLabel(musician: Musician): string {
  const label = `${musician.lastName ?? ""} ${musician.firstName ?? ""}`.trim();
  return label || musician.id;
}

function labelFor(musicianId: string, context: BandDraftContext): string {
  const musician = context.musiciansById[musicianId.trim()];
  return musician ? musicianLabel(musician) : musicianId;
}
