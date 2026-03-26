use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// Format string parsing
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub enum Segment {
    Literal(String),
    Placeholder(String), // e.g. "artist", "title"
}

/// Parse a format string like `%artist% - %title%` into segments.
pub fn parse_format(fmt: &str) -> Vec<Segment> {
    let mut segments = Vec::new();
    let mut chars = fmt.chars().peekable();
    let mut literal = String::new();

    while let Some(ch) = chars.next() {
        if ch == '%' {
            // Try to read a placeholder
            let mut placeholder = String::new();
            let mut closed = false;
            for inner in chars.by_ref() {
                if inner == '%' {
                    closed = true;
                    break;
                }
                placeholder.push(inner);
            }
            if closed && !placeholder.is_empty() {
                if !literal.is_empty() {
                    segments.push(Segment::Literal(literal.clone()));
                    literal.clear();
                }
                segments.push(Segment::Placeholder(placeholder.to_lowercase()));
            } else {
                // Unclosed or empty % — treat as literal
                literal.push('%');
                literal.push_str(&placeholder);
                if !closed {
                    // no closing % — already consumed
                }
            }
        } else {
            literal.push(ch);
        }
    }
    if !literal.is_empty() {
        segments.push(Segment::Literal(literal));
    }
    segments
}

/// Resolve a parsed format string against a set of tag values.
/// Returns the resolved base name (without extension).
pub fn resolve_format(segments: &[Segment], tags: &HashMap<String, String>) -> String {
    let mut result = String::new();
    for segment in segments {
        match segment {
            Segment::Literal(s) => result.push_str(s),
            Segment::Placeholder(key) => {
                if let Some(val) = tags.get(key.as_str()) {
                    // For track/disc: extract numeric part from "N/Total"
                    if key == "track" || key == "disc" {
                        let numeric = val.split('/').next().unwrap_or(val).trim();
                        result.push_str(numeric);
                    } else {
                        result.push_str(val);
                    }
                }
                // Missing placeholder → empty string (don't push anything)
            }
        }
    }
    result
}

/// Extract tag values from a TagData for use in format string resolution.
pub fn tag_map(tags: &crate::types::TagData) -> HashMap<String, String> {
    let mut map = HashMap::new();
    macro_rules! insert_opt {
        ($key:expr, $val:expr) => {
            if let Some(v) = $val {
                if !v.is_empty() {
                    map.insert($key.to_string(), v.clone());
                }
            }
        };
    }
    insert_opt!("title", &tags.title);
    insert_opt!("artist", &tags.artist);
    insert_opt!("album", &tags.album);
    insert_opt!("albumartist", &tags.album_artist);
    insert_opt!("year", &tags.year);
    insert_opt!("genre", &tags.genre);
    insert_opt!("comment", &tags.comment);
    if let Some(ref np) = tags.track {
        map.insert(
            "track".to_string(),
            match np.total {
                Some(t) => format!("{}/{}", np.number, t),
                None => np.number.to_string(),
            },
        );
    }
    if let Some(ref np) = tags.disc {
        map.insert(
            "disc".to_string(),
            match np.total {
                Some(t) => format!("{}/{}", np.number, t),
                None => np.number.to_string(),
            },
        );
    }
    map
}

// ---------------------------------------------------------------------------
// Filename sanitization
// ---------------------------------------------------------------------------

const ILLEGAL_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'];
const FALLBACK_NAME: &str = "_renamed";

/// Sanitize a resolved filename base:
/// - Replace OS-illegal chars with `_`
/// - Trim leading/trailing whitespace and dots
/// - Collapse consecutive whitespace to single space
/// - Return fallback if empty
pub fn sanitize(name: &str) -> String {
    let replaced: String = name
        .chars()
        .map(|c| if ILLEGAL_CHARS.contains(&c) { '_' } else { c })
        .collect();

    // Collapse consecutive whitespace
    let collapsed: String = replaced.split_whitespace().collect::<Vec<_>>().join(" ");

    // Trim leading/trailing dots
    let trimmed = collapsed.trim_matches('.');

    if trimmed.is_empty() {
        FALLBACK_NAME.to_string()
    } else {
        trimmed.to_string()
    }
}

/// Resolve a full filename (base + extension) for a given path and format string.
pub fn resolve_filename(
    path: &Path,
    segments: &[Segment],
    tags: &HashMap<String, String>,
) -> String {
    let base = resolve_format(segments, tags);
    let sanitized = sanitize(&base);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if ext.is_empty() {
        sanitized
    } else {
        format!("{}.{}", sanitized, ext)
    }
}

// ---------------------------------------------------------------------------
// Rename planning
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct RenameMapping {
    pub original_path: PathBuf,
    pub new_filename: String,
    pub new_path: PathBuf,
    pub is_noop: bool,
}

#[derive(Debug, Clone)]
pub struct RenamePreview {
    pub mappings: Vec<RenameMapping>,
    pub collisions: Vec<String>, // description of collision conflicts
    pub permission_errors: Vec<String>,
}

/// Plan renames for a list of file paths and a format string.
/// Returns a preview with mappings, collisions, and permission errors.
pub fn plan_renames(paths: &[PathBuf], format: &str) -> RenamePreview {
    let segments = parse_format(format);
    let mut mappings = Vec::new();

    for path in paths {
        let tags = crate::tag_io::read_tags(path).unwrap_or_default();
        let tag_values = tag_map(&tags);
        let new_filename = resolve_filename(path, &segments, &tag_values);
        let parent = path.parent().unwrap_or(Path::new("."));
        let new_path = parent.join(&new_filename);

        let current_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let is_noop = current_name == new_filename;

        mappings.push(RenameMapping {
            original_path: path.clone(),
            new_filename,
            new_path,
            is_noop,
        });
    }

    // Collision detection
    let case_sensitive = cfg!(target_os = "linux");
    let mut collisions = Vec::new();

    // Group by parent directory, check for duplicate resolved names
    let mut by_dir: HashMap<PathBuf, Vec<&RenameMapping>> = HashMap::new();
    for m in &mappings {
        if m.is_noop {
            continue;
        }
        let parent = m.original_path.parent().unwrap_or(Path::new("."));
        by_dir.entry(parent.to_path_buf()).or_default().push(m);
    }

    for (dir, group) in &by_dir {
        let mut seen: HashMap<String, &RenameMapping> = HashMap::new();
        for m in group {
            let key = if case_sensitive {
                m.new_filename.clone()
            } else {
                m.new_filename.to_lowercase()
            };
            if let Some(existing) = seen.get(&key) {
                collisions.push(format!(
                    "Collision in {}: '{}' and '{}' both resolve to '{}'",
                    dir.display(),
                    existing
                        .original_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy(),
                    m.original_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy(),
                    m.new_filename,
                ));
            } else {
                seen.insert(key, m);
            }
        }
    }

    // Permission pre-check
    let mut permission_errors = Vec::new();
    let mut checked_dirs = std::collections::HashSet::new();
    for m in &mappings {
        if m.is_noop {
            continue;
        }
        let parent = m.original_path.parent().unwrap_or(Path::new("."));
        if checked_dirs.insert(parent.to_path_buf()) && !is_writable(parent) {
            permission_errors.push(format!("No write permission: {}", parent.display()));
        }
    }

    RenamePreview {
        mappings,
        collisions,
        permission_errors,
    }
}

fn is_writable(dir: &Path) -> bool {
    // Try to create a temp file in the directory
    let test_path = dir.join(".tunetag_write_test");
    match std::fs::File::create(&test_path) {
        Ok(_) => {
            let _ = std::fs::remove_file(&test_path);
            true
        }
        Err(_) => false,
    }
}

// ---------------------------------------------------------------------------
// Rename execution
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RenameResult {
    pub original_path: String,
    pub new_path: Option<String>,
    pub error: Option<String>,
    pub skipped: bool,
}

/// Execute renames. Skip-and-continue on individual failures.
/// Returns per-file results.
pub fn execute_renames(paths: &[PathBuf], format: &str) -> Vec<RenameResult> {
    let preview = plan_renames(paths, format);

    if !preview.collisions.is_empty() || !preview.permission_errors.is_empty() {
        // Abort the entire batch — return fatal errors
        return paths
            .iter()
            .map(|p| RenameResult {
                original_path: p.to_string_lossy().to_string(),
                new_path: None,
                error: Some(
                    preview
                        .collisions
                        .first()
                        .or_else(|| preview.permission_errors.first())
                        .cloned()
                        .unwrap_or_else(|| "Pre-check failed".to_string()),
                ),
                skipped: false,
            })
            .collect();
    }

    preview
        .mappings
        .iter()
        .map(|m| {
            if m.is_noop {
                return RenameResult {
                    original_path: m.original_path.to_string_lossy().to_string(),
                    new_path: Some(m.new_path.to_string_lossy().to_string()),
                    error: None,
                    skipped: true,
                };
            }
            match std::fs::rename(&m.original_path, &m.new_path) {
                Ok(()) => RenameResult {
                    original_path: m.original_path.to_string_lossy().to_string(),
                    new_path: Some(m.new_path.to_string_lossy().to_string()),
                    error: None,
                    skipped: false,
                },
                Err(e) => RenameResult {
                    original_path: m.original_path.to_string_lossy().to_string(),
                    new_path: None,
                    error: Some(e.to_string()),
                    skipped: false,
                },
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // 6.1: Format string parsing
    #[test]
    fn parse_literal_only() {
        let segs = parse_format("Hello World");
        assert_eq!(segs, vec![Segment::Literal("Hello World".into())]);
    }

    #[test]
    fn parse_single_placeholder() {
        let segs = parse_format("%artist%");
        assert_eq!(segs, vec![Segment::Placeholder("artist".into())]);
    }

    #[test]
    fn parse_multiple_placeholders() {
        let segs = parse_format("%artist% - %title%");
        assert_eq!(
            segs,
            vec![
                Segment::Placeholder("artist".into()),
                Segment::Literal(" - ".into()),
                Segment::Placeholder("title".into()),
            ]
        );
    }

    #[test]
    fn parse_unrecognized_placeholder_treated_as_literal() {
        // Unknown placeholders still parse as Placeholder variants;
        // resolution returns empty string for unknown keys (not an error)
        let segs = parse_format("%unknown%");
        assert_eq!(segs, vec![Segment::Placeholder("unknown".into())]);
        let resolved = resolve_format(&segs, &HashMap::new());
        assert_eq!(resolved, "");
    }

    // 6.2: Placeholder resolution
    #[test]
    fn resolve_all_values_present() {
        let mut tags = HashMap::new();
        tags.insert("artist".to_string(), "Radiohead".to_string());
        tags.insert("title".to_string(), "Creep".to_string());
        let segs = parse_format("%artist% - %title%");
        let result = resolve_format(&segs, &tags);
        assert_eq!(result, "Radiohead - Creep");
    }

    #[test]
    fn resolve_missing_values_produce_empty() {
        let tags = HashMap::new();
        let segs = parse_format("%artist% - %title%");
        let result = resolve_format(&segs, &tags);
        assert_eq!(result, " - ");
    }

    #[test]
    fn resolve_track_numeric_extraction() {
        let mut tags = HashMap::new();
        tags.insert("track".to_string(), "3/12".to_string());
        let segs = parse_format("%track%");
        let result = resolve_format(&segs, &tags);
        assert_eq!(result, "3");
    }

    // 6.3: Filename sanitization
    #[test]
    fn sanitize_illegal_chars() {
        assert_eq!(sanitize("A/B:C*D"), "A_B_C_D");
    }

    #[test]
    fn sanitize_empty_result_uses_fallback() {
        assert_eq!(sanitize(""), FALLBACK_NAME);
        assert_eq!(sanitize("..."), FALLBACK_NAME);
    }

    #[test]
    fn sanitize_trims_whitespace() {
        assert_eq!(sanitize("  hello  "), "hello");
    }

    #[test]
    fn extension_preserved() {
        let path = Path::new("/music/track.mp3");
        let mut tags = HashMap::new();
        tags.insert("title".to_string(), "Creep".to_string());
        let segs = parse_format("%title%");
        let name = resolve_filename(path, &segs, &tags);
        assert_eq!(name, "Creep.mp3");
    }

    // 6.4: Collision detection
    #[test]
    fn collision_same_directory_detected() {
        let dir = std::env::temp_dir().join("tunetag_rename_test_col");
        std::fs::create_dir_all(&dir).unwrap();
        let p1 = dir.join("a.mp3");
        let p2 = dir.join("b.mp3");
        std::fs::write(&p1, b"").unwrap();
        std::fs::write(&p2, b"").unwrap();

        // Both resolve to "Same.mp3" since no tags
        let preview = plan_renames(&[p1.clone(), p2.clone()], "Same");
        assert!(!preview.collisions.is_empty());

        std::fs::remove_file(&p1).ok();
        std::fs::remove_file(&p2).ok();
    }

    #[test]
    fn no_op_detection_skips_unchanged() {
        let fixtures =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/test_v23.mp3");
        let preview = plan_renames(&[fixtures], "test_v23");
        let m = &preview.mappings[0];
        // The existing filename is test_v23.mp3, format resolves to test_v23.mp3
        assert!(m.is_noop);
    }
}
