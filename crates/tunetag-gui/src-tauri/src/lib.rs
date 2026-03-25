#[cfg(unix)]
extern crate libc;

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::Manager;
use walkdir::WalkDir;

/// Translate a path string to a real filesystem path.
/// On Linux/macOS, translates `sftp://user@host/path` → GVFS mount path.
/// On Windows, returns the path as-is.
fn resolve_path(raw: &str) -> PathBuf {
    #[cfg(unix)]
    if let Some(rest) = raw.strip_prefix("sftp://") {
        // Parse user@host/path or host/path
        let (userhost, path) = rest.split_once('/').unwrap_or((rest, ""));
        let (user, host) = if let Some((u, h)) = userhost.split_once('@') {
            (Some(u), h)
        } else {
            (None, userhost)
        };

        let uid = unsafe { libc::getuid() };
        let gvfs_name = match user {
            Some(u) => format!("sftp:host={},user={}", host, u),
            None => format!("sftp:host={}", host),
        };
        let base = PathBuf::from(format!("/run/user/{}/gvfs/{}", uid, gvfs_name));
        return if path.is_empty() { base } else { base.join(path) };
    }
    PathBuf::from(raw)
}

/// Supported audio file extensions (lowercase).
const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "flac", "m4a"];

/// A file entry sent to the frontend with all tag + audio property data.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub id: String,
    pub path: String,
    pub filename: String,
    pub format: String,
    // Standard tags
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub year: Option<String>,
    pub track: Option<String>,
    pub disc: Option<String>,
    pub genre: Option<String>,
    pub comment: Option<String>,
    // Audio properties
    pub duration_secs: Option<f64>,
    pub bitrate_kbps: Option<u32>,
    pub sample_rate_hz: Option<u32>,
    pub channels: Option<u8>,
}

/// Column persistence config.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnConfig {
    pub columns: Vec<ColumnSetting>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnSetting {
    pub field: String,
    pub width: u32,
    pub visible: bool,
}

/// Check if a file extension is a supported audio format (case-insensitive).
fn is_supported_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Determine the audio format string from the file extension.
fn format_from_extension(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| match ext.to_lowercase().as_str() {
            "mp3" => "MP3".to_string(),
            "flac" => "FLAC".to_string(),
            "m4a" => "M4A".to_string(),
            _ => "Unknown".to_string(),
        })
        .unwrap_or_else(|| "Unknown".to_string())
}

/// Generate a deterministic ID from a file path using blake3 hash.
fn path_to_id(path: &Path) -> String {
    let hash = blake3::hash(path.to_string_lossy().as_bytes());
    hash.to_hex().to_string()
}

/// Format a NumberPair as "N" or "N/T".
fn format_number_pair(np: &tunetag_core::NumberPair) -> String {
    match np.total {
        Some(t) => format!("{}/{}", np.number, t),
        None => np.number.to_string(),
    }
}

/// Read a single file and produce a FileEntry, or None if the file can't be read.
fn read_file_entry(path: &Path) -> Option<FileEntry> {
    let tags = tunetag_core::read_tags(path).ok()?;
    let audio_props = tunetag_core::read_audio_properties(path).ok();

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    Some(FileEntry {
        id: path_to_id(path),
        path: path.to_string_lossy().to_string(),
        filename,
        format: format_from_extension(path),
        title: tags.title,
        artist: tags.artist,
        album: tags.album,
        album_artist: tags.album_artist,
        year: tags.year,
        track: tags.track.as_ref().map(format_number_pair),
        disc: tags.disc.as_ref().map(format_number_pair),
        genre: tags.genre,
        comment: tags.comment,
        duration_secs: audio_props.as_ref().map(|p| p.duration.as_secs_f64()),
        bitrate_kbps: audio_props.as_ref().and_then(|p| p.bitrate_kbps),
        sample_rate_hz: audio_props.as_ref().and_then(|p| p.sample_rate_hz),
        channels: audio_props.as_ref().and_then(|p| p.channels),
    })
}

/// Deduplicate a path — use canonicalize where possible, fall back to the raw path
/// (canonicalize fails on GVFS/network mounts on some kernel versions).
fn dedup_key(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

/// Collect all supported audio files from a list of paths.
/// If a path is a directory, walk it (optionally recursively).
/// If a path is a file with a supported extension, include it directly.
fn collect_audio_files(paths: &[PathBuf], recursive: bool) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for path in paths {
        if path.is_dir() {
            let walker = if recursive {
                WalkDir::new(path)
            } else {
                WalkDir::new(path).max_depth(1)
            };
            for entry in walker.into_iter().filter_map(|e| e.ok()) {
                let p = entry.into_path();
                // Skip Synology NAS metadata directories (@eaDir, @Recycle, #recycle, .@__thumb)
                if p.components().any(|c| {
                    let s = c.as_os_str().to_string_lossy();
                    s == "@eaDir" || s == "@Recycle" || s == "#recycle" || s == ".@__thumb"
                }) {
                    continue;
                }
                if p.is_file() && is_supported_extension(&p) {
                    let key = dedup_key(&p);
                    if seen.insert(key) {
                        result.push(p);
                    }
                }
            }
        } else if path.is_file() && is_supported_extension(path) {
            let key = dedup_key(path);
            if seen.insert(key) {
                result.push(path.to_path_buf());
            }
        }
    }

    result
}

/// Tauri command: scan paths for supported audio files and read their metadata.
/// Accepts plain filesystem paths or sftp:// URIs (translated to local GVFS mount paths).
#[tauri::command]
async fn scan_paths(paths: Vec<String>, recursive: bool) -> Result<Vec<FileEntry>, String> {
    let resolved: Vec<PathBuf> = paths.iter().map(|p| resolve_path(p)).collect();
    let audio_files = collect_audio_files(&resolved, recursive);

    let entries: Vec<FileEntry> = audio_files
        .iter()
        .filter_map(|p| read_file_entry(p))
        .collect();

    Ok(entries)
}

/// Get the column config file path in the app data directory.
fn column_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(data_dir.join("column-config.json"))
}

/// Tauri command: load column config from the app data directory.
#[tauri::command]
async fn load_column_config(app: tauri::AppHandle) -> Result<Option<ColumnConfig>, String> {
    let config_path = column_config_path(&app)?;

    if !config_path.exists() {
        return Ok(None);
    }

    let content =
        std::fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {}", e))?;

    match serde_json::from_str::<ColumnConfig>(&content) {
        Ok(config) => Ok(Some(config)),
        Err(_) => {
            // Corrupted config file — return None to fall back to defaults
            Ok(None)
        }
    }
}

/// Shared dirty-state flag for the close prompt.
static HAS_UNSAVED_CHANGES: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Tauri command: frontend notifies backend when dirty state changes.
#[tauri::command]
fn set_has_unsaved_changes(dirty: bool) {
    HAS_UNSAVED_CHANGES.store(dirty, std::sync::atomic::Ordering::Relaxed);
}

/// Tauri command: save a batch of tag updates to disk.
#[tauri::command]
async fn save_tags(
    updates: Vec<tunetag_core::TagUpdate>,
) -> Result<tunetag_core::SaveResult, String> {
    let result = tunetag_core::save_tags_batch(updates);
    Ok(result)
}

/// Tauri command: save column config to the app data directory.
#[tauri::command]
async fn save_column_config(app: tauri::AppHandle, config: ColumnConfig) -> Result<(), String> {
    let config_path = column_config_path(&app)?;

    // Ensure parent directory exists
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    let content =
        serde_json::to_string_pretty(&config).map_err(|e| format!("Failed to serialize config: {}", e))?;

    std::fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_paths,
            save_tags,
            load_column_config,
            save_column_config,
            set_has_unsaved_changes,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if HAS_UNSAVED_CHANGES.load(std::sync::atomic::Ordering::Relaxed) {
                    api.prevent_close();
                    let win = window.clone();
                    tauri::async_runtime::spawn(async move {
                        let answer = tauri_plugin_dialog::DialogExt::dialog(&win)
                            .message("You have unsaved changes. Discard and close?")
                            .title("Unsaved Changes")
                            .buttons(tauri_plugin_dialog::MessageDialogButtons::OkCancelCustom(
                                "Discard & Close".into(),
                                "Cancel".into(),
                            ))
                            .blocking_show();
                        if answer {
                            HAS_UNSAVED_CHANGES
                                .store(false, std::sync::atomic::Ordering::Relaxed);
                            win.close().ok();
                        }
                    });
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running TuneTag");
}
