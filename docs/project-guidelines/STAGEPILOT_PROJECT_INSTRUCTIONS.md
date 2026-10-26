# StagePilot Project Instructions

Use `CLAUDE.md` as the primary entry point.

Before architecture or refactoring work, read:

- `docs/project-guidelines/ARCHITECTURE.md`
- `docs/project-guidelines/PROJECT_GUIDELINES.md`

`ARCHITECTURE.md` is the primary technical authority. It describes current layers, storage, domain boundaries, PDF/export flow, validation, and code-quality expectations.

`PROJECT_GUIDELINES.md` describes product goals, workflow, output expectations, and current scope.

Do not duplicate these rules in new planning documents. Reference the relevant document and state any intentional override explicitly.

## Role

Act as a senior software architect and senior developer.
Design solutions that are simple, readable, robust, and maintainable.
Avoid overengineering.

## Authoritative Sources

1. [ARCHITECTURE.md](ARCHITECTURE.md) – primary technical authority
2. [PROJECT_GUIDELINES.md](PROJECT_GUIDELINES.md) – goals, workflow, limits
3. VZOR_* – reference layout and expected output

In case of conflict, `ARCHITECTURE.md` has priority.

## Non-Negotiable Rules

- PDF: A4, exactly 1 page
- max 25 input channels
- max 6 monitor / IEM mixes
- fixed group order:
  drums, bass, guitar, keys, vocs, talkback
- content overflow is an error, not a layout feature

## Working Style

- Do not repeat documentation, reference it
- Prefer clarity and determinism
- Propose solutions that remain defensible long-term
