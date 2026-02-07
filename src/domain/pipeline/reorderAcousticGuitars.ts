import type { Group } from "../model/types.js";

type GuitarSortableInput = {
  key: string;
  group: Group;
};

function isAcousticGuitar(input: GuitarSortableInput): boolean {
  const key = input.key.toLowerCase();
  return key.startsWith("ac_guitar") || key.startsWith("acoustic_guitar");
}

function isElectricGuitar(input: GuitarSortableInput): boolean {
  const key = input.key.toLowerCase();
  return key.startsWith("el_guitar") || key.startsWith("electric_guitar");
}

function isKeysOrSynth(input: GuitarSortableInput): boolean {
  const group = input.group as string;
  const key = input.key.toLowerCase();
  return group === "keys" || group === "synth" || key.startsWith("keys_") || key.startsWith("synth");
}

function indexOfFirstKeys(inputs: GuitarSortableInput[]): number {
  const idx = inputs.findIndex((input) => isKeysOrSynth(input));
  return idx === -1 ? inputs.length : idx;
}

function lastIndexOfElectricBefore(inputs: GuitarSortableInput[], idxKeys: number): number {
  for (let i = Math.min(idxKeys - 1, inputs.length - 1); i >= 0; i -= 1) {
    if (isElectricGuitar(inputs[i])) return i;
  }
  return -1;
}

function lastIndexOfGuitarBefore(inputs: GuitarSortableInput[], idxKeys: number): number {
  for (let i = Math.min(idxKeys - 1, inputs.length - 1); i >= 0; i -= 1) {
    if (inputs[i].group === "guitar") return i;
  }
  return -1;
}

export function reorderAcousticGuitars<T extends GuitarSortableInput>(inputs: T[]): T[] {
  const result = inputs.slice();
  const acousticInputs = result.filter((input) => isAcousticGuitar(input));

  if (acousticInputs.length === 0) return result;

  for (const acousticInput of acousticInputs) {
    const currentIndex = result.indexOf(acousticInput);
    if (currentIndex === -1) continue;

    result.splice(currentIndex, 1);

    const idxKeys = indexOfFirstKeys(result);
    const idxLastElectric = lastIndexOfElectricBefore(result, idxKeys);
    const idxLastGuitar =
      idxLastElectric >= 0 ? idxLastElectric : lastIndexOfGuitarBefore(result, idxKeys);

    const insertIndex = Math.min(idxLastGuitar + 1, idxKeys);
    result.splice(Math.max(insertIndex, 0), 0, acousticInput);
  }

  return result;
}
