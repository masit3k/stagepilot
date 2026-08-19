import type { NotesEditorLine } from "../../domain/inputs/resolveNotesEditorModel";

type NotesSection = "inputs" | "monitors";

/**
 * Editor poznámek pod tabulkami (R11, R12, R13) — dvě podsekce, `NOTES ·
 * INPUTS` a `NOTES · MONITORS`, každá jako plochý seznam řádků z
 * `resolveNotesEditorModel`. Na rozdíl od tištěného dokumentu ukazuje
 * i řádky, které podmínka skrývá (`hidden`) — šedě, s důvodem (R13), aby
 * uživatel věděl, proč se právě psaný text nevytiskne.
 *
 * Text poznámky je obsah dokumentu, edituje se česky; popisky kolem (edited
 * štítek, tlačítka) jsou anglicky — stejná konvence jako zbytek obrazovky
 * `02`.
 *
 * Adresuje se přes `line.id` (šablonové id, nebo `custom_<n>`), ne přes
 * pozici v poli — `onToggleEnabled`/`onTextChange`/`onRevertToTemplate`
 * dostávají celou `line`, aby volající poznal `line.source` bez druhého
 * hledání.
 */
export function NotesEditor({
  model,
  onToggleEnabled,
  onTextChange,
  onRevertToTemplate,
  onAddNote,
}: {
  model: {
    readonly inputs: readonly NotesEditorLine[];
    readonly monitors: readonly NotesEditorLine[];
  };
  onToggleEnabled: (line: NotesEditorLine, enabled: boolean) => void;
  onTextChange: (line: NotesEditorLine, text: string) => void;
  onRevertToTemplate: (line: NotesEditorLine) => void;
  onAddNote: (section: NotesSection) => void;
}) {
  return (
    <div className="notesEditor">
      <NotesEditorSection
        title="NOTES · INPUTS"
        section="inputs"
        lines={model.inputs}
        onToggleEnabled={onToggleEnabled}
        onTextChange={onTextChange}
        onRevertToTemplate={onRevertToTemplate}
        onAddNote={onAddNote}
      />
      <NotesEditorSection
        title="NOTES · MONITORS"
        section="monitors"
        lines={model.monitors}
        onToggleEnabled={onToggleEnabled}
        onTextChange={onTextChange}
        onRevertToTemplate={onRevertToTemplate}
        onAddNote={onAddNote}
      />
    </div>
  );
}

function NotesEditorSection({
  title,
  section,
  lines,
  onToggleEnabled,
  onTextChange,
  onRevertToTemplate,
  onAddNote,
}: {
  title: string;
  section: NotesSection;
  lines: readonly NotesEditorLine[];
  onToggleEnabled: (line: NotesEditorLine, enabled: boolean) => void;
  onTextChange: (line: NotesEditorLine, text: string) => void;
  onRevertToTemplate: (line: NotesEditorLine) => void;
  onAddNote: (section: NotesSection) => void;
}) {
  return (
    <div className="notesEditorSection" aria-label={title}>
      <h3 className="notesEditorSection__title">{title}</h3>
      <div className="notesEditorSection__lines">
        {lines.map((line) => (
          <NotesEditorRow
            key={line.id}
            line={line}
            onToggleEnabled={onToggleEnabled}
            onTextChange={onTextChange}
            onRevertToTemplate={onRevertToTemplate}
          />
        ))}
      </div>
      <button
        type="button"
        className="button-secondary"
        onClick={() => onAddNote(section)}
      >
        + Add note
      </button>
    </div>
  );
}

function NotesEditorRow({
  line,
  onToggleEnabled,
  onTextChange,
  onRevertToTemplate,
}: {
  line: NotesEditorLine;
  onToggleEnabled: (line: NotesEditorLine, enabled: boolean) => void;
  onTextChange: (line: NotesEditorLine, text: string) => void;
  onRevertToTemplate: (line: NotesEditorLine) => void;
}) {
  return (
    <div
      className={`notesEditorRow ${line.hidden ? "notesEditorRow--hidden" : ""}`}
    >
      <div className="notesEditorRow__main">
        <input
          type="checkbox"
          className="setup-checkbox"
          checked={line.enabled}
          onChange={(event) => onToggleEnabled(line, event.target.checked)}
        />
        <input
          type="text"
          className="notesEditorRow__text"
          value={line.text}
          onChange={(event) => onTextChange(line, event.target.value)}
        />
        {line.source === "template" && line.edited ? (
          <>
            <span className="notesEditorRow__badge">edited</span>
            <button
              type="button"
              className="button-secondary"
              onClick={() => onRevertToTemplate(line)}
            >
              Revert to template
            </button>
          </>
        ) : null}
      </div>
      {line.hidden ? (
        <p className="notesEditorRow__hint">{line.hiddenReason}</p>
      ) : null}
    </div>
  );
}
