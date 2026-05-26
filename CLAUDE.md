# CLAUDE.md

This file provides guidance to Claude Code when working with the StagePilot codebase.

## Project Goal

StagePilot is a **production-quality desktop application** for generating stage plan PDFs for music events. The goal is a robust, professional app suitable for public distribution — not a prototype. Prioritize correctness, maintainability, and architectural integrity over speed.

## Commands

```bash
# Tests
npm test                          # vitest run (all tests)
npx vitest run src/domain/...     # single test file

# Lint / format
npm run lint                      # biome check
npm run format                    # biome format --write

# Desktop app
npm run dev                       # Tauri dev (Vite + Rust)
npm run tauri:build               # production desktop build

# CLI (TypeScript, no compile step)
npm run cli:dev -- --project <id>           # generate DocumentViewModel JSON
npm run cli:dev -- --project <id> --pdf     # export PDF
npm run cli:dev -- --versions <id>          # list versions
npm run cli:dev -- generate --project <file> --outDir <dir>  # export from file path

# PDF smoke tests
npm run pdf:dev
npm run smoke:pdf-preview
```

## Tech Stack

- **Frontend:** React + Vite (TypeScript)
- **Desktop:** Tauri (Rust backend)
- **PDF:** Puppeteer (Chromium headless)
- **Testing:** Vitest (Node environment, no jsdom)
- **Linting/Formatting:** Biome (NOT ESLint/Prettier)
- **CLI:** tsx (TypeScript, no compile step)
- **Module system:** ESM

## Code Quality Standards

### General
- Prefer explicit types over `any`
- No dead code, no commented-out blocks
- Functions should do one thing — split if they grow beyond ~40 lines
- Errors must be handled explicitly; never silently swallow exceptions

### Testing philosophy
- Domain logic (`src/domain/`) must be well-covered by unit tests
- Tests are the safety net for refactoring — keep them fast and reliable
- Rewrite or improve existing tests if they are unclear, redundant, or fragile
- Prefer testing behavior over implementation details
- Infrastructure code (PDF, FS) is tested via smoke tests, not unit tests

### TypeScript
- Strict mode is assumed; avoid type assertions (`as`) unless justified
- Use discriminated unions for domain states instead of optional fields
- Prefer `readonly` for domain model properties

### React (frontend)
- No state management library — use React local state + prop drilling (existing pattern)
- Keep components focused; extract logic to hooks or domain helpers
- No inline styles; use CSS classes

## Architecture Rules

**Never violate these boundaries:**
- `src/domain/` — pure logic, zero I/O, zero side effects
- `src/app/usecases/` — orchestrates domain + infrastructure
- `src/infra/` — all I/O (PDF, FS, storage)
- `packages/desktop/` — UI only; calls Tauri commands via `tauriCommands.ts`

When adding a feature, place code in the correct layer first, before writing the implementation.

## Refactoring Approach

The codebase is in a stabilization phase. When refactoring:
1. Understand the existing behavior before changing it
2. Add or update tests before touching logic
3. Make one change at a time — don't refactor and add features simultaneously
4. Run `npm test && npm run lint` after every significant change
5. Prefer preserving existing patterns unless there's a clear reason to deviate

## Domain Model (Quick Reference)

Core groups: `drums | bass | guitar | keys | vocs | talkback`

Key types (`src/domain/model/types.ts`):
- `Project` → event or generic, references `Band`
- `Band` → `defaultLineup` + `defaultOverlays`
- `Musician` → `presets: PresetItem[]`
- `Preset` → named set of `InputChannel[]`
- `DocumentViewModel` → pipeline output (inputs, monitors, stageplan, notes)

Pipeline entry: `src/domain/pipeline/buildDocument.ts`

## Storage

| Root | Type | Access |
|------|------|--------|
| `data/assets/` | Static preset catalog | Read-only |
| `%APPDATA%/StagePilot/` | User data | Read/write |

Never write user data outside the APPDATA root. Never modify `data/assets/` at runtime.

## PDF Rendering Notes

- Renderer: `src/infra/pdf/pdf.ts` via Puppeteer
- Throws if content overflows A4 — this is intentional
- Chrome resolution order: system Chrome → bundled Chromium → `PUPPETEER_EXECUTABLE_PATH`
