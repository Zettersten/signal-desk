# Signal Desk

A tray-first competitive intelligence workspace for HawkEye 360 strategy and business development. Signal Desk ships in **sample mode**: stories, scores and publisher attributions are fictional evaluation fixtures, not verified reporting.

[Workspace preview](docs/screenshots/workspace.png) · [Tray inbox preview](docs/screenshots/inbox.png). These screenshots show the sample UI in a browser; the native tray adds OS materials where supported.

## Evaluate locally

Use Node.js **24 LTS**, npm and a current stable Rust toolchain. Native builds also require the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run dev
```

- Workspace: <http://localhost:5173/>
- Ten-signal inbox: <http://localhost:5173/?tray=1>

For the actual tray, native window effects, notifications and file-save dialog:

```sh
npm run tauri -- dev
```

To include the live inference worker, install Bun 1.3.13 and run:

```sh
bun install --cwd research --frozen-lockfile
bun research/build.ts
npm run tauri -- dev --config src-tauri/with-research.json
```

Browser evaluation and plain `tauri dev` do not need an inference token. In the desktop build with the sidecar, enter an approved OpenAI-compatible base URL (usually ending in `/v1`), model ID and token in **Settings**. Select two or more records in **Strategic analysis**, choose a decision and audience, and opt into OpenCode. Only the selected sample records and the decision framing are sent to the provider. The API token is not saved in browser storage or passed as a process argument.

## Evaluation checklist

1. Launch from the menu bar or system tray. Scroll through ten signals, then click **More signals** or the window icon. Clicking a signal opens its detail in the workspace.
2. Filter to **High importance**, search by competitor and order by company. Right-click a row to bookmark it, create a folder or move it into an existing one. Open a detail to save searchable tags and a note or quotation.
3. Open **Strategic analysis**, select two signals, and generate a sample brief. Review it, then export PDF, Word or PowerPoint. Use the row menu to export one signal or the queue toolbar to export the selection.
4. From a record, selection or brief, open **Share**. Outlook opens a compose draft; long material is copied for paste. Slack copies the material and opens the configured workspace so you can pick a channel and paste. Neither integration posts automatically or attaches exported files.
5. Use **Settings → Test notification**. Digests run at **8 AM, 11 AM and 4 PM** in the system time zone, once per slot, while Signal Desk is running and the OS allows notifications. They do not wake a sleeping device, resume missed slots after five minutes, or run while the app is quit. Dismissing the inbox or closing the workspace keeps the tray process running. **Launch at sign-in** is optional and starts the tray without opening a window.

## Releases and platform notes

Push `main` or dispatch **Desktop evaluation and release** for CI artifacts. Push a version tag matching `package.json` (e.g. `v0.1.0`) to create a **draft** GitHub Release after all platform jobs succeed. Review the draft and run the checklist on each target before publishing. No remote or release is created by local setup.

| Target | User-scoped installation | Tray behavior |
| --- | --- | --- |
| macOS 26, Apple silicon and Intel | Open the DMG and copy the `.app` into `~/Applications`. | Menu-bar popover with native vibrancy. |
| Windows 11, x64 | Run the current-user NSIS installer. The OS should already have Evergreen WebView2; the installer does not install a system runtime. | Notification-area inbox with native acrylic where supported. |
| Ubuntu 26.04, x64 and arm64 | Mark the AppImage executable and run it as your user. If FUSE is unavailable, run with `--appimage-extract-and-run`. | Requires a usable StatusNotifier/AppIndicator host for reopening from the tray. Linux uses a solid surface and a menu entry to show the inbox. |

Operating-system policies can block unsigned evaluation bundles. Configure the workflow’s Apple Developer ID and notarization secrets for distribution; Windows artifacts are unsigned until a trusted signing pipeline is configured. No machine-wide installer, elevation or background service is bundled.

## Project layout

| Path | Responsibility |
| --- | --- |
| `src/data.ts` | HTTP-shaped mock for `GET /v1/signals` and `POST /v1/briefs`. A real competitor index requires an approved API, schema mapping and verified source URLs. |
| `src/App.tsx`, `src/ui.tsx` | React workspace, inbox, and shadcn-style Radix primitives; decorative Magic UI-inspired orbital plate. |
| `src/export.ts` | Deterministic local PDF, DOCX and PPTX generation. |
| `src-tauri/` | Native tray, effects, clock, tightly scoped share URLs and user-picked export destinations. |
| `research/` | Embedded OpenCode SDK worker and a loopback inference smoke test. Strategic briefs use an evidence audit followed by a draft. The worker does not browse the open web or run shell tools. |
| `.github/workflows/desktop.yml` | Verification, build matrix and draft release. |

Bookmarks, tags, highlights, settings and the latest brief stay in the webview's local storage. Notification deduplication uses a small user-local file. No remote application database or telemetry is integrated. Live inference uses an isolated temporary OpenCode workspace; review your provider's own data-handling terms before enabling it. Outlook and Slack use user-initiated handoffs, not tenant OAuth integrations. Third-party competitor and publisher names are used only as illustrative identifiers; letter tiles are not official logos.
