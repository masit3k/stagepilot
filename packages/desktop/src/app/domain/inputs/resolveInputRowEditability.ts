import type { Group } from "../../../../../../src/domain/model/groups";

/**
 * Co? Jestli lze z obrazovky `02` vypnout/vrátit kanál (`Remove channel`,
 * `Restore channel`, R3), a jestli smí `+ Add input` (R4) vůbec nabídnout
 * daného vlastníka — a pokud ne, proč. Zrcadlí `resolveMonitorRowEditability`
 * (Task 15) pro sekci MONITORS: needitovatelný stav se nesmí schovat beze
 * slova, panel/picker ho musí umět vysvětlit.
 *
 * Dva navzájem nezávislé důvody vedou ke stejnému závěru — patch, který by
 * tahle tři tlačítka zapsala, se do dokumentu nikdy nedostane (ověřeno
 * `.superpowers/sdd/2026-08-17-inputs-screen/drums-vocals-patch-reach-verification.md`,
 * task 13b):
 *
 * - `drums-not-supported`: `resolveEffectiveProjectSetup` u role `drums`
 *   čte z `presetOverride.inputs` jen `update`
 *   (`src/domain/setup/resolveEffectiveProjectSetup.ts:76-80`, task 12c fix
 *   round 1) — bicí kanály staví `drumDefinition`, ne preset. `add`/`remove`
 *   se zahodí beze stopy; navíc bez tohohle gatu `Remove channel` řádek
 *   přeškrtne, zatímco dokument ho dál tiskne beze změny — aktivní falešné
 *   potvrzení úspěchu, ne jen ticho.
 * - `overlay-not-supported`: lead/back vokální řádky i talkback řádek se
 *   staví mimo smyčku muzikantových presetů („overlay rows built outside the
 *   per-musician preset loop", `src/domain/pipeline/buildDocument.ts:222-224`)
 *   a čtou z `presetOverride` jen `update`, narrownuté na klíče, které v nich
 *   už existují (`narrowPatchToUpdatesFor`, tamtéž řádek 213-220). `remove`
 *   na takovém řádku je tichý no-op. `add` je horší: `eventOverride` větev
 *   (`buildDocument.ts:607-619`) `vocs` nevylučuje, ale v okamžiku, kdy pro
 *   ni běží, ještě žádný vokální řádek neexistuje (`affected` je vždy
 *   prázdné pole) — výsledek je trvalý, needitovatelný osiřelý řádek, který
 *   se přesto vytiskne do PDF (`ownerMusicianId: undefined`,
 *   `InputRowInspector`'s `hasOwner` je pak `false` a žádnou akci mu
 *   nenabídne). Kritérium je `group`, ne `ownerRole` — vokální overlay řádek
 *   basáka/kytaristy/klávesáka, co zpívá, má `group === "vocs"`, ale
 *   `ownerRole` toho, čí je to nástroj.
 *
 * Použití: `InputRowInspector` volá s (`row.ownerRole`, `row.group`) vybraného
 * řádku, aby zavřel `Remove channel`/`Restore channel`. `+ Add input`'s krok
 * 1 (`AddInputPicker`'s `ownerOptions`) volá s (`owner.role`, `owner.role`) —
 * kanál z pickeru vždy nese `group` shodnou s vlastníkovou lineup rolí
 * (`GROUP_INPUT_LIBRARY[owner.role]`), takže "šla by nová řada tohohle
 * vlastníka do dokumentu?" je tatáž otázka jako u existující řady.
 */
export type InputRowEditability =
  | { canEdit: true }
  | { canEdit: false; reason: "drums-not-supported" | "overlay-not-supported" };

export function resolveInputRowEditability(args: {
  ownerRole: Group;
  group: Group;
}): InputRowEditability {
  if (args.ownerRole === "drums") {
    return { canEdit: false, reason: "drums-not-supported" };
  }
  if (args.group === "vocs" || args.group === "talkback") {
    return { canEdit: false, reason: "overlay-not-supported" };
  }
  return { canEdit: true };
}
