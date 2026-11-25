# Signal Desk

A tray-first competitive intelligence workspace for HawkEye 360 strategy and business development. Signal Desk ships in **sample mode**: stories, scores and publisher attributions are fictional evaluation fixtures, not verified reporting.

[Workspace preview](docs/screenshots/workspace.png) · [Tray inbox preview](docs/screenshots/inbox.png). These screenshots show the sample UI in a browser; the native tray adds OS materials where supported.

## Profiles, records, and highlights

- Open **Library → Competitors** for capabilities, incorporation details when verified, financial coverage, profile activity, and searchable captured records. **Publishers** shows each source’s website and records. A record also links back to its competitor and publisher.
- Clicking a record opens a separate native reader with a single scroll area. Select text within a paragraph and choose **Save highlight**. Multiple quotes from the same record can be saved, including overlapping excerpts.
- Open **Library → Highlights** to find saved quotes. Each quote opens in its own window to add a note, copy the quote, or return to its passage. If the underlying text changes, the saved quote remains in the scrapbook rather than being marked against unrelated text.
- Every evaluation profile has a distinct mark; competitor profiles also have a profile-specific illustration, example incorporation data, and example financials. Fictional dates and figures are labeled. The Planet Labs registrant incorporation example links to its SEC filing.
- On refresh, the workspace compares the incoming catalog with the last local snapshot and records changes to capabilities, financials, and profile details. History survives restart; sample and live history are separate. The first load establishes a baseline. In the Vite dev preview, open `/?view=competitor%3Aunseenlabs` and then add `&sampleRevision=2` to see a sample valuation change recorded. Refreshing the same revision does not add a duplicate.

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

Browser evaluation and plain `tauri dev` do not need an inference token. In the desktop build with the sidecar, enter an approved OpenAI-compatible base URL (usually ending in `/v1`), model ID and token in **Settings**. Select one or more signals in the current feed, choose **Analyze selection**, choose a decision and audience, and opt into OpenCode. Only the selected records and the decision framing are sent to the provider. The API token is not saved in browser storage or passed as a process argument.

## Evaluation checklist

1. Launch from the menu bar or system tray. Scroll through ten signals, then click **More signals** or the window icon. Clicking a signal opens its detail in the workspace.
2. Filter to **High importance**, search by competitor and order by company. Right-click a row to bookmark it, create a folder or move it into an existing one. Open a detail to save searchable tags and a note or quotation.
3. Select a signal (or use its row menu → **Select for analysis**), then click **Analyze selection**. Generate a sample brief and download the HawkEye 360–branded document as Markdown or PDF. Both include the HawkEye mark and a chart of the selected signals by domain. Markdown embeds the images as data URLs; use PDF for Markdown viewers that block inline images. PDF, Word and PowerPoint exports of raw signals remain in the feed toolbar.
4. From a record, selection or brief, open **Share**. Outlook opens a compose draft; long material is copied for paste. Slack copies the material and opens the configured workspace so you can pick a channel and paste. Neither integration posts automatically or attaches exported files.
5. Use **Settings → Test notification**. Digests run at **8 AM, 11 AM and 4 PM** in the system time zone, once per slot, while Signal Desk is running and the OS allows notifications. They do not wake a sleeping device, resume missed slots after five minutes, or run while the app is quit. Dismissing the inbox or closing the workspace keeps the tray process running. **Launch at sign-in** is optional and starts the tray without opening a window.

## Releases and platform notes

Push `main` or dispatch **Desktop evaluation and release** for evaluation artifacts without an update channel. A stable version tag matching `package.json` (e.g. `v0.1.0`) builds updater-enabled installers and creates a **draft** GitHub Release only after all platform jobs succeed. See [Release readiness](docs/release-readiness.md) for signing setup and the publish checklist.

| Target | User-scoped installation | Tray behavior |
| --- | --- | --- |
| macOS 26, Apple silicon and Intel | Open the DMG and copy the `.app` into `~/Applications`. | Menu-bar popover with native vibrancy. |
| Windows 11, x64 | Run the current-user NSIS installer. The OS should already have Evergreen WebView2; the installer does not install a system runtime. | Notification-area inbox with native acrylic where supported. |
| Ubuntu 26.04, x64 and arm64 | Mark the AppImage executable and run it as your user. If FUSE is unavailable, run with `--appimage-extract-and-run`. | Requires a usable StatusNotifier/AppIndicator host for reopening from the tray. Linux uses a solid surface and a menu entry to show the inbox. |

Operating-system policies can block unsigned evaluation bundles. Configure the workflow’s Apple Developer ID and notarization secrets for distribution; Windows artifacts are unsigned until a trusted signing pipeline is configured. No machine-wide installer, elevation or background service is bundled.

### Automatic updates

Install the first updater-enabled release manually. Once installed, Signal Desk checks the latest published stable GitHub release shortly after startup and every six hours while the tray app is running, until an update is ready. It automatically downloads and verifies the update. It does not install or restart until you choose **Install update and restart…** from the tray menu and confirm. **Later** keeps the verified package available for this session. The download is held in memory; quitting before installation means it will be downloaded again next time. **Check for updates…** in the same menu triggers a manual check.

The GitHub release must be public or its update feed must be accessible without shipping credentials in the app. Drafts do not reach clients. On macOS and Linux, the updater accepts user-owned installations in writable folders under your home directory. On Linux run the original AppImage, not a separately extracted binary. Browser previews, local dev builds and ordinary branch artifacts do not auto-update.

## Project layout

| Path | Responsibility |
| --- | --- |
| `src/data.ts`, `src/catalog.ts` | Entity types and an injected `IntelligenceSource`; the HTTP adapter maps `GET /v1/catalog` and `POST /v1/briefs`. A real feed can implement the same interface without editing the profile or reader views. |
| `src/mock/` | Sample catalog, HTTP transport, media, and attribution. |
| `src/library/`, `src/highlights.ts` | Profile workspaces, the article and highlight readers, and quote anchoring. |
| `src-tauri/src/entities.rs` | Native reader window creation and user-local quote persistence. |
| `src/App.tsx`, `src/ui.tsx` | React workspace, inbox, and shadcn-style Radix primitives; decorative Magic UI-inspired orbital plate. |
| `src/export.ts` | Deterministic local PDF, DOCX and PPTX generation. |
| `src-tauri/` | Native tray, effects, clock, tightly scoped share URLs and user-picked export destinations. |
| `research/` | Embedded OpenCode SDK worker and a loopback inference smoke test. Strategic briefs use an evidence audit followed by a draft. The worker does not browse the open web or run shell tools. |
| `.github/workflows/desktop.yml` | Verification, build matrix and draft release. |

Bookmarks, tags, settings and the latest brief stay in the webview's local storage. Native highlights and their notes stay in per-quote files under the user’s application data, with change events between windows. Browser previews use local storage for quotes. Notification deduplication uses a small user-local file. No remote application database or telemetry is integrated. Live inference uses an isolated temporary OpenCode workspace; review your provider's own data-handling terms before enabling it. Outlook and Slack use user-initiated handoffs, not tenant OAuth integrations. Letter tiles are fallbacks, not official logos; see [asset provenance](docs/brand-assets.md).
### Desktop controls

**File → Quick Open** (`⌘/Ctrl+O`) searches records, competitor profiles, and publishers; an empty query shows recently opened signals first. Use the toolbar arrows or `⌘+[ / ]` (`Alt+Left / Right` on Windows and Linux) to go back and forward between workspace sections. Desktop record context menus use the OS menu, including the keyboard context-menu key. View zoom changes the actual webview scale and restores it separately for the workspace and readers. After exporting, **Show file** or **File → Show Last Export in File Manager** reveals the file just saved, without giving the frontend access to arbitrary filesystem paths.

The native menus provide workspace and inbox actions, Find Signals (`⌘/Ctrl+F`), refresh (`⌘/Ctrl+R`) and Settings (`⌘/Ctrl+,`). `⌘/Ctrl+K` also focuses signal search from the workspace. In signal and tray lists, use **Up/Down** or **Home/End** to move focus, and **Enter** to open a record. In selection mode, **⌘/Ctrl+A** adds the visible signals and **Escape** exits selection. The app remembers the last workspace section and window geometry, and follows the OS light/dark appearance.
