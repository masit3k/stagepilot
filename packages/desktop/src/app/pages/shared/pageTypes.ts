import type { BandOption, NavigationGuard } from "../../shell/types";

export type NewProjectPageProps = {
  navigate: (path: string) => void;
  onCreated: () => Promise<void>;
  bands: BandOption[];
  editingProjectId?: string;
  registerNavigationGuard: (guard: NavigationGuard | null) => void;
  origin?: string | null;
  fromPath?: string | null;
};

export type ProjectRouteProps = {
  id: string;
  navigate: (path: string) => void;
  registerNavigationGuard: (guard: NavigationGuard | null) => void;
  search?: string;
};

export type LibraryPageProps = {
  navigate: (path: string) => void;
  registerNavigationGuard: (guard: NavigationGuard | null) => void;
};
