import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { NavigationGuard } from "../../../shell/types";
import { LibrarySimpleEntityPage } from "./LibrarySimpleEntityPage";

export function LibraryEntityCrud({
  title,
  listCommand,
  upsertCommand,
  deleteCommand,
  registerNavigationGuard,
  multiline = false,
}: {
  title: string;
  listCommand: string;
  upsertCommand: string;
  deleteCommand: string;
  registerNavigationGuard: (guard: NavigationGuard | null) => void;
  multiline?: boolean;
}) {
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const isDirty = Boolean(
    editing && draft && JSON.stringify(editing) !== JSON.stringify(draft),
  );
  useEffect(() => {
    invoke<Array<Record<string, unknown>>>(listCommand)
      .then(setItems)
      .catch(() => undefined);
  }, [listCommand]);
  useEffect(() => {
    registerNavigationGuard(
      editing
        ? {
            isDirty: () => isDirty,
            save: async () => {
              if (draft)
                await invoke(
                  upsertCommand,
                  Object.fromEntries([
                    [
                      upsertCommand.includes("message")
                        ? "messageItem"
                        : upsertCommand.includes("contact")
                          ? "contact"
                          : "instrument",
                      draft,
                    ],
                  ]),
                );
            },
          }
        : null,
    );
    return () => registerNavigationGuard(null);
  }, [editing, draft, isDirty, registerNavigationGuard, upsertCommand]);
  const upsertArgName = upsertCommand.includes("message")
    ? "messageItem"
    : upsertCommand.includes("contact")
      ? "contact"
      : "instrument";
  const deleteArgName = deleteCommand.includes("message")
    ? "messageId"
    : deleteCommand.includes("contact")
      ? "contactId"
      : "instrumentId";
  return (
    <LibrarySimpleEntityPage
      title={title}
      status=""
      onCreate={() => {
        const next = {
          id: crypto.randomUUID(),
          name: "",
          body: "",
          channels: 1,
          key: "",
        };
        setEditing(next);
        setDraft(next);
      }}
      rows={items.map((item) => ({
        id: String(item.id),
        name: String(item.name ?? item.id),
        detail: String(item.key ?? item.email ?? item.body ?? ""),
      }))}
      onEdit={(id) => {
        const selected = items.find((item) => String(item.id) === id);
        if (!selected) return;
        setEditing(selected);
        setDraft({ ...selected });
      }}
      onDelete={async (id) => {
        await invoke(deleteCommand, { [deleteArgName]: id });
        setItems(await invoke<Array<Record<string, unknown>>>(listCommand));
      }}
      modal={
        draft ? (
          <div className="form-grid">
            <label>
              Name
              <input
                value={String(draft.name ?? "")}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              ID
              <input
                value={String(draft.id ?? "")}
                onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              />
            </label>
            {multiline ? (
              <label>
                Body
                <textarea
                  value={String(draft.body ?? "")}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </label>
            ) : (
              <label>
                Details
                <input
                  value={String(draft.key ?? draft.email ?? draft.notes ?? "")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      key: e.target.value,
                      email: e.target.value,
                      notes: e.target.value,
                    })
                  }
                />
              </label>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setEditing(null);
                  setDraft(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!draft) return;
                  await invoke(upsertCommand, { [upsertArgName]: draft });
                  setItems(
                    await invoke<Array<Record<string, unknown>>>(listCommand),
                  );
                  setEditing(null);
                  setDraft(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : null
      }
      onCloseModal={() => {
        setEditing(null);
        setDraft(null);
      }}
    />
  );
}

