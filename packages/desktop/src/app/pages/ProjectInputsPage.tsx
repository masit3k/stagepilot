import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeProject } from "../../../../../src/app/usecases/normalizeProject";
import type { DrumDefinition } from "../../../../../src/domain/drums/drumDefinition";
import type {
  DocumentViewModel,
  InputChannel,
  PresetEntity,
  PresetOverridePatch,
  ProjectNotesOverride,
} from "../../../../../src/domain/model/types";
import { buildDocument } from "../../../../../src/domain/pipeline/buildDocument";
import { summarizeEffectivePresetValidation } from "../../../../../src/domain/rules/presetOverride";
import { DrumsPartsEditor } from "../../components/setup/DrumsPartsEditor";
import { ModalOverlay, useModalBehavior } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/toast/useToast";
import { getRoleSlotLimit, normalizeLineupSlots } from "../../projectRules";
import type { LineupMap } from "../../projectRules";
import {
  type AddInputOwnerOption,
  AddInputPicker,
} from "../components/inputs/AddInputPicker";
import { InputRowInspector } from "../components/inputs/InputRowInspector";
import { InputTable } from "../components/inputs/InputTable";
import { MonitorRowInspector } from "../components/inputs/MonitorRowInspector";
import {
  type MonitorEditorRow,
  MonitorTable,
} from "../components/inputs/MonitorTable";
import { areSetupsEqual } from "../components/setup/adapters/eventSetupAdapter";
import {
  type InputEditorRow,
  buildInputEditorRows,
  buildSlotKeyIndex,
  collectDisabledInputRows,
} from "../domain/inputs/buildInputEditorRows";
import { createDocumentRepository } from "../domain/inputs/createDocumentRepository";
import {
  moveInputRow,
  resolveActiveDropIndex,
} from "../domain/inputs/moveInputRow";
import { resolveInputRowEditability } from "../domain/inputs/resolveInputRowEditability";
import {
  addInputRow,
  removeInputRow,
  restoreInputRow,
} from "../domain/inputs/toggleInputRow";
import { updateInputRow } from "../domain/inputs/updateInputRow";
import { buildMusicianDefaultPayload } from "../domain/setup/buildMusicianDefaultPayload";
import { musicianDefaultsKey } from "../domain/setup/musicianDefaultsKey";
import { useSetupOverrides } from "../domain/setup/useSetupOverrides";
import {
  getBandSetupData,
  parseProjectPayload,
  readProject,
  saveProjectPayload,
  updateMusicianDefaults,
} from "../services/projectsApi";
import { nextStepPath, previousStepPath } from "../shell/chrome/processSteps";
import { CANONICAL_LINEUP_ROLE_ORDER } from "../shell/lineupSerialize";
import type { BandSetupData, NewProjectPayload } from "../shell/types";
import { resolveDrumsSetupDefinition } from "./domain/ui/resolveDrumsSetupDefinition";
import type { ProjectRouteProps } from "./shared/pageTypes";
import { GROUP_INPUT_LIBRARY } from "./shared/setupConstants";

/**
 * Výsledek přepočtu dokumentu pro obrazovku `02`. `normalizeProject` i
 * `buildDocument` vyhazují na nekompletní/ručně editovaná data (chybějící
 * preset, muzikant, povinné pole projektu) — chyba se nese jako hodnota, ne
 * jako výjimka, aby ji `useMemo` mohl bezpečně vrátit a stránka nespadla na
 * bílou stránku (nejdůležitější požadavek tohoto tasku).
 */
type DocumentBuildResult =
  | { kind: "pending" }
  | { kind: "ready"; document: DocumentViewModel }
  | { kind: "error"; message: string };

export type InputsEditorSnapshot = {
  inputOrder: readonly string[] | undefined;
  notes: ProjectNotesOverride | undefined;
  lineup: LineupMap;
};

/** Obranný výchozí stav, kdyby se ref ještě nestihl naplnit. */
const EMPTY_INPUTS_SNAPSHOT: InputsEditorSnapshot = {
  inputOrder: undefined,
  notes: undefined,
  lineup: {},
};

/**
 * Dirty stav obrazovky `02`. Srovnává jen to, co obrazovka edituje —
 * ruční pořadí, odchylky poznámek a patche na slotech lineupu.
 *
 * Porovnání přes serializaci je tady záměrné: struktura je malá, plochá
 * a ukládá se do JSONu, takže hlubší srovnání by jen opakovalo, co dělá
 * `JSON.stringify`, a snadněji by se rozešlo s tím, co se opravdu zapíše.
 */
export function isInputsDirty(
  initial: InputsEditorSnapshot,
  current: InputsEditorSnapshot,
): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current);
}

function snapshotFromProject(project: NewProjectPayload): InputsEditorSnapshot {
  return {
    inputOrder: project.inputOrder,
    notes: project.notes,
    lineup: project.lineup ?? {},
  };
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      project: NewProjectPayload;
      snapshot: InputsEditorSnapshot;
    };

/**
 * Stejná konvence jako `parseSlotIndex` v `ProjectSetupPage.tsx` (~ř. 1177) —
 * `row.slotKey` je `${role}:${index}`, vlastníkovu roli editor má vedle v
 * `row.ownerRole`, takže se tu parsuje jen index.
 */
function parseSlotIndex(slotKey: string): number {
  const [, rawIndex] = slotKey.split(":");
  const parsed = Number(rawIndex);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isOverridePatchEmpty(patch: PresetOverridePatch): boolean {
  return !patch.inputs && !patch.monitoring;
}

/**
 * Počet odchylek slotu od výchozí výbavy muzikanta — zobrazuje se v panelu
 * (R2) a řídí, jestli je `Reset to default` k něčemu. Počítá se přímo z
 * patche, ne z `diffMeta` (`computeSetupDiff`): ten značí jako `override` jen
 * přidané/odebrané kanály, přejmenování a poznámka (`inputs.update`) by tak
 * nikdy neprošly jako odchylka, přestože přesně tohle R6 zavádí.
 */
function countPatchDeviations(patch: PresetOverridePatch | undefined): number {
  if (!patch) return 0;
  const inputs = patch.inputs;
  const inputDeviations =
    (inputs?.add?.length ?? 0) +
    (inputs?.remove?.length ?? 0) +
    (inputs?.removeKeys?.length ?? 0) +
    (inputs?.replace?.length ?? 0) +
    (inputs?.update?.length ?? 0);
  const monitoringDeviations = patch.monitoring
    ? Object.keys(patch.monitoring).length
    : 0;
  return inputDeviations + monitoringDeviations;
}

/**
 * Aktuální `presetOverride` jednoho slotu, čtený přímo z editovaného
 * snapshotu — sdílí ho výpočet `deviationCount` pro panel (R2) a payload pro
 * `Save as musician default` (R5): obě potřebují ten samý patch, jaký na
 * obrazovce `02` právě platí, ne to, co je uložené na disku.
 */
function getSlotOverride(
  lineup: LineupMap,
  role: string,
  slotIndex: number,
): PresetOverridePatch | undefined {
  const slots = normalizeLineupSlots(lineup[role], getRoleSlotLimit(role));
  return slots[slotIndex]?.presetOverride;
}

/** Zapíše (nebo smaže) `presetOverride` jednoho slotu v `lineup`, beze změny tvaru pole/objektu, jaký `role` používá. */
function replaceSlotOverride(
  lineup: LineupMap,
  role: string,
  slotIndex: number,
  nextPatch: PresetOverridePatch | undefined,
): LineupMap {
  const roleSlotLimit = getRoleSlotLimit(role);
  const slots = normalizeLineupSlots(lineup[role], roleSlotLimit);
  if (!slots[slotIndex]) return lineup;

  const nextSlots = slots.map((slot, index) => {
    if (index !== slotIndex) return slot;
    return {
      musicianId: slot.musicianId,
      ...(nextPatch && !isOverridePatchEmpty(nextPatch)
        ? { presetOverride: nextPatch }
        : {}),
      ...(slot.drumDefinition ? { drumDefinition: slot.drumDefinition } : {}),
    };
  });

  const value = roleSlotLimit <= 1 ? nextSlots[0] : nextSlots;
  return { ...lineup, [role]: value as LineupMap[string] };
}

/**
 * Zapíše `drumDefinition` jednoho slotu bicích, beze změny `presetOverride`
 * (Task 16, Ruling 1). `Edit kit` na obrazovce `02` NEreplikuje bookkeeping
 * `ProjectSetupPage.tsx` (~ř. 2235-2258): tam editace kitu zapisuje
 * `drumDefinition` A ZÁROVEŇ `inputs.add`/`removeKeys` do
 * `presetOverride.inputs` přes `buildInputsPatchFromTarget` — patch, který
 * `resolveEffectiveProjectSetup.ts:75-79` u bicích schválně zužuje jen na
 * `inputs.update`, takže `add`/`removeKeys` do dokumentu nikdy nedojede.
 * `drumDefinition` je jediný zdroj pravdy o bicích kanálech (komentář fixu
 * 12c tamtéž) — zápis navíc by tu byl jen balast a rozešel by se s
 * dokumentem, přesně jako gate z Tasku 13b existuje proto, aby zabránil.
 */
export function replaceSlotDrumDefinition(
  lineup: LineupMap,
  role: string,
  slotIndex: number,
  nextDrumDefinition: DrumDefinition,
): LineupMap {
  const roleSlotLimit = getRoleSlotLimit(role);
  const slots = normalizeLineupSlots(lineup[role], roleSlotLimit);
  if (!slots[slotIndex]) return lineup;

  const nextSlots = slots.map((slot, index) =>
    index === slotIndex
      ? { ...slot, drumDefinition: nextDrumDefinition }
      : slot,
  );

  const value = roleSlotLimit <= 1 ? nextSlots[0] : nextSlots;
  return { ...lineup, [role]: value as LineupMap[string] };
}

export function ProjectInputsPage({
  id,
  navigate,
  registerNavigationGuard,
}: ProjectRouteProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [isSaving, setIsSaving] = useState(false);
  const [setupData, setSetupData] = useState<BandSetupData | null>(null);
  const [selectedInputKey, setSelectedInputKey] = useState<string | null>(null);
  const [selectedMonitorSlotKey, setSelectedMonitorSlotKey] = useState<
    string | null
  >(null);
  const [
    showSaveMusicianDefaultConfirmation,
    setShowSaveMusicianDefaultConfirmation,
  ] = useState(false);
  const [isSavingMusicianDefault, setIsSavingMusicianDefault] = useState(false);
  const [showAddInputPicker, setShowAddInputPicker] = useState(false);
  const [showEditKitModal, setShowEditKitModal] = useState(false);
  const { notify } = useToast();
  /** Stav, proti kterému se poznává dirty — po každém uložení se posune. */
  const initialSnapshotRef = useRef<InputsEditorSnapshot | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const project = parseProjectPayload(await readProject(id));
        if (cancelled) return;
        const snapshot = snapshotFromProject(project);
        initialSnapshotRef.current = snapshot;
        setState({ kind: "ready", project, snapshot });
      } catch (error) {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Project could not be loaded.",
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const bandRef = state.kind === "ready" ? state.project.bandRef : null;

  /**
   * Katalog presetů kapely, potřebný pro `setupForSlot`. Bez něj by řádky
   * ukazovaly jen obecné výchozí kanály skupiny (R1 by přestalo platit u
   * kapel s vlastními presety), takže se dotahuje samostatně od projektu.
   */
  useEffect(() => {
    if (!bandRef) return;
    let cancelled = false;

    getBandSetupData(bandRef)
      .then((data) => {
        if (!cancelled) setSetupData(data);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[project-inputs] failed to load band setup data", {
          projectId: id,
          bandRef,
          error,
        });
        notify(
          "error",
          "Band defaults could not be loaded. Input list may not match the band's setup.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [bandRef, id, notify]);

  const presetCatalog = setupData?.presetCatalog ?? {};
  const { setupForSlot, defaultPresetFor } = useSetupOverrides({
    setupData,
    presetCatalog,
  });

  /** Katalog monitorových presetů (R7) — stejný filtr jako `ProjectSetupPage.tsx`'s `monitorEntities`/`monitorsById`, jen přesunutý sem s editací. */
  const monitorEntities = useMemo(
    () =>
      Object.values(presetCatalog).filter(
        (preset): preset is Extract<PresetEntity, { type: "monitor" }> =>
          preset.type === "monitor",
      ),
    [presetCatalog],
  );
  const monitorsById = useMemo(
    () =>
      Object.fromEntries(monitorEntities.map((preset) => [preset.id, preset])),
    [monitorEntities],
  );

  const lineup = state.kind === "ready" ? state.snapshot.lineup : {};
  const project = state.kind === "ready" ? state.project : null;
  const snapshot = state.kind === "ready" ? state.snapshot : null;

  /**
   * Efektivní preset každého obsazeného slotu (všechny role, R7) — vstup pro
   * `summarizeEffectivePresetValidation`. Zrcadlí `ProjectSetupPage.tsx`'s
   * `effectiveSlotPresets`, jen nad `CANONICAL_LINEUP_ROLE_ORDER`, protože
   * `02` talkback slot nemá.
   */
  const effectiveSlotPresets = useMemo(
    () =>
      CANONICAL_LINEUP_ROLE_ORDER.flatMap((role) =>
        normalizeLineupSlots(lineup[role], getRoleSlotLimit(role))
          .filter((slot) => Boolean(slot.musicianId))
          .map((slot) => ({
            role,
            effective: setupForSlot(role, slot.musicianId, slot.presetOverride)
              .effective,
          })),
      ),
    [lineup, setupForSlot],
  );

  /** Chyby a varování nad limity (kanály, monitor mixy, pořadí skupin) přes celou sestavu — zobrazí se nad tabulkou MONITORS (R7). */
  const overrideValidation = useMemo(
    () =>
      summarizeEffectivePresetValidation(
        effectiveSlotPresets.map((slot) => ({
          group: slot.role,
          preset: slot.effective,
        })),
        monitorsById,
      ),
    [effectiveSlotPresets, monitorsById],
  );

  /**
   * Projekt, ze kterého se staví dokument — načtený projekt s právě
   * editovaným snapshotem (ruční pořadí, poznámky, patche lineupu) navrchu.
   * Patche z panelu (R6) chodí do `snapshot`, ne do `project`; kdyby dokument
   * dál stavěl z `project`, přejmenování by se v tabulce projevilo až po
   * uložení, protože `snapshot` a `project` by se do té doby rozešly.
   */
  const editedProject = useMemo<NewProjectPayload | null>(() => {
    if (!project || !snapshot) return null;
    return {
      ...project,
      inputOrder: snapshot.inputOrder,
      notes: snapshot.notes,
      lineup: snapshot.lineup,
    };
  }, [project, snapshot]);

  /**
   * Dokument, jehož `inputs` obrazovka `02` zrcadlí (R1). `normalizeProject`
   * i `buildDocument` běží nad daty, která uživatel ručně edituje (JSON na
   * disku, kapelní presety, právě editovaný snapshot) a obojí může vyhodit —
   * nekompletní projekt, chybějící preset, muzikanta nebo notes šablonu.
   * Chyba se zachytí tady a jde do `documentResult.kind === "error"`; render
   * z ní nikdy nesmí spadnout na bílou stránku.
   */
  const documentResult = useMemo<DocumentBuildResult>(() => {
    if (!editedProject || !setupData) return { kind: "pending" };
    try {
      const normalizedProject = normalizeProject(editedProject);
      const repo = createDocumentRepository({
        project: normalizedProject,
        setupData,
      });
      return {
        kind: "ready",
        document: buildDocument(normalizedProject, repo),
      };
    } catch (error) {
      console.error("[project-inputs] failed to build the document", {
        projectId: id,
        error,
      });
      return {
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The input list could not be built from the current project data.",
      };
    }
  }, [editedProject, setupData, id]);

  /**
   * Vypnuté kanály obsazených slotů a `slotKey` podle vlastníka — obojí se
   * čte přímo z lineupu, ne z dokumentu: pořadí muzikanta v `document.inputs`
   * se s pořadím v lineupu nemusí shodovat (vokály jdou přes overlay,
   * akustická kytara se řadí za elektrickou před rozlišením podle lineupu).
   * Selhání se nesmí strhnout aktivní řádky s sebou: bez vypnutých řádků a
   * bez `slotKey` se obrazovka pořád vykreslí, jen bez přeškrtnutí (R3) a
   * bez adresy pro Task 12.
   */
  const { disabledRows, slotKeysByOwner } = useMemo(() => {
    try {
      return {
        slotKeysByOwner: buildSlotKeyIndex({
          lineup,
          roleOrder: CANONICAL_LINEUP_ROLE_ORDER,
        }),
        disabledRows: collectDisabledInputRows({
          lineup,
          roleOrder: CANONICAL_LINEUP_ROLE_ORDER,
          setupForSlot,
        }),
      };
    } catch (error) {
      console.error("[project-inputs] failed to collect disabled rows", {
        projectId: id,
        error,
      });
      return { disabledRows: [], slotKeysByOwner: new Map<string, string>() };
    }
  }, [lineup, setupForSlot, id]);

  const inputRows = useMemo(
    () =>
      documentResult.kind === "ready"
        ? buildInputEditorRows({
            document: documentResult.document,
            disabledRows,
            slotKeysByOwner,
          })
        : [],
    [documentResult, disabledRows, slotKeysByOwner],
  );

  const selectedRow =
    inputRows.find((row) => row.key === selectedInputKey) ?? null;

  /**
   * Řádky sekce MONITORS (R7) — join `document.monitorTableRows` (číslo,
   * výstup, poznámka — nikdy se tu nepřepočítávají) se `slotKeysByOwner`,
   * stejným zdrojem `slotKey`, jaký používá `InputEditorRow`. Prázdný
   * `slotKey` znamená, že vlastník nemá slot v lineupu (obranný případ, viz
   * `MonitorEditorRow` doc komentář) — takový řádek `MonitorTable` nedovolí
   * vybrat.
   */
  const monitorRows = useMemo<MonitorEditorRow[]>(() => {
    if (documentResult.kind !== "ready") return [];
    return documentResult.document.monitorTableRows.map((row) => ({
      no: row.no,
      output: row.output,
      note: row.note,
      ownerRole: row.ownerRole,
      ownerMusicianId: row.ownerMusicianId,
      slotKey:
        slotKeysByOwner.get(`${row.ownerRole}:${row.ownerMusicianId}`) ?? "",
    }));
  }, [documentResult, slotKeysByOwner]);

  const selectedMonitorRow =
    monitorRows.find(
      (row) => row.slotKey !== "" && row.slotKey === selectedMonitorSlotKey,
    ) ?? null;

  const selectedMonitorPatch = useMemo(() => {
    if (!selectedMonitorRow) return undefined;
    return getSlotOverride(
      lineup,
      selectedMonitorRow.ownerRole,
      parseSlotIndex(selectedMonitorRow.slotKey),
    );
  }, [selectedMonitorRow, lineup]);

  /** `resolved`/`effective` preset toho slotu — vstup pro `MonitoringEditor` (efektivní hodnota, diff badge) přesně jako v `ProjectSetupPage.tsx`'s setup modálu. */
  const selectedMonitorSetup = useMemo(() => {
    if (!selectedMonitorRow) return null;
    return setupForSlot(
      selectedMonitorRow.ownerRole,
      selectedMonitorRow.ownerMusicianId,
      selectedMonitorPatch,
    );
  }, [selectedMonitorRow, selectedMonitorPatch, setupForSlot]);

  /**
   * Výběr v tabulce kanálů a v tabulce monitorů se navzájem vylučuje —
   * panel vpravo je jeden slot, který ukazuje buď `InputRowInspector`, nebo
   * `MonitorRowInspector` (R7). Klik do jedné tabulky proto vždy zruší výběr
   * v té druhé.
   */
  const selectChannelRow = useCallback((key: string) => {
    setSelectedInputKey(key);
    setSelectedMonitorSlotKey(null);
  }, []);

  const selectMonitorRow = useCallback((slotKey: string) => {
    setSelectedMonitorSlotKey(slotKey);
    setSelectedInputKey(null);
  }, []);

  /**
   * Ruční přeřazení řádku tažením (R8) — zapisuje `snapshot.inputOrder`.
   * Nové pořadí se skládá jen z **aktivních** řádků (Task 14, Ruling 1):
   * vypnutý řádek má klíč jmenného prostoru vlastníka, který doména nezná, a
   * výplňový řádek `assignPdfChannels` generuje znovu při každém sestavení
   * dokumentu — ani jeden do `project.inputOrder` nepatří.
   *
   * Drop cíl (`toRowKey`) může být i vypnutý nebo výplňový řádek (nejsou
   * `draggable` jako zdroj, ale `InputTable` je pořád nechává jako cíl) —
   * `resolveActiveDropIndex` ho přeloží na nejbližší následující aktivní
   * pozici. Dokud tahle funkce nikdy neproběhne, `inputOrder` zůstává tím,
   * čím byl načten (typicky `undefined`) — nikdo jinde ho nepočítá znovu.
   */
  const reorderInputRow = useCallback(
    (fromRawKey: string, toRowKey: string) => {
      const activeKeys = inputRows
        .filter((row) => row.state === "active")
        .map((row) => row.rawKey);
      const toIndex = resolveActiveDropIndex(inputRows, toRowKey);
      const nextOrder = moveInputRow(activeKeys, fromRawKey, toIndex);
      setState((current) => {
        if (current.kind !== "ready") return current;
        return {
          ...current,
          snapshot: { ...current.snapshot, inputOrder: nextOrder },
        };
      });
    },
    [inputRows],
  );

  /** Jméno muzikanta pro panel (R2) — `setupData.members` je jediné místo, které už drží zobrazitelné jméno pro dané id. */
  const musicianNameById = useMemo(() => {
    const byId = new Map<string, string>();
    for (const members of Object.values(setupData?.members ?? {})) {
      for (const member of members) byId.set(member.id, member.name);
    }
    return byId;
  }, [setupData]);

  /**
   * Obsazené sloty lineupu, nabízené jako vlastník v kroku 1 pickeru (R4).
   * Talkback záměrně chybí — nemá vlastní slot v lineupu, přes který by šlo
   * zapsat patch. Stejný zdroj (`normalizeLineupSlots` nad `roleOrder`) jako
   * `buildSlotKeyIndex`, takže vlastník tady a `slotKeysByOwner` se nikdy
   * nerozejdou v tom, kdo je „obsazený".
   *
   * Role `drums` a `vocs` taky chybí (task 13b) — kanál z pickeru vždy nese
   * `group` shodnou s vlastníkovou lineup rolí (`GROUP_INPUT_LIBRARY[role]`),
   * takže `resolveInputRowEditability({ownerRole: role, group: role})`
   * odpovídá na stejnou otázku jako u existujícího řádku: `drums` `add`
   * zahodí `resolveEffectiveProjectSetup` beze stopy, `vocs` `add` vyrobí
   * trvalý needitovatelný osiřelý řádek, který se přesto vytiskne
   * (ověřeno `.superpowers/sdd/2026-08-17-inputs-screen/drums-vocals-patch-reach-verification.md`).
   */
  const ownerOptions = useMemo<AddInputOwnerOption[]>(() => {
    const options: AddInputOwnerOption[] = [];
    for (const role of CANONICAL_LINEUP_ROLE_ORDER) {
      if (!resolveInputRowEditability({ ownerRole: role, group: role }).canEdit)
        continue;
      const slots = normalizeLineupSlots(lineup[role], getRoleSlotLimit(role));
      for (const slot of slots) {
        options.push({
          role,
          musicianId: slot.musicianId,
          name: musicianNameById.get(slot.musicianId) ?? "Unknown musician",
        });
      }
    }
    return options;
  }, [lineup, musicianNameById]);

  /**
   * Kanály `GROUP_INPUT_LIBRARY[role]`, které vybraný vlastník ještě nemá
   * (krok 2 pickeru, R4) — porovnává se s **efektivním** presetem slotu
   * (patch + default), ne se statickým katalogem, jinak by se nabízel kanál,
   * který vlastník má z výchozích presetů nebo z dřívějšího přidání.
   */
  const getAvailableChannelsForOwner = useCallback(
    (owner: AddInputOwnerOption): InputChannel[] => {
      const slotKey = slotKeysByOwner.get(`${owner.role}:${owner.musicianId}`);
      const patch = slotKey
        ? getSlotOverride(lineup, owner.role, parseSlotIndex(slotKey))
        : undefined;
      const { effective } = setupForSlot(owner.role, owner.musicianId, patch);
      const activeKeys = new Set(effective.inputs.map((input) => input.key));
      return (GROUP_INPUT_LIBRARY[owner.role] ?? []).filter(
        (input) => !activeKeys.has(input.key),
      );
    },
    [lineup, setupForSlot, slotKeysByOwner],
  );

  const ownerChannelCount = selectedRow
    ? inputRows.filter(
        (row) =>
          row.state === "active" &&
          row.ownerMusicianId === selectedRow.ownerMusicianId &&
          row.ownerRole === selectedRow.ownerRole,
      ).length
    : 0;

  const ownerDeviationCount = useMemo(() => {
    if (!selectedRow || !selectedRow.slotKey) return 0;
    const patch = getSlotOverride(
      lineup,
      selectedRow.ownerRole,
      parseSlotIndex(selectedRow.slotKey),
    );
    return countPatchDeviations(patch);
  }, [selectedRow, lineup]);

  /**
   * Jestli má smysl `Save as musician default` (R5) — na rozdíl od
   * `ownerDeviationCount` (počet polí v patchi) porovnává **hodnoty**: patch
   * se strukturou, který se přesně vrátí zpátky k defaultu, by jinak nechal
   * tlačítko aktivní, přestože by nebylo co povyšovat. Stejná podmínka jako
   * `canUpdateMusicianDefault` v `ProjectSetupPage.tsx` (~ř. 1991):
   * `!areSetupsEqual(effective, musicianDefaultPreset)`.
   */
  const canSaveAsMusicianDefault = useMemo(() => {
    if (!selectedRow || !selectedRow.slotKey) return false;
    const patch = getSlotOverride(
      lineup,
      selectedRow.ownerRole,
      parseSlotIndex(selectedRow.slotKey),
    );
    const { effective } = setupForSlot(
      selectedRow.ownerRole,
      selectedRow.ownerMusicianId,
      patch,
    );
    const musicianDefault = defaultPresetFor(
      selectedRow.ownerRole,
      selectedRow.ownerMusicianId,
    );
    return !areSetupsEqual(effective, musicianDefault);
  }, [selectedRow, lineup, setupForSlot, defaultPresetFor]);

  /**
   * Skladba bicí soupravy vybraného řádku (R5, task 16) — vstup pro
   * `DrumsPartsEditor` v modálu `Edit kit`. Zrcadlí `ProjectSetupPage.tsx`'s
   * `drumSetup` (~ř. 1980-1989): slotový `drumDefinition`, jinak muzikantův
   * `drum_setup` preset item, jinak deterministický default —
   * `resolveDrumsSetupDefinition` řeší přesně tuhle prioritu. `null`, dokud
   * vybraný řádek nepatří bicímu vlastníkovi se slotem, takže modál nemá co
   * ukázat.
   */
  const selectedDrumSetup = useMemo(() => {
    if (
      !selectedRow ||
      selectedRow.ownerRole !== "drums" ||
      !selectedRow.slotKey
    ) {
      return null;
    }
    const role = selectedRow.ownerRole;
    const slots = normalizeLineupSlots(lineup[role], getRoleSlotLimit(role));
    const slot = slots[parseSlotIndex(selectedRow.slotKey)];
    return resolveDrumsSetupDefinition({
      slotDrumDefinition: slot?.drumDefinition,
      musicianPresetItems:
        setupData?.musicianPresetsById?.[selectedRow.ownerMusicianId],
    });
  }, [selectedRow, lineup, setupData]);

  /**
   * Zapíše přejmenování/poznámku vybraného řádku do patche jeho slotu (R6).
   * Adresuje se přes `row.rawKey` (skutečný klíč kanálu), nikdy přes
   * `row.key` (opaque identita, u vypnutého řádku jmenný prostor vlastníka —
   * viz doc komentář `InputEditorRow.key`). Prázdný `slotKey` znamená, že
   * vlastník není v `project.lineup`, takže není kam patch zapsat.
   */
  const applyRowChange = useCallback(
    (row: InputEditorRow, change: { label?: string; note?: string }) => {
      if (!row.slotKey) return;
      const role = row.ownerRole;
      const slotIndex = parseSlotIndex(row.slotKey);
      setState((current) => {
        if (current.kind !== "ready") return current;
        const slots = normalizeLineupSlots(
          current.snapshot.lineup[role],
          getRoleSlotLimit(role),
        );
        const currentPatch = slots[slotIndex]?.presetOverride;
        const nextPatch = updateInputRow(currentPatch, {
          key: row.rawKey,
          ...change,
        });
        const nextLineup = replaceSlotOverride(
          current.snapshot.lineup,
          role,
          slotIndex,
          nextPatch,
        );
        return {
          ...current,
          snapshot: { ...current.snapshot, lineup: nextLineup },
        };
      });
    },
    [],
  );

  /**
   * Zapíše `presetOverride.monitoring` vybraného slotu monitoru (R7) —
   * `MonitoringEditor` vždy posílá kompletní další patch (spread stávajícího
   * plus novou hodnotu monitoringu), takže se tu jen zapisuje beze změny
   * tvaru, stejně jako `applyRowChange` dělá pro kanály. Volající
   * (`MonitorRowInspector`) tohle nikdy nezavolá pro needitovatelný slot
   * (`resolveMonitorRowEditability`), ale prázdný `slotKey` se přesto hlídá
   * defenzivně, stejně jako všude jinde na téhle stránce.
   */
  const applyMonitorPatch = useCallback(
    (row: MonitorEditorRow, nextPatch: PresetOverridePatch) => {
      if (!row.slotKey) return;
      const role = row.ownerRole;
      const slotIndex = parseSlotIndex(row.slotKey);
      setState((current) => {
        if (current.kind !== "ready") return current;
        const nextLineup = replaceSlotOverride(
          current.snapshot.lineup,
          role,
          slotIndex,
          nextPatch,
        );
        return {
          ...current,
          snapshot: { ...current.snapshot, lineup: nextLineup },
        };
      });
    },
    [],
  );

  /**
   * Vypnutí kanálu z panelu (R3) — adresuje se přes `row.rawKey`, stejně jako
   * `applyRowChange`. Prázdný `slotKey` znamená totéž: vlastník bez slotu
   * v lineupu, není kam patch zapsat.
   */
  const removeSelectedRow = useCallback((row: InputEditorRow) => {
    if (!row.slotKey) return;
    const role = row.ownerRole;
    const slotIndex = parseSlotIndex(row.slotKey);
    setState((current) => {
      if (current.kind !== "ready") return current;
      const slots = normalizeLineupSlots(
        current.snapshot.lineup[role],
        getRoleSlotLimit(role),
      );
      const currentPatch = slots[slotIndex]?.presetOverride;
      const nextPatch = removeInputRow(currentPatch, row.rawKey);
      const nextLineup = replaceSlotOverride(
        current.snapshot.lineup,
        role,
        slotIndex,
        nextPatch,
      );
      return {
        ...current,
        snapshot: { ...current.snapshot, lineup: nextLineup },
      };
    });
  }, []);

  /** Vrácení vypnutého kanálu z panelu (R3) — zrcadlí `removeSelectedRow`. */
  const restoreSelectedRow = useCallback((row: InputEditorRow) => {
    if (!row.slotKey) return;
    const role = row.ownerRole;
    const slotIndex = parseSlotIndex(row.slotKey);
    setState((current) => {
      if (current.kind !== "ready") return current;
      const slots = normalizeLineupSlots(
        current.snapshot.lineup[role],
        getRoleSlotLimit(role),
      );
      const currentPatch = slots[slotIndex]?.presetOverride;
      const nextPatch = restoreInputRow(currentPatch, row.rawKey);
      const nextLineup = replaceSlotOverride(
        current.snapshot.lineup,
        role,
        slotIndex,
        nextPatch,
      );
      return {
        ...current,
        snapshot: { ...current.snapshot, lineup: nextLineup },
      };
    });
  }, []);

  /** Zahodí celý `presetOverride` vlastníkova slotu (owner action v panelu, R2) — ne jen jednu vlastnost. */
  const resetOwnerToDefault = useCallback((row: InputEditorRow) => {
    if (!row.slotKey) return;
    const role = row.ownerRole;
    const slotIndex = parseSlotIndex(row.slotKey);
    setState((current) => {
      if (current.kind !== "ready") return current;
      const nextLineup = replaceSlotOverride(
        current.snapshot.lineup,
        role,
        slotIndex,
        undefined,
      );
      return {
        ...current,
        snapshot: { ...current.snapshot, lineup: nextLineup },
      };
    });
  }, []);

  /**
   * Zapíše skladbu bicí soupravy z modálu `Edit kit` (R5, task 16) — jen
   * `lineup.drums[i].drumDefinition`, žádný doprovodný `presetOverride`
   * patch (Ruling 1, viz doc komentář `replaceSlotDrumDefinition`). Prázdný
   * `slotKey` znamená totéž, co všude jinde na téhle stránce: vlastník bez
   * slotu v lineupu, není kam zapsat.
   */
  const applyDrumKitChange = useCallback(
    (row: InputEditorRow, nextSetup: DrumDefinition) => {
      if (!row.slotKey) return;
      const role = row.ownerRole;
      const slotIndex = parseSlotIndex(row.slotKey);
      setState((current) => {
        if (current.kind !== "ready") return current;
        const nextLineup = replaceSlotDrumDefinition(
          current.snapshot.lineup,
          role,
          slotIndex,
          nextSetup,
        );
        return {
          ...current,
          snapshot: { ...current.snapshot, lineup: nextLineup },
        };
      });
    },
    [],
  );

  /**
   * Přidá kanál z pickeru (R4) do slotu zvoleného vlastníka a picker zavře.
   * Vlastník je vybraný z `ownerOptions`, takže má vždy `role` i `musicianId`
   * — jen jeho `slotKey` může chybět, pokud mezitím zmizel z lineupu.
   */
  const addChannelToOwner = useCallback(
    (owner: AddInputOwnerOption, input: InputChannel) => {
      const slotKey = slotKeysByOwner.get(`${owner.role}:${owner.musicianId}`);
      if (!slotKey) return;
      const slotIndex = parseSlotIndex(slotKey);
      setState((current) => {
        if (current.kind !== "ready") return current;
        const slots = normalizeLineupSlots(
          current.snapshot.lineup[owner.role],
          getRoleSlotLimit(owner.role),
        );
        const currentPatch = slots[slotIndex]?.presetOverride;
        const nextPatch = addInputRow(currentPatch, input);
        const nextLineup = replaceSlotOverride(
          current.snapshot.lineup,
          owner.role,
          slotIndex,
          nextPatch,
        );
        return {
          ...current,
          snapshot: { ...current.snapshot, lineup: nextLineup },
        };
      });
      setShowAddInputPicker(false);
    },
    [slotKeysByOwner],
  );

  /**
   * Povýší efektivní preset vybraného vlastníka na jeho trvalý default (R5,
   * Task 12b) — kanály z tohoto slotu tak nastartují každý příští projekt,
   * ne jen tenhle. `effective` se počítá stejně jako v `ProjectSetupPage.tsx`
   * (setup modál na obrazovce `01`): `setupForSlot` nad aktuálním patchem
   * slotu. Payload skládá `buildMusicianDefaultPayload` (testováno přímo) —
   * ta funkce patch vůbec nepřijímá, takže poslat ho omylem místo efektivního
   * presetu nejde. Mění data sdílená napříč projekty, proto se volá až po
   * potvrzení v modálu níž, a chybu nikdy nepolyká — jde přes existující
   * chybový kanál stránky (`notify`).
   */
  const saveSelectedRowAsMusicianDefault = useCallback(
    async (row: InputEditorRow) => {
      if (!row.slotKey) return;
      const role = row.ownerRole;
      const musicianId = row.ownerMusicianId;
      const patch = getSlotOverride(lineup, role, parseSlotIndex(row.slotKey));
      const { effective } = setupForSlot(role, musicianId, patch);
      const payload = buildMusicianDefaultPayload({
        ownerMusicianId: musicianId,
        ownerRole: role,
        effectivePreset: effective,
      });
      setIsSavingMusicianDefault(true);
      try {
        await updateMusicianDefaults(payload);
        setSetupData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            musicianDefaults: {
              ...(prev.musicianDefaults ?? {}),
              [musicianDefaultsKey(payload.musicianId, payload.role)]:
                payload.setup,
            },
          };
        });
        notify("success", "Musician defaults updated.");
        setShowSaveMusicianDefaultConfirmation(false);
      } catch (error) {
        console.error("[project-inputs] failed to update musician defaults", {
          projectId: id,
          musicianId,
          role,
          error,
        });
        notify("error", "Musician defaults could not be updated.");
      } finally {
        setIsSavingMusicianDefault(false);
      }
    },
    [lineup, setupForSlot, notify, id],
  );

  const saveSnapshot = useCallback(
    async (snapshot: InputsEditorSnapshot, project: NewProjectPayload) => {
      setIsSaving(true);
      try {
        await saveProjectPayload({
          projectId: project.id,
          payload: {
            ...project,
            inputOrder: snapshot.inputOrder,
            notes: snapshot.notes,
            lineup: snapshot.lineup,
          },
          // Ruční pořadí a poznámky jsou obsah rideru, ne kosmetika.
          intent: "content",
        });
        initialSnapshotRef.current = snapshot;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (state.kind !== "ready") return;
    const { project, snapshot } = state;
    registerNavigationGuard({
      isDirty: () =>
        isInputsDirty(
          initialSnapshotRef.current ?? EMPTY_INPUTS_SNAPSHOT,
          snapshot,
        ),
      save: () => saveSnapshot(snapshot, project),
      discard: () => {
        const initial = initialSnapshotRef.current;
        if (initial)
          setState((current) =>
            current.kind === "ready"
              ? { ...current, snapshot: initial }
              : current,
          );
      },
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, saveSnapshot, state]);

  /**
   * Na rozdíl od `StagePlanEditorPage` se tělo nezavírá za `loading`/`error` —
   * tři sekce jsou v tomto tasku prázdné hlavičky, které na data nečekají.
   * Uzavřít je za `ready` by je schovalo i tady, kde nic nenačítají.
   */
  const isDirty =
    state.kind === "ready" &&
    isInputsDirty(
      initialSnapshotRef.current ?? EMPTY_INPUTS_SNAPSHOT,
      state.snapshot,
    );

  const ownerName = selectedRow
    ? (musicianNameById.get(selectedRow.ownerMusicianId) ?? "Unknown musician")
    : "";

  const monitorOwnerName = selectedMonitorRow
    ? (musicianNameById.get(selectedMonitorRow.ownerMusicianId) ??
      "Unknown musician")
    : "";

  const saveMusicianDefaultModalRef = useModalBehavior(
    showSaveMusicianDefaultConfirmation && Boolean(selectedRow?.slotKey),
    () => setShowSaveMusicianDefaultConfirmation(false),
  );

  const isEditKitModalOpen = showEditKitModal && Boolean(selectedDrumSetup);
  const editKitModalRef = useModalBehavior(isEditKitModalOpen, () =>
    setShowEditKitModal(false),
  );

  return (
    <section className="panel panel--inputs">
      <div className="panel__header">
        <h2>Inputs</h2>
      </div>
      {state.kind === "error" ? (
        <div className="status status--error" role="alert">
          {state.message}
        </div>
      ) : null}
      {documentResult.kind === "error" ? (
        <div className="status status--error" role="alert">
          {documentResult.message}
        </div>
      ) : null}
      <div className="inputsBody">
        <div className="inputsBody__main">
          <section className="inputsSection" aria-label="Input list">
            <h2 className="inputsSectionTitle">INPUT LIST</h2>
            <InputTable
              rows={inputRows}
              selectedKey={selectedInputKey}
              onSelect={selectChannelRow}
              onReorder={reorderInputRow}
            />
            <button
              type="button"
              className="button-secondary"
              disabled={state.kind !== "ready"}
              onClick={() => setShowAddInputPicker(true)}
            >
              + Add input
            </button>
          </section>
          <section className="inputsSection" aria-label="Monitors">
            <h2 className="inputsSectionTitle">MONITORS</h2>
            {overrideValidation.errors.length > 0 ? (
              <div className="status status--error" role="alert">
                {overrideValidation.errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : null}
            {overrideValidation.warnings.length > 0 ? (
              <div className="status status--warning" aria-live="polite">
                {overrideValidation.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
            <MonitorTable
              rows={monitorRows}
              selectedSlotKey={selectedMonitorSlotKey}
              onSelect={selectMonitorRow}
            />
          </section>
          <section className="inputsSection" aria-label="Notes">
            <h2 className="inputsSectionTitle">NOTES</h2>
          </section>
        </div>
        {selectedMonitorSlotKey ? (
          <MonitorRowInspector
            row={selectedMonitorRow}
            ownerName={monitorOwnerName}
            monitors={monitorEntities}
            effectiveMonitoring={
              selectedMonitorSetup?.effective.monitoring ?? null
            }
            diffMeta={selectedMonitorSetup?.resolved.diffMeta ?? null}
            patch={selectedMonitorPatch}
            onChangePatch={(nextPatch) =>
              selectedMonitorRow &&
              applyMonitorPatch(selectedMonitorRow, nextPatch)
            }
          />
        ) : (
          <InputRowInspector
            row={selectedRow}
            ownerName={ownerName}
            channelCount={ownerChannelCount}
            deviationCount={ownerDeviationCount}
            canSaveAsMusicianDefault={canSaveAsMusicianDefault}
            onLabelChange={(label) =>
              selectedRow && applyRowChange(selectedRow, { label })
            }
            onNoteChange={(note) =>
              selectedRow && applyRowChange(selectedRow, { note })
            }
            onResetToDefault={() =>
              selectedRow && resetOwnerToDefault(selectedRow)
            }
            onSaveAsMusicianDefault={() =>
              setShowSaveMusicianDefaultConfirmation(true)
            }
            onRemoveChannel={() =>
              selectedRow && removeSelectedRow(selectedRow)
            }
            onRestoreChannel={() =>
              selectedRow && restoreSelectedRow(selectedRow)
            }
            onEditKit={() => setShowEditKitModal(true)}
          />
        )}
      </div>
      <div className="setup-action-bar setup-action-bar--equal">
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            const target = previousStepPath("inputs", id);
            if (target) navigate(target);
          }}
        >
          Back to Lineup
        </button>
        <button
          type="button"
          className="button-primary"
          disabled={isSaving || state.kind !== "ready"}
          onClick={async () => {
            if (state.kind !== "ready") return;
            if (isDirty) {
              try {
                await saveSnapshot(state.snapshot, state.project);
              } catch (error) {
                console.error("[project-inputs] failed to save", {
                  projectId: id,
                  error,
                });
                notify("error", "Inputs could not be saved.");
                return;
              }
              notify("success", "Inputs saved.");
            }
            const target = nextStepPath("inputs", id);
            if (target) navigate(target);
          }}
        >
          {state.kind === "loading"
            ? "Loading…"
            : state.kind === "error"
              ? "Unavailable"
              : isDirty
                ? "Save & Continue"
                : "Continue"}
        </button>
      </div>

      <ModalOverlay
        open={
          showSaveMusicianDefaultConfirmation && Boolean(selectedRow?.slotKey)
        }
        onClose={() => setShowSaveMusicianDefaultConfirmation(false)}
      >
        <div
          className="selector-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-musician-default-title"
          aria-describedby="save-musician-default-body"
          ref={saveMusicianDefaultModalRef}
        >
          <div className="panel__header panel__header--stack selector-dialog__title">
            <h3 id="save-musician-default-title">Save as musician default?</h3>
            <p id="save-musician-default-body" className="subtle">
              {`You are about to update default setup for: ${ownerName}.`}
            </p>
            <p className="subtle">
              This will affect all future projects and all bands.
            </p>
            <p className="subtle">This does not change the band defaults.</p>
          </div>
          <div className="selector-dialog__divider section-divider" />
          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setShowSaveMusicianDefaultConfirmation(false)}
              disabled={isSavingMusicianDefault}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={() =>
                selectedRow && saveSelectedRowAsMusicianDefault(selectedRow)
              }
              disabled={isSavingMusicianDefault}
            >
              Save default
            </button>
          </div>
        </div>
      </ModalOverlay>

      <AddInputPicker
        open={showAddInputPicker}
        owners={ownerOptions}
        getAvailableChannels={getAvailableChannelsForOwner}
        onCancel={() => setShowAddInputPicker(false)}
        onAdd={addChannelToOwner}
      />

      <ModalOverlay
        open={isEditKitModalOpen}
        onClose={() => setShowEditKitModal(false)}
      >
        <div
          className="selector-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-kit-title"
          ref={editKitModalRef}
        >
          <div className="panel__header panel__header--stack selector-dialog__title">
            <h3 id="edit-kit-title">Edit kit</h3>
          </div>
          <div className="selector-dialog__divider section-divider" />
          <div className="selector-dialog__body">
            {selectedRow && selectedDrumSetup ? (
              <DrumsPartsEditor
                setup={selectedDrumSetup}
                onChange={(nextSetup) =>
                  applyDrumKitChange(selectedRow, nextSetup)
                }
              />
            ) : null}
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setShowEditKitModal(false)}
            >
              Done
            </button>
          </div>
        </div>
      </ModalOverlay>
    </section>
  );
}
