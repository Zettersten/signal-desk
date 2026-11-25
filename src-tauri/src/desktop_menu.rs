#[cfg(target_os = "macos")]
use tauri::menu::AboutMetadata;
use tauri::Manager;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    App, AppHandle, Emitter,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

#[derive(Default)]
pub struct LastExport(pub std::sync::Mutex<Option<std::path::PathBuf>>);

pub fn install(app: &App) -> tauri::Result<()> {
    let settings = MenuItemBuilder::with_id("desk-settings", "Settings…")
        .accelerator("CmdOrCtrl+Comma")
        .build(app)?;
    let find = MenuItemBuilder::with_id("desk-find", "Find Signals")
        .accelerator("CmdOrCtrl+F")
        .build(app)?;
    let refresh = MenuItemBuilder::with_id("desk-refresh", "Refresh Catalog")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let quick = MenuItemBuilder::with_id("desk-quick", "Quick Open…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let larger = MenuItemBuilder::with_id("desk-zoom-in", "Zoom In")
        .accelerator("CmdOrCtrl+Equal")
        .build(app)?;
    let smaller = MenuItemBuilder::with_id("desk-zoom-out", "Zoom Out")
        .accelerator("CmdOrCtrl+Minus")
        .build(app)?;
    let actual = MenuItemBuilder::with_id("desk-zoom-reset", "Actual Size")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;
    #[cfg(target_os = "macos")]
    let application = SubmenuBuilder::new(app, "Signal Desk")
        .about(Some(AboutMetadata {
            name: Some("Signal Desk".into()),
            version: Some(app.package_info().version.to_string()),
            ..Default::default()
        }))
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let file = SubmenuBuilder::new(app, "File")
        .item(&quick)
        .text("desk-workspace", "Open Workspace")
        .text("desk-inbox", "Show Inbox")
        .text("desk-reveal", "Show Last Export in File Manager")
        .separator()
        .close_window();
    #[cfg(not(target_os = "macos"))]
    let file = file
        .separator()
        .item(&settings)
        .text("desk-quit", "Quit Signal Desk");
    let file = file.build()?;
    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let view = SubmenuBuilder::new(app, "View")
        .item(&find)
        .item(&refresh)
        .text("desk-back", "Back")
        .text("desk-forward", "Forward")
        .separator()
        .items(&[&larger, &smaller, &actual])
        .separator()
        .fullscreen()
        .build()?;
    let window = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .build()?;
    let help = SubmenuBuilder::new(app, "Help")
        .text("desk-about", "About Signal Desk")
        .text("desk-updates", "Check for Updates…")
        .build()?;
    let builder = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    let builder = builder.item(&application);
    app.set_menu(
        builder
            .items(&[&file, &edit, &view, &window, &help])
            .build()?,
    )?;
    #[cfg(target_os = "macos")]
    {
        window.set_as_windows_menu_for_nsapp()?;
        help.set_as_help_menu_for_nsapp()?;
    }
    Ok(())
}

pub fn dispatch(app: &AppHandle, id: &str) {
    match id {
        "desk-workspace" => {
            let _ = super::open_workspace(app.clone(), None);
        }
        "desk-inbox" => super::show_inbox(app, None),
        "desk-quit" => app.exit(0),
        "desk-updates" => super::updates::tray_action(app),
        "desk-about" => app
            .dialog()
            .message(format!(
                "Signal Desk {}\nHawkEye 360 strategy workspace",
                app.package_info().version
            ))
            .title("About Signal Desk")
            .show(|_| {}),
        "desk-reveal" => {
            if let Err(error) = reveal(app) {
                app.dialog()
                    .message(error)
                    .title("Last export")
                    .show(|_| {});
            }
        }
        "desk-zoom-in" | "desk-zoom-out" | "desk-zoom-reset" => {
            if let Some(window) = app
                .webview_windows()
                .into_values()
                .find(|window| window.label() != "inbox" && window.is_focused().unwrap_or(false))
            {
                let _ = window.emit_to(window.label(), "desktop-zoom", &id[10..]);
            }
        }
        "desk-settings" | "desk-find" | "desk-refresh" | "desk-quick" | "desk-back"
        | "desk-forward" => {
            if super::open_workspace(app.clone(), None).is_ok() {
                let _ = app.emit_to("workspace", "desktop-action", &id[5..]);
            }
        }
        _ => {}
    }
}

#[tauri::command]
pub fn set_desktop_zoom(window: tauri::WebviewWindow, percent: u16) -> Result<(), String> {
    let label = window.label();
    if !(label == "workspace" || label.starts_with("record-") || label.starts_with("highlight-"))
        || !(80..=150).contains(&percent)
    {
        return Err("Unsupported window zoom.".into());
    }
    window
        .set_zoom(f64::from(percent) / 100.0)
        .map_err(|e| e.to_string())
}

fn reveal(app: &AppHandle) -> Result<(), String> {
    let path = app
        .state::<LastExport>()
        .0
        .lock()
        .map_err(|_| "Export state is unavailable")?
        .clone()
        .ok_or("No file has been exported in this session.")?;
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|_| "Could not show the exported file. It may have been moved.".into())
}

#[tauri::command]
pub fn reveal_last_export(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "workspace" {
        return Err("This action is only available in the workspace.".into());
    }
    reveal(window.app_handle())
}

#[tauri::command]
pub fn close_desktop_window(window: tauri::WebviewWindow) -> Result<(), String> {
    let label = window.label();
    if label == "workspace"
        || label == "inbox"
        || label.starts_with("record-")
        || label.starts_with("highlight-")
    {
        window.close().map_err(|e| e.to_string())
    } else {
        Err("Unknown Signal Desk window.".into())
    }
}

#[tauri::command]
pub fn set_reader_title(window: tauri::WebviewWindow, title: String) -> Result<(), String> {
    let label = window.label();
    if !(label.starts_with("record-") || label.starts_with("highlight-"))
        || title.trim().is_empty()
        || title.chars().count() > 180
        || title.chars().any(char::is_control)
    {
        return Err("Invalid reader title.".into());
    }
    window
        .set_title(&format!("{title} — Signal Desk"))
        .map_err(|e| e.to_string())
}
