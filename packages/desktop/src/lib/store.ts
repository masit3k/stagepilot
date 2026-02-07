import { create } from "zustand";
import type { ProjectSummary, VersionSummary } from "./types";

const initialProjects: ProjectSummary[] = [
  {
    id: "demo",
    bandRef: "band_demo",
    purpose: "event",
    documentDate: "2025-01-10",
    eventDate: "2025-02-15",
    eventVenue: "Praha",
    title: "Demo Tour",
  },
];

const initialVersions: Record<string, VersionSummary[]> = {
  demo: [
    {
      versionId: "20250110-120000-123",
      generatedAt: "2025-01-10T12:00:00Z",
      pdfFileName: "BK_Inputlist_Stageplan_2025.pdf",
    },
  ],
};

type AppState = {
  projects: ProjectSummary[];
  selectedProjectId?: string;
  versions: Record<string, VersionSummary[]>;
  selectProject: (id: string) => void;
  upsertProject: (project: ProjectSummary) => void;
};

export const useAppStore = create<AppState>((set) => ({
  projects: initialProjects,
  versions: initialVersions,
  selectedProjectId: initialProjects[0]?.id,
  selectProject: (id) => set({ selectedProjectId: id }),
  upsertProject: (project) =>
    set((state) => {
      const exists = state.projects.find((item) => item.id === project.id);
      return {
        projects: exists
          ? state.projects.map((item) => (item.id === project.id ? project : item))
          : [...state.projects, project],
      };
    }),
}));
