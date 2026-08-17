import type { Group } from "../../../../../../src/domain/model/groups";
import type {
  MusicianSetupPreset,
  PresetOverridePatch,
} from "../../../../../../src/domain/model/types";
import { applyManualInputOrder } from "../../../../../../src/domain/pipeline/applyManualInputOrder";
import { assignPdfChannels } from "../../../../../../src/domain/pipeline/pdf/assignPdfChannels";
import type { LineupMap } from "../../../projectRules";

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

export type SetupForSlot = (
  role: Group,
  musicianId: string,
  patch?: PresetOverridePatch,
) => {
  resolved: { defaultPreset: MusicianSetupPreset };
  effective: MusicianSetupPreset;
};

/**
 * Co? Řádky tabulky kanálů na obrazovce `02`.
 *
 * Proč vypnuté řádky zůstávají? Je to jediné vědomé místo, kde se editor
 * liší od tisku (R3): uživatel vidí, co odškrtl, a vrátí to jedním klikem.
 * Číslo takový řádek nedostane, aby čísla souhlasila s dokumentem.
 *
 * Proč čísluje `assignPdfChannels` a ne tenhle modul? Protože ta funkce
 * vkládá výplňový kanál pro zarovnání stereo páru na nepatrné číslo. Vlastní
 * číslování od jedničky by se od PDF rozešlo přesně tam, kde na tom záleží.
 */
export function buildInputEditorRows(args: {
  lineup: LineupMap;
  roleOrder: readonly Group[];
  inputOrder: readonly string[] | undefined;
  setupForSlot: SetupForSlot;
}): InputEditorRow[] {
  const { lineup, roleOrder, inputOrder, setupForSlot } = args;
  const collected: InputEditorRow[] = [];

  for (const role of roleOrder) {
    const value = lineup[role];
    const slots = Array.isArray(value) ? value : [];

    slots.forEach((slot, slotIndex) => {
      // `LineupEntry` also allows a bare musician-id string; that shape never
      // carries a preset override, so it can never own an editable input row.
      if (typeof slot === "string") return;
      const musicianId = slot.musicianId.trim();
      if (!musicianId) return;

      const { resolved, effective } = setupForSlot(
        role,
        musicianId,
        slot.presetOverride,
      );
      const slotKey = `${role}:${slotIndex}`;
      const activeKeys = new Set(effective.inputs.map((input) => input.key));

      const toRow = (
        input: { key: string; label: string; note?: string; group?: Group },
        state: "active" | "removed",
      ): InputEditorRow => ({
        key: input.key,
        ch: null,
        label: input.label,
        note: input.note ?? "",
        group: input.group ?? role,
        ownerRole: role,
        ownerMusicianId: musicianId,
        slotKey,
        state,
      });

      for (const input of effective.inputs) collected.push(toRow(input, "active"));

      for (const input of resolved.defaultPreset.inputs) {
        if (activeKeys.has(input.key)) continue;
        collected.push(toRow(input, "removed"));
      }
    });
  }

  const ordered = applyManualInputOrder(collected, inputOrder);

  // Čísla přiřadí doména nad tištěnými řádky; vypnuté se do ní neposílají.
  //
  // Pole `ch` se musí odstranit, ne jen ignorovat: `assignPdfChannels` staví
  // výsledek jako `{ ch: nextCh, ...input }`, takže vlastní `ch: null` na vstupu
  // by přiřazené číslo spreadem přepsalo zpátky na `null`.
  const printable = ordered
    .filter((row) => row.state === "active")
    .map(({ key, label, note, group, ownerRole, ownerMusicianId }) => ({
      key,
      label,
      note,
      group,
      ownerRole,
      ownerMusicianId,
    }));
  const numbered = new Map<string, number>();
  const fillers: InputEditorRow[] = [];

  for (const row of assignPdfChannels(printable)) {
    if (row.key.startsWith("spare_ch_")) {
      fillers.push({
        key: row.key,
        ch: row.ch,
        label: row.label,
        note: row.note ?? "",
        group: row.group,
        ownerRole: row.ownerRole,
        ownerMusicianId: "",
        slotKey: "",
        state: "filler",
      });
      continue;
    }
    numbered.set(row.key, row.ch);
  }

  const withNumbers = ordered.map((row) =>
    row.state === "active" ? { ...row, ch: numbered.get(row.key) ?? null } : row,
  );

  // Výplň patří na své číslo, tedy před řádek, který ho následuje.
  for (const filler of fillers) {
    const at = withNumbers.findIndex(
      (row) => row.ch !== null && row.ch > (filler.ch ?? 0),
    );
    withNumbers.splice(at === -1 ? withNumbers.length : at, 0, filler);
  }

  return withNumbers;
}
