import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  DocumentViewModel,
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import {
  type LineupMap,
  getRoleSlotLimit,
  normalizeLineupSlots,
} from "../../../projectRules";

export type InputEditorRow = {
  /** Opaque React/selection identity — namespaced by owner on a removed row (see `composeRemovedRowKey`). Never parse this; read `rawKey` instead. */
  readonly key: string;
  /** The channel key as the preset/document actually knows it — same value as `key` on active and filler rows, the un-namespaced key on a removed one. */
  readonly rawKey: string;
  /** null u vypnutého řádku — číslo spotřebují jen tištěné kanály (R3). */
  readonly ch: number | null;
  readonly label: string;
  readonly note: string;
  readonly group: Group;
  readonly ownerRole: Group;
  readonly ownerMusicianId: string;
  readonly slotKey: string;
  readonly state: "active" | "removed" | "filler";
};

/**
 * Vypnutý kanál, dokud nemá řádek v `InputEditorRow`. `rawKey` a
 * `neighborKey` jsou oba syrové klíče z výchozího presetu (ne
 * disambiguované) — `neighborKey` je klíč, který ve výchozím presetu slotu
 * předchází tomuto kanálu, `null`, když byl ve výchozím presetu první a
 * soused tedy neexistuje.
 */
export type DisabledInputRow = {
  readonly rawKey: string;
  readonly label: string;
  readonly note: string;
  readonly group: Group;
  readonly ownerRole: Group;
  readonly ownerMusicianId: string;
  readonly slotKey: string;
  readonly neighborKey: string | null;
};

export type SetupForSlot = (
  role: Group,
  musicianId: string,
  patch?: PresetOverridePatch,
) => {
  resolved: { defaultPreset: MusicianSetupPreset };
  effective: MusicianSetupPreset;
};

const FILLER_KEY_PREFIX = "spare_ch_";

/**
 * Co? `slotKey` pro každého vlastníka role, odvozený z lineupu —
 * `${role}:${musicianId}` -> `${role}:${index}`. Jediný zdroj pravdy, ze
 * kterého čerpá join (aktivní i vypnuté řádky), ve stejné konvenci
 * `${role}:${index}`, jakou `ProjectSetupPage.tsx` (`parseSlotIndex`,
 * ř. 1226–1257) používá pro zápis patche zpátky do konkrétního slotu.
 *
 * Proč z lineupu, a ne z pořadí řádků v dokumentu? `document.inputs`
 * nezachovává pořadí muzikantů v rámci role: vokální řádky jdou přes overlay
 * (lead se tiskne před back, bez ohledu na pořadí v lineupu) a
 * `comparePdfInputs` řadí akustickou kytaru za elektrickou ještě před
 * rozlišením podle pořadí v lineupu. `slotKey` odvozený z pořadí tisku by tak
 * mohl označit jiného muzikanta, než pro kterého se patch skutečně zapíše —
 * proto tahle funkce chodí přímo do `lineup`u, stejně jako
 * `collectDisabledInputRows`.
 */
export function buildSlotKeyIndex(args: {
  lineup: LineupMap;
  roleOrder: readonly Group[];
}): Map<string, string> {
  const { lineup, roleOrder } = args;
  const slotKeyByOwner = new Map<string, string>();

  for (const role of roleOrder) {
    const slots = normalizeLineupSlots(lineup[role], getRoleSlotLimit(role));
    slots.forEach((slot, index) => {
      slotKeyByOwner.set(`${role}:${slot.musicianId}`, `${role}:${index}`);
    });
  }

  return slotKeyByOwner;
}

/**
 * `InputEditorRow.key` je jmenný prostor, ve kterém `InputTable` hledá React
 * klíč i identitu výběru. Klíč vypnutého kanálu je vždy syrový (z výchozího
 * presetu) — jakmile dva muzikanti stejné role sdílejí preset a jeden z nich
 * má kanál vypnutý, zatímco druhému se tiskne beze změny (disambiguace ho
 * nechá bez sufixu, protože v dokumentu je jen jednou), vypnutý i aktivní
 * řádek by měly stejný `key`. Jmenný prostor vlastníka to vylučuje. Nikdo
 * tenhle tvar nerozebírá zpátky — kdo potřebuje syrový klíč, čte `rawKey`.
 */
function composeRemovedRowKey(ownerMusicianId: string, rawKey: string): string {
  return `${ownerMusicianId}:${rawKey}`;
}

/**
 * Co? Řádky tabulky kanálů na obrazovce `02`, poskládané joinem nad
 * `document.inputs` — tím, co `buildDocument` skutečně vytiskne (R1).
 *
 * Proč join a ne výpočet? Číslo, label, poznámka, skupina, vlastník i pořadí
 * v `document.inputs` už jsou hotové — je to tatáž řada, co jde do PDF. Tenhle
 * modul je jen kopíruje. Jediná práce navíc: vypnuté kanály se netisknou,
 * takže v dokumentu nejsou vůbec — přicházejí zvlášť (`disabledRows`, ze
 * `collectDisabledInputRows`) a vkládají se za svého souseda (R3).
 */
export function buildInputEditorRows(args: {
  document: DocumentViewModel;
  disabledRows: readonly DisabledInputRow[];
  slotKeysByOwner: ReadonlyMap<string, string>;
}): InputEditorRow[] {
  const { document, disabledRows, slotKeysByOwner } = args;

  const rows: InputEditorRow[] = document.inputs.map((input) => {
    const isFiller = input.key.startsWith(FILLER_KEY_PREFIX);
    const ownerRole = input.ownerRole ?? input.group;
    const ownerMusicianId = input.ownerMusicianId ?? "";
    return {
      key: input.key,
      rawKey: input.key,
      ch: input.ch,
      label: input.label,
      note: input.note ?? "",
      group: input.group,
      ownerRole,
      ownerMusicianId,
      slotKey: isFiller
        ? ""
        : (slotKeysByOwner.get(`${ownerRole}:${ownerMusicianId}`) ?? ""),
      state: isFiller ? "filler" : "active",
    };
  });

  for (const disabled of disabledRows) {
    rows.splice(insertionIndexFor(rows, disabled), 0, {
      key: composeRemovedRowKey(disabled.ownerMusicianId, disabled.rawKey),
      rawKey: disabled.rawKey,
      ch: null,
      label: disabled.label,
      note: disabled.note,
      group: disabled.group,
      ownerRole: disabled.ownerRole,
      ownerMusicianId: disabled.ownerMusicianId,
      slotKey: disabled.slotKey,
      state: "removed",
    });
  }

  return rows;
}

/**
 * Kam patří vypnutý řádek:
 *
 * 1. Hned za svého souseda (`neighborKey`), pokud se najde **u téhož
 *    vlastníka** — hledání je schválně omezené na `ownerMusicianId`, protože
 *    soused je syrový klíč z výchozího presetu a dva muzikanti stejné role na
 *    stejném presetu ho mají stejný. Soused může být i dřív vložený vypnutý
 *    řádek (`composeRemovedRowKey`), proto se porovnává v obou tvarech.
 * 2. Bez souseda (nebo když soused sám v dokumentu není, protože je taky
 *    vypnutý a ještě nebyl vložen) skončí za posledním řádkem téhož
 *    vlastníka (`slotKey`) — to odliší dva muzikanty stejné role od sebe.
 * 3. Bez shody ani tam skončí na konci vlastní skupiny (`ownerRole`), ne na
 *    konci celé tabulky, kde by vypadal, že patří k poslední vytištěné roli.
 */
function insertionIndexFor(
  rows: InputEditorRow[],
  disabled: DisabledInputRow,
): number {
  if (disabled.neighborKey !== null) {
    const composedNeighborKey = composeRemovedRowKey(
      disabled.ownerMusicianId,
      disabled.neighborKey,
    );
    const neighborIndex = rows.findIndex(
      (row) =>
        row.ownerMusicianId === disabled.ownerMusicianId &&
        (row.key === disabled.neighborKey || row.key === composedNeighborKey),
    );
    if (neighborIndex !== -1) return neighborIndex + 1;
  }

  if (disabled.slotKey) {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].slotKey === disabled.slotKey) return i + 1;
    }
  }

  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].ownerRole === disabled.ownerRole) return i + 1;
  }
  return rows.length;
}

/**
 * Co? Vypnuté kanály obsazených slotů lineupu — rozdíl mezi výchozím
 * presetem slotu a jeho efektivním presetem.
 *
 * Proč samostatná funkce a ne součást joinu? `buildInputEditorRows` čte jen
 * `document.inputs`, kde vypnuté kanály nejsou (netisknou se). Tahle funkce
 * je jediné místo, které smí sáhnout do lineupu — a musí to dělat přes
 * `normalizeLineupSlots`, aby uměla i lineup zapsaný jako pole holých
 * musicianId stringů (to zahodil původní Task 11). `slotKey` sdílí s
 * aktivními řádky tutéž `buildSlotKeyIndex`, aby oba typy řádků téhož
 * vlastníka nikdy nedostaly různý `slotKey`.
 */
export function collectDisabledInputRows(args: {
  lineup: LineupMap;
  roleOrder: readonly Group[];
  setupForSlot: SetupForSlot;
}): DisabledInputRow[] {
  const { lineup, roleOrder, setupForSlot } = args;
  const slotKeyByOwner = buildSlotKeyIndex({ lineup, roleOrder });
  const rows: DisabledInputRow[] = [];

  for (const role of roleOrder) {
    const slots = normalizeLineupSlots(lineup[role], getRoleSlotLimit(role));

    for (const slot of slots) {
      const musicianId = slot.musicianId;
      const { resolved, effective } = setupForSlot(
        role,
        musicianId,
        slot.presetOverride,
      );
      const activeKeys = new Set(effective.inputs.map((input) => input.key));
      const slotKey = slotKeyByOwner.get(`${role}:${musicianId}`) ?? "";
      let previousKey: string | null = null;

      for (const input of resolved.defaultPreset.inputs) {
        if (!activeKeys.has(input.key)) {
          rows.push({
            rawKey: input.key,
            label: input.label,
            note: input.note ?? "",
            group: input.group ?? role,
            ownerRole: role,
            ownerMusicianId: musicianId,
            slotKey,
            neighborKey: previousKey,
          });
        }
        previousKey = input.key;
      }
    }
  }

  return rows;
}
