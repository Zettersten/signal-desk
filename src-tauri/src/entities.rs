use serde::{Deserialize, Serialize};
use std::{fs, io::Write, path::PathBuf};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn from_library(window: &WebviewWindow) -> Result<(), String> {
    let label = window.label();
    if label == "workspace" || label.starts_with("record-") || label.starts_with("highlight-") {
        Ok(())
    } else {
        Err("This action is only available in the library.".into())
    }
}

#[tauri::command]
pub async fn open_detail(
    window: WebviewWindow,
    kind: String,
    id: String,
    highlight_id: Option<String>,
) -> Result<(), String> {
    if window.label() != "inbox" {
        from_library(&window)?;
    }
    if !matches!(kind.as_str(), "record" | "highlight")
        || !valid_id(&id)
        || highlight_id
            .as_ref()
            .is_some_and(|quote| kind != "record" || !valid_id(quote))
    {
        return Err("Invalid library item.".into());
    }
    let app = window.app_handle().clone();
    let from_inbox = window.label() == "inbox";
    open_entity_window(&app, kind, id, highlight_id, true)?;
    if from_inbox {
        super::hide_inbox(app);
    }
    Ok(())
}

pub(crate) fn open_entity_window(
    app: &AppHandle,
    kind: String,
    id: String,
    highlight_id: Option<String>,
    visible: bool,
) -> Result<(), String> {
    let label = format!("{kind}-{id}");
    #[cfg(target_os = "macos")]
    if visible {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }
    if let Some(existing) = app.get_webview_window(&label) {
        existing
            .unminimize()
            .and_then(|_| existing.show())
            .and_then(|_| existing.set_focus())
            .map_err(|e| e.to_string())?;
        if let Some(quote) = highlight_id {
            existing
                .emit_to(&label, "record-quote", quote)
                .map_err(|e| e.to_string())?;
        }
    } else {
        let quote = highlight_id
            .map(|value| format!("&quote={value}"))
            .unwrap_or_default();
        let url = WebviewUrl::App(format!("index.html?{kind}={id}{quote}").into());
        let (title, width, height) = if kind == "record" {
            ("Signal Desk — Record", 768.0, 760.0)
        } else {
            ("Signal Desk — Highlight", 548.0, 530.0)
        };
        WebviewWindowBuilder::new(app, label, url)
            .title(title)
            .inner_size(width, height)
            .min_inner_size(400.0, 360.0)
            .visible(visible)
            .center()
            .build()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_source_site(window: WebviewWindow, address: String) -> Result<(), String> {
    from_library(&window)?;
    let url = url::Url::parse(&address).map_err(|_| "Invalid website address")?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Open an HTTPS source without embedded credentials.".into());
    }
    window
        .opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| "Could not open the source website.".into())
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    id: String,
    record_id: String,
    record_title: String,
    paragraph_id: String,
    start: usize,
    end: usize,
    quote: String,
    note: String,
    created_at: String,
}

fn location(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|_| "User storage is unavailable")?
        .join("highlights"))
}

fn read_highlights(path: PathBuf) -> Result<Vec<Highlight>, String> {
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(_) => return Err("Could not read the highlights folder".to_owned()),
    };
    Ok(entries
        .flatten()
        .filter_map(|entry| {
            let p = entry.path();
            if p.extension()? != "json"
                || !entry.file_type().ok()?.is_file()
                || entry.metadata().ok()?.len() > 30_000
            {
                return None;
            }
            serde_json::from_slice(&fs::read(p).ok()?).ok()
        })
        .collect())
}

fn write_highlight(dir: PathBuf, entry: Highlight) -> Result<(), String> {
    let error = |_| "Could not write the highlight".to_owned();
    fs::create_dir_all(&dir).map_err(error)?;
    let mut file = tempfile::NamedTempFile::new_in(&dir).map_err(error)?;
    let bytes = serde_json::to_vec(&entry).map_err(|_| "Could not encode the highlight")?;
    file.write_all(&bytes).map_err(error)?;
    file.persist(dir.join(format!("{}.json", entry.id)))
        .map_err(|_| "Could not save the highlight")?;
    Ok(())
}

#[tauri::command]
pub async fn list_highlights(window: WebviewWindow) -> Result<Vec<Highlight>, String> {
    from_library(&window)?;
    let path = location(window.app_handle())?;
    tauri::async_runtime::spawn_blocking(move || read_highlights(path))
        .await
        .map_err(|_| "Could not read highlights")?
}

#[tauri::command]
pub async fn save_highlight(window: WebviewWindow, entry: Highlight) -> Result<(), String> {
    from_library(&window)?;
    if !valid_id(&entry.id)
        || !valid_id(&entry.record_id)
        || !valid_id(&entry.paragraph_id)
        || entry.end <= entry.start
        || entry.end > 1_000_000
        || entry.quote.trim().is_empty()
        || entry.quote.len() > 8_000
        || entry.note.len() > 16_000
        || entry.record_title.len() > 1_000
        || chrono::DateTime::parse_from_rfc3339(&entry.created_at).is_err()
    {
        return Err("Invalid highlight".into());
    }
    let dir = location(window.app_handle())?;
    tauri::async_runtime::spawn_blocking(move || write_highlight(dir, entry))
        .await
        .map_err(|_| "Could not save highlight")??;
    let _ = window.app_handle().emit("highlights-changed", ());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entity_ids_are_safe_window_labels_and_file_names() {
        assert!(valid_id("sample-1_ab"));
        for id in ["", "../data", "a/b", "a?foo", "a#foo", "a b", "é"] {
            assert!(!valid_id(id));
        }
    }

    #[test]
    fn saving_a_note_replaces_only_its_own_quote_file() {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("highlights");
        assert!(read_highlights(dir.clone()).unwrap().is_empty());
        let new = |id: &str, note: &str| Highlight {
            id: id.into(),
            record_id: "s1".into(),
            record_title: "Example".into(),
            paragraph_id: "summary".into(),
            start: 0,
            end: 3,
            quote: "SAR".into(),
            note: note.into(),
            created_at: "2026-11-24T00:00:00Z".into(),
        };
        write_highlight(dir.clone(), new("first", "")).unwrap();
        write_highlight(dir.clone(), new("other", "Different quote")).unwrap();
        write_highlight(dir.clone(), new("first", "Reviewed")).unwrap();
        fs::write(dir.join("broken.json"), "not json").unwrap();
        let mut stored = read_highlights(dir).unwrap();
        stored.sort_by(|a, b| a.id.cmp(&b.id));
        assert_eq!(
            stored,
            [new("first", "Reviewed"), new("other", "Different quote")]
        );
    }
}
