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
The desktop app uses a single, deterministic user data root:

1. If `STAGEPILOT_USER_DATA` is set, it is always used.
2. In dev (`tauri dev`), it defaults to `<repo>/user_data`.
3. In production, it uses the Tauri app data directory.

## Troubleshooting
- **WebView2 missing (Windows):** Install the Evergreen WebView2 runtime.
- **Export lock errors:** If the export PDF is open, the export will fail with `EXPORT_LOCKED`.
  Close the PDF and re-export. The version PDF is still saved in `user_data/versions`.
- **Path issues:** Confirm `STAGEPILOT_USER_DATA` points to the intended folder.
