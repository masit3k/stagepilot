---
name: stagepilot-commit
description: "Use in the StagePilot repository for commit-related tasks: inspect pending changes, detect suspicious files, propose a conventional commit message, stage selected files, run appropriate validation, create a commit, and push only when explicitly requested."
---

# StagePilot Commit

Use this skill only in the StagePilot repository.

Follow the repository `AGENTS.md` strictly before applying this workflow. Repository instructions have priority for architecture, storage, validation, and UX rules.

Do not edit source files as part of this workflow unless the user explicitly asks for fixes before committing.

## Supported Modes

Determine the requested mode from the user's prompt:

1. Inspect only
   - Use when the user asks to review pending changes or check what would be committed.
   - Do not stage, commit, or push.

2. Commit message only
   - Use when the user asks only for a commit message.
   - Inspect the relevant diff if available.
   - Output only the proposed single-line commit message.

3. Commit only
   - Use when the user explicitly asks to create a commit.
   - Stage only relevant files.
   - Run appropriate validation.
   - Commit with a conventional commit message.
   - Do not push unless explicitly requested.

4. Commit and push
   - Use only when the user explicitly asks to commit and push.
   - Commit first.
   - Push only to the current upstream branch.

If the requested mode is ambiguous, choose the safest lower-impact mode and state the assumption.

## Workflow

### 1. Inspect the working tree

Run:

```bash
git status --short
git diff --stat
git diff
```

If staged files exist, also run:

```bash
git diff --staged --stat
git diff --staged
```

Treat already staged files as potentially intentional user state. Do not unstage, overwrite, or modify them unless the user explicitly asks.

### 2. Detect suspicious or unrelated files

Treat these as suspicious unless clearly requested:

- unrelated edits
- generated artifacts
- secrets, credentials, tokens, keys
- local settings
- runtime data
- build outputs
- dependency lockfile changes not caused by the task
- changes under `data/assets/`, unless explicitly part of a catalog/static asset task
- files outside the StagePilot repository scope

Do not modify or revert suspicious files.

If suspicious files cannot be safely separated from the requested commit, stop and ask the user what to include.

### 3. Select relevant files

Stage only files that are directly related to the requested task.

Use explicit pathspecs only.

Allowed:

```bash
git add path/to/file.ts path/to/other-file.test.ts
```

Forbidden:

```bash
git add .
git add -A
git commit -a
```

After staging, re-check:

```bash
git status --short
git diff --staged --stat
git diff --staged
```

If the staged diff contains unrelated changes, stop before committing.

### 4. Choose a conventional commit message

Use the smallest accurate conventional prefix:

- `feat:`
- `fix:`
- `refactor:`
- `test:`
- `docs:`
- `chore:`
- `build:`

Rules:

- single line only
- concise and specific
- imperative or neutral project style
- no trailing period
- no multiple sentences
- describe only the staged change

Examples:

```text
fix: preserve effective drum setup in PDF inputs
docs: document StagePilot commit workflow
refactor: simplify monitor row ordering resolver
```

### 5. Run validation

For docs-only, config-only, or skill-only changes, validation may be skipped if no executable behavior changed. State that clearly.

For executable changes, run the smallest relevant validation first:

Domain logic:

```bash
npx vitest run src/domain/...
```

PDF/document generation:

```bash
npm test
npm run smoke:pdf-preview
```

UI changes:

```bash
npm run lint
```

Run `npm run build:desktop` when desktop TypeScript or bundling risk is relevant.

Significant executable changes:

```bash
npm test
npm run lint
```

Tauri/Rust changes:

```bash
npm run tauri:build
```

If validation fails:

- report the failing command,
- summarize the relevant error,
- do not commit unless the user explicitly instructs to proceed despite the failure.

If validation cannot be run due to missing dependencies or environment limitations, report that clearly.

### 6. Commit

Before committing, verify that:

- only intended files are staged,
- validation passed or was intentionally skipped,
- the commit message matches the staged diff.

Commit with:

```bash
git commit -m "<message>"
```

If the staged diff changes unexpectedly at any point, stop and inspect before proceeding.

### 7. Push

Push only if the user explicitly requested push.

Before pushing, identify the branch and upstream:

```bash
git branch --show-current
git rev-parse --abbrev-ref --symbolic-full-name @{u}
```

Push only to the current upstream branch:

```bash
git push
```

Do not:

- create branches,
- switch branches,
- force push,
- use `--set-upstream`,
- push to a different remote or branch,

unless the user explicitly asks.

## StagePilot Guardrails

- Preserve existing UX flows, CTA ordering, and visual consistency.
- Do not redesign architecture unless explicitly requested.
- Keep domain logic in `src/domain/` free of filesystem, network, Tauri, and browser I/O.
- Keep orchestration in `src/app/usecases/` and I/O in `src/infra/` unless an established pattern clearly requires otherwise.
- Use `effectiveSetup` from `resolveEffectiveProjectSetup` as the source of truth for resolved musician setup during document generation.
- Treat AppData runtime storage as authoritative for projects, library/catalog user data, versions, temp files, and default exports.
- Do not write user data outside the AppData root except explicit user-selected PDF export paths or CLI `--outDir` workflows.
- Never modify `data/assets/` at runtime.
- Do not add new direct runtime imports from `data/assets/` when an AppData-backed repository path exists.

## Final Response

For inspect-only tasks, include:

- inspected files/change areas,
- suspicious files, if any,
- recommended commit grouping,
- proposed commit message, if useful.

For commit-message-only tasks:

- output only the proposed single-line commit message.

For commit-only tasks, include:

- committed files,
- commit message,
- validation run and result,
- suspicious/uncommitted files left untouched, if any.

For commit-and-push tasks, include:

- committed files,
- commit message,
- validation run and result,
- pushed branch/upstream,
- suspicious/uncommitted files left untouched, if any.
