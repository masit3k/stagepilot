# StagePilot Desktop Dev

## Prerequisites
- Node.js 18+ and npm
- Rust toolchain (stable)
- Windows: MSVC build tools + WebView2 runtime
- macOS: Xcode command line tools
- Linux: WebKit/GTK dependencies per Tauri docs

## Commands
From the repo root:

```bash
npm run tauri dev
```

Build a production bundle:

```bash
npm run tauri build
```

> Closing the terminal stops the dev app.

## User data root
The desktop app stores all user-writable data in the OS app data directory under `stagepilot/`.

- Windows: `%APPDATA%/com.mkrecmer.stagepilot-desktop/stagepilot`
- macOS: `~/Library/Application Support/com.mkrecmer.stagepilot-desktop/stagepilot`
- Linux: `$XDG_DATA_HOME/com.mkrecmer.stagepilot-desktop/stagepilot` (or `~/.local/share/com.mkrecmer.stagepilot-desktop/stagepilot`)

Subdirectories created on first run:
- `projects/`
- `exports/`
- `temp/`
- `versions/`
- `assets/` (user-imported assets)
- `library/`

## Troubleshooting
- **WebView2 missing (Windows):** Install the Evergreen WebView2 runtime.
- **Export lock errors:** If the export PDF is open, the export will fail with `EXPORT_LOCKED`.
  Close the PDF and re-export. The version PDF is still saved in `stagepilot/versions`.
- **Chromium cache missing (Puppeteer):** Install browser cache once with `npx puppeteer browsers install chrome` (desktop will otherwise fallback to system Chrome when available).


## Wiping local data
Runtime user data is **never** read from repo-local `user_data/`; desktop uses OS app data `stagepilot/` only.

- One-shot wipe for development startup (debug/dev only):

```bash
STAGEPILOT_DEV_WIPE_STORAGE=1 npm run tauri dev
```

On startup, StagePilot logs `Wiped StagePilot storage at <path>` and then recreates required folders.

- Manual cleanup:
  - Windows: `%APPDATA%/com.mkrecmer.stagepilot-desktop/stagepilot`
  - macOS: `~/Library/Application Support/com.mkrecmer.stagepilot-desktop/stagepilot`
  - Linux: `$XDG_DATA_HOME/com.mkrecmer.stagepilot-desktop/stagepilot` (or `~/.local/share/com.mkrecmer.stagepilot-desktop/stagepilot`)

In production builds, `STAGEPILOT_DEV_WIPE_STORAGE` is ignored for safety.
