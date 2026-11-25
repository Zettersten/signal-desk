mod desktop_menu;
mod entities;
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
    if let (Some(monitor), Ok(mut size)) = (monitor, window.outer_size()) {
        let area = monitor.work_area();
        let sf = monitor.scale_factor();
        let fitting = tauri::PhysicalSize::new(
            ((416.0 * sf).round() as u32).min(area.size.width.saturating_sub(16).max(1)),
            ((512.0 * sf).round() as u32).min(area.size.height.saturating_sub(16).max(1)),
        );
        if fitting != size && window.set_size(fitting).is_ok() {
            size = fitting;
        }
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
fn open_workspace(app: tauri::AppHandle, view: Option<String>) -> Result<(), String> {
    hide_inbox(app.clone());
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    let workspace = app
        .get_webview_window("workspace")
        .ok_or("Workspace unavailable")?;
    workspace.show().map_err(|e| e.to_string())?;
    workspace.unminimize().map_err(|e| e.to_string())?;
    workspace.set_focus().map_err(|e| e.to_string())?;
    if let Some(view) = view {
        workspace
            .emit_to("workspace", "workspace-view", view)
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
                if last != key
                    && notify(
                        &app,
                        &format!("Signal Desk / {slot} digest"),
                        "Open Signal Desk to review the latest sample signals and headlines.",
                    )
                    .is_ok()
                {
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
    if window.label() != "workspace" && !window.label().starts_with("record-") {
        return Err("Export is available in the workspace and record windows.".into());
    }
    let (base, ext) = name.rsplit_once('.').ok_or("Invalid file name")?;
    if !matches!(ext, "pdf" | "docx" | "pptx" | "md")
        || base.is_empty()
        || !base.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        || bytes.is_empty()
        || bytes.len() > 20_000_000
    {
        return Err("Unsupported export".into());
    }
    let (tx, rx) = std::sync::mpsc::channel();
    let app = window.app_handle().clone();
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
        std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
        if let Ok(mut last) = app.state::<desktop_menu::LastExport>().0.lock() {
            *last = Some(path);
        }
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
        || request.records.is_empty()
        || request.records.len() > 30
        || request.objective.trim().is_empty()
        || request.objective.len() > 12000
    {
        return Err(
            "Enter a model, token and objective and select between 1 and 30 records.".into(),
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

pub fn run() {
    let context = tauri::generate_context!();
    let startup_smoke = std::env::args().any(|arg| arg == "--startup-smoke");
    let builder = tauri::Builder::default();
    // Do not send a test launch to an already running user instance.
    let builder = if startup_smoke {
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if !args.iter().any(|arg| arg == "--background") {
                show_inbox(app, None);
            }
        }))
    };
    let builder = if startup_smoke {
        builder
    } else {
        use tauri_plugin_window_state::{Builder, StateFlags};
        builder.plugin(
            Builder::default()
                .with_filter(|label| label == "workspace")
                .with_state_flags(StateFlags::POSITION | StateFlags::SIZE | StateFlags::MAXIMIZED)
                .build(),
        )
    };
    let builder = builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--background"]),
        ));
    // The updater requires a configuration object during plugin initialization.
    // Evaluation and development builds do not have an update channel.
    let builder = if updates::configured(context.config()) {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    } else {
        builder
    };
    let app = builder
        .manage(desktop_menu::LastExport::default())
        .invoke_handler(tauri::generate_handler![
            open_workspace,
            hide_inbox,
            test_notification,
            save_artifact,
            run_research,
            entities::open_detail,
            entities::open_source_site,
            entities::list_highlights,
            entities::save_highlight,
            desktop_menu::close_desktop_window,
            desktop_menu::set_reader_title,
            desktop_menu::reveal_last_export,
            desktop_menu::set_desktop_zoom
        ])
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            desktop_menu::install(app)?;
            #[cfg(not(target_os = "macos"))]
            if let Some(inbox) = app.get_webview_window("inbox") {
                let _ = inbox.remove_menu();
            }
            let inbox = MenuItemBuilder::with_id("inbox", "Show inbox").build(app)?;
            let workspace = MenuItemBuilder::with_id("workspace", "Open workspace").build(app)?;
            let updates = MenuItemBuilder::with_id("updates", "Check for updates…").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Signal Desk").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&inbox, &workspace, &updates, &quit])
                .build()?;
            TrayIconBuilder::with_id("signal-desk")
                .icon(tauri::image::Image::from_bytes(
                    if cfg!(target_os = "macos") {
                        include_bytes!("../icons/tray.png").as_slice()
                    } else {
                        include_bytes!("../icons/tray-brand.png").as_slice()
                    },
                )?)
                .icon_as_template(cfg!(target_os = "macos"))
                .tooltip("Signal Desk")
                .menu(&menu)
                .show_menu_on_left_click(cfg!(target_os = "linux"))
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
            updates::start(app.handle(), updates, !startup_smoke);
            if !startup_smoke {
                digest_clock(app.handle().clone());
                if !std::env::args().any(|arg| arg == "--background") {
                    show_inbox(app.handle(), None);
                }
            }
            Ok(())
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "inbox" => show_inbox(app, None),
            "workspace" => {
                let _ = open_workspace(app.clone(), None);
            }
            "quit" => app.exit(0),
            "updates" => updates::tray_action(app),
            id => desktop_menu::dispatch(app, id),
        })
        .on_window_event(move |window, event| match event {
            WindowEvent::CloseRequested { api, .. }
                if matches!(window.label(), "workspace" | "inbox") =>
            {
                api.prevent_close();
                if window.label() == "workspace" && !startup_smoke {
                    use tauri_plugin_window_state::{AppHandleExt, StateFlags};
                    let _ = window.app_handle().save_window_state(
                        StateFlags::POSITION | StateFlags::SIZE | StateFlags::MAXIMIZED,
                    );
                }
                let _ = window.hide();
            }
            WindowEvent::Focused(false) if window.label() == "inbox" => {
                let _ = window.hide();
            }
            WindowEvent::Focused(true) if window.label() == "inbox" => {
                let _ = window.emit_to("inbox", "inbox-focused", ());
            }
            _ => {}
        })
        .build(context);
    let app = match app {
        Ok(app) => app,
        Err(error) if startup_smoke => {
            startup_smoke_report(false, &format!("Desktop initialization failed: {error}"));
            std::process::exit(1);
        }
        Err(error) => panic!("failed to start Signal Desk: {error}"),
    };
    app.run(move |app, event| {
        if startup_smoke && matches!(event, tauri::RunEvent::Ready) {
            let test = (|| -> Result<(), String> {
                let app_menu = app.menu().ok_or("Native application menu was not installed")?;
                if app_menu.items().map_err(|e| e.to_string())?.len() < 5 {
                    return Err("Native menu does not have the expected submenu structure".into());
                }
                entities::open_entity_window(app, "record".into(), "s1".into(), None, false)?;
                entities::open_entity_window(app, "highlight".into(), "smoke-test".into(), None, false)?;
                for (label, route) in [("record-s1", "record=s1"), ("highlight-smoke-test", "highlight=smoke-test")] {
                    let window = app.get_webview_window(label).ok_or("Reader window was not registered")?;
                    if window.url().map_err(|e| e.to_string())?.query() != Some(route) {
                        return Err("Reader window did not resolve its entity route".into());
                    }
                    desktop_menu::set_reader_title(window.clone(), "Read-only smoke test".into())?;
                    desktop_menu::set_desktop_zoom(window.clone(), 120)?;
                    if desktop_menu::set_desktop_zoom(window.clone(), 0).is_ok() {
                        return Err("Reader accepted invalid zoom".into());
                    }
                    window.destroy().map_err(|e| e.to_string())?;
                }
                Ok(())
            })();
            match test {
                Ok(()) => finish_startup_smoke(app, true, "Signal Desk native menus, reader window lifecycle, titles and zoom initialized successfully."),
                Err(error) => finish_startup_smoke(app, false, &format!("Native reader smoke test failed: {error}")),
            }
        }
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } = event
        {
            let _ = open_workspace(app.clone(), None);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}

fn finish_startup_smoke(app: &tauri::AppHandle, passed: bool, message: &str) {
    startup_smoke_report(passed, message);
    app.exit(if passed { 0 } else { 1 });
}

fn startup_smoke_report(passed: bool, message: &str) {
    // Windows GUI executables need not have console handles, even with a redirected parent process.
    if let Some(path) = std::env::var_os("SIGNAL_DESK_SMOKE_REPORT") {
        let _ = std::fs::write(path, message);
    }
    if passed {
        println!("{message}");
    } else {
        eprintln!("{message}");
    }
}
