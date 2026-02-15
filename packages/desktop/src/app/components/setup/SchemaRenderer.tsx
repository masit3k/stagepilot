import type { EventSetupEditState } from "./adapters/eventSetupAdapter";
import { AdditionalPickerField } from "./fields/AdditionalPickerField";
import { DropdownField } from "./fields/DropdownField";
import { ToggleField } from "./fields/ToggleField";
import type { FieldDef } from "./schema/types";

type SchemaRendererProps = {
  fields: FieldDef[];
  state: EventSetupEditState;
  onPatch: (nextPatch: ReturnType<FieldDef["setValue"]>) => void;
};

export function SchemaRenderer({ fields, state, onPatch }: SchemaRendererProps) {
  return (
    <div className="setup-schema-fields">
      {fields.map((field) => {
        if (field.kind === "dropdown") return <DropdownField key={field.id} field={field} state={state} onPatch={onPatch} />;
        if (field.kind === "toggle") return <ToggleField key={field.id} field={field} state={state} onPatch={onPatch} />;
        return <AdditionalPickerField key={field.id} field={field} state={state} onPatch={onPatch} />;
      })}
    </div>
  );
}
