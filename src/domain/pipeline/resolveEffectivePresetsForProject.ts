import type { DataRepository } from "../../infra/fs/repo.js";
import type {
  Band,
  Group,
  Musician,
  PresetItem,
  Project,
} from "../model/types.js";

function isTalkbackItem(item: PresetItem): boolean {
  return item.kind === "talkback";
}

export function resolveEffectivePresetsForProject(args: {
  project: Project;
  band: Band;
  musician: Musician;
  group: Group;
  repo: DataRepository;
}): PresetItem[] {
  void args.project;
  void args.band;
  void args.group;
  void args.repo;
  return [...(args.musician.presets ?? [])].filter((item) => !isTalkbackItem(item));
}
