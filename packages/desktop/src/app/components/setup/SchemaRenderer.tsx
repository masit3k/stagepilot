import type { EventSetupEditState } from "./adapters/eventSetupAdapter";
import { AdditionalPickerField } from "./fields/AdditionalPickerField";
import { DropdownField } from "./fields/DropdownField";
import { ToggleField } from "./fields/ToggleField";
import type { FieldDef, SchemaNode } from "./schema/types";

type SchemaRendererProps = {
  fields: SchemaNode[];
  state: EventSetupEditState;
  onPatch: (nextPatch: ReturnType<FieldDef["setValue"]>) => void;
};

export function SchemaRenderer({ fields, state, onPatch }: SchemaRendererProps) {
  return (
    <div className="setup-schema-fields">
      {fields.map((field) => {
        if (field.kind === "toggleGrid") {
          return (
            <div key={field.id} className="setup-toggle-grid" role="group" aria-label="Setup toggles">
              {field.fields.map((toggleField) => (
                <ToggleField key={toggleField.id} field={toggleField} state={state} onPatch={onPatch} />
              ))}
            </div>
          );
        }
        if (field.kind === "dropdown") return <DropdownField key={field.id} field={field} state={state} onPatch={onPatch} />;
        if (field.kind === "toggle") return <ToggleField key={field.id} field={field} state={state} onPatch={onPatch} />;
        return <AdditionalPickerField key={field.id} field={field} state={state} onPatch={onPatch} />;
      })}
    </div>
  );
}
