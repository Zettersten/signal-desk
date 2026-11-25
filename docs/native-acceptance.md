# Native desktop acceptance

The app uses the OS for window chrome, application and row context menus, tray entry points, notifications, file save/reveal, and clipboard. The searchable workspace, records, and analysis authoring render in the desktop webview and must be judged in the installed app.

Before calling the experience 10/10 on a platform, test these scenarios on its supported OS release:

| Workflow | Evidence to collect |
| --- | --- |
| Tray and window lifecycle | Open from the tray, move between record windows, close and reopen the workspace, and restart with the previous size and placement. Repeat after unplugging an external display. |
| Keyboard and accessibility | Navigate the feed and Quick Open without a mouse. Check keyboard-invoked context menus, editing shortcuts, visible focus, and screen-reader announcements. |
| Appearance | Switch OS light/dark mode while windows are open; check at typical and scaled display settings. Zoom a reader and verify that the workspace zoom does not change. |
| Document handoff | Export PDF or Markdown through the native dialog and reveal it in Finder, Explorer or the default file manager. Cancel an export and verify the last successful export remains the reveal target. |
| Installed startup | Run the packaged startup smoke test. It verifies the app menu, both reader window routes, title assignment and zoom. It does not exercise menu interaction or assistive technology. |

macOS uses the system menu bar and traffic lights. Windows uses its window menus and standard installer; Linux delegates menus and file reveal to the available desktop environment. Check at least one supported desktop session rather than treating an Xvfb run as full interaction coverage.

### Repeatable macOS file-reveal check

Run a debug build copied from its DMG with `--export-reveal-smoke`. The test writes a synthetic Markdown file through the same post-dialog write path used by real exports, then submits the tracked path to Finder. Compare the printed path with `osascript -e 'tell application "Finder" to get POSIX path of (item 1 of (get selection) as alias)'`. The test requires Apple Events permission for Finder to query the selection. It verifies the native handoff, not keyboard operation of the Save dialog. The synthetic file is in a temporary directory and can be removed after the check.
