import type { Group } from "../../../../../../src/domain/model/groups";

/**
 * Co? Jestli lze z obrazovky `02` vypnout/vrátit kanál (`Remove channel`,
 * `Restore channel`, R3) — a pokud ne, proč. Zrcadlí
 * `resolveMonitorRowEditability` (Task 15) pro sekci MONITORS:
 * needitovatelný stav se nesmí schovat beze slova, inspektor ho musí umět
 * vysvětlit.
 *
 * Dva navzájem nezávislé důvody vedou ke stejnému závěru — patch, který by
 * tahle tlačítka zapsala, se do dokumentu nikdy nedostane (ověřeno
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
 * řádku, aby zavřel `Remove channel`/`Restore channel`. Druhý volající —
 * dvoukrokový picker `+ Add input` — zanikl s F5d R5: kanál se přidává volbou
 * zapojení nebo doplňku u jeho vlastníka (`Edit inputs`, `Edit kit`), ne
 * výběrem z paralelního katalogu, takže brána už jen zavírá řádky, ne cestu
 * ke vzniku nových.
 */
export type InputRowEditability =
  | { canEdit: true }
  | { canEdit: false; reason: "drums-not-supported" | "overlay-not-supported" };

export function resolveInputRowEditability(args: {
  ownerRole: Group;
  group: Group;
}): InputRowEditability {
  // `group` must win over `ownerRole` (fix round 2, Important 1): a
  // drummer's own back-vocal overlay row carries `ownerRole: "drums"` but
  // `group: "vocs"` — it is not a drum-kit channel, so it must not get
  // `drums-not-supported` (which now feeds the `Edit kit` hint). Checking
  // `ownerRole === "drums"` first used to steal that row from the
  // `overlay-not-supported` branch below, telling the user their vocal
  // channel changes through `Edit kit` — an active false steer.
  if (args.group === "vocs" || args.group === "talkback") {
    return { canEdit: false, reason: "overlay-not-supported" };
  }
  if (args.ownerRole === "drums") {
    return { canEdit: false, reason: "drums-not-supported" };
  }
  return { canEdit: true };
}
