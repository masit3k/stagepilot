# PDF rendering pipeline

> Status: Descriptive documentation of the current PDF rendering architecture.
> This is not a new product specification.
> Update this document whenever the PDF rendering pipeline changes intentionally.

## Status

This document describes the implemented post-refactor PDF pipeline. It records
where responsibilities live today and should be kept in sync with intentional
changes to document building, PDF rendering, PDF source data, or stageplan
rendering.

## Overview

The high-level flow is:

```text
project JSON -> normalizeProject -> loadRepository/loadCatalogRepository
  -> buildDocument -> validateDocument -> renderInputlistHtml
  -> renderPdf/Puppeteer
```

`DocumentViewModel` is the final PDF-facing document model. Domain and pipeline
code prepares that model; infrastructure code turns it into HTML and then a PDF.

## Entry points

- `scripts/desktop_preview.ts`
  - `main()` / internal `run()`
  - Loads a project from a runtime user-data directory, builds and validates a
    `DocumentViewModel`, and writes a preview PDF into `temp`.
  - Produces a preview PDF response contract for desktop callers.

- `scripts/desktop_export.ts`
  - `run()`
  - Loads a project by id from a runtime user-data directory and calls
    `exportProjectPdf`.
  - Produces version/export PDF metadata or an export-lock/error response for
    desktop callers.

- `src/app/usecases/exportPdf.ts`
  - `exportPdf`, `exportPdfFromProjectFile`, `exportProjectPdf`
  - Normalizes project input, loads repository data, builds and validates the
    document model, renders a PDF, creates a version snapshot, and publishes an
    export PDF.
  - Produces version/export PDFs.

- `src/app/usecases/generateDocument.ts`
  - `generateDocument`
  - Loads and normalizes a project, builds `DocumentViewModel`, and validates it.
  - Produces the document model, not a PDF.

- `src/cli/index.ts`
  - default project command, `generate`, `--versions`, `--show-version`
  - The default command prints a document model or calls `exportPdf` when
    `--pdf` is provided. `generate` exports from a project file into an output
    directory. Version commands inspect saved versions.

- Smoke scripts
  - `scripts/smoke_versions.ts` exercises export/version metadata and CLI
    version listing.
  - `scripts/smoke_pdf_preview.ts` exercises `buildDocument` plus `renderPdf`
    into a temporary preview PDF.

## Data sources

`loadRepository` delegates to `loadCatalogRepository`.

Runtime AppData, resolved through `catalogPathsForRoot`, is the source for:

- `projects`
- `catalog/bands`
- `catalog/musicians`
- `catalog/contacts`
- `catalog/templates/notes`
- `exports`
- `temp`
- `versions`
- `storage.json`

Built-in repository assets are the source for:

- group presets under `data/assets/presets/groups`
- monitor presets under `data/assets/presets/monitors`
- drum input catalog under `data/assets/catalog/inputs/drums.json`
- PDF fonts referenced from `src/infra/pdf/styles.ts`
- setup blueprints such as `data/assets/setup-blueprints/drums.json`

`catalogPathsForRoot` still defines AppData preset paths, but those paths are
reserved for possible future runtime preset editing. The current repository
loader intentionally reads group and monitor presets from built-in assets. This
source policy is covered by `src/infra/storage/catalogRepository.test.ts`.

## Pipeline flow

1. Project JSON is normalized by `normalizeProject`.
2. `loadRepository` / `loadCatalogRepository` loads runtime catalog entities
   and built-in preset assets.
3. `resolveDocumentContext` resolves the band, validates the band leader,
   resolves effective lineup/overlays/talkback, and loads lineup musicians.
4. `resolveEffectiveProjectState` normalizes project lineup slots, overlays,
   talkback state, preset overrides, and drum-definition overrides.
5. `resolveEffectiveProjectSetup` resolves per-musician inputs and monitoring
   from musician presets plus project overrides.
6. `buildDocument` orchestrates the PDF-facing document model.
7. `validateDocument` validates the completed `DocumentViewModel`.
8. `renderInputlistHtml` renders the model to two-page HTML.
9. `renderPdf` launches Puppeteer/Chromium, checks page overflow, and writes the
   final PDF.

## Document build layer

`src/domain/pipeline/buildDocument.ts` is the main orchestration point for
building the `DocumentViewModel`.

It coordinates:

- context resolution through `resolveDocumentContext`
- effective project setup through `resolveEffectiveProjectSetup`
- per-musician input collection
- vocal capability and overlay handling
- talkback handling through `buildPdfTalkbackInputs`
- monitor row creation through `buildPdfMonitorRows`
- key formatting through `formatKeysInputInstances`
- input disambiguation through `disambiguateInputKeys`
- drum, vocal, and project-meta formatting
- input ordering and final block composition
- PDF channel numbering through `assignPdfChannels`
- printable input rows through `buildPdfInputRows`
- stageplan model creation through `buildPdfStageplanModel`
- notes creation through `buildPdfNotes`

The extracted modules own focused policies; `buildDocument` wires those policies
together.

## PDF-specific pipeline modules

Current modules under `src/domain/pipeline/pdf/`:

- `assignPdfChannels.ts`
  - Exports `assignPdfChannels`, `buildPdfInputRows`, and related input types.
  - Owns PDF channel numbering and conversion to printable input rows.
  - Domain/content logic for the PDF document model.

- `buildPdfMonitorRows.ts`
  - Exports `GROUP_MONITOR_ORDER`, `orderPdfMonitorOwners`,
    `buildPdfMonitorRows`, and `MonitorOwner`.
  - Owns monitor owner ordering and monitor table row creation.
  - Domain/content logic for the PDF document model.

- `buildPdfNotes.ts`
  - Exports `buildPdfNotes`.
  - Filters notes template lines against monitor conditions such as wedge usage.
  - Domain/content logic for PDF notes.

- `buildPdfTalkback.ts`
  - Exports `normalizeTalkbackLabel`, `buildPdfTalkbackInputs`, and
    `PdfTalkbackInput`.
  - Resolves talkback inputs and normalizes talkback labels.
  - Domain/content logic for PDF inputs.

- `buildPdfStageplan.ts`
  - Exports `buildPdfStageplanModel`.
  - Projects numbered inputs, monitor rows, lineup people, lead vocal slots, and
    power data into `DocumentViewModel["stageplan"]`.
  - Renderer-facing document model logic, but not visual layout.

- `buildPdfStageplanPrintModel.ts`
  - Exports `buildPdfStageplanPrintModel` plus print-model types.
  - Shapes stageplan content into print boxes, input bullets, monitor bullets,
    headers, power badges, and slot assignment.
  - Renderer-facing model logic, not HTML/CSS layout.

- `pdfOrdering.ts`
  - Exports `comparePdfInputs`, `composeFinalPdfInputOrder`,
    `orderPdfVocalInputs`, and input classifier helpers.
  - Owns PDF input ordering policies and final block composition.
  - Domain/content ordering logic.

Test-only files in the same directory cover ordering, formatting, and stageplan
print-model behavior.

## Input numbering

Detailed numbering rules live in
[`docs/architecture/pdf-input-numbering.md`](./pdf-input-numbering.md).

Briefly:

- `vm.inputs` is the canonical physical numbered FOH input list.
- `vm.inputRows` is the compact printable input table representation.
- Mono inputs consume one channel.
- Stereo pairs consume two physical channels.
- Odd-start stereo behavior may insert spare channels.
- Spare channels remain in `vm.inputs` and `vm.inputRows`.
- Spare channels are excluded from `vm.stageplan.inputs`.
- Printed row compaction is separate from physical channel numbering.

## Ordering policies

- Input group/order policy starts in `comparePdfInputs` from `pdfOrdering.ts`.
  It uses group order, drum catalog rank, vocal rank, guitar rank, bass setup
  ordering, lineup order, label, and key.
- Final input block composition is handled by `composeFinalPdfInputOrder`:
  instruments first, ordered vocals next, talkback last.
- Vocal ordering is handled by `orderPdfVocalInputs`, using owner role rank,
  lead/back slot maps, and lead/back classification.
- Monitor owner ordering is handled by `orderPdfMonitorOwners` in
  `buildPdfMonitorRows.ts`, using `GROUP_MONITOR_ORDER` and lead vocal slot
  ordering.
- Stageplan print ordering is handled in `buildPdfStageplanPrintModel.ts`:
  fixed print slots, per-slot input grouping, numeric input ordering, special
  drum aggregation, key input rank, and monitor bullet ordering by monitor
  output number.

## Formatting policies

Formatting is split by domain concern:

- Input table note formatting and stereo row compaction:
  `src/domain/formatters/inputlist.ts`
  (`formatInputListNote`, `compactStereoInputChannelsForPdf`,
  `resolveStereoPair`).
- Vocal PDF labels:
  `src/domain/formatters/vocalPdfLabels.ts`
  (`formatLeadVocalPdfLabel`, `formatBackVocalPdfLabel`).
- Monitor labels:
  `src/domain/formatters/monitors.ts`
  (`formatMonitorLabel`, `formatMonitorOwnerLabel`,
  `formatMonitoringLabel`) and `src/domain/monitors/getMonitorLabel.ts`.
- Talkback labels:
  `src/domain/pipeline/pdf/buildPdfTalkback.ts`
  (`normalizeTalkbackLabel`).
- Keys labels:
  `src/domain/pipeline/formatKeysInputs.ts`
  (`formatKeysInputInstances`) and `disambiguateInputKeys`.
- Drum labels:
  `src/domain/formatters/inputLabels.ts`
  (`groupActiveDrumInputsByFamily`, `formatDrumInputDisplayLabel`).
- Stageplan headers and monitor bullets:
  `src/domain/formatters/stageplan.ts`
  (`formatStageplanBoxHeader`, `formatMonitorBullet`,
  `formatMonitorBullets`).
- Project meta line formatting:
  `src/domain/formatters/meta.ts` (`formatProjectMetaLine`).

There is no single central PDF formatting module; policies remain near their
domain concern.

## Stageplan architecture

Stageplan work is split between domain/pipeline content shaping and infra
rendering.

Domain/pipeline responsibilities:

- `buildPdfStageplanModel` creates `DocumentViewModel["stageplan"]` from
  numbered inputs, monitor rows, lineup people, lead vocal slots, and power
  requirements.
- `buildPdfStageplanPrintModel` turns the stageplan document model into print
  boxes and bullet content.
- `resolvePowerForStageplan`, `resolveStageplanRoleForInput`, and
  `collapseStereoForStageplan` support content placement and text shaping.

Infra renderer responsibilities:

- `src/infra/pdf/sections/stageplan.ts` selects layout variants, computes box
  coordinates and sizing, checks stageplan page height, and renders stageplan
  HTML.
- `stageplanLayout` contains renderer layout constants and is consumed by
  `styles.ts`.
- `StageplanRenderOptions` currently supports `hideMusicianNames` for preview
  and export rendering.

Visual layout remains an infra concern and is intentionally separate from the
domain document model.

## Rendering layer

- `src/infra/pdf/template.ts`
  - Renders page 1 with header, input table, monitor table, and notes.
  - Renders page 2 with the stageplan section.
  - Escapes text and injects `pdfStyles`.

- `src/infra/pdf/pdf.ts`
  - Converts `DocumentViewModel` to HTML with `renderInputlistHtml`.
  - Resolves font/logo base URLs.
  - Launches Puppeteer/Chromium with fallback strategies.
  - Checks each PDF page/content pair for overflow.
  - Writes the final A4 PDF.

- `src/infra/pdf/styles.ts`
  - Defines PDF CSS, local Inter font faces, table styling, notes styling, and
    stageplan styling.

- `src/infra/pdf/layout.ts`
  - Defines page, typography, table, and DOM id constants shared by template,
    styles, and overflow checks.

- `src/infra/pdf/sections/stageplan.ts`
  - Builds the render plan and emits stageplan HTML.

## Error handling and diagnostics

- Explicit missing preset references fail fast with contextual errors during
  preset expansion, setup resolution, talkback resolution, or monitor override
  resolution.
- Wrong preset entity types fail with messages naming the expected and actual
  type.
- Missing project, band, musician, or notes-template data propagates through
  repository errors.
- `validateDocument` runs after `buildDocument` in generation/export flows.
- Desktop preview wraps failures into a `PREVIEW_FAILED` response with phase and
  stack details.
- Desktop export wraps export-lock failures separately and otherwise returns
  `EXPORT_FAILED`.
- CLI `generate` classifies validation, layout overflow, I/O, and engine errors
  into its current JSON response shape.
- Renderer overflow and missing stageplan layout positions remain renderer-level
  errors.
- Chromium launch diagnostics are logged by `renderPdf`.

## Test coverage

Important coverage after the stabilization work includes:

- `src/domain/pipeline/buildDocument.pdfRegression.test.ts`
  - Freezes current full-lineup document model ordering, numbering, labels,
    monitor rows, and stageplan data.

- `src/domain/pipeline/buildDocument.presetDiagnostics.test.ts`
  - Covers fail-fast diagnostics for missing/wrong preset references.

- `src/infra/storage/catalogRepository.test.ts`
  - Covers runtime-vs-built-in catalog source policy.

- `src/domain/pipeline/pdf/pdfOrdering.test.ts`
  - Covers PDF input ordering, final block composition, and monitor owner order.

- `src/domain/pipeline/pdf/pdfFormatting.test.ts`
  - Covers PDF-specific formatting behavior such as talkback label
    normalization.

- `src/domain/pipeline/pdf/buildPdfStageplanPrintModel.test.ts`
  - Covers stageplan print-model content shaping.

- `src/infra/pdf/template.test.ts`
  - Covers two-page template layout and stageplan render options.

- `src/infra/pdf/sections/stageplan.test.ts`
  - Covers stageplan layout selection, geometry, bullets, names, monitor
    bullets, and power badges.

- Formatter coverage:
  - `src/domain/formatters/inputlist.test.ts`
  - `src/domain/formatters/vocalPdfLabels.test.ts`
  - `src/domain/formatters/monitors.test.ts`
  - `src/domain/pipeline/formatKeysInputs.test.ts`

- TypeScript validation:
  - `npx tsc -p tsconfig.json --noEmit` is expected to pass.

## Known boundaries and future work

- Final PDF generation depends on Puppeteer/Chromium.
- Stageplan visual layout remains in infra code and is intentionally not domain
  logic.
- Group and monitor presets are currently built-in repository assets, not
  runtime-editable AppData catalog entities.
- Runtime preset editing would require a separate migration and source-of-truth
  design.
- Full visual regression or golden-PDF testing is not currently documented as
  part of the standard validation flow.
