use std::{sync::Mutex, time::Duration};

use tauri::{menu::MenuItem, AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::{Update, UpdaterExt};

const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

enum Status {
    Idle,
    Checking,
    Downloading,
    Ready(Box<Package>),
    Confirming,
    Installing,
}

struct Package {
    update: Update,
    bytes: Vec<u8>,
}

struct Updates {
    status: Mutex<Status>,
    item: MenuItem<tauri::Wry>,
}

pub fn start(app: &AppHandle, item: MenuItem<tauri::Wry>) {
    app.manage(Updates {
        status: Mutex::new(Status::Idle),
        item,
    });
    if unavailable(app).is_none() {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_secs(15)).await;
            loop {
                if begin_check(&app) {
                    check(app.clone(), false).await;
                }
                tokio::time::sleep(CHECK_INTERVAL).await;
            }
        });
    }
}

fn unavailable(app: &AppHandle) -> Option<&'static str> {
    let configured = app.config().plugins.0.get("updater").is_some_and(|config| {
        config["pubkey"]
            .as_str()
            .is_some_and(|key| !key.trim().is_empty())
            && config["endpoints"]
                .as_array()
                .is_some_and(|urls| !urls.is_empty())
    });
    if !configured {
        return Some("This build does not have automatic updates configured. Install a signed release build to enable updates.");
    }
    check_install_location(app).err()
}

#[cfg(unix)]
fn check_install_location(app: &AppHandle) -> Result<(), &'static str> {
    use std::{os::unix::fs::MetadataExt, path::PathBuf};
    #[cfg(target_os = "macos")]
    let (location, message) = (
        std::env::current_exe().ok().and_then(|exe| exe.ancestors().nth(3).filter(|path| path.extension().is_some_and(|ext| ext == "app")).map(PathBuf::from)),
        "To receive updates without administrator access, copy Signal Desk into ~/Applications and open that copy.",
    );
    #[cfg(target_os = "linux")]
    let (location, message) = (
        std::env::var_os("APPIMAGE").map(PathBuf::from),
        "To receive updates without administrator access, open the original AppImage from a folder in your home directory.",
    );
    let location = location
        .and_then(|path| path.canonicalize().ok())
        .ok_or(message)?;
    let home = app
        .path()
        .home_dir()
        .ok()
        .and_then(|path| path.canonicalize().ok())
        .ok_or(message)?;
    // Refuse system installs before the platform updater can request elevation.
    let owner = location.metadata().map_err(|_| message)?.uid();
    let uid = unsafe { libc::geteuid() };
    if uid == 0 || uid != owner || !location.starts_with(&home) {
        return Err(message);
    }
    tempfile::tempdir_in(location.parent().ok_or(message)?).map_err(|_| message)?;
    Ok(())
}

#[cfg(not(unix))]
fn check_install_location(_: &AppHandle) -> Result<(), &'static str> {
    // Windows release updates use the same current-user NSIS installer as first-time installs.
    Ok(())
}

fn begin_check(app: &AppHandle) -> bool {
    let state = app.state::<Updates>();
    {
        let mut status = state.status.lock().unwrap();
        if !matches!(*status, Status::Idle) {
            return false;
        }
        *status = Status::Checking;
    }
    let _ = state.item.set_text("Checking for updates…");
    let _ = state.item.set_enabled(false);
    true
}

async fn download(app: &AppHandle) -> Result<Option<Package>, String> {
    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let Some(mut update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    if update.download_url.scheme() != "https" {
        return Err("The update package must use HTTPS.".into());
    }
    let state = app.state::<Updates>();
    *state.status.lock().unwrap() = Status::Downloading;
    let _ = state.item.set_text("Downloading update…");
    update.timeout = Some(Duration::from_secs(10 * 60));
    // Tauri verifies the signature before returning any bytes. Retain them only for this app session.
    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;
    Ok(Some(Package { update, bytes }))
}

async fn check(app: AppHandle, manual: bool) {
    let result = download(&app).await;
    let state = app.state::<Updates>();
    match result {
        Ok(Some(package)) => {
            let version = package.update.version.clone();
            *state.status.lock().unwrap() = Status::Ready(Box::new(package));
            let _ = state.item.set_text("Install update and restart…");
            let _ = state.item.set_enabled(true);
            if manual {
                tray_action(&app);
            } else {
                let _ = super::notify(&app, "Signal Desk update ready", &format!("Version {version} is ready. Use the Signal Desk tray menu to install and restart when convenient."));
            }
        }
        result => {
            *state.status.lock().unwrap() = Status::Idle;
            let _ = state.item.set_text("Check for updates…");
            let _ = state.item.set_enabled(true);
            if manual {
                match result {
                    Ok(None) => message(&app, &format!("Version {} is up to date.", app.package_info().version), MessageDialogKind::Info),
                    Err(_) => message(&app, "Couldn’t check for or verify an update. Check your connection to GitHub and try again, or contact your administrator.", MessageDialogKind::Warning),
                    _ => unreachable!(),
                }
            }
        }
    }
}

fn message(app: &AppHandle, body: &str, kind: MessageDialogKind) {
    app.dialog()
        .message(body)
        .title("Signal Desk updates")
        .kind(kind)
        .show(|_| {});
}

pub fn tray_action(app: &AppHandle) {
    if let Some(reason) = unavailable(app) {
        message(app, reason, MessageDialogKind::Info);
        return;
    }
    if begin_check(app) {
        tauri::async_runtime::spawn(check(app.clone(), true));
        return;
    }

    let state = app.state::<Updates>();
    let package = {
        let mut status = state.status.lock().unwrap();
        if !matches!(*status, Status::Ready(_)) {
            return;
        }
        let Status::Ready(package) = std::mem::replace(&mut *status, Status::Confirming) else {
            unreachable!()
        };
        package
    };
    let app = app.clone();
    let body = format!(
        "Version {} is downloaded and verified. Signal Desk will close and reopen to apply it.",
        package.update.version
    );
    app.clone().dialog().message(body).title("Install Signal Desk update?")
        .buttons(MessageDialogButtons::OkCancelCustom("Install and restart".into(), "Later".into()))
        .show(move |confirmed| {
            let state = app.state::<Updates>();
            if !confirmed {
                *state.status.lock().unwrap() = Status::Ready(package);
                return;
            }
            if let Err(reason) = check_install_location(&app) {
                *state.status.lock().unwrap() = Status::Ready(package);
                message(&app, reason, MessageDialogKind::Warning);
                return;
            }
            if super::RESEARCH_RUNNING.swap(true, std::sync::atomic::Ordering::Acquire) {
                *state.status.lock().unwrap() = Status::Ready(package);
                message(&app, "An analysis is still running. Wait for it to finish, then install the update from the tray menu.", MessageDialogKind::Info);
                return;
            }
            let research_guard = super::ResearchGuard;
            *state.status.lock().unwrap() = Status::Installing;
            let _ = state.item.set_text("Installing update…");
            let _ = state.item.set_enabled(false);
            tauri::async_runtime::spawn_blocking(move || {
                let _research_guard = research_guard;
                if package.update.install(&package.bytes).is_ok() {
                    // Windows returns only on failure; on success NSIS exits and relaunches the app.
                    app.restart();
                }
                let state = app.state::<Updates>();
                *state.status.lock().unwrap() = Status::Ready(package);
                let _ = state.item.set_text("Install update and restart…");
                let _ = state.item.set_enabled(true);
                message(&app, "The update could not be installed. Open Signal Desk from a folder you can write to, or reinstall from GitHub Releases.", MessageDialogKind::Warning);
            });
        });
}
