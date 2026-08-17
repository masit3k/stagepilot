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
  readonly key: string;
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
 * Vypnutý kanál, dokud nemá řádek v `InputEditorRow`. `neighborKey` je klíč,
 * který ve výchozím presetu slotu předchází tomuto kanálu — `null`, když byl
 * ve výchozím presetu první a soused tedy neexistuje.
 */
export type DisabledInputRow = {
  readonly key: string;
  readonly label: string;
  readonly note: string;
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
}): InputEditorRow[] {
  const { document, disabledRows } = args;
  const slotKeyByRowKey = deriveSlotKeys(document.inputs);

  const rows: InputEditorRow[] = document.inputs.map((input) => {
    const isFiller = input.key.startsWith(FILLER_KEY_PREFIX);
    return {
      key: input.key,
      ch: input.ch,
      label: input.label,
      note: input.note ?? "",
      group: input.group,
      ownerRole: input.ownerRole ?? input.group,
      ownerMusicianId: input.ownerMusicianId ?? "",
      slotKey: isFiller ? "" : (slotKeyByRowKey.get(input.key) ?? ""),
      state: isFiller ? "filler" : "active",
    };
  });

  for (const disabled of disabledRows) {
    rows.splice(insertionIndexFor(rows, disabled), 0, {
      key: disabled.key,
      ch: null,
      label: disabled.label,
      note: disabled.note,
      group: disabled.ownerRole,
      ownerRole: disabled.ownerRole,
      ownerMusicianId: disabled.ownerMusicianId,
      slotKey: disabled.slotKey,
      state: "removed",
    });
  }

  return rows;
}

/**
 * Kam patří vypnutý řádek: hned za svého souseda, pokud se v joinu najde.
 * Bez souseda (nebo když soused sám v dokumentu není, protože je taky
 * vypnutý a ještě nebyl vložen) skončí za posledním řádkem téhož vlastníka
 * (`slotKey`) — to odliší dva muzikanty stejné role od sebe. Bez shody ani
 * tam skončí na konci vlastní skupiny (`ownerRole`), ne na konci celé
 * tabulky, kde by vypadal, že patří k poslední vytištěné roli.
 */
function insertionIndexFor(
  rows: InputEditorRow[],
  disabled: DisabledInputRow,
): number {
  if (disabled.neighborKey !== null) {
    const neighborIndex = rows.findIndex(
      (row) => row.key === disabled.neighborKey,
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
 * `slotKey` identifikuje, který výskyt role patří danému vlastníkovi
 * (1. kytarista, 2. kytarista, ...), aby ho pozdější inspektor (Task 12) mohl
 * skupinovat. `document.inputs` index slotu nenese přímo — nese ale
 * `ownerRole`/`ownerMusicianId` na každém řádku, a řádky jsou už ve
 * vytištěném pořadí. Index se tedy odvodí z pořadí, ve kterém se který
 * vlastník v rámci role poprvé objeví; víc informací dokument nedává.
 * Řádek bez vlastníka (typicky filler) slotKey nedostane.
 */
function deriveSlotKeys(
  inputs: DocumentViewModel["inputs"],
): Map<string, string> {
  const indexByRoleAndMusician = new Map<string, number>();
  const nextIndexByRole = new Map<Group, number>();
  const slotKeyByRowKey = new Map<string, string>();

  for (const input of inputs) {
    if (input.key.startsWith(FILLER_KEY_PREFIX)) continue;
    const role = input.ownerRole;
    const musicianId = input.ownerMusicianId;
    if (!role || !musicianId) {
      console.warn(
        `[buildInputEditorRows] input "${input.key}" has no owner in the document; slotKey left empty (the Task 12 inspector needs it).`,
      );
      continue;
    }

    const comboKey = `${role}:${musicianId}`;
    let index = indexByRoleAndMusician.get(comboKey);
    if (index === undefined) {
      index = nextIndexByRole.get(role) ?? 0;
      indexByRoleAndMusician.set(comboKey, index);
      nextIndexByRole.set(role, index + 1);
    }
    slotKeyByRowKey.set(input.key, `${role}:${index}`);
  }

  return slotKeyByRowKey;
}

/**
 * Co? Vypnuté kanály obsazených slotů lineupu — rozdíl mezi výchozím
 * presetem slotu a jeho efektivním presetem.
 *
 * Proč samostatná funkce a ne součást joinu? `buildInputEditorRows` čte jen
 * `document.inputs`, kde vypnuté kanály nejsou (netisknou se). Tahle funkce
 * je jediné místo, které smí sáhnout do lineupu — a musí to dělat přes
 * `normalizeLineupSlots`, aby uměla i lineup zapsaný jako pole holých
 * musicianId stringů (to zahodil původní Task 11).
 */
export function collectDisabledInputRows(args: {
  lineup: LineupMap;
  roleOrder: readonly Group[];
  setupForSlot: SetupForSlot;
}): DisabledInputRow[] {
  const { lineup, roleOrder, setupForSlot } = args;
  const rows: DisabledInputRow[] = [];

  for (const role of roleOrder) {
    const slots = normalizeLineupSlots(lineup[role], getRoleSlotLimit(role));

    slots.forEach((slot, slotIndex) => {
      const musicianId = slot.musicianId;
      const { resolved, effective } = setupForSlot(
        role,
        musicianId,
        slot.presetOverride,
      );
      const activeKeys = new Set(effective.inputs.map((input) => input.key));
      const slotKey = `${role}:${slotIndex}`;
      let previousKey: string | null = null;

      for (const input of resolved.defaultPreset.inputs) {
        if (!activeKeys.has(input.key)) {
          rows.push({
            key: input.key,
            label: input.label,
            note: input.note ?? "",
            ownerRole: role,
            ownerMusicianId: musicianId,
            slotKey,
            neighborKey: previousKey,
          });
        }
        previousKey = input.key;
      }
    });
  }

  return rows;
}
