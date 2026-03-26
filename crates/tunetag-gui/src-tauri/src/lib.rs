#[cfg(unix)]
extern crate libc;

mod musicbrainz;

use base64::Engine as _;
use musicbrainz::{MusicBrainzClient, ReleaseDetailDto, SearchResultDto};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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

// ---------------------------------------------------------------------------
// Cover art commands
// ---------------------------------------------------------------------------

/// Cover art data returned to the frontend.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverArtData {
    pub data: String,      // base64-encoded image bytes
    pub mime_type: String, // "image/jpeg" or "image/png"
}

/// Multi-file cover art selection result.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum CoverArtSelection {
    /// All selected files share the same cover art.
    #[serde(rename = "shared")]
    Shared { art: CoverArtData },
    /// Files have differing cover art.
    #[serde(rename = "mixed")]
    Mixed,
    /// No files have cover art.
    #[serde(rename = "none")]
    None,
}

fn read_cover_from_path(path: &Path) -> Option<tunetag_core::CoverArt> {
    tunetag_core::read_tags(path)
        .ok()
        .and_then(|t| t.cover_art)
}

fn cover_art_to_data(cover: &tunetag_core::CoverArt) -> CoverArtData {
    let mime_type = match cover.format {
        tunetag_core::CoverArtFormat::Jpeg => "image/jpeg",
        tunetag_core::CoverArtFormat::Png => "image/png",
    }
    .to_string();
    let data = base64::engine::general_purpose::STANDARD.encode(&cover.data);
    CoverArtData { data, mime_type }
}

/// Tauri command: get cover art for a single file.
#[tauri::command]
async fn get_cover_art(path: String) -> Result<Option<CoverArtData>, String> {
    let p = Path::new(&path);
    let cover = read_cover_from_path(p);
    Ok(cover.as_ref().map(cover_art_to_data))
}

/// Tauri command: get cover art for a multi-file selection.
/// Returns shared image if all files have identical art (byte-for-byte via SHA-256),
/// or a status indicator ("mixed" / "none").
#[tauri::command]
async fn get_cover_art_for_selection(paths: Vec<String>) -> Result<CoverArtSelection, String> {
    if paths.is_empty() {
        return Ok(CoverArtSelection::None);
    }

    let mut hashes: Vec<Option<(Vec<u8>, Vec<u8>)>> = Vec::new(); // (hash, raw bytes)

    for path in &paths {
        let cover = read_cover_from_path(Path::new(path));
        match cover {
            Some(c) => {
                let mut hasher = Sha256::new();
                hasher.update(&c.data);
                let hash = hasher.finalize().to_vec();
                hashes.push(Some((hash, c.data)));
            }
            None => hashes.push(None),
        }
    }

    let all_none = hashes.iter().all(|h| h.is_none());
    if all_none {
        return Ok(CoverArtSelection::None);
    }

    // Check if all hashes match
    let first_hash = match &hashes[0] {
        Some((h, _)) => h.clone(),
        None => return Ok(CoverArtSelection::Mixed),
    };

    let all_same = hashes
        .iter()
        .all(|h| h.as_ref().map(|(hash, _)| hash == &first_hash).unwrap_or(false));

    if all_same {
        // Return the image data (read fresh for the first file to get format info)
        let first_cover = read_cover_from_path(Path::new(&paths[0]));
        match first_cover {
            Some(cover) => Ok(CoverArtSelection::Shared {
                art: cover_art_to_data(&cover),
            }),
            None => Ok(CoverArtSelection::None),
        }
    } else {
        Ok(CoverArtSelection::Mixed)
    }
}

/// Tauri command: embed a JPEG or PNG image file as cover art for a set of files.
#[tauri::command]
async fn embed_cover_art(file_paths: Vec<String>, image_path: String) -> Result<(), String> {
    // Read and validate the image file
    let image_bytes = std::fs::read(&image_path)
        .map_err(|e| format!("Failed to read image: {}", e))?;

    // Validate magic bytes
    let format = if image_bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        tunetag_core::CoverArtFormat::Jpeg
    } else if image_bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        tunetag_core::CoverArtFormat::Png
    } else {
        return Err("Unsupported image format. Only JPEG and PNG are supported.".into());
    };

    let cover = tunetag_core::CoverArt::new(image_bytes, format);

    for file_path in &file_paths {
        let p = Path::new(file_path);
        // Read existing tags, set cover art, write back
        let mut tags = tunetag_core::read_tags(p)
            .map_err(|e| format!("Failed to read {}: {}", file_path, e))?;
        tags.cover_art = Some(cover.clone());
        tunetag_core::write_tags(p, &tags, false)
            .map_err(|e| format!("Failed to write {}: {}", file_path, e))?;
    }

    Ok(())
}

/// Tauri command: remove cover art from a set of files.
#[tauri::command]
async fn remove_cover_art_cmd(file_paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut failed: Vec<String> = Vec::new();
    for file_path in &file_paths {
        if let Err(e) = tunetag_core::remove_cover_art(Path::new(file_path)) {
            failed.push(format!("{}: {}", file_path, e));
        }
    }
    if failed.is_empty() {
        Ok(Vec::new())
    } else {
        Err(failed.join("\n"))
    }
}

/// Tauri command: export cover art from a file to a destination path.
#[tauri::command]
async fn export_cover_art(file_path: String, dest_path: String) -> Result<(), String> {
    let cover = read_cover_from_path(Path::new(&file_path))
        .ok_or_else(|| "No cover art found in file".to_string())?;

    std::fs::write(&dest_path, &cover.data)
        .map_err(|e| format!("Failed to write cover art: {}", e))?;

    Ok(())
}

/// Shared dirty-state flag for the close prompt.
static HAS_UNSAVED_CHANGES: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Tauri command: frontend notifies backend when dirty state changes.
#[tauri::command]
fn set_has_unsaved_changes(dirty: bool) {
    HAS_UNSAVED_CHANGES.store(dirty, std::sync::atomic::Ordering::Relaxed);
}

// ---------------------------------------------------------------------------
// Refresh command
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshResult {
    pub updated: Vec<FileEntry>,
    pub deleted: Vec<String>,
}

#[tauri::command]
async fn refresh_files(paths: Vec<String>) -> Result<RefreshResult, String> {
    let mut updated = Vec::new();
    let mut deleted = Vec::new();

    for path_str in &paths {
        let path = std::path::Path::new(path_str);
        if !path.exists() {
            deleted.push(path_str.clone());
            continue;
        }
        match read_file_entry(path) {
            Some(entry) => updated.push(entry),
            None => deleted.push(path_str.clone()),
        }
    }

    Ok(RefreshResult { updated, deleted })
}

// ---------------------------------------------------------------------------
// Rename commands
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamePreviewRow {
    pub original_path: String,
    pub original_name: String,
    pub new_name: String,
    pub is_noop: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamePreviewResponse {
    pub rows: Vec<RenamePreviewRow>,
    pub collisions: Vec<String>,
    pub permission_errors: Vec<String>,
}

#[tauri::command]
async fn rename_preview_single(file_path: String, format: String) -> Result<String, String> {
    use tunetag_core::rename::{parse_format, resolve_filename, tag_map};
    use tunetag_core::read_tags;
    let path = std::path::Path::new(&file_path);
    let tags = read_tags(path).unwrap_or_default();
    let tag_values = tag_map(&tags);
    let segments = parse_format(&format);
    Ok(resolve_filename(path, &segments, &tag_values))
}

#[tauri::command]
async fn rename_preview(
    file_paths: Vec<String>,
    format: String,
) -> Result<RenamePreviewResponse, String> {
    let paths: Vec<std::path::PathBuf> = file_paths
        .iter()
        .map(std::path::PathBuf::from)
        .collect();
    let preview = tunetag_core::plan_renames(&paths, &format);
    let rows = preview
        .mappings
        .iter()
        .map(|m| RenamePreviewRow {
            original_name: m
                .original_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            new_name: m.new_filename.clone(),
            original_path: m.original_path.to_string_lossy().to_string(),
            is_noop: m.is_noop,
        })
        .collect();
    Ok(RenamePreviewResponse {
        rows,
        collisions: preview.collisions,
        permission_errors: preview.permission_errors,
    })
}

#[tauri::command]
async fn rename_execute(
    file_paths: Vec<String>,
    format: String,
) -> Result<Vec<tunetag_core::RenameResult>, String> {
    let paths: Vec<std::path::PathBuf> = file_paths
        .iter()
        .map(std::path::PathBuf::from)
        .collect();
    Ok(tunetag_core::execute_renames(&paths, &format))
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

// ---------------------------------------------------------------------------
// MusicBrainz managed state + commands (tasks 4.1-4.5)
// ---------------------------------------------------------------------------

struct MbState(MusicBrainzClient);

#[tauri::command]
async fn mb_search_releases(
    query: String,
    state: tauri::State<'_, MbState>,
) -> Result<Vec<SearchResultDto>, String> {
    state.0.search_releases(&query).await
}

#[tauri::command]
async fn mb_get_release_details(
    mbid: String,
    state: tauri::State<'_, MbState>,
) -> Result<ReleaseDetailDto, String> {
    state.0.get_release_details(&mbid).await
}

#[tauri::command]
async fn mb_fetch_cover_art(
    mbid: String,
    state: tauri::State<'_, MbState>,
) -> Result<Option<String>, String> {
    state.0.fetch_cover_art(&mbid).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mb_client = MusicBrainzClient::new().expect("Failed to create MusicBrainz client");

    tauri::Builder::default()
        .manage(MbState(mb_client))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_paths,
            save_tags,
            load_column_config,
            save_column_config,
            set_has_unsaved_changes,
            get_cover_art,
            get_cover_art_for_selection,
            embed_cover_art,
            remove_cover_art_cmd,
            export_cover_art,
            rename_preview_single,
            rename_preview,
            rename_execute,
            refresh_files,
            mb_search_releases,
            mb_get_release_details,
            mb_fetch_cover_art,
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
