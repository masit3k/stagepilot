type InputLike = {
  key: string;
  label: string;
};

type StereoSide = "L" | "R";

type GroupState = {
  count: number;
  slots: Array<{ l: boolean; r: boolean }>;
};

type Assignment = {
  groupKey: string;
  instanceIndex: number;
  isStereo: boolean;
};

function detectStereoSide(key: string): StereoSide | null {
  const lower = key.toLowerCase();
  if (lower.endsWith("_l")) return "L";
  if (lower.endsWith("_r")) return "R";
  return null;
}

function groupKeyForKey(key: string, side: StereoSide | null): string {
  if (!side) return key;
  return key.slice(0, -2);
}

function ensureNumberSuffix(label: string, index: number): string {
  const trimmed = label.trimEnd();
  if (/\s\d+$/.test(trimmed)) return label;
  if (/\(\d+\)$/.test(trimmed)) return label;
  return `${label} ${index}`;
}

function ensureNumberBeforeSide(label: string, index: number): string {
  const trimmed = label.trimEnd();
  const sideMatch = /^(.*)\s+(L|R)\s*$/i.exec(trimmed);
  if (!sideMatch) return ensureNumberSuffix(label, index);

  const base = sideMatch[1];
  const side = sideMatch[2];
  if (/\s\d+$/.test(base.trim()) || /\(\d+\)$/.test(base.trim())) {
    return label;
  }

  return `${base.trim()} ${index} ${side}`;
}

export function disambiguateInputKeys<T extends InputLike>(inputs: T[]): T[] {
  const assignments: Assignment[] = [];
  const groupStates = new Map<string, GroupState>();

  for (const input of inputs) {
    const side = detectStereoSide(input.key);
    const groupKey = groupKeyForKey(input.key, side);
    const state = groupStates.get(groupKey) ?? { count: 0, slots: [] };

    if (!side) {
      state.count += 1;
      assignments.push({ groupKey, instanceIndex: state.count, isStereo: false });
    } else {
      const slotKey = side === "L" ? "l" : "r";
      let instanceIndex = 0;

      for (let i = 0; i < state.slots.length; i++) {
        const slot = state.slots[i];
        if (!slot[slotKey]) {
          slot[slotKey] = true;
          instanceIndex = i + 1;
          break;
        }
      }

      if (instanceIndex === 0) {
        const slot = { l: false, r: false };
        slot[slotKey] = true;
        state.slots.push(slot);
        instanceIndex = state.slots.length;
      }

      assignments.push({ groupKey, instanceIndex, isStereo: true });
    }

    groupStates.set(groupKey, state);
  }

  const groupCounts = new Map<string, number>();
  for (const [groupKey, state] of groupStates.entries()) {
    groupCounts.set(groupKey, state.slots.length > 0 ? state.slots.length : state.count);
  }

  return inputs.map((input, index) => {
    const assignment = assignments[index];
    const total = groupCounts.get(assignment.groupKey) ?? 1;

    if (total <= 1) {
      return { ...input };
    }

    const key = `${input.key}_${assignment.instanceIndex}`;
    const label = ensureNumberBeforeSide(input.label, assignment.instanceIndex);
    return { ...input, key, label };
  });
}
