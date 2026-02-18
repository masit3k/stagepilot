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
  normalizeRoleConstraint,
  resolveBandLeaderId,
  resolveTalkbackOwnerId,
  validateLineup,
} from "../../projectRules";
import {
  summarizeEffectivePresetValidation,
  validateEffectivePresets,
  normalizeBassConnectionOverridePatch,
} from "../../../../../src/domain/rules/presetOverride";
import type { Group } from "../../../../../src/domain/model/groups";
import type {
  InputChannel,
  Musician,
  MusicianSetupPreset,
  PresetItem,
} from "../../../../../src/domain/model/types";
import { resolveEffectiveMusicianSetup } from "../../../../../src/domain/setup/resolveEffectiveMusicianSetup";
import { inferDrumSetupFromLegacyInputs } from "../../../../../src/domain/drums/drumSetup";
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
import { isLineupSetupDirty } from "../domain/ui/isLineupSetupDirty";
import {
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
import vocalBackNoMicPreset from "../../../../../data/assets/presets/groups/vocs/vocal_back_no_mic.json";
import vocalBackWiredPreset from "../../../../../data/assets/presets/groups/vocs/vocal_back_wired.json";
import vocalBackWirelessPreset from "../../../../../data/assets/presets/groups/vocs/vocal_back_wireless.json";
import type { ProjectRouteProps } from "./shared/pageTypes";
import {
  BASS_FIELDS,
  GUITAR_FIELDS,
  KEYS_FIELDS,
  LEAD_VOCS_FIELDS,
  GROUP_INPUT_LIBRARY,
  ROLE_ORDER,
  buildInputsPatchFromTarget,
  createFallbackSetupData,
  getGroupDefaultPreset,
  resolveMusicianDefaultInputsFromPresets,
} from "./shared/setupConstants";

export function ProjectSetupPage({
  id,
  navigate,
  registerNavigationGuard,
  search = "",
}: ProjectRouteProps) {
  const [project, setProject] = useState<NewProjectPayload | null>(null);
  const [setupData, setSetupData] = useState<BandSetupData | null>(null);
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
  const [backVocalIds, setBackVocalIds] = useState<string[]>([]);
  const [isBackVocsModalOpen, setIsBackVocsModalOpen] = useState(false);
  const [isBackVocsSetupOpen, setIsBackVocsSetupOpen] = useState(false);
  const [backVocsSetupDraft, setBackVocsSetupDraft] = useState<Record<string, PresetOverridePatch | undefined>>({});
  const [status, setStatus] = useState("");
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const initialSnapshotRef = useRef("");
  const snapshotHydratedRef = useRef(false);

  const buildSetupSnapshot = useCallback(
    (
      nextLineup: LineupMap,
      data: BandSetupData,
      storedLeader?: string,
      storedTalkback?: string,
    ) => {
      const selected = getUniqueSelectedMusicians(
        nextLineup,
        data.constraints,
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
      setTalkbackOwnerId(snapshot.talkbackOwnerId);
    },
    [buildSetupSnapshot],
  );

  useEffect(() => {
    snapshotHydratedRef.current = false;
    (async () => {
      const parsedRaw = JSON.parse(
        await invoke<string>("read_project", { projectId: id }),
      ) as NewProjectPayload;
      const parsed = migrateProjectTalkbackOwner(migrateProjectLineupVocsToLeadBack(parsedRaw));
      setProject(parsed);
      setBackVocalIds(
        normalizeLineupValue((parsed.lineup ?? {}).back_vocs, 8),
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
        parsed.talkbackOwnerId,
      );
      applyState(
        initialLineup,
        data,
        parsed.bandLeaderId,
        parsed.talkbackOwnerId,
      );
      if (!hasStoredLineup) {
        const updatedProject: NewProjectPayload = {
          ...parsed,
          lineup: {
            ...serializeLineupForProject(
              initialState.lineup,
              data.constraints,
              ROLE_ORDER,
            ),
            back_vocs: normalizeLineupValue(
              (parsed.lineup ?? {}).back_vocs,
              8,
            ),
          },
          bandLeaderId: initialState.bandLeaderId || undefined,
          talkbackOwnerId: initialState.talkbackOwnerId || undefined,
          updatedAt: new Date().toISOString(),
        };
        await projectsApi.saveProject({
          projectId: id,
          json: JSON.stringify(toPersistableProject(updatedProject), null, 2),
        });
        setProject(updatedProject);
      }
      initialSnapshotRef.current = JSON.stringify({
        ...initialState,
        lineup: serializeLineupForProject(
          initialState.lineup,
          data.constraints,
          ROLE_ORDER,
        ),
        backVocalIds: normalizeLineupValue((parsed.lineup ?? {}).back_vocs, 8),
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
            setupData.constraints,
            ROLE_ORDER,
            setupData.roleConstraints,
          ),
    [lineup, setupData],
  );
  const selectedMusicianIds = useMemo(
    () =>
      !setupData
        ? []
        : getUniqueSelectedMusicians(lineup, setupData.constraints, ROLE_ORDER),
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
  const talkbackCurrentOwnerId = talkbackOwnerId || bandLeaderId;
  const backVocalPresetRefs = useMemo(
    () => [vocalBackNoMicPreset, vocalBackWiredPreset, vocalBackWirelessPreset],
    [],
  );
  const defaultBackVocalRef = useMemo(
    () =>
      backVocalPresetRefs.find((item) => item.id === "vocal_back_no_mic")?.id ??
      [...backVocalPresetRefs].sort((a, b) => a.id.localeCompare(b.id))[0]
        ?.id ??
      "",
    [backVocalPresetRefs],
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
      const roleConstraint = normalizeRoleConstraint(
        role,
        setupData.constraints[role],
      );
      normalizeLineupSlots(lineup[role], roleConstraint.max).forEach((slot) => {
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

    if (backVocalIds.length > 0) return explicitSelectedIds;

    return Array.from(defaultBackVocalIds).filter((idValue) =>
      templateMusicianIds.has(idValue),
    );
  }, [backVocalIds, defaultBackVocalIds, leadVocalIds, templateMusicianIds]);
  const backVocalMembers = useMemo(
    () =>
      templateMusicians.filter((item) =>
        selectedBackVocalIds.includes(item.id),
      ),
    [selectedBackVocalIds, templateMusicians],
  );

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
    return serializeLineupForProject(lineup, setupData.constraints, ROLE_ORDER);
  }, [lineup, setupData]);
  const defaultSelectedBackVocalIds = useMemo(() => {
    if (!setupData) return [] as string[];
    const defaultLineup = { ...(setupData.defaultLineup ?? {}) };
    const selectedIds = getUniqueSelectedMusicians(
      defaultLineup,
      setupData.constraints,
      ROLE_ORDER,
    );
    const roleByMusicianId = new Map<string, Group>();
    ROLE_ORDER.forEach((role) => {
      const roleConstraint = normalizeRoleConstraint(
        role,
        setupData.constraints[role],
      );
      normalizeLineupSlots(defaultLineup[role], roleConstraint.max).forEach(
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
    backVocalIds: [...selectedBackVocalIds].sort((a, b) => a.localeCompare(b)),
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
        setupData.constraints,
        ROLE_ORDER,
      ),
      backVocalIds: defaultSelectedBackVocalIds,
    });
  }, [defaultSelectedBackVocalIds, setupData, buildSetupSnapshot]);
  const isDirty = Boolean(
    project &&
      isLineupSetupDirty({
        baselineProject: JSON.parse(initialSnapshotRef.current || "null") ?? {
          lineup: {},
          bandLeaderId: "",
          talkbackOwnerId: "",
          backVocalIds: [],
        },
        currentDraftProject: {
          lineup: serializedLineup,
          bandLeaderId,
          talkbackOwnerId: talkbackCurrentOwnerId,
          backVocalIds: selectedBackVocalIds,
        },
      }),
  );

  useEffect(() => {
    if (!project || !setupData || snapshotHydratedRef.current) return;
    initialSnapshotRef.current = currentSnapshot;
    snapshotHydratedRef.current = true;
  }, [currentSnapshot, project, setupData]);

  async function persistProject(next?: Partial<NewProjectPayload>) {
    if (!project) return;
    const payload: NewProjectPayload = {
      ...project,
      lineup: {
        ...serializedLineup,
        back_vocs: [...selectedBackVocalIds],
      },
      bandLeaderId,
      talkbackOwnerId: talkbackCurrentOwnerId || undefined,
      ...next,
    };
    await projectsApi.saveProject({
      projectId: id,
      json: JSON.stringify(toPersistableProject(payload), null, 2),
    });
    setProject(payload);
    initialSnapshotRef.current = JSON.stringify({
      lineup: serializeLineupForProject(
        payload.lineup ?? {},
        setupData?.constraints ?? {},
        ROLE_ORDER,
      ),
      bandLeaderId: payload.bandLeaderId ?? "",
      talkbackOwnerId: payload.talkbackOwnerId ?? payload.bandLeaderId ?? "",
      backVocalIds: [...selectedBackVocalIds].sort((a, b) =>
        a.localeCompare(b),
      ),
    });
    snapshotHydratedRef.current = true;
  }

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () => !isCommitting && isDirty,
      save: persistProject,
    });
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard, isDirty, isCommitting]);

  function setRoleSlots(role: string, slots: LineupSlotValue[]) {
    if (!setupData) return;
    const constraint = normalizeRoleConstraint(
      role,
      setupData.constraints[role],
    );
    const compact = slots.filter((slot) => Boolean(slot.musicianId));
    const value = constraint.max <= 1 ? compact[0] : compact;
    const nextLineup = { ...lineup, [role]: value as LineupMap[string] };
    applyState(nextLineup, setupData, bandLeaderId, talkbackOwnerId);
  }

  function updateSlot(role: string, slotIndex: number, musicianId: string) {
    if (!setupData) return;
    const constraint = normalizeRoleConstraint(
      role,
      setupData.constraints[role],
    );
    const current = normalizeLineupSlots(lineup[role], constraint.max);
    while (current.length < Math.max(constraint.max, slotIndex + 1))
      current.push({ musicianId: "" });
    const previous = current[slotIndex];
    current[slotIndex] = musicianId
      ? {
          musicianId,
          ...(previous?.musicianId === musicianId && previous?.presetOverride
            ? { presetOverride: previous.presetOverride }
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


  function resolveDraftOverride(slotKey: string, fallbackOverride: PresetOverridePatch | undefined): PresetOverridePatch | undefined {
    return Object.prototype.hasOwnProperty.call(setupDraftBySlot, slotKey)
      ? setupDraftBySlot[slotKey]
      : fallbackOverride;
  }

  function isMonitoringModified(args: {
    monitorRefOrigin: string;
    additionalWedgeCountOrigin: string;
    effectiveAdditionalWedgeCount: number | undefined;
  }): boolean {
    return args.monitorRefOrigin === "override"
      || args.additionalWedgeCountOrigin === "override"
      || (args.effectiveAdditionalWedgeCount ?? 0) > 0;
  }
  function getExistingSlotOverride(role: string, slotIndex: number): PresetOverridePatch | undefined {
    if (!setupData) return undefined;
    const constraint = normalizeRoleConstraint(role, setupData.constraints[role]);
    const slots = normalizeLineupSlots(lineup[role], constraint.max);
    return slots[slotIndex]?.presetOverride;
  }

  function applySetupDraftOverrides(
    draftOverrides: Record<string, PresetOverridePatch | undefined>,
  ) {
    if (!setupData) return;
    const nextLineup: LineupMap = { ...lineup };
    ROLE_ORDER.forEach((role) => {
      const constraint = normalizeRoleConstraint(
        role,
        setupData.constraints[role],
      );
      const slots = normalizeLineupSlots(lineup[role], constraint.max).map(
        (slot, slotIndex) => {
          if (!slot.musicianId) return slot;
          const slotKey = `${role}:${slotIndex}`;
          const override = Object.prototype.hasOwnProperty.call(draftOverrides, slotKey)
            ? draftOverrides[slotKey]
            : slot.presetOverride;
          const normalizedOverride = normalizeBassConnectionOverridePatch(
            resolveSlotSetup(role as Group, slot.musicianId).resolved.defaultPreset,
            override,
          );
          return {
            musicianId: slot.musicianId,
            ...(normalizedOverride ? { presetOverride: normalizedOverride } : {}),
          };
        },
      );
      nextLineup[role] = (
        constraint.max <= 1 ? slots[0] : slots
      ) as LineupMap[string];
    });
    applyState(nextLineup, setupData, bandLeaderId, talkbackOwnerId);
  }

  const resolveSlotSetup = useCallback(
    (role: Group, musicianId: string, patch?: PresetOverridePatch) => {
      const musicianDefaults = setupData?.musicianDefaults?.[musicianId];
      const musicianDefaultInputs = resolveMusicianDefaultInputsFromPresets(
        role,
        setupData?.musicianPresetsById?.[musicianId],
      );
      const resolved = resolveEffectiveMusicianSetup({
        musicianDefaults: musicianDefaultInputs
          ? { ...musicianDefaults, inputs: musicianDefaultInputs }
          : musicianDefaults,
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
    [setupData],
  );

  const backVocalMembersSorted = useMemo(
    () => [...backVocalMembers].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    [backVocalMembers],
  );
  const backVocsSetupItems = useMemo(
    () => backVocalMembersSorted.map((member) => {
      const defaultPreset = resolveSlotSetup("vocs", member.id).resolved.defaultPreset;
      const defaultInputKeys = new Set(defaultPreset.inputs.map((item) => item.key));
      const slots = normalizeLineupSlots(lineup.back_vocs, 8);
      const existing = slots.find((slot) => slot.musicianId === member.id)?.presetOverride;
      const draft = backVocsSetupDraft[member.id];
      const patch = Object.prototype.hasOwnProperty.call(backVocsSetupDraft, member.id) ? draft : existing;
      const { effective } = resolveSlotSetup("vocs", member.id, patch);
      const value = effective.inputs.some((input) => input.key === "voc_back_wired")
        ? "vocal_back_wired"
        : effective.inputs.some((input) => input.key === "voc_back_wireless")
          ? "vocal_back_wireless"
          : "vocal_back_no_mic";
      const isModified = !effective.inputs.every((input) => defaultInputKeys.has(input.key)) || effective.inputs.length !== defaultInputKeys.size;
      return { musicianId: member.id, name: member.name, value, isModified };
    }),
    [backVocalMembersSorted, backVocsSetupDraft, lineup.back_vocs, resolveSlotSetup],
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
      const constraint = normalizeRoleConstraint(
        role,
        setupData.constraints[role],
      );
      return normalizeLineupSlots(lineup[role], constraint.max)
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
    const constraint = normalizeRoleConstraint(
      role,
      setupData.constraints[role],
    );
    return normalizeLineupSlots(lineup[role], constraint.max)
      .map((slot, slotIndex) => ({ role, slotIndex, slot }))
      .filter(({ slot }) => Boolean(slot.musicianId))
      .map(({ role, slotIndex, slot }) => ({
        slotKey: `${role}:${slotIndex}`,
        musicianId: slot.musicianId,
        musicianName:
          selectedMusicianMap.get(slot.musicianId) ?? slot.musicianId,
        role: role as Group,
        hasOverride: Boolean(slot.presetOverride),
      }));
  }, [editingSetup, lineup, selectedMusicianMap, setupData]);

  const selectedSetupMusician =
    setupMusicians.find((item) => item.slotKey === selectedSetupSlotKey) ??
    setupMusicians[0];

  const resetModalRef = useModalBehavior(showResetConfirmation, () =>
    setShowResetConfirmation(false),
  );
  const musicianSelectorRef = useModalBehavior(
    Boolean(editing && setupData),
    () => setEditing(null),
  );
  const backVocsModalRef = useModalBehavior(Boolean(isBackVocsModalOpen), () =>
    setIsBackVocsModalOpen(false),
  );
  const backVocsSetupModalRef = useModalBehavior(Boolean(isBackVocsSetupOpen), () =>
    setIsBackVocsSetupOpen(false),
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
        {setupData
          ? ROLE_ORDER.map((role) => {
              const constraint = normalizeRoleConstraint(
                role,
                setupData.constraints[role],
              );
              const selected = normalizeLineupValue(
                lineup[role],
                constraint.max,
              );
              const members = setupData.members[role] || [];
              return (
                <article key={role} className="lineup-card">
                  <h3>
                    {getRoleDisplayName(
                      role,
                      setupData.constraints,
                      setupData.roleConstraints,
                    )}
                  </h3>
                  <div className="lineup-card__body section-divider">
                    <div className="lineup-list lineup-list--single">
                      {(selected.length ? selected : [""]).map(
                        (musicianId, index) => {
                          const alternatives = members.filter(
                            (m) => m.id !== musicianId,
                          );
                          return (
                            <div
                              key={`${role}-${index}`}
                              className="lineup-list__row"
                            >
                              <span className="lineup-list__name">
                                {musicianId
                                  ? (members.find((m) => m.id === musicianId)
                                      ?.name ?? musicianId)
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
                                      currentSelectedId:
                                        musicianId || undefined,
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
                                      const setupConstraint =
                                        normalizeRoleConstraint(
                                          setupRole,
                                          setupData.constraints[setupRole],
                                        );
                                      normalizeLineupSlots(
                                        lineup[setupRole],
                                        setupConstraint.max,
                                      ).forEach((setupSlot, setupIndex) => {
                                        if (!setupSlot.musicianId) return;
                                        draftEntries[
                                          `${setupRole}:${setupIndex}`
                                        ] = normalizeBassConnectionOverridePatch(
                                          resolveSlotSetup(setupRole as Group, setupSlot.musicianId).resolved.defaultPreset,
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
                                  {normalizeLineupSlots(
                                    lineup[role],
                                    constraint.max,
                                  )[index]?.presetOverride
                                    ? " •"
                                    : ""}
                                </button>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          : ROLE_ORDER.map((role) => {
              const constraint = normalizeRoleConstraint(role);
              return (
                <article key={role} className="lineup-card">
                  <h3>{getRoleDisplayName(role)}</h3>
                  <div className="lineup-card__body section-divider">
                    <div className="lineup-list lineup-list--single">
                      {Array.from({ length: Math.max(1, constraint.max) }).map(
                        (_, index) => (
                          <div
                            key={`${role}-${index}`}
                            className="lineup-list__row"
                          >
                            <span className="lineup-list__name">
                              Not selected
                            </span>
                            <div className="lineup-list__actions">
                              <button
                                type="button"
                                className="button-secondary"
                                disabled
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                className="button-secondary"
                                disabled
                              >
                                Setup
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
        <BackVocsBlock
          members={backVocalMembers}
          changeDisabled={selectedOptions.length === 0}
          onChange={() => setIsBackVocsModalOpen(true)}
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
                  ?.name || "Use band leader default"}
              </span>
              <button
                type="button"
                className="button-secondary"
                disabled={
                  selectedOptions.filter((m) => m.id !== talkbackCurrentOwnerId)
                    .length === 0
                }
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
              This will reset lineup, band leader, and talkback to the band
              defaults.
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
                setShowResetConfirmation(false);
              }}
            >
              Reset
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
              const availableInputs = (
                GROUP_INPUT_LIBRARY[
                  selectedSetupMusician.role as keyof typeof GROUP_INPUT_LIBRARY
                ] ?? []
              ).filter(
                (item: InputChannel) =>
                  !effective.inputs.some(
                    (effectiveItem) => effectiveItem.key === item.key,
                  ),
              );
              const drumSetup =
                selectedSetupMusician.role === "drums"
                  ? inferDrumSetupFromLegacyInputs(effective.inputs)
                  : null;
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
                    title={`Setup for this event – ${selectedSetupMusician.musicianName} (${selectedSetupMusician.role})`}
                    subtitle="Changes here apply only to this event. Band defaults are not modified."
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
                          const constraint = normalizeRoleConstraint(
                            role,
                            setupData.constraints[role],
                          );
                          normalizeLineupSlots(lineup[role], constraint.max).forEach((slot, slotIndex) => {
                            if (slot.musicianId !== selectedSetupMusician.musicianId) return;
                            next[`${role}:${slotIndex}`] = resetOverrides();
                          });
                        });
                        return next;
                      });
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
                          hasOverride: Boolean(setupDraftBySlot[item.slotKey]),
                        }))}
                        selectedSlotKey={selectedSetupMusician.slotKey}
                        onSelect={setSelectedSetupSlotKey}
                      />
                      {selectedSetupMusician.role === "bass" ? (
                        <div className="setup-editor-stack">
                          <SetupSection
                            title="Inputs"
                            modified={resolved.diffMeta.inputs.some((item) => item.origin === "override")}
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
                                  [selectedSetupMusician.slotKey]: nextPatch,
                                }))
                              }
                            />
                          </SetupSection>
                          <SetupSection
                            title="Monitoring"
                            modified={
                              isMonitoringModified({
                                monitorRefOrigin: resolved.diffMeta.monitoring.monitorRef.origin,
                                additionalWedgeCountOrigin: resolved.diffMeta.monitoring.additionalWedgeCount.origin,
                                effectiveAdditionalWedgeCount: effective.monitoring.additionalWedgeCount,
                              })
                            }
                          >
                            <MonitoringEditor
                              effectiveMonitoring={effective.monitoring}
                              patch={currentPatch}
                              diffMeta={resolved.diffMeta}
                              onChangePatch={(nextPatch) =>
                                setSetupDraftBySlot((prev) => ({
                                  ...prev,
                                  [selectedSetupMusician.slotKey]: nextPatch,
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
                                  setSetupDraftBySlot((prev) => {
                                    const prior =
                                      prev[selectedSetupMusician.slotKey];
                                    const nextInputsPatch =
                                      buildInputsPatchFromTarget(
                                        resolved.defaultPreset.inputs,
                                        targetInputs,
                                      );
                                    return {
                                      ...prev,
                                      [selectedSetupMusician.slotKey]: {
                                        ...prior,
                                        ...(Object.keys(nextInputsPatch)
                                          .length > 0
                                          ? { inputs: nextInputsPatch }
                                          : {}),
                                      },
                                    };
                                  });
                                }}
                              />
                            ) : null}
                            {selectedSetupMusician.role === "drums" ? (
                              <SelectedInputsList
                                effectiveInputs={effective.inputs}
                                inputDiffMeta={resolved.diffMeta.inputs}
                                availableInputs={[]}
                                nonRemovableKeys={[
                                  "dr_kick_out",
                                  "dr_kick_in",
                                  "dr_snare1_top",
                                  "dr_snare1_bottom",
                                ]}
                                onRemoveInput={(key) => {
                                  setSetupDraftBySlot((prev) => {
                                    const prior = prev[selectedSetupMusician.slotKey];
                                    const nextRemove = Array.from(new Set([...(prior?.inputs?.removeKeys ?? []), key]));
                                    const nextAdd = (prior?.inputs?.add ?? []).filter((item) => item.key !== key);
                                    return {
                                      ...prev,
                                      [selectedSetupMusician.slotKey]: {
                                        ...prior,
                                        inputs: { ...prior?.inputs, removeKeys: nextRemove, add: nextAdd },
                                      },
                                    };
                                  });
                                }}
                                onAddInput={() => {}}
                              />
                            ) : (
                              <SetupSection
                                title="Inputs"
                                modified={resolved.diffMeta.inputs.some((item) => item.origin === "override")}
                              >
                                <SchemaRenderer
                                  fields={selectedSetupMusician.role === "guitar" ? GUITAR_FIELDS : selectedSetupMusician.role === "keys" ? KEYS_FIELDS : LEAD_VOCS_FIELDS}
                                  state={{ defaultPreset: resolved.defaultPreset, effectivePreset: effective, patch: currentPatch }}
                                  onPatch={(nextPatch) =>
                                    setSetupDraftBySlot((prev) => ({
                                      ...prev,
                                      [selectedSetupMusician.slotKey]: nextPatch,
                                    }))
                                  }
                                />
                              </SetupSection>
                            )}
                          </div>
                          <div className="setup-editor-column">
                            <SetupSection
                              title="Monitoring"
                              modified={
                                isMonitoringModified({
                                  monitorRefOrigin: resolved.diffMeta.monitoring.monitorRef.origin,
                                  additionalWedgeCountOrigin: resolved.diffMeta.monitoring.additionalWedgeCount.origin,
                                  effectiveAdditionalWedgeCount: effective.monitoring.additionalWedgeCount,
                                })
                              }
                            >
                              <MonitoringEditor
                                effectiveMonitoring={effective.monitoring}
                                patch={currentPatch}
                                diffMeta={resolved.diffMeta}
                                onChangePatch={(nextPatch) =>
                                  setSetupDraftBySlot((prev) => ({
                                    ...prev,
                                    [selectedSetupMusician.slotKey]: nextPatch,
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
            saveDisabled={!defaultBackVocalRef}
            saveError={
              !defaultBackVocalRef
                ? "No back vocal preset is available."
                : undefined
            }
            onCancel={() => setIsBackVocsModalOpen(false)}
            onSave={(nextSelectedIds) => {
              const sanitizedSelectedIds = sanitizeBackVocsSelection(
                nextSelectedIds,
                leadVocalIds,
              );
              setBackVocalIds(Array.from(sanitizedSelectedIds));
              setIsBackVocsModalOpen(false);
            }}
          />
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={isBackVocsSetupOpen}
        onClose={() => setIsBackVocsSetupOpen(false)}
      >
        <div ref={backVocsSetupModalRef}>
          <BackVocsSetupModal
            open={isBackVocsSetupOpen}
            items={backVocsSetupItems}
            onBack={() => setIsBackVocsSetupOpen(false)}
            onReset={() => {
              const next = Object.fromEntries(backVocsSetupItems.map((item) => [item.musicianId, undefined]));
              setBackVocsSetupDraft(next);
            }}
            onSave={() => {
              const current = normalizeLineupSlots(lineup.back_vocs, 8);
              const nextById = new Map(current.map((slot) => [slot.musicianId, slot]));
              for (const item of backVocsSetupItems) {
                const override = Object.prototype.hasOwnProperty.call(backVocsSetupDraft, item.musicianId)
                  ? backVocsSetupDraft[item.musicianId]
                  : nextById.get(item.musicianId)?.presetOverride;
                nextById.set(item.musicianId, { musicianId: item.musicianId, ...(override ? { presetOverride: override } : {}) });
              }
              setLineup((prev) => ({ ...prev, back_vocs: Array.from(nextById.values()) }));
              setIsBackVocsSetupOpen(false);
            }}
            onChange={(musicianId, presetId) => {
              const targetPreset = backVocalPresetRefs.find((item) => item.id === presetId);
              if (!targetPreset) return;
              const nextPatch = withInputsTarget(
                resolveSlotSetup("vocs", musicianId).resolved.defaultPreset.inputs,
                backVocsSetupDraft[musicianId],
                targetPreset.inputs as InputChannel[],
              );
              setBackVocsSetupDraft((prev) => ({ ...prev, [musicianId]: nextPatch }));
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
                  setupData.constraints,
                  setupData.roleConstraints,
                )}
              </h3>
            </div>
            <div className="selector-dialog__divider section-divider" />
            <div className="selector-list">
              {(editing.role === "leader"
                ? selectedOptions
                : editing.role === "talkback"
                  ? selectedOptions
                  : setupData.members[editing.role] || []
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
                    else if (editing.role === "talkback")
                      setTalkbackOwnerId(member.id);
                    else updateSlot(editing.role, editing.slotIndex, member.id);
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
