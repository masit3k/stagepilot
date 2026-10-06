import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildBandDraftContext } from "../../../../../src/domain/band/buildBandDraftContext";
import type {
  BandDraftContext,
  BandDraftError,
} from "../../../../../src/domain/band/buildBandFromDraft";
import { useToast } from "../../components/ui/toast/useToast";
import { BandContactSection } from "../components/band/BandContactSection";
import { BandIdentitySection } from "../components/band/BandIdentitySection";
import { BandLineupSection } from "../components/band/BandLineupSection";
import { BandRolesSection } from "../components/band/BandRolesSection";
import {
  type BandFormState,
  bandFormFromBand,
  createEmptyBandForm,
  serializeBandForm,
  setContactMember,
  toBandDraft,
} from "../domain/band/bandFormModel";
import {
  type BandFormData,
  type SaveBandDraftResult,
  describeApiError,
  loadBandFormData,
  readContact,
  saveBandDraft,
} from "../services/bandsApi";
import { NEW_BAND_ROUTE_SEGMENT } from "../shell/routes";
import type { LibraryPageProps } from "./shared/pageTypes";

export type LibraryBandFormPageProps = LibraryPageProps & {
  /** `null` = zakládá se nová kapela (`/library/bands/new`). */
  readonly bandId: string | null;
  /** Ruling 10: obnoví kapely v shellu, aby novou kapelu nabídlo založení projektu. */
  readonly onBandSaved: () => Promise<void>;
};

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "notFound" }
  | { readonly kind: "ready"; readonly data: BandFormData };

type Notify = (kind: "success" | "error", message: string) => void;

/** `/library/bands/new` a `/library/bands/:id` (R12): jeden formulář pro založení i úpravu. */
export function LibraryBandFormPage({
  bandId,
  navigate,
  registerNavigationGuard,
  onBandSaved,
}: LibraryBandFormPageProps) {
  const { notify } = useToast();
  const [form, setForm] = useState<BandFormState>(createEmptyBandForm);
  const formRef = useRef(form);
  formRef.current = form;
  const baselineRef = useRef<string | null>(null);

  const load = useBandFormData(bandId, notify, (data) => {
    const initial = data.band
      ? bandFormFromBand(data.band, data.contact)
      : createEmptyBandForm();
    baselineRef.current = serializeBandForm(initial);
    setForm(initial);
  });
  const context = useDraftContext(load);
  const { persist, errors, isSaving } = useBandPersistence({
    bandId,
    context,
    formRef,
    baselineRef,
    notify,
    onBandSaved,
  });

  useEffect(() => {
    registerNavigationGuard({
      isDirty: () =>
        baselineRef.current !== null &&
        serializeBandForm(formRef.current) !== baselineRef.current,
      save: async () => {
        const result = await persist();
        if (!result?.ok) throw new Error("The band was not saved.");
      },
    });
    return () => registerNavigationGuard(null);
  }, [persist, registerNavigationGuard]);

  const selectContactMember = useCallback(
    (musicianId: string) => {
      if (!musicianId) {
        setForm((state) => setContactMember(state, "", null));
        return;
      }
      readContact(musicianId)
        .then((existing) =>
          setForm((state) => setContactMember(state, musicianId, existing)),
        )
        .catch((error: unknown) =>
          notify(
            "error",
            `The contact could not be loaded: ${describeApiError(error).message}`,
          ),
        );
    },
    [notify],
  );

  if (load.kind !== "ready") {
    return <BandFormStatus load={load} bandId={bandId} navigate={navigate} />;
  }

  const handleSave = () => {
    void persist().then((result) => {
      if (result?.ok && !bandId)
        navigate(`/library/bands/${encodeURIComponent(result.bandId)}`);
    });
  };
  const { musicians } = load.data;

  return (
    <section className="panel band-form">
      <div className="panel__header">
        <h2>{bandId ? `Edit band: ${form.name || bandId}` : "New band"}</h2>
      </div>
      <BandIdentitySection
        form={form}
        bandId={bandId}
        errors={errors}
        onChange={setForm}
      />
      <BandLineupSection
        form={form}
        musicians={musicians}
        errors={errors}
        onChange={setForm}
      />
      <BandRolesSection
        form={form}
        musicians={musicians}
        errors={errors}
        onChange={setForm}
      />
      <BandContactSection
        form={form}
        musicians={musicians}
        errors={errors}
        onChange={setForm}
        onSelectMember={selectContactMember}
      />
      <div className="setup-action-bar setup-action-bar--equal">
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/library")}
        >
          Back to bands
        </button>
        <button
          type="button"
          className="button-primary"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving ? "Saving…" : "Save band"}
        </button>
      </div>
    </section>
  );
}

/** R13: rozbitý soubor přeruší načtení a toast nese cestu (zprávu z Rustu). */
function useBandFormData(
  bandId: string | null,
  notify: Notify,
  onLoaded: (data: BandFormData) => void,
): LoadState {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    let active = true;
    loadBandFormData(bandId)
      .then((data) => {
        if (!active) return;
        if (bandId && !data.band) {
          setLoad({ kind: "notFound" });
          return;
        }
        onLoadedRef.current(data);
        setLoad({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const { message } = describeApiError(error);
        setLoad({ kind: "error", message });
        notify("error", `The band could not be loaded: ${message}`);
      });
    return () => {
      active = false;
    };
  }, [bandId, notify]);

  return load;
}

function useDraftContext(load: LoadState): BandDraftContext | null {
  const data = load.kind === "ready" ? load.data : null;
  return useMemo(
    () =>
      data
        ? buildBandDraftContext({
            musicians: data.musicians,
            presets: data.presets,
            bands: data.bands,
            reservedIds: [NEW_BAND_ROUTE_SEGMENT],
            ...(data.band ? { existingBand: data.band } : {}),
          })
        : null,
    [data],
  );
}

function useBandPersistence(args: {
  readonly bandId: string | null;
  readonly context: BandDraftContext | null;
  readonly formRef: { readonly current: BandFormState };
  readonly baselineRef: { current: string | null };
  readonly notify: Notify;
  readonly onBandSaved: () => Promise<void>;
}) {
  const { bandId, context, formRef, baselineRef, notify, onBandSaved } = args;
  const [errors, setErrors] = useState<readonly BandDraftError[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const persist = useCallback(async (): Promise<SaveBandDraftResult | null> => {
    if (!context) return null;
    const submitted = formRef.current;
    setIsSaving(true);
    try {
      const result = await saveBandDraft(
        toBandDraft(submitted, bandId),
        context,
      );
      setErrors(
        result.ok || result.kind === "writeFailed" ? [] : result.errors,
      );
      reportSaveResult(result, notify);
      if (result.ok) {
        baselineRef.current = serializeBandForm(submitted);
        await refreshAfterSave(onBandSaved, notify);
      }
      return result;
    } finally {
      setIsSaving(false);
    }
  }, [bandId, context, formRef, baselineRef, notify, onBandSaved]);

  return { persist, errors, isSaving };
}

/** R13: `contactWritten` = kontakt na disku zůstal, i když kapela ne; uživatel to musí vědět. */
function reportSaveResult(result: SaveBandDraftResult, notify: Notify): void {
  if (result.ok) {
    notify("success", "Band saved.");
    return;
  }
  if (result.kind === "invalid") return;
  if (result.kind === "bandExists") {
    if (result.contactWritten) {
      notify(
        "error",
        "The contact was saved, but the band was not: a band with this name already exists.",
      );
    }
    return;
  }
  notify(
    "error",
    result.contactWritten
      ? `The contact was saved, but the band was not: ${result.message}`
      : `The band could not be saved: ${result.message}`,
  );
}

async function refreshAfterSave(
  onBandSaved: () => Promise<void>,
  notify: Notify,
): Promise<void> {
  try {
    await onBandSaved();
  } catch (error) {
    notify(
      "error",
      `The band was saved, but the band list could not be refreshed: ${describeApiError(error).message}`,
    );
  }
}

function BandFormStatus({
  load,
  bandId,
  navigate,
}: {
  load: Exclude<LoadState, { kind: "ready" }>;
  bandId: string | null;
  navigate: (path: string) => void;
}) {
  const message =
    load.kind === "loading"
      ? null
      : load.kind === "notFound"
        ? `Band '${bandId ?? ""}' was not found in your library.`
        : load.message;
  return (
    <section className="panel">
      {message === null ? (
        <p className="status">Loading band…</p>
      ) : (
        <p className="status status--error" role="alert">
          {message}
        </p>
      )}
      <div className="setup-action-bar">
        <button
          type="button"
          className="button-secondary"
          onClick={() => navigate("/library")}
        >
          Back to bands
        </button>
      </div>
    </section>
  );
}
