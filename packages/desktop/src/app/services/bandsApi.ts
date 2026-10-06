import { invoke } from "@tauri-apps/api/core";
import {
  type BandDraft,
  type BandDraftContext,
  type BandDraftError,
  buildBandFromDraft,
} from "../../../../../src/domain/band/buildBandFromDraft";
import { summarizeBand } from "../../../../../src/domain/band/summarizeBand";
import type {
  Band,
  Contact,
  Musician,
  PresetEntity,
} from "../../../../../src/domain/model/types";
import type { BandOption } from "../shell/types";
import { listBands } from "./projectsApi";
import { TAURI_COMMANDS } from "./tauriCommands";

// Co? Jediná cesta desktopu ke kapelám a kontaktům v katalogu (R11).
// Proč? Stránky nesmí volat `invoke` přímo a zápis musí jít přes doménu,
// aby se na disk nikdy nedostala kapela, kterou `buildBandFromDraft` odmítl.

export function listCatalogMusicians() {
  return invoke<Musician[]>(TAURI_COMMANDS.LIST_CATALOG_MUSICIANS);
}

export function listPresets() {
  return invoke<PresetEntity[]>(TAURI_COMMANDS.LIST_PRESETS);
}

export function readBand(bandId: string) {
  return invoke<Band | null>(TAURI_COMMANDS.READ_BAND, { bandId });
}

export function readContact(contactId: string) {
  return invoke<Contact | null>(TAURI_COMMANDS.READ_CONTACT, { contactId });
}

function writeBand(args: { bandId: string; json: string; expectNew: boolean }) {
  return invoke<void>(TAURI_COMMANDS.WRITE_BAND, args);
}

function writeContact(args: { contactId: string; json: string }) {
  return invoke<void>(TAURI_COMMANDS.WRITE_CONTACT, args);
}

/** Rust vrací `ApiError { code, message }`; samotné Tauri chyby chodí jako string. */
export function describeApiError(error: unknown): {
  readonly code: string | null;
  readonly message: string;
} {
  if (typeof error === "string") return { code: null, message: error };
  if (typeof error === "object" && error !== null) {
    const code =
      "code" in error && typeof error.code === "string" ? error.code : null;
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message
        : String(error);
    return { code, message };
  }
  return { code: null, message: String(error) };
}

/** Ruling 8: kapela, jejíž soubor nejde přečíst, je chybová položka, ne pád seznamu. */
export type BandListItem =
  | {
      readonly kind: "ok";
      readonly id: string;
      readonly name: string;
      readonly code: string | null;
      readonly memberCount: number;
      readonly isIncomplete: boolean;
    }
  | {
      readonly kind: "error";
      readonly id: string;
      readonly name: string;
      readonly message: string;
    };

/**
 * Ruling 7: `list_bands` nenese sestavu, proto se ke každé kapele dočte její
 * soubor. Rejectne jen při selhání samotného `list_bands`; chyba jednoho
 * souboru se vrací jako položka `kind: "error"` se zprávou (cestou).
 */
export async function listBandSummaries(): Promise<BandListItem[]> {
  const options = await listBands();
  return Promise.all(options.map(summarizeListedBand));
}

async function summarizeListedBand(option: BandOption): Promise<BandListItem> {
  try {
    const band = await readBand(option.id);
    if (!band) {
      return {
        kind: "error",
        id: option.id,
        name: option.name,
        message: `File catalog/bands/${option.id}.json was not found — the file name must match the band id.`,
      };
    }
    return {
      kind: "ok",
      id: option.id,
      name: option.name,
      code: option.code ?? null,
      ...summarizeBand(band),
    };
  } catch (error) {
    return {
      kind: "error",
      id: option.id,
      name: option.name,
      message: describeApiError(error).message,
    };
  }
}

export type BandFormData = {
  readonly musicians: readonly Musician[];
  readonly presets: readonly PresetEntity[];
  readonly bands: readonly BandOption[];
  readonly band: Band | null;
  readonly contact: Contact | null;
};

/** Všechno, co formulář potřebuje; rozbitý soubor shodí celé načtení (R13). */
export async function loadBandFormData(
  bandId: string | null,
): Promise<BandFormData> {
  const [musicians, presets, bands, band] = await Promise.all([
    listCatalogMusicians(),
    listPresets(),
    listBands(),
    bandId ? readBand(bandId) : Promise.resolve(null),
  ]);
  const contactId = band?.defaultContactId?.trim();
  const contact = contactId ? await readContact(contactId) : null;
  return { musicians, presets, bands, band, contact };
}

export type SaveBandDraftResult =
  | { readonly ok: true; readonly bandId: string }
  | {
      readonly ok: false;
      readonly kind: "invalid";
      readonly errors: readonly BandDraftError[];
    }
  | {
      readonly ok: false;
      readonly kind: "bandExists";
      readonly errors: readonly BandDraftError[];
      readonly contactWritten: boolean;
    }
  | {
      readonly ok: false;
      readonly kind: "writeFailed";
      readonly message: string;
      readonly contactWritten: boolean;
    };

/**
 * R11: doména postaví kapelu a kontakt; při chybách se nezapíše nic. Jinak
 * nejdřív kontakt, potom kapela — kapela tak nikdy neukazuje na kontakt,
 * který na disku není. Chyby zápisu se vrací jako výsledek, nerejectuje se.
 */
export async function saveBandDraft(
  draft: BandDraft,
  context: BandDraftContext,
): Promise<SaveBandDraftResult> {
  const built = buildBandFromDraft(draft, context);
  if (!built.ok) return { ok: false, kind: "invalid", errors: built.errors };
  const { band, contact } = built;
  if (contact) {
    try {
      await writeContact({ contactId: contact.id, json: toJsonFile(contact) });
    } catch (error) {
      return {
        ok: false,
        kind: "writeFailed",
        message: describeApiError(error).message,
        contactWritten: false,
      };
    }
  }
  try {
    await writeBand({
      bandId: band.id,
      json: toJsonFile(band),
      expectNew: !draft.existingId,
    });
    return { ok: true, bandId: band.id };
  } catch (error) {
    const { code, message } = describeApiError(error);
    const contactWritten = Boolean(contact);
    if (code === "BAND_EXISTS") {
      return {
        ok: false,
        kind: "bandExists",
        contactWritten,
        errors: [
          { field: "name", message: "A band with this name already exists." },
        ],
      };
    }
    return { ok: false, kind: "writeFailed", message, contactWritten };
  }
}

function toJsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
