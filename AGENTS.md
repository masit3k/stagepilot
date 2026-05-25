# AGENTS.md

Primary Codex entry point for the StagePilot repository.

## Read Before Architecture Or Refactoring Work

Before architecture, refactoring, storage, PDF, or data-model work, read these documents:

1. `docs/project-guidelines/ARCHITECTURE.md`
2. `docs/project-guidelines/PROJECT_GUIDELINES.md`
3. `docs/project-guidelines/REFACTORING_RULES.md`
4. `docs/project-guidelines/STAGEPILOT_PROJECT_INSTRUCTIONS.md`

## Conflict Priority

1. User's explicit task instruction
2. `AGENTS.md`
3. `docs/project-guidelines/ARCHITECTURE.md`
4. `docs/project-guidelines/PROJECT_GUIDELINES.md`
5. `docs/project-guidelines/REFACTORING_RULES.md`
6. `docs/project-guidelines/STAGEPILOT_PROJECT_INSTRUCTIONS.md`

If a user instruction intentionally overrides documentation, mention the override in the final output. If the override is unclear or appears dangerous, stop and ask questions before changing code.

## Non-Negotiable Rules

- Preserve existing behavior unless the task explicitly requires a behavior change.
- Do not redesign architecture unless explicitly requested.
- Do not introduce speculative abstractions.
- Do not silently change persisted project JSON shape.
- Do not duplicate business logic between UI and PDF/export code.
- Keep UI, application, domain, infrastructure, Tauri, CLI, and PDF responsibilities separated.
- If a requested change conflicts with documented invariants, stop and list questions.
- Prefer small, focused, deterministic changes.
- Do not modify unrelated files.
- Run relevant checks when possible.

## Commit Workflow

- Do not create commits unless explicitly requested.
- Do not push unless explicitly requested.
- For commit-related tasks, use `.agents/skills/stagepilot-commit/SKILL.md`.

## Final Output

Final Codex output must include:

- summary of changes
- modified/created/deleted files
- tests/checks run
- single-line commit message
