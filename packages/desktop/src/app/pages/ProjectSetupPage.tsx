import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type SetupCapabilitySection,
  resolveMusicianCapabilityInputs,
  supportsCapabilitySection,
} from "../../../../../src/domain/lineup/resolveLineupInstrumentMembership";
import type { Group } from "../../../../../src/domain/model/groups";
import { resolvePresetIdAlias } from "../../../../../src/domain/model/presetAliases";
import type {
  InputChannel,
  Musician,
  MusicianSetupPreset,
  PresetEntity,
  PresetItem,
} from "../../../../../src/domain/model/types";
import { summarizeEffectivePresetValidation } from "../../../../../src/domain/rules/presetOverride";
import { ModalOverlay, useModalBehavior } from "../../components/ui/Modal";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Close,
} from "../../components/ui/icons";
import {
  type LineupMap,
  type LineupSlotValue,
  type PresetOverridePatch,
  addMusiciansToLineupSlots,
  getDefaultLineupSlotsForRole,
  getRoleDisplayName,
  getRoleSlotLimit,
  getUniqueSelectedMusicians,
  normalizeLineupSlots,
  resolveBandLeaderId,
  resolveTalkbackOwnerId,
  validateLineup,
} from "../../projectRules";
import { BackVocsBlock } from "../components/roles/BackVocsBlock";
import { LeadVocsBlock } from "../components/roles/LeadVocsBlock";
import { LineupRow } from "../components/roles/LineupRow";
import { ChangeBackVocsModal } from "../components/roles/modals/ChangeBackVocsModal";
import { ChangeLeadVocsModal } from "../components/roles/modals/ChangeLeadVocsModal";
import { sanitizeBackVocsSelection } from "../components/roles/utils/backVocs";
import { migrateProjectTalkbackOwner } from "../domain/project/migrateProjectTalkbackOwner";
import { ensureMusiciansInLineup } from "../domain/roles/ensureMusiciansInLineup";
import { resolveVocalOverlayEditorModel } from "../domain/roles/resolveVocalOverlayEditorModel";
import { enforceVocalSelectionInvariant } from "../domain/roles/vocalSelectionInvariant";
import { useSetupOverrides } from "../domain/setup/useSetupOverrides";
import {
  type LineupDirtyComparisonState,
  createLineupDirtyBaseline,
  hasUnsavedLineupChanges,
} from "../domain/ui/isLineupSetupDirty";
import { resolveMusicianDisplayName } from "../domain/ui/musicianDisplayName";
import * as projectsApi from "../services/projectsApi";
import { buildCanonicalProjectFromSetupState } from "../shell/canonicalProject";
import { nextStepPath } from "../shell/chrome/processSteps";
import { serializeLineupForProject } from "../shell/lineupSerialize";
import { withFrom } from "../shell/routes";
import type {
  BandSetupData,
  MemberOption,
  NewProjectPayload,
} from "../shell/types";
import type { ProjectRouteProps } from "./shared/pageTypes";
import {
  ROLE_ORDER,
  buildVisibleLineupSections,
  createFallbackSetupData,
  resolveSetupCardLabel,
} from "./shared/setupConstants";
import { resolveTalkbackSummaryLabel } from "./shared/talkbackSummary";

function hasOwnKey(value: unknown, key: string): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value, key)
  );
}

function normalizeOverlayIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((musicianId) => musicianId.length > 0);
}

function extractOverlayMusicianIds(
  value: string[] | null | undefined,
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => entry.trim())
    .filter((musicianId) => musicianId.length > 0);
}

const ROLE_EMPTY_LABELS: Record<string, string> = {
  drums: "No drummer assigned",
  bass: "No bassist assigned",
  guitar: "No guitarist assigned",
  keys: "No keyboardist assigned",
  vocs: "No vocalist assigned",
};

function getRoleEmptyLabel(role: string): string {
  return (
    ROLE_EMPTY_LABELS[role] ??
    `No ${getRoleDisplayName(role).toLowerCase()} assigned`
  );
}

type AssignmentRoleCopy = {
  title: string;
  assignedHeading: string;
  addHeading: string;
  placeholder: string;
  emptyState: string;
};

const ASSIGNMENT_ROLE_COPY: Record<string, AssignmentRoleCopy> = {
  drums: {
    title: "Edit drum assignments",
    assignedHeading: "Assigned drummers",
    addHeading: "Add drummers",
    placeholder: "Add another drummer",
    emptyState: "No drummer assigned",
  },
  bass: {
    title: "Edit bass assignments",
    assignedHeading: "Assigned bassists",
    addHeading: "Add bassists",
    placeholder: "Add another bassist",
    emptyState: "No bassist assigned",
  },
  guitar: {
    title: "Edit electric guitar assignments",
    assignedHeading: "Assigned electric guitarists",
    addHeading: "Add electric guitarists",
    placeholder: "Add another electric guitarist",
    emptyState: "No electric guitarist assigned",
  },
  keys: {
    title: "Edit keys assignments",
    assignedHeading: "Assigned keyboardists",
    addHeading: "Add keyboardists",
    placeholder: "Add another keyboardist",
    emptyState: "No keyboardist assigned",
  },
  vocs: {
    title: "Edit lead vocal assignments",
    assignedHeading: "Assigned lead vocalists",
    addHeading: "Add lead vocalists",
    placeholder: "Add another lead vocalist",
    emptyState: "No lead vocalist assigned",
  },
};

function getAssignmentRoleCopy(role: string): AssignmentRoleCopy {
  return (
    ASSIGNMENT_ROLE_COPY[role] ?? {
      title: `Edit ${getRoleDisplayName(role).toLowerCase()} assignments`,
      assignedHeading: `Assigned ${getRoleDisplayName(role).toLowerCase()}`,
      addHeading: `Add ${getRoleDisplayName(role).toLowerCase()}`,
      placeholder: `Add another ${getRoleDisplayName(role).toLowerCase()}`,
      emptyState: getRoleEmptyLabel(role),
    }
  );
}

type AddMusiciansMultiSelectProps = {
  id: string;
  options: MemberOption[];
  selectedIds: string[];
  placeholder: string;
  onSelectionChange: (nextSelectedIds: string[]) => void;
  onAddSelected: (selectedIds: string[]) => void;
};

function AddMusiciansMultiSelect({
  id,
  options,
  selectedIds,
  placeholder,
  onSelectionChange,
  onAddSelected,
}: AddMusiciansMultiSelectProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const orderedSelectedIds = options
    .filter((option) => selectedIdSet.has(option.id))
    .map((option) => option.id);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportMargin = 8;
    const preferredMaxHeight = Math.min(
      260,
      Math.round(window.innerHeight * 0.42),
    );
    const spaceBelow = window.innerHeight - rect.bottom - 6 - viewportMargin;
    const spaceAbove = rect.top - 6 - viewportMargin;
    const opensAbove =
      spaceBelow < preferredMaxHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      120,
      Math.min(preferredMaxHeight, opensAbove ? spaceAbove : spaceBelow),
    );
    setPanelPosition({
      left: rect.left,
      top: opensAbove
        ? Math.max(viewportMargin, rect.top - maxHeight - 6)
        : rect.bottom + 6,
      width: rect.width,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updatePanelPosition();
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, updatePanelPosition]);

  const setSelectedFromSet = (nextSet: Set<string>) => {
    onSelectionChange(
      options
        .filter((option) => nextSet.has(option.id))
        .map((option) => option.id),
    );
  };
  const toggleOption = (musicianId: string) => {
    const nextSet = new Set(selectedIds);
    if (nextSet.has(musicianId)) {
      nextSet.delete(musicianId);
    } else {
      nextSet.add(musicianId);
    }
    setSelectedFromSet(nextSet);
  };
  const addSelected = () => {
    if (orderedSelectedIds.length === 0) return;
    onAddSelected(orderedSelectedIds);
    onSelectionChange([]);
    setIsOpen(false);
  };

  return (
    <div className="lineup-multiselect">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="lineup-multiselect__trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => {
          updatePanelPosition();
          setIsOpen((current) => !current);
        }}
      >
        <span>
          {options.length === 0 ? "All musicians assigned" : placeholder}
        </span>
        <span aria-hidden="true" className="lineup-multiselect__chevron">
          <ChevronDown size={14} />
        </span>
      </button>
      {isOpen && panelPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="lineup-multiselect__popover"
              style={{
                left: `${panelPosition.left}px`,
                top: `${panelPosition.top}px`,
                width: `${panelPosition.width}px`,
                maxHeight: `${panelPosition.maxHeight}px`,
              }}
            >
              <div
                className="lineup-multiselect__options"
                aria-label={placeholder}
              >
                {options.length === 0 ? (
                  <p className="lineup-multiselect__empty">
                    No available musicians
                  </p>
                ) : (
                  options.map((option) => {
                    const selected = selectedIdSet.has(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={
                          selected
                            ? "lineup-multiselect__option is-selected"
                            : "lineup-multiselect__option"
                        }
                        onClick={() => toggleOption(option.id)}
                      >
                        <input
                          type="checkbox"
                          tabIndex={-1}
                          checked={selected}
                          readOnly
                          aria-hidden="true"
                        />
                        <span>{option.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="lineup-multiselect__footer">
                <span>
                  {orderedSelectedIds.length === 1
                    ? "1 selected"
                    : `${orderedSelectedIds.length} selected`}
                </span>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={orderedSelectedIds.length === 0}
                  onClick={addSelected}
                >
                  Add selected
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function ProjectSetupPage({
  id,
  navigate,
  registerNavigationGuard,
  search = "",
}: ProjectRouteProps) {
  const [project, setProject] = useState<NewProjectPayload | null>(null);
  const [setupData, setSetupData] = useState<BandSetupData | null>(null);
  const presetCatalog = setupData?.presetCatalog ?? {};
  const [lineup, setLineup] = useState<LineupMap>({});
  const [editing, setEditing] = useState<{
    role: string;
    slotIndex: number;
    currentSelectedId?: string;
  } | null>(null);
  const [assignmentEditor, setAssignmentEditor] = useState<{
    role: string;
    draftSlots: LineupSlotValue[];
    selectedMusicianIds: string[];
  } | null>(null);
  const [bandLeaderId, setBandLeaderId] = useState("");
  const [talkbackOwnerId, setTalkbackOwnerId] = useState("");
  const [hasTalkbackOverride, setHasTalkbackOverride] = useState(false);
  const [leadVocalIds, setLeadVocalIds] = useState<string[]>([]);
  const [hasLeadVocalOverride, setHasLeadVocalOverride] = useState(false);
  const [backVocalIds, setBackVocalIds] = useState<string[]>([]);
  const [hasBackVocalOverride, setHasBackVocalOverride] = useState(false);
  const [isLeadVocsModalOpen, setIsLeadVocsModalOpen] = useState(false);
  const [isBackVocsModalOpen, setIsBackVocsModalOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const initialSnapshotRef = useRef<LineupDirtyComparisonState | null>(null);
  const snapshotHydratedRef = useRef(false);

  const buildSetupSnapshot = useCallback(
    (
      nextLineup: LineupMap,
      data: BandSetupData,
      storedLeader?: string,
      storedTalkback?: string,
    ) => {
      const selected = getUniqueSelectedMusicians(nextLineup, ROLE_ORDER);
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
      console.info("[project-open] setup-init-start", { projectId: id });
      let rawProject = "";
      try {
        console.info("[project-open] before-read_project", { projectId: id });
        rawProject = await invoke<string>("read_project", { projectId: id });
        console.info("[project-open] after-read_project", {
          projectId: id,
          rawLength: rawProject.length,
        });
      } catch (error) {
        console.error("[project-open] read_project-failed", {
          projectId: id,
          error,
        });
        throw error;
      }
      let parsedRaw: NewProjectPayload;
      try {
        parsedRaw = JSON.parse(rawProject) as NewProjectPayload;
        console.info("[project-open] after-json-parse", {
          projectId: id,
          hasLineup: Boolean(parsedRaw.lineup),
          lineupKeys: Object.keys(parsedRaw.lineup ?? {}),
        });
      } catch (error) {
        console.error("[project-open] json-parse-failed", {
          projectId: id,
          error,
        });
        throw error;
      }
      const parsed = migrateProjectTalkbackOwner(parsedRaw);
      console.info("[project-open] after-project-migrate", {
        projectId: id,
        lineupKeys: Object.keys(parsed.lineup ?? {}),
      });
      const rawOverlays =
        parsed.overlays && typeof parsed.overlays === "object"
          ? parsed.overlays
          : undefined;
      const parsedHasLeadOverlay = hasOwnKey(rawOverlays, "leadVocals");
      const parsedHasBackOverlay = hasOwnKey(rawOverlays, "backVocals");
      const parsedHasTalkbackOverlay = hasOwnKey(rawOverlays, "talkback");
      const parsedHasLeadVocalOverride = parsedHasLeadOverlay;
      const parsedHasBackVocalOverride = parsedHasBackOverlay;
      const parsedHasTalkbackOverride = parsedHasTalkbackOverlay;
      const parsedTalkbackOwnerIdFromOverlay = (() => {
        if (!parsedHasTalkbackOverlay) return undefined;
        const talkback = rawOverlays?.talkback;
        if (!talkback || typeof talkback !== "object") return "";
        const mode = (talkback as { mode?: unknown }).mode;
        if (mode === "none") return "";
        const ownerId = (talkback as { ownerId?: unknown }).ownerId;
        return typeof ownerId === "string" ? ownerId.trim() : "";
      })();
      const parsedTalkbackOwnerId =
        parsedTalkbackOwnerIdFromOverlay ??
        (typeof parsed.talkbackOwnerId === "string"
          ? parsed.talkbackOwnerId.trim()
          : typeof (parsedRaw as unknown as { talkBackOwnerId?: unknown })
                .talkBackOwnerId === "string"
            ? (
                parsedRaw as unknown as { talkBackOwnerId: string }
              ).talkBackOwnerId.trim()
            : "");
      setProject(parsed);
      const persistedBackVocalIds = parsedHasBackOverlay
        ? normalizeOverlayIds(rawOverlays?.backVocals)
        : [];
      const persistedLeadVocalIds = parsedHasLeadOverlay
        ? normalizeOverlayIds(rawOverlays?.leadVocals)
        : [];
      setBackVocalIds(persistedBackVocalIds);
      setLeadVocalIds(persistedLeadVocalIds);
      setHasBackVocalOverride(parsedHasBackVocalOverride);
      setHasLeadVocalOverride(parsedHasLeadVocalOverride);
      setHasTalkbackOverride(parsedHasTalkbackOverride);
      setTalkbackOwnerId(parsedTalkbackOwnerId);
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
      console.info("[project-open] setup-data-loaded", {
        projectId: id,
        bandRef: parsed.bandRef,
        hasDefaultLineup: Boolean(data.defaultLineup),
      });
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
      console.info("[project-open] pre-normalize-lineup", {
        projectId: id,
        hasStoredLineup,
        keys: Object.keys(initialLineup),
      });
      const initialState = buildSetupSnapshot(
        initialLineup,
        data,
        parsed.bandLeaderId,
        parsedTalkbackOwnerId,
      );
      console.info("[project-open] initial-setup-snapshot", {
        projectId: id,
        selectedMusicians: getUniqueSelectedMusicians(
          initialState.lineup,
          ROLE_ORDER,
        ).length,
      });
      setLineup(initialLineup);
      setBandLeaderId(initialState.bandLeaderId);
      if (!hasStoredLineup) {
        const updatedProject: NewProjectPayload = {
          ...parsed,
          lineup: serializeLineupForProject(initialState.lineup, ROLE_ORDER),
          bandLeaderId: initialState.bandLeaderId || undefined,
          talkbackOwnerId: parsedTalkbackOwnerId,
        };
        await projectsApi.saveProjectPayload({
          projectId: id,
          payload: updatedProject,
          intent: "system",
        });
        setProject(updatedProject);
      } else {
        const hasLegacyLineupFormat = Object.values(parsed.lineup ?? {}).some(
          (v) => v !== undefined && !Array.isArray(v),
        );
        if (hasLegacyLineupFormat) {
          const migratedLineup = serializeLineupForProject(
            initialState.lineup,
            ROLE_ORDER,
          );
          const migratedProject: NewProjectPayload = {
            ...parsed,
            lineup: migratedLineup,
          };
          await projectsApi.saveProjectPayload({
            projectId: id,
            payload: migratedProject,
            intent: "system",
          });
          setProject(migratedProject);
        }
      }
      const initialSerializedLineup = serializeLineupForProject(
        initialState.lineup,
        ROLE_ORDER,
      );
      console.info("[project-open] after-serialize-lineup", {
        projectId: id,
        serializedKeys: Object.keys(initialSerializedLineup),
      });
      const initialTemplateMusicians = getUniqueSelectedMusicians(
        initialState.lineup,
        ROLE_ORDER,
      );
      const effectiveInitialLeadVocalIds = parsedHasLeadVocalOverride
        ? persistedLeadVocalIds.filter((idValue) =>
            initialTemplateMusicians.includes(idValue),
          )
        : [];
      const effectiveBackVocalIds = parsedHasBackVocalOverride
        ? persistedBackVocalIds
        : [];
      initialSnapshotRef.current = createLineupDirtyBaseline({
        lineup: initialSerializedLineup,
        bandLeaderId: initialState.bandLeaderId,
        talkbackOwnerId: parsedHasTalkbackOverride
          ? parsedTalkbackOwnerId
          : parsedTalkbackOwnerId,
        leadVocalIds: effectiveInitialLeadVocalIds,
        hasLeadVocalOverride: parsedHasLeadVocalOverride,
        backVocalIds: effectiveBackVocalIds,
        hasBackVocalOverride: parsedHasBackVocalOverride,
        hasTalkbackOverride: parsedHasTalkbackOverride,
      });
    })().catch((error) => {
      console.error("[project-open] setup-init-failed", {
        projectId: id,
        error,
      });
      setStatus("Failed to load setup.");
    });
  }, [id, applyState, buildSetupSnapshot]);

  const errors = useMemo(
    () => (!setupData ? [] : validateLineup(lineup, ROLE_ORDER)),
    [lineup, setupData],
  );
  const selectedMusicianIds = useMemo(
    () => (!setupData ? [] : getUniqueSelectedMusicians(lineup, ROLE_ORDER)),
    [lineup, setupData],
  );
  const selectedOptions = useMemo(() => {
    if (!setupData) return [] as MemberOption[];
    const byId = new Map<string, MemberOption>();
    for (const members of Object.values(setupData.members)) {
      for (const member of members) {
        byId.set(member.id, member);
      }
    }
    return selectedMusicianIds
      .map((idValue) => byId.get(idValue))
      .filter(Boolean) as MemberOption[];
  }, [selectedMusicianIds, setupData]);
  const allBandMembers = useMemo(() => {
    if (!setupData) return [] as MemberOption[];
    const byId = new Map<string, MemberOption>();
    for (const members of Object.values(setupData.members)) {
      for (const member of members) {
        byId.set(member.id, member);
      }
    }
    return Array.from(byId.values());
  }, [setupData]);
  const allBandMusicians = useMemo<Musician[]>(() => {
    if (!setupData) return [];
    const byId = new Map<string, Musician>();
    for (const [group, members] of Object.entries(setupData.members)) {
      for (const member of members) {
        if (byId.has(member.id)) continue;
        byId.set(member.id, {
          id: member.id,
          firstName: "",
          lastName: "",
          group: group as Group,
          presets: (setupData.musicianPresetsById?.[member.id] ??
            []) as PresetItem[],
        });
      }
    }
    return Array.from(byId.values());
  }, [setupData]);
  const allBandMusiciansById = useMemo(
    () => new Map(allBandMusicians.map((musician) => [musician.id, musician])),
    [allBandMusicians],
  );
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
  const templateMusicians = selectedOptions;
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
  const talkbackCurrentOwnerId = hasTalkbackOverride
    ? talkbackOwnerId
    : bandLeaderId;
  const defaultLeadVocalIds = useMemo(
    () =>
      Array.from(
        new Set(
          extractOverlayMusicianIds(setupData?.defaultOverlays?.leadVocals),
        ),
      ),
    [setupData?.defaultOverlays?.leadVocals],
  );
  const rawSelectedLeadVocalIds = useMemo(() => {
    return extractOverlayMusicianIds(leadVocalIds);
  }, [leadVocalIds]);
  const rawSelectedBackVocalIds = useMemo(() => {
    return extractOverlayMusicianIds(backVocalIds);
  }, [backVocalIds]);
  const vocalOverlayModel = useMemo(
    () =>
      resolveVocalOverlayEditorModel({
        lineupMusicians: selectedTemplateMusicians,
        lineupMembers: templateMusicians,
        catalogMusicians: allBandMusicians,
        catalogMembers: allBandMembers,
        presetCatalog,
        rawLeadIds: rawSelectedLeadVocalIds,
        rawBackIds: rawSelectedBackVocalIds,
      }),
    [
      allBandMembers,
      allBandMusicians,
      presetCatalog,
      rawSelectedBackVocalIds,
      rawSelectedLeadVocalIds,
      selectedTemplateMusicians,
      templateMusicians,
    ],
  );
  const {
    selectedLeadIds: selectedLeadVocalIds,
    selectedBackIds: selectedBackVocalIds,
    leadMembers: leadVocalMembers,
    backMembers: backVocalMembers,
    leadSections: leadVocalCandidateSections,
    backSections: backVocalCandidateSections,
    candidateIds: lineupVocalCandidateIdSet,
    hasCandidates: hasVocalCandidates,
  } = vocalOverlayModel;

  const serializedLineup = useMemo(() => {
    if (!setupData) return {} as LineupMap;
    const nextLineup = ensureMusiciansInLineup(lineup, allBandMusiciansById, [
      ...selectedLeadVocalIds,
      ...selectedBackVocalIds,
    ]);
    return serializeLineupForProject(nextLineup, ROLE_ORDER);
  }, [
    allBandMusiciansById,
    lineup,
    selectedBackVocalIds,
    selectedLeadVocalIds,
    setupData,
  ]);
  const defaultSelectedBackVocalIds = useMemo(() => {
    if (!setupData) return [] as string[];
    const leadIds = new Set(
      extractOverlayMusicianIds(setupData.defaultOverlays?.leadVocals),
    );
    return Array.from(
      sanitizeBackVocsSelection(
        new Set(
          extractOverlayMusicianIds(setupData.defaultOverlays?.backVocals),
        ),
        leadIds,
      ),
    );
  }, [setupData]);

  const currentSnapshot = JSON.stringify({
    lineup: serializedLineup,
    bandLeaderId,
    talkbackOwnerId: talkbackCurrentOwnerId,
    hasTalkbackOverride,
    leadVocalIds: [...selectedLeadVocalIds],
    hasLeadVocalOverride,
    backVocalIds: [...selectedBackVocalIds],
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
        ensureMusiciansInLineup(defaults.lineup, allBandMusiciansById, [
          ...defaultLeadVocalIds,
          ...defaultSelectedBackVocalIds,
        ]),
        ROLE_ORDER,
      ),
      backVocalIds: defaultSelectedBackVocalIds,
      leadVocalIds: defaultLeadVocalIds,
      hasLeadVocalOverride: true,
      hasBackVocalOverride: true,
      hasTalkbackOverride: false,
    });
  }, [
    defaultLeadVocalIds,
    defaultSelectedBackVocalIds,
    allBandMusiciansById,
    setupData,
    buildSetupSnapshot,
  ]);
  const currentDirtyState = useMemo<LineupDirtyComparisonState>(
    () => ({
      lineup: serializedLineup,
      bandLeaderId,
      talkbackOwnerId: talkbackCurrentOwnerId,
      leadVocalIds: selectedLeadVocalIds,
      hasLeadVocalOverride,
      backVocalIds: selectedBackVocalIds,
      hasBackVocalOverride,
      hasTalkbackOverride,
    }),
    [
      bandLeaderId,
      hasLeadVocalOverride,
      hasBackVocalOverride,
      hasTalkbackOverride,
      selectedLeadVocalIds,
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
            leadVocalIds: [],
            hasLeadVocalOverride: false,
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

  const canonicalProjectDraft = useMemo(() => {
    if (!project) return null;
    const nextLineup = ensureMusiciansInLineup(lineup, allBandMusiciansById, [
      ...selectedLeadVocalIds,
      ...selectedBackVocalIds,
    ]);
    return buildCanonicalProjectFromSetupState({
      project,
      roleOrder: ROLE_ORDER,
      lineup: nextLineup,
      bandLeaderId,
      talkbackOwnerId: talkbackCurrentOwnerId,
      hasTalkbackOverride,
      leadVocalIds: [...selectedLeadVocalIds],
      hasLeadVocalOverride,
      backVocalIds: [...selectedBackVocalIds],
      hasBackVocalOverride,
    });
  }, [
    allBandMusiciansById,
    bandLeaderId,
    hasBackVocalOverride,
    hasLeadVocalOverride,
    hasTalkbackOverride,
    lineup,
    project,
    selectedBackVocalIds,
    selectedLeadVocalIds,
    talkbackCurrentOwnerId,
  ]);

  async function persistProject(next?: Partial<NewProjectPayload>) {
    if (!canonicalProjectDraft) return;
    const payload: NewProjectPayload = { ...canonicalProjectDraft, ...next };
    await projectsApi.saveProjectPayload({
      projectId: id,
      payload,
      intent: "content",
    });
    setProject(payload);
    initialSnapshotRef.current = createLineupDirtyBaseline({
      lineup: serializeLineupForProject(payload.lineup ?? {}, ROLE_ORDER),
      bandLeaderId: payload.bandLeaderId ?? "",
      talkbackOwnerId: payload.talkbackOwnerId ?? "",
      leadVocalIds: [...selectedLeadVocalIds],
      hasLeadVocalOverride,
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
    const value =
      Number.isFinite(roleSlotLimit) && roleSlotLimit <= 1
        ? compact[0]
        : compact;
    const nextLineup = { ...lineup, [role]: value as LineupMap[string] };
    applyState(nextLineup, setupData, bandLeaderId, talkbackOwnerId);
  }

  function updateSlot(role: string, slotIndex: number, musicianId: string) {
    if (!setupData) return;
    const roleSlotLimit = getRoleSlotLimit(role);
    const current = normalizeLineupSlots(lineup[role], roleSlotLimit);
    if (
      musicianId &&
      current.some(
        (slot, index) => index !== slotIndex && slot.musicianId === musicianId,
      )
    ) {
      return;
    }
    while (current.length <= slotIndex) current.push({ musicianId: "" });
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

  const { setupForSlot } = useSetupOverrides({
    setupData,
    presetCatalog,
  });

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
          effective: setupForSlot(
            role as Group,
            slot.musicianId,
            slot.presetOverride,
          ).effective,
        }))
        .filter((slot) => Boolean(slot.musicianId));
    });
  }, [lineup, setupForSlot, setupData]);

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
  const resolveMusicianCapabilityDefaultInputs = useCallback(
    (musicianId: string): InputChannel[] =>
      resolveMusicianCapabilityInputs({
        presetItems: setupData?.musicianPresetsById?.[musicianId],
        getPresetByRef: (ref) => presetCatalog[resolvePresetIdAlias(ref)],
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
      return ROLE_ORDER.filter((role) => role !== "vocs").map((role) => ({
        kind: "role" as const,
        role,
      }));
    }

    return buildVisibleLineupSections({
      roleOrder: ROLE_ORDER,
      resolveRoleSlots: (role) => {
        const roleSlotLimit = getRoleSlotLimit(role);
        return normalizeLineupSlots(lineup[role], roleSlotLimit);
      },
      resolveMusicianDefaultInputs: (musicianId) =>
        resolveMusicianCapabilityDefaultInputs(musicianId),
    }).filter((section) => section.kind !== "role" || section.role !== "vocs");
  }, [lineup, resolveMusicianCapabilityDefaultInputs, setupData]);

  function openAssignmentEditor(role: string) {
    setAssignmentEditor({
      role,
      draftSlots: normalizeLineupSlots(lineup[role], getRoleSlotLimit(role)),
      selectedMusicianIds: [],
    });
  }

  function resetAssignmentEditorToBandDefaults(role: string) {
    if (!setupData) return;
    setAssignmentEditor((current) =>
      current?.role === role
        ? {
            ...current,
            draftSlots: getDefaultLineupSlotsForRole(
              setupData.defaultLineup,
              role,
            ),
            selectedMusicianIds: [],
          }
        : current,
    );
  }

  const resetModalRef = useModalBehavior(showResetConfirmation, () =>
    setShowResetConfirmation(false),
  );
  const musicianSelectorRef = useModalBehavior(
    Boolean(editing && setupData),
    () => setEditing(null),
  );
  const assignmentEditorRef = useModalBehavior(
    Boolean(assignmentEditor && setupData),
    () => setAssignmentEditor(null),
  );
  const leadVocsModalRef = useModalBehavior(Boolean(isLeadVocsModalOpen), () =>
    setIsLeadVocsModalOpen(false),
  );
  const backVocsModalRef = useModalBehavior(Boolean(isBackVocsModalOpen), () =>
    setIsBackVocsModalOpen(false),
  );

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
      <div className="lineup-rows">
        {visibleLineupSections.map((section) => {
          if (section.kind === "acoustic_guitar") {
            // Derived from the guitar slots, so there is nothing to change here.
            const names = section.members.map((member) => {
              const sourceSlots = normalizeLineupSlots(
                lineup[member.sourceRole],
                getRoleSlotLimit(member.sourceRole),
              );
              const musicianId =
                sourceSlots[member.sourceSlotIndex]?.musicianId ??
                member.musicianId;
              const sourceMembers = resolveEligibleMembersForSection(
                "acoustic_guitar",
                member.sourceRole,
              );
              return {
                key: `${member.sourceRole}-${member.sourceSlotIndex}`,
                label: musicianId
                  ? resolveMusicianDisplayName({
                      musicianId,
                      preferredName: sourceMembers.find(
                        (m) => m.id === musicianId,
                      )?.name,
                    })
                  : "Not selected",
              };
            });

            return (
              <LineupRow
                key="acoustic-guitar"
                roleLabel="AC. GUITAR"
                names={names}
              />
            );
          }

          const role = section.role;
          const roleSlotLimit = getRoleSlotLimit(role);
          const slots = normalizeLineupSlots(lineup[role], roleSlotLimit);
          const sectionCapability: SetupCapabilitySection =
            role === "guitar" ? "guitar" : (role as SetupCapabilitySection);
          const members = resolveEligibleMembersForSection(
            sectionCapability,
            role,
          );

          const hasOverride = slots.some((slot) =>
            Boolean(slot.presetOverride),
          );

          return (
            <LineupRow
              key={role}
              roleLabel={
                role === "guitar"
                  ? resolveSetupCardLabel({
                      role: "guitar",
                      musicianId: slots[0]?.musicianId,
                      resolveInputs: (musicianId) =>
                        setupForSlot("guitar", musicianId).resolved
                          .defaultPreset.inputs,
                      fallback: getRoleDisplayName(role),
                    })
                  : getRoleDisplayName(role)
              }
              names={slots.map((slot, index) => ({
                key: `${role}-${index}`,
                label: resolveMusicianDisplayName({
                  musicianId: slot.musicianId,
                  preferredName: members.find((m) => m.id === slot.musicianId)
                    ?.name,
                }),
              }))}
              emptyLabel={getRoleEmptyLabel(role)}
              meta={
                // Was a bare "•" appended to the Setup button label.
                hasOverride ? (
                  <span className="setup-badge setup-badge--override">
                    Setup edited
                  </span>
                ) : null
              }
              actions={
                <>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => openAssignmentEditor(role)}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={slots.length === 0}
                    onClick={() => {
                      // F5d R6: sekce Inputs i monitoring slotu žijí od téhle
                      // fáze na obrazovce `02`. Cíl se bere z `processSteps`,
                      // ne zadrátovanou cestou, aby se flow `01 → 02 → 03 → 04`
                      // a process trail nemohly rozejít.
                      const target = nextStepPath("lineup", id);
                      if (target) navigate(target);
                    }}
                  >
                    Setup
                  </button>
                </>
              }
            />
          );
        })}
        <LeadVocsBlock
          members={leadVocalMembers}
          changeDisabled={!hasVocalCandidates}
          onChange={() => setIsLeadVocsModalOpen(true)}
        />
        <BackVocsBlock
          members={backVocalMembers}
          changeDisabled={!hasVocalCandidates}
          onChange={() => setIsBackVocsModalOpen(true)}
        />
        {/* These two hints used to be paragraphs floating above their cards;
            as rows they sit with the position they describe. */}
        <LineupRow
          roleLabel="BAND LEADER"
          names={[
            {
              key: "band-leader",
              label:
                selectedOptions.find((m) => m.id === bandLeaderId)?.name ||
                "Not selected",
            },
          ]}
          hint="On-site band lead for coordination and decisions."
          actions={
            <button
              type="button"
              className="button-secondary"
              disabled={
                selectedOptions.filter((m) => m.id !== bandLeaderId).length ===
                0
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
          }
        />
        <LineupRow
          roleLabel="TALKBACK"
          names={[
            {
              key: "talkback",
              label: resolveTalkbackSummaryLabel(
                selectedOptions.find((m) => m.id === talkbackCurrentOwnerId)
                  ?.name,
              ),
            },
          ]}
          hint="Owner of the talkback microphone."
          actions={
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
          }
        />
      </div>
      {errors.length + overrideValidationErrors.length > 0 ? (
        <div className="status status--error" role="alert">
          {[...errors, ...overrideValidationErrors].map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      {overrideValidationWarnings.length > 0 ? (
        <div className="status status--warning" aria-live="polite">
          {overrideValidationWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <p>
            Review setup overrides in each role to reduce required monitor
            sends, if needed.
          </p>
        </div>
      ) : null}
      {status ? (
        <p className="status status--error" role="alert">
          {status}
        </p>
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
          className="button-primary"
          onClick={async () => {
            if (errors.length > 0 || overrideValidationErrors.length > 0)
              return;
            if (isDirty) {
              setIsCommitting(true);
              try {
                await persistProject();
              } catch (error) {
                console.error("[project-setup] failed to save lineup", {
                  projectId: id,
                  error,
                });
                setStatus("Project could not be saved.");
                return;
              } finally {
                setIsCommitting(false);
              }
            }
            // Po lineupu jde krok 02 INPUTS, ne editor rozmístění. Cíl se bere
            // z modelu kroků, aby se tok a proces trail nemohly rozejít (R1).
            const target = nextStepPath("lineup", id);
            if (target) navigate(target);
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
          aria-labelledby="reset-defaults-title"
          aria-describedby="reset-defaults-body"
          ref={resetModalRef}
        >
          <button
            type="button"
            className="modal-close"
            onClick={() => setShowResetConfirmation(false)}
            aria-label="Close"
          >
            <Close />
          </button>
          <div className="panel__header panel__header--stack selector-dialog__title">
            <h3 id="reset-defaults-title">Reset to defaults?</h3>
            <p id="reset-defaults-body" className="subtle">
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
              className="button-danger"
              onClick={() => {
                if (!setupData) return;
                applyState({ ...(setupData.defaultLineup ?? {}) }, setupData);
                setLeadVocalIds(defaultLeadVocalIds);
                setHasLeadVocalOverride(true);
                setBackVocalIds(defaultSelectedBackVocalIds);
                setHasBackVocalOverride(true);
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
        open={isLeadVocsModalOpen}
        onClose={() => setIsLeadVocsModalOpen(false)}
      >
        <div ref={leadVocsModalRef}>
          <ChangeLeadVocsModal
            open={isLeadVocsModalOpen}
            suggestedCandidates={
              leadVocalCandidateSections.suggestedLeadVocalCandidates
            }
            otherCandidates={
              leadVocalCandidateSections.otherLeadVocalCandidates
            }
            initialSelectedIds={selectedLeadVocalIds}
            defaultSelectedIds={defaultLeadVocalIds}
            disabledSelectedIds={selectedBackVocalIds}
            onCancel={() => setIsLeadVocsModalOpen(false)}
            onSave={(nextSelectedIds) => {
              const normalizedSelection = enforceVocalSelectionInvariant({
                lineupCandidateIds: lineupVocalCandidateIdSet,
                leadIds: nextSelectedIds,
                backIds: selectedBackVocalIds,
              });
              if (setupData) {
                applyState(
                  ensureMusiciansInLineup(lineup, allBandMusiciansById, [
                    ...normalizedSelection.leadIds,
                    ...normalizedSelection.backIds,
                  ]),
                  setupData,
                  bandLeaderId,
                  talkbackOwnerId,
                );
              }
              setLeadVocalIds(normalizedSelection.leadIds);
              setBackVocalIds(normalizedSelection.backIds);
              setHasLeadVocalOverride(true);
              setHasBackVocalOverride(true);
              setIsLeadVocsModalOpen(false);
            }}
          />
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={isBackVocsModalOpen}
        onClose={() => setIsBackVocsModalOpen(false)}
      >
        <div ref={backVocsModalRef}>
          <ChangeBackVocsModal
            open={isBackVocsModalOpen}
            suggestedCandidates={backVocalCandidateSections.suggested}
            additionalCandidates={backVocalCandidateSections.additional}
            initialSelectedIds={selectedBackVocalIds}
            defaultSelectedIds={defaultSelectedBackVocalIds}
            onCancel={() => setIsBackVocsModalOpen(false)}
            onSave={(nextSelectedIds) => {
              const normalizedSelection = enforceVocalSelectionInvariant({
                lineupCandidateIds: lineupVocalCandidateIdSet,
                leadIds: selectedLeadVocalIds,
                backIds: nextSelectedIds,
              });
              if (setupData) {
                applyState(
                  ensureMusiciansInLineup(lineup, allBandMusiciansById, [
                    ...normalizedSelection.leadIds,
                    ...normalizedSelection.backIds,
                  ]),
                  setupData,
                  bandLeaderId,
                  talkbackOwnerId,
                );
              }
              setLeadVocalIds(normalizedSelection.leadIds);
              setBackVocalIds(normalizedSelection.backIds);
              setHasLeadVocalOverride(true);
              setHasBackVocalOverride(true);
              setIsBackVocsModalOpen(false);
            }}
          />
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={Boolean(assignmentEditor && setupData)}
        onClose={() => setAssignmentEditor(null)}
      >
        {assignmentEditor && setupData
          ? (() => {
              const role = assignmentEditor.role;
              const roleCopy = getAssignmentRoleCopy(role);
              const sectionCapability: SetupCapabilitySection =
                role === "guitar" ? "guitar" : (role as SetupCapabilitySection);
              const members = resolveEligibleMembersForSection(
                sectionCapability,
                role,
              );
              const assignedIds = new Set(
                assignmentEditor.draftSlots.map((slot) => slot.musicianId),
              );
              const availableMembers = members.filter(
                (member) => !assignedIds.has(member.id),
              );
              const availableMemberIds = new Set(
                availableMembers.map((member) => member.id),
              );
              const selectedMusicianIds =
                assignmentEditor.selectedMusicianIds.filter((musicianId) =>
                  availableMemberIds.has(musicianId),
                );

              return (
                <div
                  className="selector-dialog selector-dialog--musician-select"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="assignment-editor-title"
                  ref={assignmentEditorRef}
                >
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => setAssignmentEditor(null)}
                    aria-label="Close"
                  >
                    <Close />
                  </button>
                  <div className="panel__header panel__header--stack selector-dialog__title">
                    <h3 id="assignment-editor-title">{roleCopy.title}</h3>
                  </div>
                  <div className="selector-dialog__divider section-divider" />
                  <div className="selector-dialog__body lineup-assignment-editor">
                    <section className="lineup-assignment-editor__section">
                      <h4>{roleCopy.assignedHeading}</h4>
                      <div className="lineup-list lineup-list--compact">
                        {assignmentEditor.draftSlots.length === 0 ? (
                          <p className="status status--empty">
                            {roleCopy.emptyState}
                          </p>
                        ) : (
                          assignmentEditor.draftSlots.map((slot, index) => (
                            <div
                              key={`${role}-assignment-${slot.musicianId}-${index}`}
                              className="lineup-list__row"
                            >
                              <span className="lineup-list__name">
                                {index + 1}.{" "}
                                {resolveMusicianDisplayName({
                                  musicianId: slot.musicianId,
                                  preferredName: members.find(
                                    (member) => member.id === slot.musicianId,
                                  )?.name,
                                })}
                              </span>
                              <div className="lineup-list__actions">
                                <button
                                  type="button"
                                  className="button-ghost"
                                  disabled={index === 0}
                                  onClick={() =>
                                    setAssignmentEditor((current) => {
                                      if (!current) return current;
                                      const next = [...current.draftSlots];
                                      [next[index - 1], next[index]] = [
                                        next[index],
                                        next[index - 1],
                                      ];
                                      return { ...current, draftSlots: next };
                                    })
                                  }
                                >
                                  <ArrowUp size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="button-ghost"
                                  disabled={
                                    index ===
                                    assignmentEditor.draftSlots.length - 1
                                  }
                                  onClick={() =>
                                    setAssignmentEditor((current) => {
                                      if (!current) return current;
                                      const next = [...current.draftSlots];
                                      [next[index], next[index + 1]] = [
                                        next[index + 1],
                                        next[index],
                                      ];
                                      return { ...current, draftSlots: next };
                                    })
                                  }
                                >
                                  <ArrowDown size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="button-ghost"
                                  onClick={() =>
                                    setAssignmentEditor((current) =>
                                      current
                                        ? {
                                            ...current,
                                            draftSlots:
                                              current.draftSlots.filter(
                                                (_, slotIndex) =>
                                                  slotIndex !== index,
                                              ),
                                          }
                                        : current,
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                    <section className="lineup-assignment-editor__section">
                      <h4>{roleCopy.addHeading}</h4>
                      <div className="lineup-card__add">
                        <div className="lineup-assignment-editor__add">
                          <AddMusiciansMultiSelect
                            id="assignment-add"
                            options={availableMembers}
                            selectedIds={selectedMusicianIds}
                            placeholder={roleCopy.placeholder}
                            onSelectionChange={(nextSelectedIds) =>
                              setAssignmentEditor((current) =>
                                current
                                  ? {
                                      ...current,
                                      selectedMusicianIds: nextSelectedIds,
                                    }
                                  : current,
                              )
                            }
                            onAddSelected={(nextSelectedIds) =>
                              setAssignmentEditor((current) => {
                                if (!current || nextSelectedIds.length === 0) {
                                  return current;
                                }
                                const roleSlotLimit = getRoleSlotLimit(
                                  current.role,
                                );
                                const nextDraftSlots =
                                  addMusiciansToLineupSlots(
                                    current.draftSlots,
                                    nextSelectedIds,
                                    roleSlotLimit,
                                  );
                                return {
                                  ...current,
                                  draftSlots: nextDraftSlots,
                                  selectedMusicianIds: [],
                                };
                              })
                            }
                          />
                        </div>
                      </div>
                    </section>
                  </div>
                  <div className="modal-actions modal-actions--split">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => resetAssignmentEditorToBandDefaults(role)}
                    >
                      Reset to defaults
                    </button>
                    <div className="modal-actions__group">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => setAssignmentEditor(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={() => {
                          setRoleSlots(role, assignmentEditor.draftSlots);
                          setAssignmentEditor(null);
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          : null}
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
            aria-labelledby="musician-selector-title"
            ref={musicianSelectorRef}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setEditing(null)}
              aria-label="Close"
            >
              <Close />
            </button>
            <div className="panel__header panel__header--stack selector-dialog__title">
              <h3 id="musician-selector-title">
                Select {getRoleDisplayName(editing.role)}
              </h3>
            </div>
            <div className="selector-dialog__divider section-divider" />
            <div className="selector-dialog__body selector-list">
              {(editing.role === "leader"
                ? selectedOptions
                : editing.role === "talkback"
                  ? [{ id: "", name: "Nobody assigned" }, ...selectedOptions]
                  : resolveEligibleMembersForSection(
                      editing.role === "guitar"
                        ? "guitar"
                        : (editing.role as SetupCapabilitySection),
                      editing.role,
                    ).filter((member) => {
                      if (member.id === editing.currentSelectedId) return true;
                      return !normalizeLineupSlots(
                        lineup[editing.role],
                        getRoleSlotLimit(editing.role),
                      ).some((slot) => slot.musicianId === member.id);
                    })
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
