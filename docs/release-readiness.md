# Release readiness

## Enable the signed update channel

1. Generate one **production** Tauri updater key pair outside the repository. Keep the private key in an approved vault with a backup. The installed app pins the public key, so replacing a lost private key does not update an older install automatically.

   ```sh
   mkdir -p ~/.tauri
   npm run tauri -- signer generate -w ~/.tauri/signal-desk.key
   ```

2. In GitHub **Settings → Secrets and variables → Actions**, set:

   | Type | Name | Value |
   | --- | --- | --- |
   | Variable | `TAURI_UPDATER_PUBLIC_KEY` | Exact contents of `signal-desk.key.pub`, not its path. |
   | Secret | `TAURI_SIGNING_PRIVATE_KEY` | Exact contents of `signal-desk.key`, not its path. |
   | Secret | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used to protect the private key, if set. |

   The release process rejects an incomplete platform set or a signature that does not bind the release version. Updater signing is separate from macOS notarization and Windows Authenticode. Keep stable tags protected so only release maintainers can trigger a signing build.

3. Keep GitHub Releases readable by installed clients. This workflow targets a public GitHub repository. If the code or release assets must be private, move the updater endpoint and signed assets to an approved distribution service; do not give desktop clients a shared GitHub token. Do not use public distribution for internal-only material without approval.

4. Get a green matrix run before tagging. The [first hosted run](https://github.com/Zettersten/signal-desk/actions/runs/45481424357) passed frontend verification but failed in macOS certificate import, Windows standalone worker compilation, and the Linux smoke tests (invalid result JSON on x64 and timeout on ARM64). The workflow now omits missing Apple signing env entries, and native Windows uses its installed Bun runtime. The worker returns its brief in a private result file, disables background catalog and project-file scanning, and logs which step the fixture reaches without exposing inference data. Re-run the matrix to verify all five packages before tagging. Do not skip the worker smoke test to make a distribution release green.

5. Set up Apple Developer ID signing and notarization using the workflow’s `APPLE_*` secrets. Add an approved Windows Authenticode signing step. Deploy only from a trusted, auditable builder. Confirm installers and updater payloads are signed on the target platform; Tauri updater signatures alone do not satisfy Gatekeeper or Windows trust policy.

6. Version the release in `package.json` (and refresh the npm lockfile), push the matching stable `vX.Y.Z` tag, and review the resulting draft. It should contain five user installers, both macOS updater archives, five updater signatures and `latest.json`. Make the approved stable release the GitHub **latest** release. Upload all assets before publication; drafts are not visible to installed clients.

## Acceptance tests before inviting users

- **Install and update:** On clean, non-admin accounts on each supported platform, install the first signed build. Make a newer signed build available in a separate test channel or repository. Confirm a background download with the workspace closed; choose **Later** and verify the app stays running; then explicitly install and confirm it reopens with the new version and retains local data. Also test offline recovery and a modified or wrong-version artifact being rejected.
- **Native behavior:** Verify tray placement, app switching, OS notification permission and the three digest times, launch at sign-in, and native save dialogs and exports under standard enterprise policy. Test clean launch from the Windows current-user installer, macOS `~/Applications`, and Linux AppImage.
- **Live competitor feed:** Contract an approved data source and replace the sample client. Preserve primary-source URLs, publication timestamps, provenance and meaningful ranking. Deduplicate alerts across digests and test stale or unavailable sources. Clearly separate sample data from verified reporting.
- **Inference and data policy:** Validate approved endpoints and models, provider retention and user data rules. If open-web research is required, add approved source retrieval, evidence verification and citations. The current worker audits supplied material; it does not discover external evidence. Decide whether local notes and briefs need encryption, retention controls, export limits or central policy before allowing sensitive data.
- **Sharing and support:** Confirm whether Outlook drafts and Slack clipboard handoffs meet requirements, or whether managed tenant integrations are needed. Assign owners for releases, key custody, incident response, and user support. Plan a forward fix if a rollout fails; the updater does not accept downgrades.
