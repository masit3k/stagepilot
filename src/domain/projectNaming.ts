export type NamingProject = {
  id?: string;
  slug?: string;
  displayName?: string;
  purpose?: "event" | "generic";
  eventDate?: string;
  eventVenue?: string;
  documentDate?: string;
  note?: string;
};

export type NamingBand = {
  id: string;
  code?: string | null;
  name: string;
};

export function formatDateForSlug(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "00-00-0000";
  return `${day}-${month}-${year}`;
}

export function formatDateForDisplayName(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "00/00/0000";
  return `${day}/${month}/${year}`;
}

export function sanitizeVenueForSlug(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1).toLowerCase()}`)
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatProjectSlug(project: NamingProject, band: NamingBand): string {
  const bandCode = band.code?.trim() || band.id;
  if (project.purpose === "event") {
    const eventDate = formatDateForSlug(project.eventDate ?? "");
    const venue = sanitizeVenueForSlug(project.eventVenue ?? "") || "Venue";
    return `${bandCode}_Inputlist_Stageplan_${eventDate}_${venue}`;
  }
  const year = (project.documentDate ?? "").slice(0, 4) || "0000";
  return `${bandCode}_Inputlist_Stageplan_${year}`;
}

export function formatProjectDisplayName(project: NamingProject, band: NamingBand): string {
  if (project.purpose === "event") {
    const eventDate = formatDateForDisplayName(project.eventDate ?? "");
    const venue = (project.eventVenue ?? "").trim() || "Venue";
    return `${band.name} – ${eventDate} – ${venue}`;
  }
  const year = (project.documentDate ?? "").slice(0, 4) || "0000";
  const note = project.note?.trim();
  return note ? `${band.name} – ${note} – ${year}` : `${band.name} – ${year}`;
}

export function isUuidV7(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function generateUuidV7(date = new Date()): string {
  const unixMs = BigInt(date.getTime());
  const random = new Uint8Array(10);
  globalThis.crypto.getRandomValues(random);

  const bytes = new Uint8Array(16);
  bytes[0] = Number((unixMs >> 40n) & 0xffn);
  bytes[1] = Number((unixMs >> 32n) & 0xffn);
  bytes[2] = Number((unixMs >> 24n) & 0xffn);
  bytes[3] = Number((unixMs >> 16n) & 0xffn);
  bytes[4] = Number((unixMs >> 8n) & 0xffn);
  bytes[5] = Number(unixMs & 0xffn);
  bytes[6] = 0x70 | (random[0] & 0x0f);
  bytes[7] = random[1];
  bytes[8] = 0x80 | (random[2] & 0x3f);
  bytes[9] = random[3];
  bytes[10] = random[4];
  bytes[11] = random[5];
  bytes[12] = random[6];
  bytes[13] = random[7];
  bytes[14] = random[8];
  bytes[15] = random[9];

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function migrateProjectIdentity(project: NamingProject, band: NamingBand): NamingProject {
  const candidateId = project.id?.trim() || "";
  const nextId = isUuidV7(candidateId) ? candidateId : generateUuidV7();
  const slug = project.slug || formatProjectSlug(project, band);
  const displayName = project.displayName || formatProjectDisplayName(project, band);

  return {
    ...project,
    id: nextId,
    slug,
    displayName,
  };
}

export const formatEventDateForSlug = formatDateForSlug;
export const formatEventDateForDisplayName = formatDateForDisplayName;
export const sanitizeSlugSegment = sanitizeVenueForSlug;
