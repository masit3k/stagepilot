import type { LineupEntry, RichLineupValue } from "../../../projectRules";
import type { NewProjectPayload } from "../../shell/types";

/**
 * Zahodí `presetOverride` a `drumDefinition` z jednoho záznamu lineupu.
 *
 * Záznam může být holý string (jen `musicianId`, zkratka bez odchylek — tak
 * ukládá `serializeLineupForProject`, když slot žádnou odchylku nenese) — ten
 * se vrací beze změny, protože nic z toho, co reset maže, nést nemůže.
 *
 * Objektový záznam se nekopíruje přes výčet `musicianId`: `LineupSlotValue`
 * dnes žádné jiné pole nemá, ale kdyby ho jednou dostalo (ruční úprava JSONu
 * na disku, budoucí pole), tenhle reset by ho tiše smazal. Proto se maže jen
 * to, co reset slibuje smazat, a všechno ostatní na záznamu přežívá.
 */
function stripSlotDeviations(entry: LineupEntry): LineupEntry {
  if (typeof entry !== "object" || entry === null) return entry;
  const { presetOverride, drumDefinition, ...rest } = entry as Record<
    string,
    unknown
  >;
  return rest as LineupEntry;
}

function resetLineupValue(
  value: RichLineupValue | undefined,
): RichLineupValue | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value)
    ? value.map(stripSlotDeviations)
    : stripSlotDeviations(value);
}

/**
 * Co? Zahodí všech pět vrstev, které obrazovka `02` edituje (R15).
 *
 * Pravidlo, které to drží pohromadě: reset maže vše, co je na projektu
 * **odchylkou od výchozího stavu muzikanta nebo kapely**. Proto do něj patří
 * i `drumDefinition` — `resolveDrumsSetupDefinition` ho staví nad
 * `musicianPresetItems`, takže je to odchylka jako každá jiná, jen uložená
 * vedle patche a ne v něm.
 *
 * Co reset nemaže: obsazení lineupu, stage plan a údaje o akci. Ty na téhle
 * obrazovce nevznikly.
 */
export function resetInputsScreen(
  payload: NewProjectPayload,
): NewProjectPayload {
  const { inputOrder, notes, lineup: rawLineup, ...rest } = payload;

  if (!rawLineup) return rest;

  const lineup = Object.fromEntries(
    Object.entries(rawLineup).map(([role, value]) => [
      role,
      resetLineupValue(value),
    ]),
  ) as NonNullable<NewProjectPayload["lineup"]>;

  return { ...rest, lineup };
}
