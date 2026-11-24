import { useEffect, useState } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { Inbox } from "../../components/ui/icons";
import { useToast } from "../../components/ui/toast/useToast";
import {
  type BandListItem,
  describeApiError,
  listBandSummaries,
} from "../services/bandsApi";
import type { LibraryPageProps } from "./shared/pageTypes";

type BandListState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly items: readonly BandListItem[] }
  | { readonly kind: "error"; readonly message: string };

/**
 * `/library` (R12): s jedinou entitou nemá rozcestník smysl, Library je
 * rovnou seznam kapel. Muzikanti si při svém specu přidají vlastní záložku.
 */
export function LibraryBandsPage({
  navigate,
  registerNavigationGuard,
}: LibraryPageProps) {
  const { notify } = useToast();
  const [state, setState] = useState<BandListState>({ kind: "loading" });

  useEffect(() => {
    registerNavigationGuard(null);
    let active = true;
    listBandSummaries()
      .then((items) => {
        if (!active) return;
        setState({ kind: "ready", items });
        const unreadable = items.filter((item) => item.kind === "error").length;
        if (unreadable > 0) {
          notify(
            "error",
            unreadable === 1
              ? "1 band file could not be read. See the list for the file path."
              : `${unreadable} band files could not be read. See the list for the file paths.`,
          );
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        const { message } = describeApiError(error);
        setState({ kind: "error", message });
        notify("error", `Bands could not be loaded: ${message}`);
      });
    return () => {
      active = false;
      registerNavigationGuard(null);
    };
  }, [notify, registerNavigationGuard]);

  const openNewBand = () => navigate("/library/bands/new");

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Bands</h2>
        <button type="button" className="button-primary" onClick={openNewBand}>
          New band
        </button>
      </div>
      <div aria-live="polite">
        <BandListBody
          state={state}
          navigate={navigate}
          onNewBand={openNewBand}
        />
      </div>
    </section>
  );
}

function BandListBody({
  state,
  navigate,
  onNewBand,
}: {
  state: BandListState;
  navigate: (path: string) => void;
  onNewBand: () => void;
}) {
  if (state.kind === "loading") return <p className="status">Loading bands…</p>;
  if (state.kind === "error") {
    return (
      <p className="status status--error" role="alert">
        {state.message}
      </p>
    );
  }
  if (state.items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={22} />}
        title="No bands yet"
        description="A band holds the lineup, the band leader and the contact that a new project starts from."
        action={
          <button type="button" className="button-primary" onClick={onNewBand}>
            New band
          </button>
        }
      />
    );
  }
  return (
    <div className="library-table">
      {state.items.map((item) =>
        item.kind === "error" ? (
          <div key={item.id} className="library-row">
            <span>{item.name}</span>
            <span className="field-error">{item.message}</span>
            <span />
            <span>
              <span className="setup-badge setup-badge--override">
                Unreadable
              </span>
            </span>
            <span />
          </div>
        ) : (
          <div key={item.id} className="library-row">
            <span>{item.name}</span>
            <span>{item.code ?? "—"}</span>
            <span>{formatMemberCount(item.memberCount)}</span>
            <span>
              {item.isIncomplete ? (
                <span className="setup-badge setup-badge--override">
                  Incomplete
                </span>
              ) : null}
            </span>
            <button
              type="button"
              className="button-secondary"
              onClick={() =>
                navigate(`/library/bands/${encodeURIComponent(item.id)}`)
              }
            >
              Edit
            </button>
          </div>
        ),
      )}
    </div>
  );
}

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}
