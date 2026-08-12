import { resolvePresetIdAlias } from "../../../../../src/domain/model/presetAliases";
import type {
  Monitor,
  MonitorSupplier,
} from "../../../../../src/domain/model/types";

/**
 * Co? Projekce katalogu odposlechů na dvě nezávislé osy — typ a dodavatel.
 * Proč? Deset presetů v jednom seznamu se špatně čte; ID se přitom nikdy
 * neskládá spojováním řetězců, vždy se hledá existující preset.
 */
export type MonitorTypeOption = {
  key: string;
  label: string;
  bySupplier: Partial<Record<MonitorSupplier, string>>;
};

export type MonitorAxes = {
  types: MonitorTypeOption[];
  supplierByRef: Record<string, MonitorSupplier>;
  typeKeyByRef: Record<string, string>;
};

function typeKeyOf(monitor: Monitor): string {
  return monitor.kind === "wedge"
    ? "wedge"
    : `iem:${monitor.mode}:${monitor.wireless ? "wireless" : "wired"}`;
}

function typeLabelOf(monitor: Monitor): string {
  return monitor.label.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function buildMonitorAxes(monitors: Monitor[]): MonitorAxes {
  const byKey = new Map<string, MonitorTypeOption>();
  const supplierByRef: Record<string, MonitorSupplier> = {};
  const typeKeyByRef: Record<string, string> = {};

  for (const monitor of monitors) {
    const key = typeKeyOf(monitor);
    const option = byKey.get(key) ?? {
      key,
      label: typeLabelOf(monitor),
      bySupplier: {},
    };
    option.bySupplier[monitor.supplier] = monitor.id;
    byKey.set(key, option);
    supplierByRef[monitor.id] = monitor.supplier;
    typeKeyByRef[monitor.id] = key;
  }

  return {
    types: Array.from(byKey.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
    supplierByRef,
    typeKeyByRef,
  };
}

export function resolveMonitorSelection(
  axes: MonitorAxes,
  monitorRef: string,
): { typeKey: string; supplier: MonitorSupplier } | undefined {
  const resolved = resolvePresetIdAlias(monitorRef);
  const typeKey = axes.typeKeyByRef[resolved];
  const supplier = axes.supplierByRef[resolved];
  if (!typeKey || !supplier) return undefined;
  return { typeKey, supplier };
}

/**
 * Najde preset odpovídající kombinaci obou os. Chybí-li požadovaný dodavatel,
 * vrátí druhou variantu téhož typu — uživatel nikdy neztratí zvolený typ.
 */
export function resolveMonitorRef(
  axes: MonitorAxes,
  typeKey: string,
  supplier: MonitorSupplier,
): string | undefined {
  const option = axes.types.find((candidate) => candidate.key === typeKey);
  if (!option) return undefined;
  const other: MonitorSupplier = supplier === "band" ? "foh" : "band";
  return option.bySupplier[supplier] ?? option.bySupplier[other];
}
