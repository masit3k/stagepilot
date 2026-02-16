import { ModalOverlay } from "../../../../components/ui/Modal";
import type { ReactNode } from "react";

export function LibrarySimpleEntityPage({
  title,
  status,
  onCreate,
  rows,
  onEdit,
  onDelete,
  modal,
  onCloseModal,
}: {
  title: string;
  status: string;
  onCreate: () => void;
  rows: { id: string; name: string; detail?: string }[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  modal: ReactNode;
  onCloseModal: () => void;
}) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{title}</h2>
        <button type="button" onClick={onCreate}>
          + New
        </button>
      </div>
      {status ? <p className="status status--error">{status}</p> : null}
      <div className="library-table">
        {rows.map((row) => (
          <div key={row.id} className="library-row">
            <span>{row.name}</span>
            <span>{row.detail || "—"}</span>
            <div className="project-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => onEdit(row.id)}
              >
                Edit
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => onDelete(row.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      <ModalOverlay open={Boolean(modal)} onClose={onCloseModal}>
        <div className="selector-dialog">
          <button type="button" className="modal-close" onClick={onCloseModal}>
            ×
          </button>
          {modal}
        </div>
      </ModalOverlay>
    </section>
  );
}

