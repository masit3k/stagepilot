import type { InputChannel, PresetOverridePatch } from "../../../../../../../src/domain/model/types";
import type { EventSetupEditState } from "../adapters/eventSetupAdapter";

export type FieldNormalizer<T> = (value: T) => T;

export type FieldBase<TValue, TKind extends string> = {
  kind: TKind;
  id: string;
  label: string;
  description?: string;
  getValue: (state: EventSetupEditState) => TValue;
  setValue: (state: EventSetupEditState, value: TValue) => PresetOverridePatch | undefined;
  isDefault: (state: EventSetupEditState) => boolean;
  reset: (state: EventSetupEditState) => PresetOverridePatch | undefined;
  normalize?: FieldNormalizer<TValue>;
  isDisabled?: (state: EventSetupEditState) => boolean;
};

export type DropdownOption = {
  value: string;
  label: string;
};

export type DropdownFieldDef = FieldBase<string, "dropdown"> & {
  options: (state: EventSetupEditState) => DropdownOption[];
};

export type ToggleFieldDef = FieldBase<boolean, "toggle">;

export type AdditionalPickerOption = {
  id: string;
  label: string;
  input: InputChannel;
};

export type AdditionalPickerFieldDef = FieldBase<string[], "additionalPicker"> & {
  options: (state: EventSetupEditState) => AdditionalPickerOption[];
  maxSelected: number;
};

export type FieldDef = DropdownFieldDef | ToggleFieldDef | AdditionalPickerFieldDef;

export type ToggleGridGroupDef = {
  kind: "toggleGrid";
  id: string;
  fields: ToggleFieldDef[];
};

export type SchemaNode = FieldDef | ToggleGridGroupDef;
