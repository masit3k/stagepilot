# PDF input numbering rules

This document records the current `buildDocument` behavior for PDF input
numbering and display rows. It is descriptive, not a new specification.

Source of truth:

- `src/domain/pipeline/buildDocument.ts`
- `src/domain/formatters/inputlist.ts`
- regression coverage in `src/domain/pipeline/buildDocument.pdfRegression.test.ts`
- formatter coverage in `src/domain/formatters/inputlist.test.ts`

## Pipeline position

`buildDocument` resolves and formats all inputs first, then applies channel
numbers near the end of the pipeline:

1. collect instrument, vocal, and talkback inputs
2. sort and reorder inputs into final PDF order
3. apply label formatting and key disambiguation
4. split final inputs into non-vocal/non-talkback, vocal, and talkback blocks
5. assign channel numbers with `assignChannelsWithOddStereoRule`
6. derive compact printed rows with `buildInputRows`
7. derive stageplan inputs from numbered inputs, excluding spare rows

Channel numbers therefore depend on the final ordered input list, not on preset
declaration order alone.

## Canonical numbered inputs: `vm.inputs`

`vm.inputs` is the canonical numbered FOH channel list.

Rules:

- one `vm.inputs` entry equals one physical input channel
- every entry has numeric `ch`
- mono entries consume one channel
- stereo pairs consume two consecutive physical channels
- inserted spare channels are included
- left/right sides remain separate physical entries
- metadata such as `key`, `label`, `baseLabel`, `compactGroupKey`, `channel`,
  `group`, `note`, `ownerRole`, and `ownerMusicianId` stays on physical entries

`vm.inputs` is used for validation and as the source for stageplan inputs. The
stageplan projection filters out spare rows before rendering.

## Printed input rows: `vm.inputRows`

`vm.inputRows` is a view-only representation of the PDF input table.

Rules:

- rows are derived from `vm.inputs` after channel numbering
- rows are sorted by numeric `ch` before display compaction
- a mono or non-compactable physical channel becomes one row:
  - `no: String(ch)`
  - `label: input.label`
  - `note: input.note`
- a compactable stereo pair becomes one row:
  - `no: "N+N+1"`
  - `label: baseLabel`
  - `note: "2x ..."`, unless the normalized note already starts with `2x `
- spare channels are not filtered; they print as normal rows, for example
  `{ no: "12", label: "---", note: "---" }`

`vm.inputRows` intentionally does not preserve canonical details such as `key`,
numeric `ch`, `group`, owner metadata, or separate left/right physical channels.

## Mono numbering

Any ordered input that is not paired with the immediately following input by
`resolveStereoPair` is treated as mono for numbering.

Rules:

- assign the current `nextCh`
- increment `nextCh` by 1
- no odd/even alignment is applied
- mono inputs may receive odd or even channel numbers
- a left or right input that is not recognized as a pair with the next input is
  numbered as a single physical channel

## Stereo pair detection for numbering

`assignChannelsWithOddStereoRule` only compares the current input with the next
input in final order. Non-adjacent inputs are never paired.

A numbering stereo pair requires:

- both inputs have the same `group`
- normalized notes are equal
- either labels form an opposite-side pair, or keys form an opposite-side pair

Label-based side detection accepts these forms:

- `Name L` and `Name R`
- `Name L (...)` and `Name R (...)`
- `Name (L)` and `Name (R)`
- `Name - L` and `Name - R`
- `Name Left` and `Name Right`
- `Name Left (...)` and `Name Right (...)`

For label-based detection, the normalized base labels must match and the sides
must differ.

Key-based side detection is the fallback. It treats adjacent same-group,
same-note inputs as a stereo pair when one key ends with `_l` and the other ends
with `_r`. The current implementation does not compare stripped key stems in
this fallback.

When a pair is detected, the two physical entries are emitted in left-then-right
order even if the adjacent inputs arrived as right-then-left.

## Odd-start stereo behavior

Most detected stereo pairs are forced to start on an odd channel.

Rules:

- if the pair must start odd and `nextCh` is odd, the left side gets `nextCh`
  and the right side gets `nextCh + 1`
- if the pair must start odd and `nextCh` is even, a spare channel is inserted
  at `nextCh`; the stereo pair then starts at `nextCh + 1`
- after assigning a stereo pair, `nextCh` advances by 2
- the pair consumes exactly two consecutive physical channels

The overhead exception is based on the resolved stereo base label. If the
normalized base is exactly `overhead`, `overheads`, or `oh`, the pair does not
force odd start. Current drum overhead rows are therefore numbered consecutively
without spare insertion, for example `OH L` at 9 and `OH R` at 10.

## Spare channel insertion

Spare channels are inserted only by the odd-start stereo rule.

Insertion condition:

- a stereo pair is detected
- the pair is not in the overhead exception
- the current `nextCh` is even

Inserted spare shape:

```ts
{
  ch: nextCh,
  key: `spare_ch_${nextCh}`,
  label: "---",
  group: stereoPairFirstInput.group,
  note: "---",
  ownerRole: stereoPairFirstInput.ownerRole,
}
```

Current effects:

- spare rows are included in `vm.inputs`
- spare rows are included in `vm.inputRows`
- spare rows are excluded from `vm.stageplan.inputs`
- spare rows count as canonical physical input entries for any logic that reads
  `vm.inputs.length`

Example from regression coverage:

- `PAD SFX` receives channel 11
- `Tracks L/R` would otherwise start at 12
- channel 12 is inserted as `spare_ch_12`
- `Tracks` prints as `13+14`

## Compact stereo rows

Input row compaction is separate from numbering stereo detection.

`compactStereoInputChannelsForPdf` compacts two adjacent numbered physical
channels only when all of these are true:

- the rows are adjacent after sorting by `ch`
- `b.ch === a.ch + 1`
- both rows have `compactGroupKey`
- `compactGroupKey` values are equal
- the compaction context is equal:
  `ownerRole + ownerMusicianId + compactGroupKey`
- exactly two rows exist for that compaction context
- both rows have the same `baseLabel`
- normalized notes are equal
- both rows have valid `channel` metadata (`L` or `R`)
- the `channel` values differ

If compacted, the printed row uses `baseLabel` as the label and prefixes the
note with `2x ` after whitespace normalization. If the normalized note already
starts with `2x `, it is left unchanged.

Compaction does not use label parsing and does not use key suffix parsing. It is
metadata-driven through `baseLabel`, `compactGroupKey`, and `channel`.

## Important differences between numbering and compaction

Numbering stereo detection:

- runs before `vm.inputRows`
- compares only adjacent inputs in final order
- uses labels or `_l`/`_r` key suffixes
- requires same `group` and same normalized note
- controls physical channel assignment and spare insertion
- does not require `baseLabel`, `compactGroupKey`, or `channel` metadata

Printed row compaction:

- runs after `vm.inputs` exists
- sorts by numeric channel
- uses metadata only
- requires exactly two rows in the same owner/compact-group context
- controls only PDF table display
- does not change canonical channel numbering

This means a pair can be numbered as stereo but still print as two rows if it
lacks compaction metadata, and a compacted row still represents two physical
entries in `vm.inputs`.
