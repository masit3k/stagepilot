import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModalOverlay, useModalBehavior } from "../../components/ui/Modal";
import {
  type LineupMap,
  type LineupSlotValue,
  type PresetOverridePatch,
  getUniqueSelectedMusicians,
  getRoleDisplayName,
  normalizeLineupSlots,
  normalizeLineupValue,
  getRoleSlotLimit,
  resolveBandLeaderId,
  resolveTalkbackOwnerId,
  validateLineup,
} from "../../projectRules";
import {
  summarizeEffectivePresetValidation,
  validateEffectivePresets,
  normalizeSetupOverridePatch,
} from "../../../../../src/domain/rules/presetOverride";
import type { Group } from "../../../../../src/domain/model/groups";
import type {
  InputChannel,
  Musician,
  MusicianSetupPreset,
  PresetEntity,
  PresetItem,
} from "../../../../../src/domain/model/types";
import { resolveEffectiveMusicianSetup } from "../../../../../src/domain/setup/resolveEffectiveMusicianSetup";
import { createDefaultDrumDefinition, parseDrumDefinition } from "../../../../../src/domain/drums/drumDefinition";
import { resolveDrumInputs } from "../../../../../src/domain/drums/resolveDrumInputs";
import {
  MusicianSelector,
  type SetupMusicianItem,
} from "../../components/setup/MusicianSelector";
import { SelectedInputsList } from "../../components/setup/SelectedInputsList";
import { DrumsPartsEditor } from "../../components/setup/DrumsPartsEditor";
import { MonitoringEditor } from "../../components/setup/MonitoringEditor";
import { SetupModalShell } from "../components/setup/SetupModalShell";
import { SetupSection } from "../components/setup/SetupSection";
import { SchemaRenderer } from "../components/setup/SchemaRenderer";
import { migrateProjectLineupVocsToLeadBack } from "../domain/project/migrateProjectLineup";
import { migrateProjectTalkbackOwner } from "../domain/project/migrateProjectTalkbackOwner";
import {
  createLineupDirtyBaseline,
  hasUnsavedLineupChanges,
  type LineupDirtyComparisonState,
} from "../domain/ui/isLineupSetupDirty";
import {
  areSetupsEqual,
  resetOverrides,
  shouldEnableSetupReset,
  withInputsTarget,
  type EventSetupEditState,
} from "../components/setup/adapters/eventSetupAdapter";
import { BackVocsBlock } from "../components/roles/BackVocsBlock";
import { ChangeBackVocsModal } from "../components/roles/modals/ChangeBackVocsModal";
import { BackVocsSetupModal } from "../components/roles/modals/BackVocsSetupModal";
import {
  getBackVocalCandidatesFromTemplate,
  getBackVocsFromTemplate,
  getLeadVocsFromTemplate,
  getTalkbackOwnersFromTemplate,
  sanitizeBackVocsSelection,
} from "../components/roles/utils/backVocs";
import { withFrom } from "../shell/routes";
import * as projectsApi from "../services/projectsApi";
import type {
  BandSetupData,
  MemberOption,
  NewProjectPayload,
} from "../shell/types";
import { toPersistableProject } from "../shell/types";
import { serializeLineupForProject } from "../shell/lineupSerialize";
import type { ProjectRouteProps } from "./shared/pageTypes";
import {
  buildSetupFieldCatalog,
  buildVisibleLineupSections,
  GROUP_INPUT_LIBRARY,
  ROLE_ORDER,
  buildInputsPatchFromTarget,
  createFallbackSetupData,
  getGroupDefaultPreset,
  resolveMusicianDefaultSetupForRole,
  resolveSetupCardLabel,
} from "./shared/setupConstants";
import {
  resolveInputsForCapabilitySection,
  resolveMusicianCapabilityInputs,
  supportsCapabilitySection,
  type SetupCapabilitySection,
} from "../../../../../src/domain/lineup/resolveLineupInstrumentMembership";
import {
  resolveDistinctInstrumentLabels,
  resolveEffectiveInstrumentGroups,
} from "../../../../../src/domain/lineup/effectiveInstrumentGroups";
import { resolveMusicianDisplayName } from "../domain/ui/musicianDisplayName";
import { composeSetupModalTitle } from "../domain/ui/setupModalTitle";

export function ProjectSetupPage({
  id,
  navigate,
  registerNavigationGuard,
  search = "",
}: ProjectRouteProps) {
  const [project, setProject] = useState<NewProjectPayload | null>(null);
  const [setupData, setSetupData] = useState<BandSetupData | null>(null);
  const presetCatalog = setupData?.presetCatalog ?? {};
  const {
    bassFields: BASS_FIELDS,
    guitarFields: GUITAR_FIELDS,
    keysFields: KEYS_FIELDS,
    leadVocsFields: LEAD_VOCS_FIELDS,
  } = useMemo(() => buildSetupFieldCatalog(presetCatalog), [presetCatalog]);
  const [lineup, setLineup] = useState<LineupMap>({});
  const [editing, setEditing] = useState<{
    role: string;
    slotIndex: number;
    currentSelectedId?: string;
  } | null>(null);
  const [editingSetup, setEditingSetup] = useState<{
    role: string;
    slotIndex: number;
    musicianId: string;
  } | null>(null);
  const [setupDraftBySlot, setSetupDraftBySlot] = useState<
    Record<string, PresetOverridePatch | undefined>
  >({});
  const [selectedSetupSlotKey, setSelectedSetupSlotKey] = useState("");
  const [bandLeaderId, setBandLeaderId] = useState("");
  const [talkbackOwnerId, setTalkbackOwnerId] = useState("");
  const [hasTalkbackOverride, setHasTalkbackOverride] = useState(false);
  const [backVocalIds, setBackVocalIds] = useState<string[]>([]);
  const [hasBackVocalOverride, setHasBackVocalOverride] = useState(false);
  const [isBackVocsModalOpen, setIsBackVocsModalOpen] = useState(false);
  const [isBackVocsSetupOpen, setIsBackVocsSetupOpen] = useState(false);
  const [backVocsSetupDraft, setBackVocsSetupDraft] = useState<
    Record<string, PresetOverridePatch | undefined>
  >({});
  const [status, setStatus] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [
    showUpdateMusicianDefaultsConfirmation,
    setShowUpdateMusicianDefaultsConfirmation,
  ] = useState(false);
  const [isUpdatingMusicianDefaults, setIsUpdatingMusicianDefaults] =
    useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const initialSnapshotRef = useRef<LineupDirtyComparisonState | null>(null);
  const snapshotHydratedRef = useRef(false);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = window.setTimeout(() => setToastMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const buildSetupSnapshot = useCallback(
    (
      nextLineup: LineupMap,
      data: BandSetupData,
      storedLeader?: string,
      storedTalkback?: string,
    ) => {
      const selected = getUniqueSelectedMusicians(
        nextLineup,
        ROLE_ORDER,
      );
      const resolvedLeader = resolveBandLeaderId({
        selectedMusicianIds: selected,
        storedBandLeaderId: storedLeader,
        bandLeaderId: data.bandLeader,
        defaultContactId: data.defaultContactId,
      });
      const resolvedTalkback = resolveTalkbackOwnerId({
        selectedMusicianIds: selected,
        bandLeaderId: resolvedLeader,
        storedTalkbackOwnerId: storedTalkback,
      });
      return {
        lineup: nextLineup,
        bandLeaderId: resolvedLeader,
        talkbackOwnerId: resolvedTalkback,
      };
    },
    [],
  );

  const applyState = useCallback(
    (
      nextLineup: LineupMap,
      data: BandSetupData,
      storedLeader?: string,
      storedTalkback?: string,
    ) => {
      const snapshot = buildSetupSnapshot(
        nextLineup,
        data,
        storedLeader,
        storedTalkback,
      );
      setLineup(nextLineup);
      setBandLeaderId(snapshot.bandLeaderId);
      setTalkbackOwnerId((prev) =>
        hasTalkbackOverride ? prev : snapshot.talkbackOwnerId,
      );
    },
    [buildSetupSnapshot, hasTalkbackOverride],
  );

  useEffect(() => {
    snapshotHydratedRef.current = false;
    (async () => {
      const parsedRaw = JSON.parse(
        await invoke<string>("read_project", { projectId: id }),
      ) as NewProjectPayload;
      const parsed = migrateProjectTalkbackOwner(
        migrateProjectLineupVocsToLeadBack(parsedRaw),
      );
      const parsedHasTalkbackOverride = Object.prototype.hasOwnProperty.call(
        parsedRaw,
        "talkbackOwnerId",
      );
      const parsedTalkbackOwnerId =
        typeof parsed.talkbackOwnerId === "string"
          ? parsed.talkbackOwnerId.trim()
          : "";
      const parsedHasBackVocalOverride = Array.isArray((parsed.lineup ?? {}).back_vocs);
      setProject(parsed);
      const persistedBackVocalIds = normalizeLineupValue(
        (parsed.lineup ?? {}).back_vocs,
        8,
      );
      setBackVocalIds(persistedBackVocalIds);
      setHasBackVocalOverride(parsedHasBackVocalOverride);
      setHasTalkbackOverride(parsedHasTalkbackOverride);
      setTalkbackOwnerId(
        parsedHasTalkbackOverride ? parsedTalkbackOwnerId : "",
      );
      let data: BandSetupData;
      try {
        data = await invoke<BandSetupData>("get_band_setup_data", {
          bandId: parsed.bandRef,
        });
      } catch (error) {
        console.error("Failed to load band setup data", {
          projectId: id,
          bandRef: parsed.bandRef,
          error,
        });
        data = createFallbackSetupData(parsed);
        setStatus(
          "Band defaults could not be loaded. You can still configure lineup manually.",
        );
      }
      if (data.loadWarnings?.length) {
        console.warn("Band setup loaded with warnings", {
          projectId: id,
          bandRef: parsed.bandRef,
          warnings: data.loadWarnings,
        });
        setStatus(data.loadWarnings.join("\n"));
      }
      setSetupData(data);
      const hasStoredLineup = Boolean(
        parsed.lineup && Object.keys(parsed.lineup).length > 0,
      );
      const fallbackLineup = { ...(data.defaultLineup ?? {}) };
      if (!hasStoredLineup && !Object.keys(fallbackLineup).length) {
        console.error(
          "Band default lineup is empty during setup initialization",
          {
            projectId: id,
            bandRef: parsed.bandRef,
          },
        );
      }
      const initialLineup = {
        ...(hasStoredLineup ? parsed.lineup : fallbackLineup),
      };
      if (initialLineup.lead_vocs && !initialLineup.vocs) {
        initialLineup.vocs = initialLineup.lead_vocs;
      }
      delete initialLineup.lead_vocs;
      delete initialLineup.back_vocs;
      const initialState = buildSetupSnapshot(
        initialLineup,
        data,
        parsed.bandLeaderId,
        parsedHasTalkbackOverride ? parsedTalkbackOwnerId : undefined,
      );
      setLineup(initialLineup);
      setBandLeaderId(initialState.bandLeaderId);
      if (!hasStoredLineup) {
        const updatedProject: NewProjectPayload = {
          ...parsed,
          lineup: {
            ...serializeLineupForProject(
              initialState.lineup,
              ROLE_ORDER,
            ),
            ...(Array.isArray((parsed.lineup ?? {}).back_vocs)
              ? {
                  back_vocs: normalizeLineupValue(
                    (parsed.lineup ?? {}).back_vocs,
                    8,
                  ),
                }
              : {}),
          },
          bandLeaderId: initialState.bandLeaderId || undefined,
          ...(parsedHasTalkbackOverride
            ? { talkbackOwnerId: parsedTalkbackOwnerId }
            : {}),
          updatedAt: new Date().toISOString(),
        };
        await projectsApi.saveProject({
          projectId: id,
          json: JSON.stringify(toPersistableProject(updatedProject), null, 2),
        });
        setProject(updatedProject);
      }
      const initialSerializedLineup = serializeLineupForProject(
        initialState.lineup,
        ROLE_ORDER,
      );
      const initialTemplateMusicians = getUniqueSelectedMusicians(
        initialState.lineup,
        ROLE_ORDER,
      );
      const initialRoleByMusicianId = new Map<string, Group>();
      ROLE_ORDER.forEach((role) => {
        const roleSlotLimit = getRoleSlotLimit(role);
        normalizeLineupSlots(initialState.lineup[role], roleSlotLimit).forEach(
          (slot) => {
            initialRoleByMusicianId.set(slot.musicianId, role as Group);
          },
        );
      });
      const initialMusicians = initialTemplateMusicians.map((musicianId) => ({
        id: musicianId,
        firstName: "",
        lastName: "",
        group: initialRoleByMusicianId.get(musicianId) ?? "vocs",
        presets: (data.musicianPresetsById?.[musicianId] ?? []) as PresetItem[],
      }));
      const initialLeadVocalIds = getLeadVocsFromTemplate(initialMusicians);
      const effectiveBackVocalIds = parsedHasBackVocalOverride
        ? normalizeLineupValue((parsed.lineup ?? {}).back_vocs, 8)
        : Array.from(
            sanitizeBackVocsSelection(
              getBackVocsFromTemplate(initialMusicians),
              initialLeadVocalIds,
            ),
          ).sort((a, b) => a.localeCompare(b));
      initialSnapshotRef.current = createLineupDirtyBaseline({
        lineup: initialSerializedLineup,
        bandLeaderId: initialState.bandLeaderId,
        talkbackOwnerId: parsedHasTalkbackOverride
          ? parsedTalkbackOwnerId
          : (initialState.talkbackOwnerId ?? ""),
        backVocalIds: effectiveBackVocalIds,
        hasBackVocalOverride: parsedHasBackVocalOverride,
        hasTalkbackOverride: parsedHasTalkbackOverride,
      });
    })().catch((error) => {
      console.error("Failed to initialize setup page", {
        projectId: id,
        error,
      });
      setStatus("Failed to load setup.");
    });
  }, [id, applyState, buildSetupSnapshot]);

  const errors = useMemo(
    () =>
      !setupData
        ? []
        : validateLineup(
            lineup,
            ROLE_ORDER,
          ),
    [lineup, setupData],
  );
  const selectedMusicianIds = useMemo(
    () =>
      !setupData
        ? []
        : getUniqueSelectedMusicians(lineup, ROLE_ORDER),
    [lineup, setupData],
  );
  const selectedOptions = useMemo(() => {
    if (!setupData) return [] as MemberOption[];
    const byId = new Map<string, MemberOption>();
    Object.values(setupData.members)
      .flat()
      .forEach((m) => byId.set(m.id, m));
    return selectedMusicianIds
      .map((idValue) => byId.get(idValue))
      .filter(Boolean) as MemberOption[];
  }, [selectedMusicianIds, setupData]);
  const backVocalPresetRefs = useMemo(
    () =>
      ["vocal_back_no_mic", "vocal_back_wired", "vocal_back_wireless"]
        .map((ref) => presetCatalog[ref])
        .filter((preset): preset is PresetEntity => Boolean(preset))
        .filter(
          (preset): preset is Extract<PresetEntity, { type: "preset" }> =>
            preset.type === "preset",
        ),
    [presetCatalog],
  );

  const monitorOptions = useMemo(
    () =>
      Object.values(presetCatalog)
        .filter(
          (preset): preset is Extract<PresetEntity, { type: "monitor" }> =>
            preset.type === "monitor",
        )
        .map((preset) => ({ value: preset.id, label: preset.label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [presetCatalog],
  );
  const templateMusicians = selectedOptions;
  const templateMusicianIds = useMemo(
    () => new Set(templateMusicians.map((item) => item.id)),
    [templateMusicians],
  );
  const selectedTemplateMusicians = useMemo<Musician[]>(() => {
    if (!setupData) return [];

    const roleByMusicianId = new Map<string, Group>();
    ROLE_ORDER.forEach((role) => {
      const roleSlotLimit = getRoleSlotLimit(role);
      normalizeLineupSlots(lineup[role], roleSlotLimit).forEach((slot) => {
        roleByMusicianId.set(slot.musicianId, role as Group);
      });
    });

    return selectedMusicianIds.map((musicianId) => ({
      id: musicianId,
      firstName: "",
      lastName: "",
      group: roleByMusicianId.get(musicianId) ?? "vocs",
      presets: (setupData.musicianPresetsById?.[musicianId] ??
        []) as PresetItem[],
    }));
  }, [lineup, selectedMusicianIds, setupData]);
  const defaultTalkbackOwnerIds = useMemo(
    () =>
      Array.from(
        getTalkbackOwnersFromTemplate(selectedTemplateMusicians),
      ).filter((idValue) => templateMusicianIds.has(idValue)),
    [selectedTemplateMusicians, templateMusicianIds],
  );
  const talkbackCurrentOwnerId = hasTalkbackOverride
    ? talkbackOwnerId
    : (defaultTalkbackOwnerIds[0] ?? bandLeaderId);
  const leadVocalIds = useMemo(
    () => getLeadVocsFromTemplate(selectedTemplateMusicians),
    [selectedTemplateMusicians],
  );
  const defaultBackVocalIds = useMemo(
    () =>
      sanitizeBackVocsSelection(
        getBackVocsFromTemplate(selectedTemplateMusicians),
        leadVocalIds,
      ),
    [leadVocalIds, selectedTemplateMusicians],
  );
  const selectedBackVocalIds = useMemo(() => {
    const explicitSelectedIds = Array.from(
      sanitizeBackVocsSelection(new Set(backVocalIds), leadVocalIds),
    ).filter((idValue) => templateMusicianIds.has(idValue));

    if (hasBackVocalOverride) return explicitSelectedIds;

    return Array.from(defaultBackVocalIds).filter((idValue) =>
      templateMusicianIds.has(idValue),
    );
  }, [
    backVocalIds,
    defaultBackVocalIds,
    hasBackVocalOverride,
    leadVocalIds,
    templateMusicianIds,
  ]);
  const backVocalMembers = useMemo(
    () =>
      templateMusicians.filter((item) =>
        selectedBackVocalIds.includes(item.id),
      ),
    [selectedBackVocalIds, templateMusicians],
  );
  const hasSelectedBackVocs = selectedBackVocalIds.length > 0;
  const isBackVocsSetupDisabled = !hasSelectedBackVocs;

  const backVocalCandidateIds = useMemo(
    () =>
      new Set(
        getBackVocalCandidatesFromTemplate(selectedTemplateMusicians).map(
          (musician) => musician.id,
        ),
      ),
    [selectedTemplateMusicians],
  );
  const backVocalCandidates = useMemo(
    () =>
      templateMusicians.filter((item) => backVocalCandidateIds.has(item.id)),
    [backVocalCandidateIds, templateMusicians],
  );

  const serializedLineup = useMemo(() => {
    if (!setupData) return {} as LineupMap;
    return serializeLineupForProject(lineup, ROLE_ORDER);
  }, [lineup, setupData]);
  const defaultSelectedBackVocalIds = useMemo(() => {
    if (!setupData) return [] as string[];
    const defaultLineup = { ...(setupData.defaultLineup ?? {}) };
    const selectedIds = getUniqueSelectedMusicians(
      defaultLineup,
      ROLE_ORDER,
    );
    const roleByMusicianId = new Map<string, Group>();
    ROLE_ORDER.forEach((role) => {
      const roleSlotLimit = getRoleSlotLimit(role);
      normalizeLineupSlots(defaultLineup[role], roleSlotLimit).forEach(
        (slot) => {
          roleByMusicianId.set(slot.musicianId, role as Group);
        },
      );
    });
    const musicians = selectedIds.map((musicianId) => ({
      id: musicianId,
      firstName: "",
      lastName: "",
      group: roleByMusicianId.get(musicianId) ?? "vocs",
      presets: (setupData.musicianPresetsById?.[musicianId] ??
        []) as PresetItem[],
    }));
    const leadIds = getLeadVocsFromTemplate(musicians);
    return Array.from(
      sanitizeBackVocsSelection(getBackVocsFromTemplate(musicians), leadIds),
    ).sort((a, b) => a.localeCompare(b));
  }, [setupData]);

  const currentSnapshot = JSON.stringify({
    lineup: serializedLineup,
    bandLeaderId,
    talkbackOwnerId: talkbackCurrentOwnerId,
    hasTalkbackOverride,
    backVocalIds: [...selectedBackVocalIds].sort((a, b) => a.localeCompare(b)),
    hasBackVocalOverride,
  });
  const defaultSnapshot = useMemo(() => {
    if (!setupData) return "";
    const defaults = buildSetupSnapshot(
      { ...(setupData.defaultLineup ?? {}) },
      setupData,
    );
    return JSON.stringify({
      ...defaults,
      lineup: serializeLineupForProject(
        defaults.lineup,
        ROLE_ORDER,
      ),
      backVocalIds: defaultSelectedBackVocalIds,
      hasBackVocalOverride: false,
      hasTalkbackOverride: false,
    });
  }, [defaultSelectedBackVocalIds, setupData, buildSetupSnapshot]);
  const currentDirtyState = useMemo<LineupDirtyComparisonState>(
    () => ({
      lineup: serializedLineup,
      bandLeaderId,
      talkbackOwnerId: talkbackCurrentOwnerId,
      backVocalIds: selectedBackVocalIds,
      hasBackVocalOverride,
      hasTalkbackOverride,
    }),
    [
      bandLeaderId,
      hasBackVocalOverride,
      hasTalkbackOverride,
      selectedBackVocalIds,
      serializedLineup,
      talkbackCurrentOwnerId,
    ],
  );
  const isDirty = Boolean(
    project &&
      hasUnsavedLineupChanges({
        baseline:
          initialSnapshotRef.current ??
          createLineupDirtyBaseline({
            lineup: {},
            bandLeaderId: "",
            talkbackOwnerId: "",
            backVocalIds: [],
            hasBackVocalOverride: false,
            hasTalkbackOverride: false,
          }),
        current: currentDirtyState,
      }),
  );

  useEffect(() => {
    if (!project || !setupData || snapshotHydratedRef.current) return;
    initialSnapshotRef.current = createLineupDirtyBaseline(currentDirtyState);
    snapshotHydratedRef.current = true;
  }, [currentDirtyState, project, setupData]);

  async function persistProject(next?: Partial<NewProjectPayload>) {
    if (!project) return;
    const payload: NewProjectPayload = {
      ...project,
      lineup: {
        ...serializedLineup,
        ...(hasBackVocalOverride
          ? { back_vocs: [...selectedBackVocalIds] }
          : {}),
      },
      bandLeaderId,
      ...(hasTalkbackOverride
        ? { talkbackOwnerId: talkbackCurrentOwnerId }
        : {}),
      ...next,
    };
    await projectsApi.saveProject({
      projectId: id,
      json: JSON.stringify(toPersistableProject(payload), null, 2),
    });
    setProject(payload);
    initialSnapshotRef.current = createLineupDirtyBaseline({
      lineup: serializeLineupForProject(
        payload.lineup ?? {},
        ROLE_ORDER,
      ),
      bandLeaderId: payload.bandLeaderId ?? "",
      talkbackOwnerId: hasTalkbackOverride
        ? (payload.talkbackOwnerId ?? "")
        : (payload.bandLeaderId ?? ""),
      hasTalkbackOverride,
      backVocalIds: [...selectedBackVocalIds],
      hasBackVocalOverride,
    });
    snapshotHydratedRef.current = true;
  }

  async function saveLineupAndExit() {
    await persistProject();
  }

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () => !isCommitting && isDirty,
      save: saveLineupAndExit,
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty, isCommitting, saveLineupAndExit]);

  function setRoleSlots(role: string, slots: LineupSlotValue[]) {
    if (!setupData) return;
    const roleSlotLimit = getRoleSlotLimit(role);
    const compact = slots.filter((slot) => Boolean(slot.musicianId));
    const value = roleSlotLimit <= 1 ? compact[0] : compact;
    const nextLineup = { ...lineup, [role]: value as LineupMap[string] };
    applyState(nextLineup, setupData, bandLeaderId, talkbackOwnerId);
  }

  function updateSlot(role: string, slotIndex: number, musicianId: string) {
    if (!setupData) return;
    const roleSlotLimit = getRoleSlotLimit(role);
    const current = normalizeLineupSlots(lineup[role], roleSlotLimit);
    while (current.length < Math.max(roleSlotLimit, slotIndex + 1))
      current.push({ musicianId: "" });
    const previous = current[slotIndex];
    current[slotIndex] = musicianId
      ? {
          musicianId,
          ...(previous?.musicianId === musicianId && previous?.presetOverride
            ? { presetOverride: previous.presetOverride }
            : {}),
          ...(previous?.musicianId === musicianId && previous?.drumDefinition
            ? { drumDefinition: previous.drumDefinition }
            : {}),
        }
      : { musicianId: "" };
    setRoleSlots(role, current);
  }

  function parseSlotIndex(slotKey: string): number {
    const [, rawIndex] = slotKey.split(":");
    const parsed = Number(rawIndex);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function resolveDraftOverride(
    slotKey: string,
    fallbackOverride: PresetOverridePatch | undefined,
  ): PresetOverridePatch | undefined {
    return Object.prototype.hasOwnProperty.call(setupDraftBySlot, slotKey)
      ? setupDraftBySlot[slotKey]
      : fallbackOverride;
  }

  function isDiffOriginOverridden(origin: string): boolean {
    return origin === "override";
  }

  function hasSetupOverrideDiff(
    resolved: ReturnType<typeof resolveSlotSetup>["resolved"],
  ): boolean {
    return (
      resolved.diffMeta.inputs.some((item) =>
        isDiffOriginOverridden(item.origin),
      ) ||
      isDiffOriginOverridden(resolved.diffMeta.monitoring.monitorRef.origin) ||
      isDiffOriginOverridden(
        resolved.diffMeta.monitoring.additionalWedgeCount.origin,
      )
    );
  }
  function getExistingSlotOverride(
    role: string,
    slotIndex: number,
  ): PresetOverridePatch | undefined {
    if (!setupData) return undefined;
    const roleSlotLimit = getRoleSlotLimit(role);
    const slots = normalizeLineupSlots(lineup[role], roleSlotLimit);
    return slots[slotIndex]?.presetOverride;
  }

  function applySetupDraftOverrides(
    draftOverrides: Record<string, PresetOverridePatch | undefined>,
  ) {
    if (!setupData) return;
    const nextLineup: LineupMap = { ...lineup };
    ROLE_ORDER.forEach((role) => {
      const roleSlotLimit = getRoleSlotLimit(role);
      const slots = normalizeLineupSlots(lineup[role], roleSlotLimit).map(
        (slot, slotIndex) => {
          if (!slot.musicianId) return slot;
          const slotKey = `${role}:${slotIndex}`;
          const override = Object.prototype.hasOwnProperty.call(
            draftOverrides,
            slotKey,
          )
            ? draftOverrides[slotKey]
            : slot.presetOverride;
          const normalizedOverride = normalizeSetupOverridePatch(
            resolveSlotSetup(role as Group, slot.musicianId).resolved
              .defaultPreset,
            override,
          );
          const persistedSlot = normalizeLineupSlots(lineup[role], roleSlotLimit)[slotIndex];
          return {
            musicianId: slot.musicianId,
            ...(normalizedOverride
              ? { presetOverride: normalizedOverride }
              : {}),
            ...(persistedSlot?.drumDefinition ? { drumDefinition: persistedSlot.drumDefinition } : {}),
          };
        },
      );
      nextLineup[role] = (
        roleSlotLimit <= 1 ? slots[0] : slots
      ) as LineupMap[string];
    });
    applyState(nextLineup, setupData, bandLeaderId, talkbackOwnerId);
  }

  const resolveMusicianDefaultPreset = useCallback(
    (role: Group, musicianId: string): MusicianSetupPreset => {
      const roleScopedDefaults =
        setupData?.musicianDefaults?.[`${musicianId}:${role}`];
      const genericDefaults = setupData?.musicianDefaults?.[musicianId];
      return resolveMusicianDefaultSetupForRole({
        role,
        musicianDefaults: genericDefaults,
        roleScopedDefaults,
        presetItems: setupData?.musicianPresetsById?.[musicianId],
        presetCatalog,
        bandDefaults: getGroupDefaultPreset(role),
      });
    },
    [presetCatalog, setupData],
  );

  const resolveSlotSetup = useCallback(
    (role: Group, musicianId: string, patch?: PresetOverridePatch) => {
      const musicianDefaults = resolveMusicianDefaultPreset(role, musicianId);
      const resolved = resolveEffectiveMusicianSetup({
        musicianDefaults,
        bandDefaults: getGroupDefaultPreset(role),
        eventOverride: patch,
        group: role,
      });
      return {
        resolved,
        effective: {
          inputs: resolved.effectiveInputs,
          monitoring: resolved.effectiveMonitoring,
        },
      };
    },
    [resolveMusicianDefaultPreset],
  );

  const backVocalMembersSorted = useMemo(
    () =>
      [...backVocalMembers].sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      ),
    [backVocalMembers],
  );
  const backVocsSetupItems = useMemo(
    () =>
      backVocalMembersSorted.map((member) => {
        const defaultPreset = resolveSlotSetup("vocs", member.id).resolved
          .defaultPreset;
        const slots = normalizeLineupSlots(lineup.back_vocs, 8);
        const existing = slots.find(
          (slot) => slot.musicianId === member.id,
        )?.presetOverride;
        const draft = backVocsSetupDraft[member.id];
        const patch = normalizeSetupOverridePatch(
          defaultPreset,
          Object.prototype.hasOwnProperty.call(backVocsSetupDraft, member.id)
            ? draft
            : existing,
        );
        const { resolved, effective } = resolveSlotSetup(
          "vocs",
          member.id,
          patch,
        );
        const value = effective.inputs.some(
          (input) => input.key === "voc_back_wired",
        )
          ? "vocal_back_wired"
          : effective.inputs.some((input) => input.key === "voc_back_wireless")
            ? "vocal_back_wireless"
            : "vocal_back_no_mic";
        const isModified = resolved.diffMeta.inputs.some((item) =>
          isDiffOriginOverridden(item.origin),
        );
        return { musicianId: member.id, name: member.name, value, isModified };
      }),
    [
      backVocalMembersSorted,
      backVocsSetupDraft,
      lineup.back_vocs,
      resolveSlotSetup,
    ],
  );

  const effectiveSlotPresets = useMemo(() => {
    if (!setupData)
      return [] as Array<{
        role: string;
        slotIndex: number;
        musicianId: string;
        patch?: PresetOverridePatch;
        effective: MusicianSetupPreset;
      }>;
    return ROLE_ORDER.flatMap((role) => {
      const roleSlotLimit = getRoleSlotLimit(role);
      return normalizeLineupSlots(lineup[role], roleSlotLimit)
        .map((slot, slotIndex) => ({
          role,
          slotIndex,
          musicianId: slot.musicianId,
          patch: slot.presetOverride,
          effective: resolveSlotSetup(
            role as Group,
            slot.musicianId,
            slot.presetOverride,
          ).effective,
        }))
        .filter((slot) => Boolean(slot.musicianId));
    });
  }, [lineup, resolveSlotSetup, setupData]);

  const overrideValidation = useMemo(
    () =>
      summarizeEffectivePresetValidation(
        effectiveSlotPresets.map((slot) => ({
          group: slot.role,
          preset: slot.effective,
        })),
      ),
    [effectiveSlotPresets],
  );

  const overrideValidationErrors = overrideValidation.errors;
  const overrideValidationWarnings = overrideValidation.warnings;

  const backSetupPath =
    project?.purpose === "generic"
      ? `/projects/${encodeURIComponent(id)}/generic`
      : `/projects/${encodeURIComponent(id)}/event`;
  const editProjectPath = withFrom(
    backSetupPath,
    "setup",
    `${window.location.pathname}${search || ""}`,
  );
  const bandName =
    project?.displayName ?? setupData?.name ?? project?.bandRef ?? "—";
  const selectedMusicianMap = useMemo(
    () => new Map(selectedOptions.map((item) => [item.id, item.name])),
    [selectedOptions],
  );
  const setupMusicians = useMemo(() => {
    if (!setupData || !editingSetup) return [] as SetupMusicianItem[];
    const role = editingSetup.role;
    const roleSlotLimit = getRoleSlotLimit(role);
    return normalizeLineupSlots(lineup[role], roleSlotLimit)
      .map((slot, slotIndex) => ({ role, slotIndex, slot }))
      .filter(({ slot }) => Boolean(slot.musicianId))
      .map(({ role, slotIndex, slot }) => ({
        slotKey: `${role}:${slotIndex}`,
        musicianId: slot.musicianId,
        musicianName: resolveMusicianDisplayName({
          musicianId: slot.musicianId,
          preferredName: selectedMusicianMap.get(slot.musicianId),
        }),
        role: role as Group,
        hasOverride: Boolean(slot.presetOverride),
      }));
  }, [editingSetup, lineup, selectedMusicianMap, setupData]);

  useEffect(() => {
    if (!editingSetup || setupMusicians.length === 0) return;
    if (
      selectedSetupSlotKey &&
      setupMusicians.some((item) => item.slotKey === selectedSetupSlotKey)
    ) {
      return;
    }
    const requested = `${editingSetup.role}:${editingSetup.slotIndex}`;
    const nextSelected = setupMusicians.some(
      (item) => item.slotKey === requested,
    )
      ? requested
      : (setupMusicians[0]?.slotKey ?? "");
    if (nextSelected) {
      setSelectedSetupSlotKey(nextSelected);
    }
  }, [editingSetup, selectedSetupSlotKey, setupMusicians]);

  const selectedSetupMusician =
    setupMusicians.find((item) => item.slotKey === selectedSetupSlotKey) ??
    setupMusicians[0];
  const resolveMusicianCapabilityDefaultInputs = useCallback(
    (musicianId: string): InputChannel[] =>
      resolveMusicianCapabilityInputs({
        presetItems: setupData?.musicianPresetsById?.[musicianId],
        getPresetByRef: (ref) => presetCatalog[ref],
      }),
    [presetCatalog, setupData],
  );

  const resolveEligibleMembersForSection = useCallback(
    (section: SetupCapabilitySection, fallbackRole: string): MemberOption[] => {
      if (!setupData) return [];
      const roleMembers = setupData.members[fallbackRole] || [];
      return roleMembers.filter((member) =>
        supportsCapabilitySection({
          section,
          inputs: resolveMusicianCapabilityDefaultInputs(member.id),
        }),
      );
    },
    [resolveMusicianCapabilityDefaultInputs, setupData],
  );

  const visibleLineupSections = useMemo(() => {
    if (!setupData) {
      return ROLE_ORDER.map((role) => ({ kind: "role" as const, role }));
    }

    return buildVisibleLineupSections({
      roleOrder: ROLE_ORDER,
      resolveRoleSlots: (role) => {
        const roleSlotLimit = getRoleSlotLimit(role);
        return normalizeLineupSlots(lineup[role], roleSlotLimit);
      },
      resolveMusicianDefaultInputs: (musicianId) =>
        resolveMusicianCapabilityDefaultInputs(musicianId),
    });
  }, [lineup, resolveMusicianCapabilityDefaultInputs, setupData]);

  const resetModalRef = useModalBehavior(showResetConfirmation, () =>
    setShowResetConfirmation(false),
  );
  const updateMusicianDefaultsModalRef = useModalBehavior(
    showUpdateMusicianDefaultsConfirmation,
    () => setShowUpdateMusicianDefaultsConfirmation(false),
  );
  const musicianSelectorRef = useModalBehavior(
    Boolean(editing && setupData),
    () => setEditing(null),
  );
  const backVocsModalRef = useModalBehavior(Boolean(isBackVocsModalOpen), () =>
    setIsBackVocsModalOpen(false),
  );
  const backVocsSetupModalRef = useModalBehavior(
    Boolean(isBackVocsSetupOpen),
    () => setIsBackVocsSetupOpen(false),
  );
  const setupEditorRef = useModalBehavior(Boolean(editingSetup), () => {
    setEditingSetup(null);
    setSetupDraftBySlot({});
    setSelectedSetupSlotKey("");
  });

  return (
    <section className="panel panel--setup">
      <div className="panel__header">
        <h2>Lineup Setup</h2>
      </div>
      <div className="lineup-meta">
        <div className="band-name">{bandName}</div>
      </div>
      <div className="lineup-helper">
        <p className="subtle">
          Configure lineup for Input List and Stage Plan.
          <br />
          Defaults are prefilled from the band’s saved lineup settings.
        </p>
        <button
          type="button"
          className="button-secondary"
          onClick={() => setShowResetConfirmation(true)}
          disabled={
            !setupData || !project || currentSnapshot === defaultSnapshot
          }
        >
          Reset to defaults
        </button>
      </div>
      <div className="lineup-grid">
        {visibleLineupSections.map((section) => {
          if (section.kind === "acoustic_guitar") {
            return (
              <article
                key="acoustic-guitar"
                className="lineup-card"
              >
                <h3>AC. GUITAR</h3>
                <div className="lineup-card__body section-divider">
                  <div className="lineup-list lineup-list--single">
                    {section.members.map((member) => {
                      const sourceRoleSlotLimit = getRoleSlotLimit(member.sourceRole);
                      const sourceSlots = normalizeLineupSlots(
                        lineup[member.sourceRole],
                        sourceRoleSlotLimit,
                      );
                      const sourceSlot = sourceSlots[member.sourceSlotIndex];
                      const musicianId = sourceSlot?.musicianId ?? member.musicianId;
                      const sourceMembers = resolveEligibleMembersForSection("acoustic_guitar", member.sourceRole);
                      const selectedName = musicianId
                        ? resolveMusicianDisplayName({
                            musicianId,
                            preferredName: sourceMembers.find((m) => m.id === musicianId)?.name,
                          })
                        : "Not selected";

                      return (
                        <div
                          key={`acoustic-guitar-${member.sourceRole}-${member.sourceSlotIndex}-${member.musicianId}`}
                          className="lineup-list__row"
                        >
                          <span className="lineup-list__name">{selectedName}</span>
                          <div className="lineup-list__actions">
                            <button
                              type="button"
                              className="button-secondary"
                              disabled={!musicianId || sourceMembers.filter((m) => m.id !== musicianId).length === 0}
                              onClick={() =>
                                setEditing({
                                  role: member.sourceRole,
                                  slotIndex: member.sourceSlotIndex,
                                  currentSelectedId: musicianId || undefined,
                                })
                              }
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              className="button-secondary"
                              disabled={!musicianId}
                              onClick={() => {
                                if (!setupData || !musicianId) return;
                                const draftEntries: Record<
                                  string,
                                  PresetOverridePatch | undefined
                                > = {};
                                ROLE_ORDER.forEach((setupRole) => {
                                  const setupRoleSlotLimit = getRoleSlotLimit(setupRole);
                                  normalizeLineupSlots(
                                    lineup[setupRole],
                                    setupRoleSlotLimit,
                                  ).forEach((setupSlot, setupIndex) => {
                                    if (!setupSlot.musicianId) return;
                                    draftEntries[`${setupRole}:${setupIndex}`] =
                                      normalizeSetupOverridePatch(
                                        resolveSlotSetup(
                                          setupRole as Group,
                                          setupSlot.musicianId,
                                        ).resolved.defaultPreset,
                                        setupSlot.presetOverride,
                                      );
                                  });
                                });
                                setSetupDraftBySlot(draftEntries);
                                const slotKey = `${member.sourceRole}:${member.sourceSlotIndex}`;
                                setSelectedSetupSlotKey(slotKey);
                                setEditingSetup({
                                  role: member.sourceRole,
                                  slotIndex: member.sourceSlotIndex,
                                  musicianId,
                                });
                              }}
                            >
                              Setup
                              {sourceSlot?.presetOverride ? " •" : ""}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          }

          const role = section.role;
          const roleSlotLimit = getRoleSlotLimit(role);
          const selected = normalizeLineupValue(lineup[role], roleSlotLimit);
          const sectionCapability: SetupCapabilitySection = role === "guitar"
            ? "guitar"
            : (role as SetupCapabilitySection);
          const members = resolveEligibleMembersForSection(sectionCapability, role);

          return (
            <article key={role} className="lineup-card">
              <h3>
                {role === "guitar"
                  ? resolveSetupCardLabel({
                      role: "guitar",
                      musicianId: selected[0],
                      resolveInputs: (musicianId) =>
                        resolveSlotSetup("guitar", musicianId).resolved.defaultPreset
                          .inputs,
                      fallback: getRoleDisplayName(
                        role,
                      ),
                    })
                  : getRoleDisplayName(
                      role,
                    )}
              </h3>
              <div className="lineup-card__body section-divider">
                <div className="lineup-list lineup-list--single">
                  {(selected.length ? selected : [""]).map((musicianId, index) => {
                    const alternatives = members.filter((m) => m.id !== musicianId);
                    return (
                      <div key={`${role}-${index}`} className="lineup-list__row">
                        <span className="lineup-list__name">
                          {musicianId
                            ? resolveMusicianDisplayName({
                                musicianId,
                                preferredName: members.find((m) => m.id === musicianId)?.name,
                              })
                            : "Not selected"}
                        </span>
                        <div className="lineup-list__actions">
                          <button
                            type="button"
                            className="button-secondary"
                            disabled={alternatives.length === 0}
                            onClick={() =>
                              setEditing({
                                role,
                                slotIndex: index,
                                currentSelectedId: musicianId || undefined,
                              })
                            }
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            className="button-secondary"
                            disabled={!musicianId}
                            onClick={() => {
                              if (!setupData) return;
                              const draftEntries: Record<
                                string,
                                PresetOverridePatch | undefined
                              > = {};
                              ROLE_ORDER.forEach((setupRole) => {
                                const setupRoleSlotLimit = getRoleSlotLimit(setupRole);
                                normalizeLineupSlots(
                                  lineup[setupRole],
                                  setupRoleSlotLimit,
                                ).forEach((setupSlot, setupIndex) => {
                                  if (!setupSlot.musicianId) return;
                                  draftEntries[`${setupRole}:${setupIndex}`] =
                                    normalizeSetupOverridePatch(
                                      resolveSlotSetup(
                                        setupRole as Group,
                                        setupSlot.musicianId,
                                      ).resolved.defaultPreset,
                                      setupSlot.presetOverride,
                                    );
                                });
                              });
                              setSetupDraftBySlot(draftEntries);
                              const slotKey = `${role}:${index}`;
                              setSelectedSetupSlotKey(slotKey);
                              setEditingSetup({
                                role,
                                slotIndex: index,
                                musicianId,
                              });
                            }}
                          >
                            Setup
                            {normalizeLineupSlots(lineup[role], roleSlotLimit)[index]
                              ?.presetOverride
                              ? " •"
                              : ""}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
        <BackVocsBlock
          members={backVocalMembers}
          changeDisabled={selectedOptions.length === 0}
          setupDisabled={isBackVocsSetupDisabled}
          onChange={() => setIsBackVocsModalOpen(true)}
          onSetup={() => setIsBackVocsSetupOpen(true)}
        />
        <p className="subtle">
          Select the on-site band lead for coordination and decisions.
        </p>
        <article className="lineup-card">
          <h3>BAND LEADER</h3>
          <div className="lineup-card__body section-divider">
            <div className="lineup-list__row">
              <span className="lineup-list__name">
                {selectedOptions.find((m) => m.id === bandLeaderId)?.name ||
                  "Not selected"}
              </span>
              <button
                type="button"
                className="button-secondary"
                disabled={
                  selectedOptions.filter((m) => m.id !== bandLeaderId)
                    .length === 0
                }
                onClick={() =>
                  setEditing({
                    role: "leader",
                    slotIndex: 0,
                    currentSelectedId: bandLeaderId,
                  })
                }
              >
                Change
              </button>
            </div>
          </div>
        </article>
        <p className="subtle">Assign talkback microphone owner.</p>
        <article className="lineup-card">
          <h3>TALKBACK</h3>
          <div className="lineup-card__body section-divider">
            <div className="lineup-list__row">
              <span className="lineup-list__name">
                {selectedOptions.find((m) => m.id === talkbackCurrentOwnerId)
                  ?.name || ""}
              </span>
              <button
                type="button"
                className="button-secondary"
                disabled={selectedOptions.length === 0}
                onClick={() =>
                  setEditing({
                    role: "talkback",
                    slotIndex: 0,
                    currentSelectedId: talkbackCurrentOwnerId,
                  })
                }
              >
                Change
              </button>
            </div>
          </div>
        </article>
      </div>
      {errors.length + overrideValidationErrors.length > 0 ? (
        <div className="status status--error">
          {[...errors, ...overrideValidationErrors].map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      {overrideValidationWarnings.length > 0 ? (
        <div className="status status--warning">
          {overrideValidationWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <p>
            Review setup overrides in each role to reduce required monitor
            sends, if needed.
          </p>
        </div>
      ) : null}
      {status ? <p className="status status--error">{status}</p> : null}
      {toastMessage ? (
        <p className="status status--success">{toastMessage}</p>
      ) : null}

      <div className="setup-action-bar">
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate(editProjectPath)}
        >
          Edit Project
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/")}
        >
          Back to Hub
        </button>
        <button
          type="button"
          onClick={async () => {
            if (errors.length > 0 || overrideValidationErrors.length > 0)
              return;
            if (isDirty) {
              setIsCommitting(true);
              await persistProject();
            }
            navigate(withFrom(`/projects/${id}/preview`, "setup"));
          }}
          disabled={errors.length > 0 || overrideValidationErrors.length > 0}
        >
          {isDirty ? "Save & Continue" : "Continue"}
        </button>
      </div>

      <ModalOverlay
        open={showResetConfirmation}
        onClose={() => setShowResetConfirmation(false)}
      >
        <div
          className="selector-dialog"
          role="alertdialog"
          aria-modal="true"
          ref={resetModalRef}
        >
          <button
            type="button"
            className="modal-close"
            onClick={() => setShowResetConfirmation(false)}
            aria-label="Close"
          >
            ×
          </button>
          <div className="panel__header panel__header--stack">
            <h3>Reset to defaults?</h3>
            <p className="subtle">
              This will reset lineup, band leader, and talkback defaults to the
              band defaults.
            </p>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => setShowResetConfirmation(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!setupData) return;
                applyState({ ...(setupData.defaultLineup ?? {}) }, setupData);
                setBackVocalIds([]);
                setHasBackVocalOverride(false);
                setTalkbackOwnerId("");
                setHasTalkbackOverride(false);
                setShowResetConfirmation(false);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={
          showUpdateMusicianDefaultsConfirmation &&
          Boolean(selectedSetupMusician)
        }
        onClose={() => {
          setShowUpdateMusicianDefaultsConfirmation(false);
        }}
      >
        <div
          className="selector-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-musician-defaults-title"
          ref={updateMusicianDefaultsModalRef}
        >
          <div className="panel__header panel__header--stack selector-dialog__title">
            <h3 id="update-musician-defaults-title">
              Update musician defaults?
            </h3>
            <p className="subtle">
              {`You are about to update default setup for: ${selectedSetupMusician?.musicianName ?? ""}.`}
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
              onClick={() => setShowUpdateMusicianDefaultsConfirmation(false)}
              disabled={isUpdatingMusicianDefaults}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!selectedSetupMusician) return;
                const existingPatch = getExistingSlotOverride(
                  selectedSetupMusician.role,
                  parseSlotIndex(selectedSetupMusician.slotKey),
                );
                const currentPatch = resolveDraftOverride(
                  selectedSetupMusician.slotKey,
                  existingPatch,
                );
                const { effective } = resolveSlotSetup(
                  selectedSetupMusician.role,
                  selectedSetupMusician.musicianId,
                  currentPatch,
                );
                setIsUpdatingMusicianDefaults(true);
                try {
                  await invoke("update_musician_defaults", {
                    musicianId: selectedSetupMusician.musicianId,
                    role: selectedSetupMusician.role,
                    setup: effective,
                  });
                  setSetupData((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      musicianDefaults: {
                        ...(prev.musicianDefaults ?? {}),
                        [`${selectedSetupMusician.musicianId}:${selectedSetupMusician.role}`]:
                          effective,
                      },
                    };
                  });
                  setToastMessage("Musician defaults updated.");
                  setShowUpdateMusicianDefaultsConfirmation(false);
                } catch {
                  setStatus("Failed to update musician defaults.");
                } finally {
                  setIsUpdatingMusicianDefaults(false);
                }
              }}
              disabled={isUpdatingMusicianDefaults}
            >
              Update defaults
            </button>
          </div>
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={Boolean(editingSetup)}
        onClose={() => {
          setEditingSetup(null);
          setSetupDraftBySlot({});
          setSelectedSetupSlotKey("");
        }}
      >
        {editingSetup && selectedSetupMusician
          ? (() => {
              const existingPatch = getExistingSlotOverride(
                selectedSetupMusician.role,
                parseSlotIndex(selectedSetupMusician.slotKey),
              );
              const currentPatch = resolveDraftOverride(
                selectedSetupMusician.slotKey,
                existingPatch,
              );
              const { resolved, effective } = resolveSlotSetup(
                selectedSetupMusician.role,
                selectedSetupMusician.musicianId,
                currentPatch,
              );
              const setupSection: SetupCapabilitySection =
                selectedSetupMusician.role === "guitar"
                  ? "guitar"
                  : (selectedSetupMusician.role as SetupCapabilitySection);
              const effectiveSectionInputs = resolveInputsForCapabilitySection({
                section: setupSection,
                inputs: effective.inputs,
              });
              const effectiveInputGroups = resolveEffectiveInstrumentGroups(
                effectiveSectionInputs,
              );
              const inputSectionGroups =
                effectiveInputGroups.length > 0
                  ? effectiveInputGroups
                  : [{ key: "vocs", label: "", inputs: effectiveSectionInputs }];
              const setupTitle = composeSetupModalTitle({
                templateType: project?.purpose === "generic" ? "generic" : "event",
                musicianName: selectedSetupMusician.musicianName,
                instrumentLabels: resolveDistinctInstrumentLabels(
                  effectiveSectionInputs,
                ),
              });
              const availableInputs = (
                GROUP_INPUT_LIBRARY[
                  selectedSetupMusician.role as keyof typeof GROUP_INPUT_LIBRARY
                ] ?? []
              ).filter(
                (item: InputChannel) =>
                  !effectiveSectionInputs.some(
                    (effectiveItem) => effectiveItem.key === item.key,
                  ),
              );
              const selectedRoleSlots = normalizeLineupSlots(
                lineup[selectedSetupMusician.role],
                getRoleSlotLimit(selectedSetupMusician.role),
              );
              const selectedRoleSlot = selectedRoleSlots.find(
                (slot) => slot.musicianId === selectedSetupMusician.musicianId,
              );
              const drumSetup =
                selectedSetupMusician.role === "drums"
                  ? parseDrumDefinition(selectedRoleSlot?.drumDefinition, createDefaultDrumDefinition())
                  : null;
              const musicianDefaultPreset = resolveMusicianDefaultPreset(
                selectedSetupMusician.role,
                selectedSetupMusician.musicianId,
              );
              const canUpdateMusicianDefault = !areSetupsEqual(
                effective,
                musicianDefaultPreset,
              );
              const modalErrors = validateEffectivePresets(
                setupMusicians.map((slot) => {
                  const existingSlotPatch = getExistingSlotOverride(
                    slot.role,
                    parseSlotIndex(slot.slotKey),
                  );
                  const slotPatch = resolveDraftOverride(
                    slot.slotKey,
                    existingSlotPatch,
                  );
                  const { resolved: slotResolved } = resolveSlotSetup(
                    slot.role,
                    slot.musicianId,
                    slotPatch,
                  );
                  return {
                    group: slot.role,
                    preset: {
                      inputs: slotResolved.effectiveInputs,
                      monitoring: slotResolved.effectiveMonitoring,
                    },
                  };
                }),
              );
              return (
                <div
                  className="selector-dialog selector-dialog--setup-editor"
                  role="dialog"
                  aria-modal="true"
                  ref={setupEditorRef}
                >
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => {
                      setEditingSetup(null);
                      setSetupDraftBySlot({});
                      setSelectedSetupSlotKey("");
                    }}
                    aria-label="Close"
                  >
                    ×
                  </button>
                  <SetupModalShell
                    open={Boolean(editingSetup && selectedSetupMusician)}
                    title={setupTitle}
                    subtitle="Changes here apply only to this event. Musicians defaults are not modified."
                    isDirty={shouldEnableSetupReset({
                      eventOverride: existingPatch,
                      defaultPreset: resolved.defaultPreset,
                      effectivePreset: effective,
                    })}
                    onBack={() => {
                      setEditingSetup(null);
                      setSetupDraftBySlot({});
                      setSelectedSetupSlotKey("");
                    }}
                    onReset={() => {
                      if (!setupData) return;
                      setSetupDraftBySlot((prev) => {
                        const next = { ...prev };
                        ROLE_ORDER.forEach((role) => {
                          const roleSlotLimit = getRoleSlotLimit(role);
                          normalizeLineupSlots(
                            lineup[role],
                            roleSlotLimit,
                          ).forEach((slot, slotIndex) => {
                            if (
                              slot.musicianId !==
                              selectedSetupMusician.musicianId
                            )
                              return;
                            next[`${role}:${slotIndex}`] = resetOverrides();
                          });
                        });
                        return next;
                      });
                    }}
                    defaultAction={{
                      label: "Save as musician default…",
                      disabled: !canUpdateMusicianDefault,
                      onClick: () =>
                        setShowUpdateMusicianDefaultsConfirmation(true),
                    }}
                    saveDisabled={modalErrors.length > 0}
                    onSave={() => {
                      applySetupDraftOverrides(setupDraftBySlot);
                      setEditingSetup(null);
                      setSetupDraftBySlot({});
                      setSelectedSetupSlotKey("");
                    }}
                  >
                    <div className="setup-musician-layout">
                      <MusicianSelector
                        items={setupMusicians.map((item) => ({
                          ...item,
                          hasOverride: hasSetupOverrideDiff(
                            resolveSlotSetup(
                              item.role,
                              item.musicianId,
                              resolveDraftOverride(
                                item.slotKey,
                                getExistingSlotOverride(
                                  item.role,
                                  parseSlotIndex(item.slotKey),
                                ),
                              ),
                            ).resolved,
                          ),
                        }))}
                        selectedSlotKey={selectedSetupMusician.slotKey}
                        onSelect={setSelectedSetupSlotKey}
                      />
                      {selectedSetupMusician.role === "bass" ? (
                        <div className="setup-editor-stack">
                          <SetupSection
                            title="Inputs"
                            modified={resolved.diffMeta.inputs.some((item) =>
                              isDiffOriginOverridden(item.origin),
                            )}
                          >
                            <SchemaRenderer
                              fields={BASS_FIELDS}
                              state={
                                {
                                  defaultPreset: resolved.defaultPreset,
                                  effectivePreset: effective,
                                  patch: currentPatch,
                                } satisfies EventSetupEditState
                              }
                              onPatch={(nextPatch) =>
                                setSetupDraftBySlot((prev) => ({
                                  ...prev,
                                  [selectedSetupMusician.slotKey]:
                                    normalizeSetupOverridePatch(
                                      resolved.defaultPreset,
                                      nextPatch,
                                    ),
                                }))
                              }
                            />
                          </SetupSection>
                          <SetupSection
                            title="Monitoring"
                            modified={
                              isDiffOriginOverridden(
                                resolved.diffMeta.monitoring.monitorRef.origin,
                              ) ||
                              isDiffOriginOverridden(
                                resolved.diffMeta.monitoring
                                  .additionalWedgeCount.origin,
                              )
                            }
                          >
                            <MonitoringEditor
                              monitorOptions={monitorOptions}
                              effectiveMonitoring={effective.monitoring}
                              patch={currentPatch}
                              diffMeta={resolved.diffMeta}
                              onChangePatch={(nextPatch) =>
                                setSetupDraftBySlot((prev) => ({
                                  ...prev,
                                  [selectedSetupMusician.slotKey]:
                                    normalizeSetupOverridePatch(
                                      resolved.defaultPreset,
                                      nextPatch,
                                    ),
                                }))
                              }
                            />
                          </SetupSection>
                        </div>
                      ) : (
                        <div className="setup-editor-grid">
                          <div className="setup-editor-column">
                            {selectedSetupMusician.role === "drums" &&
                            drumSetup ? (
                              <DrumsPartsEditor
                                setup={drumSetup}
                                onChange={(nextSetup) => {
                                  const targetInputs =
                                    resolveDrumInputs(nextSetup);
                                  setLineup((prevLineup) => {
                                    const nextLineup = { ...prevLineup };
                                    const roleSlots = normalizeLineupSlots(
                                      nextLineup[selectedSetupMusician.role],
                                      getRoleSlotLimit(selectedSetupMusician.role),
                                    );
                                    const updatedSlots = roleSlots.map((slot) =>
                                      slot.musicianId === selectedSetupMusician.musicianId
                                        ? { ...slot, drumDefinition: nextSetup }
                                        : slot,
                                    );
                                    nextLineup[selectedSetupMusician.role] = updatedSlots[0];
                                    return nextLineup;
                                  });
                                  setSetupDraftBySlot((prev) => {
                                    const prior =
                                      prev[selectedSetupMusician.slotKey];
                                    const nextInputsPatch =
                                      buildInputsPatchFromTarget(
                                        resolved.defaultPreset.inputs,
                                        targetInputs,
                                      );
                                    const nextPatch = {
                                      ...prior,
                                      ...(Object.keys(nextInputsPatch).length >
                                      0
                                        ? { inputs: nextInputsPatch }
                                        : {}),
                                    };
                                    return {
                                      ...prev,
                                      [selectedSetupMusician.slotKey]:
                                        normalizeSetupOverridePatch(
                                          resolved.defaultPreset,
                                          nextPatch,
                                        ),
                                    };
                                  });
                                }}
                              />
                            ) : null}
                            {selectedSetupMusician.role === "drums" ? (
                              <SelectedInputsList
                                effectiveInputs={effectiveSectionInputs}
                                inputDiffMeta={resolved.diffMeta.inputs}
                                availableInputs={availableInputs}
                                nonRemovableKeys={[
                                  "dr_kick_1_out",
                                  "dr_kick_1_in",
                                  "dr_snare1_top",
                                  "dr_snare1_bottom",
                                ]}
                                onRemoveInput={(key) => {
                                  setSetupDraftBySlot((prev) => {
                                    const prior =
                                      prev[selectedSetupMusician.slotKey];
                                    const nextRemove = Array.from(
                                      new Set([
                                        ...(prior?.inputs?.removeKeys ?? []),
                                        key,
                                      ]),
                                    );
                                    const nextAdd = (
                                      prior?.inputs?.add ?? []
                                    ).filter((item) => item.key !== key);
                                    const nextPatch = {
                                      ...prior,
                                      inputs: {
                                        ...prior?.inputs,
                                        removeKeys: nextRemove,
                                        add: nextAdd,
                                      },
                                    };
                                    return {
                                      ...prev,
                                      [selectedSetupMusician.slotKey]:
                                        normalizeSetupOverridePatch(
                                          resolved.defaultPreset,
                                          nextPatch,
                                        ),
                                    };
                                  });
                                }}
                                onAddInput={() => {}}
                              />
                            ) : (
                              inputSectionGroups.map((group) => (
                                <SetupSection
                                  key={group.key}
                                  title={
                                    inputSectionGroups.length === 1
                                      ? "Input"
                                      : `Input – ${group.label}`
                                  }
                                  modified={resolved.diffMeta.inputs.some(
                                    (item) => isDiffOriginOverridden(item.origin),
                                  )}
                                >
                                  <SchemaRenderer
                                    fields={
                                      group.key === "keys"
                                        ? KEYS_FIELDS
                                        : group.key === "acoustic_guitar" ||
                                            group.key === "electric_guitar"
                                          ? GUITAR_FIELDS
                                          : LEAD_VOCS_FIELDS
                                    }
                                    state={{
                                      defaultPreset: resolved.defaultPreset,
                                      effectivePreset: effective,
                                      patch: currentPatch,
                                    }}
                                    onPatch={(nextPatch) =>
                                      setSetupDraftBySlot((prev) => ({
                                        ...prev,
                                        [selectedSetupMusician.slotKey]:
                                          normalizeSetupOverridePatch(
                                            resolved.defaultPreset,
                                            nextPatch,
                                          ),
                                      }))
                                    }
                                  />
                                </SetupSection>
                              ))
                            )}
                          </div>
                          <div className="setup-editor-column">
                            <SetupSection
                              title="Monitoring"
                              modified={
                                isDiffOriginOverridden(
                                  resolved.diffMeta.monitoring.monitorRef
                                    .origin,
                                ) ||
                                isDiffOriginOverridden(
                                  resolved.diffMeta.monitoring
                                    .additionalWedgeCount.origin,
                                )
                              }
                            >
                              <MonitoringEditor
                                monitorOptions={monitorOptions}
                                effectiveMonitoring={effective.monitoring}
                                patch={currentPatch}
                                diffMeta={resolved.diffMeta}
                                onChangePatch={(nextPatch) =>
                                  setSetupDraftBySlot((prev) => ({
                                    ...prev,
                                    [selectedSetupMusician.slotKey]:
                                      normalizeSetupOverridePatch(
                                        resolved.defaultPreset,
                                        nextPatch,
                                      ),
                                  }))
                                }
                              />
                            </SetupSection>
                          </div>
                        </div>
                      )}
                    </div>
                    {modalErrors.length > 0 ? (
                      <div className="status status--error">
                        {modalErrors.map((error) => (
                          <p key={error}>{error}</p>
                        ))}
                      </div>
                    ) : null}
                  </SetupModalShell>
                </div>
              );
            })()
          : null}
      </ModalOverlay>

      <ModalOverlay
        open={isBackVocsModalOpen}
        onClose={() => setIsBackVocsModalOpen(false)}
      >
        <div ref={backVocsModalRef}>
          <ChangeBackVocsModal
            open={isBackVocsModalOpen}
            members={backVocalCandidates}
            initialSelectedIds={sanitizeBackVocsSelection(
              new Set(selectedBackVocalIds),
              leadVocalIds,
            )}
            onCancel={() => setIsBackVocsModalOpen(false)}
            onSave={(nextSelectedIds) => {
              const sanitizedSelectedIds = sanitizeBackVocsSelection(
                nextSelectedIds,
                leadVocalIds,
              );
              setBackVocalIds(Array.from(sanitizedSelectedIds));
              setHasBackVocalOverride(true);
              setIsBackVocsModalOpen(false);
            }}
          />
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={isBackVocsSetupOpen}
        onClose={() => setIsBackVocsSetupOpen(false)}
      >
        <div
          className="selector-dialog selector-dialog--setup-editor"
          role="dialog"
          aria-modal="true"
          ref={backVocsSetupModalRef}
        >
          <BackVocsSetupModal
            open={isBackVocsSetupOpen}
            items={backVocsSetupItems}
            onBack={() => setIsBackVocsSetupOpen(false)}
            onReset={() => {
              const next = Object.fromEntries(
                backVocsSetupItems.map((item) => [item.musicianId, undefined]),
              );
              setBackVocsSetupDraft(next);
            }}
            onSave={() => {
              const current = normalizeLineupSlots(lineup.back_vocs, 8);
              const nextById = new Map(
                current.map((slot) => [slot.musicianId, slot]),
              );
              for (const item of backVocsSetupItems) {
                const override = Object.prototype.hasOwnProperty.call(
                  backVocsSetupDraft,
                  item.musicianId,
                )
                  ? backVocsSetupDraft[item.musicianId]
                  : nextById.get(item.musicianId)?.presetOverride;
                const normalizedOverride = normalizeSetupOverridePatch(
                  resolveSlotSetup("vocs", item.musicianId).resolved
                    .defaultPreset,
                  override,
                );
                nextById.set(item.musicianId, {
                  musicianId: item.musicianId,
                  ...(normalizedOverride
                    ? { presetOverride: normalizedOverride }
                    : {}),
                });
              }
              setLineup((prev) => ({
                ...prev,
                back_vocs: Array.from(nextById.values()),
              }));
              setIsBackVocsSetupOpen(false);
            }}
            onChange={(musicianId, presetId) => {
              const targetPreset = backVocalPresetRefs.find(
                (item) => item.id === presetId,
              );
              if (!targetPreset) return;
              const nextPatch = withInputsTarget(
                resolveSlotSetup("vocs", musicianId).resolved.defaultPreset
                  .inputs,
                backVocsSetupDraft[musicianId],
                targetPreset.inputs as InputChannel[],
              );
              setBackVocsSetupDraft((prev) => ({
                ...prev,
                [musicianId]: normalizeSetupOverridePatch(
                  resolveSlotSetup("vocs", musicianId).resolved.defaultPreset,
                  nextPatch,
                ),
              }));
            }}
          />
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={Boolean(editing && setupData)}
        onClose={() => setEditing(null)}
      >
        {editing && setupData ? (
          <div
            className="selector-dialog selector-dialog--musician-select"
            role="dialog"
            aria-modal="true"
            ref={musicianSelectorRef}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setEditing(null)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="panel__header panel__header--stack selector-dialog__title">
              <h3>
                Select{" "}
                {getRoleDisplayName(
                  editing.role,
                )}
              </h3>
            </div>
            <div className="selector-dialog__divider section-divider" />
            <div className="selector-list">
              {(editing.role === "leader"
                ? selectedOptions
                : editing.role === "talkback"
                  ? [{ id: "", name: "Nobody assigned" }, ...selectedOptions]
                  : resolveEligibleMembersForSection(
                      editing.role === "guitar" ? "guitar" : (editing.role as SetupCapabilitySection),
                      editing.role,
                    )
              ).map((member) => (
                <button
                  type="button"
                  key={member.id}
                  className={
                    member.id === editing.currentSelectedId
                      ? "selector-option selector-option--selected"
                      : "selector-option"
                  }
                  onClick={() => {
                    if (editing.role === "leader") setBandLeaderId(member.id);
                    else if (editing.role === "talkback") {
                      setTalkbackOwnerId(member.id);
                      setHasTalkbackOverride(true);
                    } else
                      updateSlot(editing.role, editing.slotIndex, member.id);
                    setEditing(null);
                  }}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </ModalOverlay>
    </section>
  );
}
