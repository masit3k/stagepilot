import { loadCatalogRepository, type DataRepository } from "../storage/catalogRepository.js";

export type { DataRepository };

export async function loadRepository(options?: { userDataRoot?: string; dataRoot?: string }): Promise<DataRepository> {
  return loadCatalogRepository(options?.userDataRoot);
}
