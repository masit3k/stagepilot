import {
  LINEUP_ASSIGNMENT_ROLES,
  type LineupAssignments,
  type LineupRole,
  dedupeLineupIds,
  normalizeLineupAssignments,
} from "../lineup/lineupAssignments.js";
import {
  getAllLineupMemberIds,
  normalizeBandToCanonicalShape,
  validateCanonicalBandModel,
} from "../model/bandLineup.js";
import type { Group } from "../model/groups.js";
import type { Band, Contact, Musician } from "../model/types.js";
import { isValidBandCode, normalizeBandCode } from "./bandCode.js";
import { deriveBandId } from "./bandId.js";

export type BandDraftField =
  | "name"
  | "code"
  | "lineup"
  | "bandLeader"
  | "backVocals"
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
  /** Skupina `vocs` jsou lead vokály (dodatek A1): `leadVocals` se z ní odvodí. */
  readonly lineup: Partial<Record<Group, readonly string[]>>;
  /** Dodatek A2: ruční výběr BACK VOCS; uloží se přesně (oříznutý, bez duplicit). */
  readonly backVocalIds: readonly string[];
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
  /** Kdo umí zpívat. Doména ho nečte; formulář z něj předvyplní BACK VOCS nové kapely (A2). */
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
 * Vokály (dodatek A1/A2): `leadVocals` je přesně `defaultLineup.vocs` ve
 * stejném pořadí, `backVocals` přesně výběr z draftu. Doména nic
 * nepřepočítává — předvyplnění BACK VOCS je věc formuláře (`bandFormModel`).
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
  const members = new Set(getAllLineupMemberIds(lineup));
  const bandLeaderId = (draft.bandLeaderId ?? "").trim();
  errors.push(...collectLeaderErrors(bandLeaderId, members));
  const backVocalIds = dedupeLineupIds(draft.backVocalIds);
  errors.push(
    ...collectBackVocalErrors(backVocalIds, lineup, members, context),
  );
  const contact = resolveContact(draft.contact, members, context, errors);
  if (errors.length > 0) return { ok: false, errors };

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
        leadVocals: [...lineup.vocs],
        backVocals: backVocalIds,
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

function collectLeaderErrors(
  bandLeaderId: string,
  members: ReadonlySet<string>,
): BandDraftError[] {
  if (!bandLeaderId) {
    return members.size > 0
      ? [{ field: "bandLeader", message: "Choose the band leader." }]
      : [];
  }
  return members.has(bandLeaderId)
    ? []
    : [
        {
          field: "bandLeader",
          message: "The band leader must be in the lineup.",
        },
      ];
}

/** A2: back vokalista musí být v sestavě a nesmí být lead (= člen `vocs`, A1). */
function collectBackVocalErrors(
  backVocalIds: readonly string[],
  lineup: LineupAssignments,
  members: ReadonlySet<string>,
  context: BandDraftContext,
): BandDraftError[] {
  const leads = new Set(lineup.vocs);
  return backVocalIds.flatMap((musicianId): BandDraftError[] => {
    if (!members.has(musicianId)) {
      return [
        {
          field: "backVocals",
          message: `${labelFor(musicianId, context)} is not in the lineup.`,
        },
      ];
    }
    if (leads.has(musicianId)) {
      return [
        {
          field: "backVocals",
          message: `${labelFor(musicianId, context)} is a lead vocalist.`,
        },
      ];
    }
    return [];
  });
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
          field: message.includes("defaultOverlays") ? "backVocals" : "lineup",
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
