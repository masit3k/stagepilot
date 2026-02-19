# StagePilot

## Install
- npm i

## Run (no build)
- npm run dev:export -- --project <PROJECT_ID>

## Build + run
- npm run build
- npm run export -- --project <PROJECT_ID>

## Milestone v0.2.0 – Stable foundation

- main branch correctly configured and protected
- PDF export pipeline finalized
  - immutable versions/
  - latest export in exports/
  - Windows file-lock handling
- Ready to start desktop (Tauri) feature development

This is the last known-good baseline before desktop UI work.

## Data model
- System assets are shipped in `data/` (read-only).
- User data is stored in OS app data under `stagepilot/`:
  - Windows: `%APPDATA%/com.mkrecmer.stagepilot-desktop/stagepilot`
  - macOS: `~/Library/Application Support/com.mkrecmer.stagepilot-desktop/stagepilot`
  - Linux: `$XDG_DATA_HOME/com.mkrecmer.stagepilot-desktop/stagepilot` (or `~/.local/share/com.mkrecmer.stagepilot-desktop/stagepilot`)

## Desktop storage cleanup
- Runtime user data is **not** stored in repo-local `user_data/`.
- To wipe desktop storage on dev startup, run with `STAGEPILOT_DEV_WIPE_STORAGE=1` (dev builds only).
- Manual cleanup paths:
  - Windows: `%APPDATA%/com.mkrecmer.stagepilot-desktop/stagepilot`
  - macOS: `~/Library/Application Support/com.mkrecmer.stagepilot-desktop/stagepilot`
  - Linux: `$XDG_DATA_HOME/com.mkrecmer.stagepilot-desktop/stagepilot` (or `~/.local/share/com.mkrecmer.stagepilot-desktop/stagepilot`)
