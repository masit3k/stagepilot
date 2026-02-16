import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { ROLE_ORDER } from "../../shared/setupConstants";
import { toIdSlug } from "../../shared/projectHubUtils";
import type {
  LibraryBand,
  LibraryMusician,
} from "../../../shell/types";
import { getRoleDisplayName, normalizeLineupValue, normalizeRoleConstraint, validateLineup } from "../../../../projectRules";
import { LibraryEntityCrud } from "./LibraryEntityCrud";
import { LibrarySimpleEntityPage } from "./LibrarySimpleEntityPage";
import type { LibraryPageProps } from "../../shared/pageTypes";

export function LibraryBandsPage({
  navigate,
  registerNavigationGuard,
}: LibraryPageProps) {
  const [bands, setBands] = useState<LibraryBand[]>([]);
  const [query, setQuery] = useState("");
  useEffect(() => {
    invoke<LibraryBand[]>("list_library_bands")
      .then(setBands)
      .catch(() => undefined);
    registerNavigationGuard(null);
    return () => registerNavigationGuard(null);
  }, [registerNavigationGuard]);
  const filtered = bands.filter((band) => {
    const q = query.trim().toLowerCase();
    return (
      !q ||
      band.name.toLowerCase().includes(q) ||
      band.code.toLowerCase().includes(q)
    );
  });
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Bands</h2>
        <button type="button" onClick={() => navigate("/library/bands/new")}>
          + New Band
        </button>
      </div>
      <input
        placeholder="Search by name/code"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="library-table">
        {filtered.map((band) => (
          <div key={band.id} className="library-row">
            <span>{band.name}</span>
            <span>{band.code}</span>
            <span>{band.members.length}</span>
            <span>
              {Object.keys(band.defaultLineup ?? {}).join(", ") || "—"}
            </span>
            <div className="project-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  navigate(`/library/bands/${encodeURIComponent(band.id)}`)
                }
              >
                Edit
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={async () => {
                  const copy = await invoke<LibraryBand>(
                    "duplicate_library_band",
                    { bandId: band.id },
                  );
                  navigate(`/library/bands/${encodeURIComponent(copy.id)}`);
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={async () => {
                  if (!window.confirm(`Delete ${band.name}?`)) return;
                  await invoke("delete_library_band", { bandId: band.id });
                  setBands(await invoke<LibraryBand[]>("list_library_bands"));
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LibraryBandDetailPage({
  bandId,
  navigate,
  registerNavigationGuard,
}: LibraryPageProps & { bandId: string }) {
  const isNew = bandId === "new";
  const [musicians, setMusicians] = useState<LibraryMusician[]>([]);
  const [band, setBand] = useState<LibraryBand>({
    id: "",
    name: "",
    code: "",
    description: "",
    constraints: {
      drums: { min: 0, max: 1 },
      bass: { min: 0, max: 1 },
      guitar: { min: 0, max: 1 },
      keys: { min: 0, max: 1 },
      vocs: { min: 0, max: 4 },
    },
    roleConstraints: undefined,
    defaultLineup: {},
    members: [],
    contacts: [],
    messages: [],
  });
  const initialRef = useRef("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    (async () => {
      setMusicians(await invoke<LibraryMusician[]>("list_library_musicians"));
      if (!isNew) {
        const loaded = await invoke<LibraryBand>("read_library_band", {
          bandId,
        });
        setBand(loaded);
        initialRef.current = JSON.stringify(loaded);
      } else {
        initialRef.current = JSON.stringify(band);
      }
    })().catch(() => setStatus("Failed to load band"));
  }, [bandId, isNew]);
  const isDirty = JSON.stringify(band) !== initialRef.current;
  useEffect(() => {
    registerNavigationGuard({
      isDirty: () => isDirty,
      save: async () => {
        await saveBand();
      },
    });
    return () => registerNavigationGuard(null);
  });
  const saveBand = useCallback(async () => {
    const id = band.id || toIdSlug(band.code || band.name);
    const next = { ...band, id };
    const errors = validateLineup(
      next.defaultLineup ?? {},
      next.constraints,
      ROLE_ORDER,
      next.roleConstraints,
    );
    if (errors.length > 0) {
      setStatus(errors.join(" "));
      return;
    }
    await invoke("upsert_library_band", { band: next });
    initialRef.current = JSON.stringify(next);
    setBand(next);
    setStatus("Saved.");
  }, [band]);
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{isNew ? "New Band" : `Band: ${band.name}`}</h2>
      </div>
      <div className="form-grid">
        <label>
          Name
          <input
            value={band.name}
            onChange={(e) => setBand({ ...band, name: e.target.value })}
          />
        </label>
        <label>
          Code
          <input
            value={band.code}
            onChange={(e) => setBand({ ...band, code: e.target.value })}
          />
        </label>
        <label>
          Description
          <input
            value={band.description ?? ""}
            onChange={(e) => setBand({ ...band, description: e.target.value })}
          />
        </label>
      </div>
      <article className="lineup-card">
        <div className="panel__header">
          <h3>Members</h3>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              const first = musicians[0];
              if (!first) return;
              setBand({
                ...band,
                members: [
                  ...band.members,
                  { musicianId: first.id, roles: ["vocs"], isDefault: false },
                ],
              });
            }}
          >
            + Add member
          </button>
        </div>
        <div className="lineup-list">
          {band.members.map((member, index) => (
            <div
              key={`${member.musicianId}-${index}`}
              className="lineup-list__row"
            >
              <span>
                {musicians.find((m) => m.id === member.musicianId)?.name ??
                  member.musicianId}
              </span>
              <span>{member.roles.join(", ")}</span>
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  setBand({
                    ...band,
                    members: band.members.filter((_, idx) => idx !== index),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </article>
      <article className="lineup-card">
        <div className="panel__header">
          <h3>Default lineup</h3>
        </div>
        <div className="lineup-grid">
          {ROLE_ORDER.map((role) => {
            const constraint = normalizeRoleConstraint(
              role,
              band.constraints[role],
            );
            const slots = normalizeLineupValue(
              (band.defaultLineup ?? {})[role],
              constraint.max,
            );
            return (
              <div key={role} className="lineup-card">
                <strong>
                  {getRoleDisplayName(
                    role,
                    band.constraints,
                    band.roleConstraints,
                  )}
                </strong>
                {Array.from({ length: Math.max(constraint.max, 1) }).map(
                  (_, idx) => (
                    <div key={idx} className="lineup-list__row">
                      <span>
                        {musicians.find((m) => m.id === slots[idx])?.name ??
                          "Not set"}
                      </span>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          const selected =
                            musicians[idx % Math.max(musicians.length, 1)];
                          if (!selected) return;
                          const current = normalizeLineupValue(
                            (band.defaultLineup ?? {})[role],
                            constraint.max,
                          );
                          while (
                            current.length < Math.max(constraint.max, idx + 1)
                          )
                            current.push("");
                          current[idx] = selected.id;
                          setBand({
                            ...band,
                            defaultLineup: {
                              ...(band.defaultLineup ?? {}),
                              [role]:
                                constraint.max === 1
                                  ? current[0]
                                  : current.filter(Boolean),
                            },
                          });
                        }}
                      >
                        Change
                      </button>
                    </div>
                  ),
                )}
              </div>
            );
          })}
        </div>
      </article>
      <article className="lineup-card">
        <div className="panel__header">
          <h3>Contacts</h3>
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              setBand({
                ...band,
                contacts: [
                  ...band.contacts,
                  { id: crypto.randomUUID(), name: "New Contact" },
                ],
              })
            }
          >
            + Add contact
          </button>
        </div>
        {band.contacts.map((contact) => (
          <div key={contact.id} className="lineup-list__row">
            <input
              value={contact.name}
              onChange={(e) =>
                setBand({
                  ...band,
                  contacts: band.contacts.map((item) =>
                    item.id === contact.id
                      ? { ...item, name: e.target.value }
                      : item,
                  ),
                })
              }
            />
            <button
              type="button"
              className="button-secondary"
              onClick={() =>
                setBand({
                  ...band,
                  contacts: band.contacts.filter(
                    (item) => item.id !== contact.id,
                  ),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </article>
      <article className="lineup-card">
        <div className="panel__header">
          <h3>Messages</h3>
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              setBand({
                ...band,
                messages: [
                  ...band.messages,
                  { id: crypto.randomUUID(), name: "New Message", body: "" },
                ],
              })
            }
          >
            + Add message
          </button>
        </div>
        {band.messages.map((message) => (
          <label key={message.id}>
            {message.name}
            <textarea
              value={message.body}
              onChange={(e) =>
                setBand({
                  ...band,
                  messages: band.messages.map((item) =>
                    item.id === message.id
                      ? { ...item, body: e.target.value }
                      : item,
                  ),
                })
              }
            />
          </label>
        ))}
      </article>
      {status ? <p className="status status--error">{status}</p> : null}
      <div className="setup-action-bar">
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/library/bands")}
        >
          Back
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/library/bands")}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={async () => {
            await saveBand();
            navigate("/library/bands");
          }}
        >
          Save
        </button>
      </div>
    </section>
  );
}

export function LibraryMusiciansPage({ registerNavigationGuard }: LibraryPageProps) {
  const [items, setItems] = useState<LibraryMusician[]>([]);
  const [editing, setEditing] = useState<LibraryMusician | null>(null);
  const [draft, setDraft] = useState<LibraryMusician | null>(null);
  const [status, setStatus] = useState("");
  const isDirty = Boolean(
    editing && draft && JSON.stringify(editing) !== JSON.stringify(draft),
  );
  useEffect(() => {
    invoke<LibraryMusician[]>("list_library_musicians")
      .then(setItems)
      .catch(() => setStatus("Failed to load musicians"));
  }, []);
  useEffect(() => {
    registerNavigationGuard(
      editing
        ? {
            isDirty: () => isDirty,
            save: async () => {
              if (draft)
                await invoke("upsert_library_musician", { musician: draft });
            },
          }
        : null,
    );
    return () => registerNavigationGuard(null);
  }, [editing, isDirty, draft, registerNavigationGuard]);
  return (
    <LibrarySimpleEntityPage
      title="Musicians"
      status={status}
      onCreate={() => {
        const next = {
          id: crypto.randomUUID(),
          name: "",
          defaultRoles: [],
          notes: "",
        };
        setEditing(next);
        setDraft(next);
      }}
      rows={items.map((item) => ({
        id: item.id,
        name: item.name,
        detail: item.defaultRoles.join(", "),
      }))}
      onEdit={(id) => {
        const selected = items.find((item) => item.id === id);
        if (!selected) return;
        setEditing(selected);
        setDraft({ ...selected });
      }}
      onDelete={async (id) => {
        await invoke("delete_library_musician", { musicianId: id });
        setItems(await invoke<LibraryMusician[]>("list_library_musicians"));
      }}
      modal={
        draft ? (
          <div className="form-grid">
            <label>
              Name
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Gender
              <input
                value={draft.gender ?? ""}
                onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
              />
            </label>
            <label>
              Default roles
              <input
                value={draft.defaultRoles.join(", ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    defaultRoles: e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              Notes
              <textarea
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
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
                  await invoke("upsert_library_musician", {
                    musician: {
                      ...draft,
                      id: draft.id || toIdSlug(draft.name),
                    },
                  });
                  setItems(
                    await invoke<LibraryMusician[]>("list_library_musicians"),
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

export function LibraryInstrumentsPage({ registerNavigationGuard }: LibraryPageProps) {
  return (
    <LibraryEntityCrud
      title="Instruments"
      listCommand="list_library_instruments"
      upsertCommand="upsert_library_instrument"
      deleteCommand="delete_library_instrument"
      registerNavigationGuard={registerNavigationGuard}
    />
  );
}
export function LibraryContactsPage({ registerNavigationGuard }: LibraryPageProps) {
  return (
    <LibraryEntityCrud
      title="Contacts"
      listCommand="list_library_contacts"
      upsertCommand="upsert_library_contact"
      deleteCommand="delete_library_contact"
      registerNavigationGuard={registerNavigationGuard}
    />
  );
}
export function LibraryMessagesPage({ registerNavigationGuard }: LibraryPageProps) {
  return (
    <LibraryEntityCrud
      title="Messages"
      listCommand="list_library_messages"
      upsertCommand="upsert_library_message"
      deleteCommand="delete_library_message"
      registerNavigationGuard={registerNavigationGuard}
      multiline
    />
  );
}

