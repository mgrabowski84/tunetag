use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::Manager;
use walkdir::WalkDir;

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
                if p.is_file() && is_supported_extension(&p) {
                    if let Ok(canonical) = p.canonicalize() {
                        if seen.insert(canonical.clone()) {
                            result.push(canonical);
                        }
                    }
                }
            }
        } else if path.is_file() && is_supported_extension(path) {
            if let Ok(canonical) = path.canonicalize() {
                if seen.insert(canonical.clone()) {
                    result.push(canonical);
                }
            }
        }
    }

    result
}

/// Tauri command: scan paths for supported audio files and read their metadata.
#[tauri::command]
async fn scan_paths(paths: Vec<PathBuf>, recursive: bool) -> Result<Vec<FileEntry>, String> {
    let audio_files = collect_audio_files(&paths, recursive);

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
            load_column_config,
            save_column_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TuneTag");
}
