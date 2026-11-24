#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod updates;

use chrono::{Local, Timelike};
use serde::Deserialize;
use std::{
    io::{Read, Write},
    process::{Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, PhysicalPosition, Position, Rect, Size, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;

fn show_inbox(app: &tauri::AppHandle, anchor: Option<Rect>) {
    let Some(window) = app.get_webview_window("inbox") else {
        return;
    };
    let mouse = app.cursor_position().ok();
    let monitor = mouse
        .and_then(|p| app.monitor_from_point(p.x, p.y).ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());
    if let (Some(monitor), Ok(size)) = (monitor, window.outer_size()) {
        let area = monitor.work_area();
        let sf = monitor.scale_factor();
        let (left, top) = (area.position.x, area.position.y);
        let right = left + area.size.width as i32;
        let bottom = top + area.size.height as i32;
        let (w, h) = (size.width as i32, size.height as i32);
        let (x, y) = match anchor {
            Some(rect) => {
                let location = match rect.position {
                    Position::Physical(p) => p,
                    Position::Logical(p) => p.to_physical(sf),
                };
                let dimensions = match rect.size {
                    Size::Physical(s) => s,
                    Size::Logical(s) => s.to_physical(sf),
                };
                let y = if location.y < top + (bottom - top) / 2 {
                    location.y + dimensions.height as i32 + 7
                } else {
                    location.y - h - 7
                };
                (location.x + dimensions.width as i32 / 2 - w / 2, y)
            }
            None if cfg!(target_os = "macos") => (right - w - 14, top + 8),
            None => (right - w - 14, bottom - h - 10),
        };
        let _ = window.set_position(PhysicalPosition::new(
            x.clamp(left, (right - w).max(left)),
            y.clamp(top, (bottom - h).max(top)),
        ));
    }
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
fn open_workspace(app: tauri::AppHandle, id: Option<String>) -> Result<(), String> {
    hide_inbox(app.clone());
    let workspace = app
        .get_webview_window("workspace")
        .ok_or("Workspace unavailable")?;
    workspace.show().map_err(|e| e.to_string())?;
    workspace.unminimize().map_err(|e| e.to_string())?;
    workspace.set_focus().map_err(|e| e.to_string())?;
    if let Some(id) = id {
        workspace
            .emit("workspace-signal", id)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_inbox(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("inbox") {
        let _ = window.hide();
    }
}

fn notify(app: &tauri::AppHandle, title: &str, body: &str) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn test_notification(app: tauri::AppHandle) -> Result<(), String> {
    notify(
        &app,
        "Signal Desk",
        "Your sample competitive intelligence digest is ready to review.",
    )
}

fn digest_clock(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let Ok(dir) = app.path().app_local_data_dir() else {
            return;
        };
        let _ = std::fs::create_dir_all(&dir);
        let file = dir.join("last-digest");
        let mut last = std::fs::read_to_string(&file).unwrap_or_default();
        loop {
            let now = Local::now();
            let slot = match now.hour() {
                8 => Some("Morning"),
                11 => Some("Late morning"),
                16 => Some("Afternoon"),
                _ => None,
            };
            if let Some(slot) = slot.filter(|_| now.minute() < 5) {
                let key = now.format("%F/%H").to_string();
                if last != key && notify(&app, &format!("Signal Desk / {slot} digest"), "Sample feed: 12 signals, including 2 marked high importance. Open Signal Desk to review.").is_ok() {
                    last = key;
                    let _ = std::fs::write(&file, &last);
                }
            }
            std::thread::sleep(Duration::from_secs(15));
        }
    });
}

#[tauri::command]
async fn save_artifact(
    window: tauri::WebviewWindow,
    name: String,
    bytes: Vec<u8>,
) -> Result<bool, String> {
    if window.label() != "workspace" {
        return Err("Export is available in the workspace.".into());
    }
    let (base, ext) = name.rsplit_once('.').ok_or("Invalid file name")?;
    if !matches!(ext, "pdf" | "docx" | "pptx")
        || base.is_empty()
        || !base.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        || bytes.is_empty()
        || bytes.len() > 20_000_000
    {
        return Err("Unsupported export".into());
    }
    let (tx, rx) = std::sync::mpsc::channel();
    window
        .dialog()
        .file()
        .set_parent(&window)
        .set_file_name(&name)
        .add_filter(ext.to_uppercase(), &[ext])
        .save_file(move |result| {
            let _ = tx.send(result);
        });
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = rx.recv().map_err(|e| e.to_string())? else {
            return Ok(false);
        };
        let path = path.into_path().map_err(|e| e.to_string())?;
        std::fs::write(path, bytes).map_err(|e| e.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
struct ResearchRequest {
    endpoint: String,
    model: String,
    token: String,
    mode: String,
    audience: String,
    objective: String,
    records: Vec<serde_json::Value>,
}
static RESEARCH_RUNNING: AtomicBool = AtomicBool::new(false);
struct ResearchGuard;
impl Drop for ResearchGuard {
    fn drop(&mut self) {
        RESEARCH_RUNNING.store(false, Ordering::Release);
    }
}

#[tauri::command]
async fn run_research(
    window: tauri::WebviewWindow,
    request: ResearchRequest,
) -> Result<serde_json::Value, String> {
    if window.label() != "workspace" {
        return Err("Research is available in the workspace.".into());
    }
    let url =
        url::Url::parse(&request.endpoint).map_err(|_| "Enter a valid inference endpoint.")?;
    let loopback = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if !(url.scheme() == "https" || url.scheme() == "http" && loopback)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.host_str().is_none()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Use HTTPS or an HTTP loopback inference endpoint; omit credentials, query and fragment.".into());
    }
    if request.model.trim().is_empty()
        || request.model.len() > 200
        || request.token.trim().is_empty()
        || request.token.len() > 8192
        || request.records.len() < 2
        || request.records.len() > 30
        || request.objective.trim().is_empty()
        || request.objective.len() > 12000
    {
        return Err(
            "Enter a model, token and objective and select between 2 and 30 records.".into(),
        );
    }
    let payload = serde_json::to_vec(&serde_json::json!({"endpoint":request.endpoint,"model":request.model,"token":request.token,"mode":request.mode,"audience":request.audience,"objective":request.objective,"records":request.records})).map_err(|_| "Invalid research input")?;
    if payload.len() > 128_000 {
        return Err("Selected evidence is too large.".into());
    }
    if RESEARCH_RUNNING.swap(true, Ordering::Acquire) {
        return Err("Another brief is already running.".into());
    }
    let guard = ResearchGuard;
    let app = window.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        let (sidecar, _worker_dir) = research_worker_path(&app)?;
        // The SDK may write diagnostics to stdout. Keep the brief in a separate,
        // user-private result file and remove the file when this request ends.
        let output_dir = tempfile::Builder::new()
            .prefix("signal-desk-result-")
            .tempdir()
            .map_err(|_| "Could not create private storage for the analysis")?;
        let result_path = output_dir.path().join("brief.json");
        let mut cmd = Command::new(sidecar);
        cmd.arg("--result-file").arg(&result_path);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        let mut child = cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| {
                "OpenCode is not bundled in this build. See the desktop setup instructions."
            })?;
        if child
            .stdin
            .take()
            .ok_or("OpenCode input is unavailable")?
            .write_all(&payload)
            .is_err()
        {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Could not send the brief to OpenCode.".into());
        }
        let start = Instant::now();
        let status = loop {
            if let Some(status) = child.try_wait().map_err(|_| "OpenCode did not finish")? {
                break status;
            }
            if start.elapsed() > Duration::from_secs(150) {
                let _ = child.kill();
                let _ = child.wait();
                return Err("OpenCode timed out. Check your provider endpoint and model.".into());
            }
            std::thread::sleep(Duration::from_millis(150));
        };
        if !status.success() {
            return Err(
                "OpenCode could not complete the analysis. Check the endpoint, model and token."
                    .into(),
            );
        }
        let mut bytes = Vec::new();
        std::fs::File::open(result_path)
            .and_then(|file| file.take(200_001).read_to_end(&mut bytes))
            .map_err(|_| "OpenCode did not return a readable brief")?;
        if bytes.len() > 200_000 {
            return Err("OpenCode returned an oversized brief.".into());
        }
        serde_json::from_slice(&bytes).map_err(|_| "OpenCode returned an invalid brief.".into())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn research_worker_path(
    app: &tauri::AppHandle,
) -> Result<(std::path::PathBuf, Option<tempfile::TempDir>), String> {
    let exe = std::env::current_exe().map_err(|_| "Cannot locate the app")?;
    let adjacent = exe.with_file_name(if cfg!(windows) {
        "signal-research.exe"
    } else {
        "signal-research"
    });
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::OpenOptionsExt;
        use tauri::path::BaseDirectory;

        let resource = app
            .path()
            .resolve("signal-research.gz", BaseDirectory::Resource)
            .map_err(|_| "Cannot locate the bundled OpenCode resource")?;
        if resource.is_file() {
            let data = app
                .path()
                .app_local_data_dir()
                .map_err(|_| "Cannot locate user storage")?;
            let failure = "Could not unpack the bundled OpenCode worker into user storage";
            std::fs::create_dir_all(&data).map_err(|_| failure)?;
            let dir = tempfile::Builder::new()
                .prefix("signal-desk-worker-")
                .tempdir_in(data)
                .map_err(|_| failure)?;
            let path = dir.path().join("signal-research");
            let mut output = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o700)
                .open(&path)
                .map_err(|_| failure)?;
            let source = std::fs::File::open(resource).map_err(|_| failure)?;
            const MAX_WORKER_SIZE: u64 = 300 * 1024 * 1024;
            let size = std::io::copy(
                &mut flate2::read::GzDecoder::new(source).take(MAX_WORKER_SIZE + 1),
                &mut output,
            )
            .map_err(|_| failure)?;
            if size == 0 || size > MAX_WORKER_SIZE {
                return Err(failure.into());
            }
            return Ok((path, Some(dir)));
        }
    }
    #[cfg(not(target_os = "linux"))]
    let _ = app;
    Ok((adjacent, None))
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if !args.iter().any(|arg| arg == "--background") {
                show_inbox(app, None);
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--background"]),
        ))
        .invoke_handler(tauri::generate_handler![
            open_workspace,
            hide_inbox,
            test_notification,
            save_artifact,
            run_research
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let inbox = MenuItemBuilder::with_id("inbox", "Show inbox").build(app)?;
            let workspace = MenuItemBuilder::with_id("workspace", "Open workspace").build(app)?;
            let updates = MenuItemBuilder::with_id("updates", "Check for updates…").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Signal Desk").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&inbox, &workspace, &updates, &quit])
                .build()?;
            TrayIconBuilder::with_id("signal-desk")
                .icon(tauri::image::Image::from_bytes(include_bytes!(
                    "../icons/tray.png"
                ))?)
                .icon_as_template(cfg!(target_os = "macos"))
                .tooltip("Signal Desk")
                .menu(&menu)
                .show_menu_on_left_click(cfg!(target_os = "linux"))
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "inbox" => show_inbox(app, None),
                    "workspace" => {
                        let _ = open_workspace(app.clone(), None);
                    }
                    "quit" => app.exit(0),
                    "updates" => updates::tray_action(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if app
                            .get_webview_window("inbox")
                            .is_some_and(|w| w.is_visible().unwrap_or(false))
                        {
                            hide_inbox(app.clone())
                        } else {
                            show_inbox(app, Some(rect))
                        }
                    }
                })
                .build(app)?;
            digest_clock(app.handle().clone());
            updates::start(app.handle(), updates);
            if !std::env::args().any(|arg| arg == "--background") {
                show_inbox(app.handle(), None);
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Focused(false) if window.label() == "inbox" => {
                let _ = window.hide();
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("failed to start Signal Desk");
    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } = event
        {
            show_inbox(app, None);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}
