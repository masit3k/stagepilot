import { formatProjectDisplayName, formatProjectSlug, getTodayIsoLocal, isPastIsoDate } from "../../projectRules";
import { generateUuidV7, isUuidV7 } from "../../../../../src/domain/projectNaming";
import type { NewProjectPayload, ProjectSummary } from "../shell/types";
import { toPersistableProject } from "../shell/types";
import * as projectsApi from "./projectsApi";
import { migrateProjectLineupVocsToLeadBack } from "../domain/project/migrateProjectLineup";

export async function refreshProjectsAndMigrate(): Promise<{ projects: ProjectSummary[]; migratedIds: Map<string, string> }> {
  const availableBands = await projectsApi.listBands();
  const bandsById = new Map(availableBands.map((band) => [band.id, band]));
  const bandsByCode = new Map(
    availableBands.filter((band) => Boolean(band.code?.trim())).map((band) => [band.code?.trim().toLowerCase() ?? "", band]),
  );
  const listed = await projectsApi.listProjects();
  const migratedIds = new Map<string, string>();
  const maintainedProjects: ProjectSummary[] = [];
  const now = new Date();
  const nowIso = now.toISOString();
  const todayIso = getTodayIsoLocal(now);

  for (const summary of listed) {
    const raw = await projectsApi.readProject(summary.id);
    const parsedRaw = projectsApi.parseProjectPayload(raw);
    const { legacyId: _legacyId, ...withoutLegacy } = parsedRaw as NewProjectPayload & { legacyId?: unknown };
    const project = migrateProjectLineupVocsToLeadBack(
      withoutLegacy as NewProjectPayload,
    );

    if (project.status === "trashed" && project.purgeAt && new Date(project.purgeAt).getTime() < now.getTime()) {
      await projectsApi.deleteProjectPermanently(project.id);
      continue;
    }

    const templateType = project.templateType ?? project.purpose;
    const needsTemplateTypeMigration = project.templateType !== templateType;
    const needsIdMigration = !isUuidV7(project.id);
    const normalizedBandRef = project.bandRef?.trim() || "";
    const band = bandsById.get(normalizedBandRef) || bandsByCode.get(normalizedBandRef.toLowerCase());
    if (!band) continue;

    const canonicalBandRef = band.id;
    const needsBandRefMigration = canonicalBandRef !== project.bandRef;
    const namingSource = {
      purpose: project.purpose,
      eventDate: project.eventDate,
      eventVenue: project.eventVenue,
      documentDate: project.documentDate,
      note: project.note,
    };
    const slug = formatProjectSlug(namingSource, band);
    const displayName = formatProjectDisplayName(namingSource, band);
    const needsNameMigration = project.slug !== slug || project.displayName !== displayName;
    const hasLegacyId = Object.prototype.hasOwnProperty.call(parsedRaw, "legacyId");
    const currentStatus = project.status ?? "active";
    const eventDate = project.eventDate;
    const shouldAutoArchive =
      templateType === "event" &&
      currentStatus === "active" &&
      Boolean(eventDate) &&
      isPastIsoDate(eventDate ?? "", todayIso);

    const needsMaintenance =
      shouldAutoArchive ||
      hasLegacyId ||
      needsIdMigration ||
      needsBandRefMigration ||
      needsNameMigration ||
      needsTemplateTypeMigration ||
      !project.status;

    const legacyId = summary.id;
    const nextId = needsIdMigration ? generateUuidV7() : project.id;
    const migrated: NewProjectPayload = {
      ...(project as Omit<NewProjectPayload, "id" | "slug" | "displayName" | "bandRef">),
      id: nextId,
      slug,
      displayName,
      bandRef: canonicalBandRef,
      templateType: templateType ?? "generic",
      status: shouldAutoArchive ? "archived" : currentStatus,
      archivedAt: shouldAutoArchive ? nowIso : project.archivedAt,
      updatedAt: needsMaintenance ? nowIso : project.updatedAt,
    };

    if (needsMaintenance) {
      await projectsApi.saveProject({
        projectId: nextId,
        legacyProjectId: legacyId,
        json: JSON.stringify(toPersistableProject(migrated), null, 2),
      });
      if (legacyId !== nextId) migratedIds.set(legacyId, nextId);
    }

    maintainedProjects.push({
      ...summary,
      id: nextId,
      slug: migrated.slug,
      displayName: migrated.displayName,
      bandRef: migrated.bandRef,
      purpose: migrated.purpose,
      templateType: migrated.templateType,
      status: migrated.status,
      eventDate: migrated.eventDate,
      updatedAt: migrated.updatedAt ?? summary.updatedAt,
      archivedAt: migrated.archivedAt,
      trashedAt: migrated.trashedAt,
      purgeAt: migrated.purgeAt,
    });
  }

  return { projects: maintainedProjects, migratedIds };
}
