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

- Windows: `%APPDATA%/stagepilot`
- macOS: `~/Library/Application Support/stagepilot`
- Linux: `$XDG_DATA_HOME/stagepilot` (or `~/.local/share/stagepilot`)

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
