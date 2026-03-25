use crate::error::TagError;
use crate::tag_io::{read_tags, write_tags};
use crate::types::TagData;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// A single file tag update from the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagUpdate {
    pub path: String,
    /// field name → new value (None = clear the field, key absent = don't touch)
    pub fields: HashMap<String, Option<String>>,
}

/// A single save failure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveError {
    pub path: String,
    pub error: String,
}

/// Aggregate result of a batch save operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveResult {
    pub succeeded: Vec<String>,
    pub failed: Vec<SaveError>,
}

/// Apply a batch of `TagUpdate`s, writing each file via lofty.
/// Skips failures and continues — errors are collected in `SaveResult::failed`.
pub fn save_tags_batch(updates: Vec<TagUpdate>) -> SaveResult {
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();

    for update in updates {
        let path = Path::new(&update.path);

        match apply_update(path, &update.fields) {
            Ok(()) => succeeded.push(update.path),
            Err(e) => failed.push(SaveError {
                path: update.path,
                error: e.to_string(),
            }),
        }
    }

    SaveResult { succeeded, failed }
}

fn apply_update(
    path: &Path,
    fields: &HashMap<String, Option<String>>,
) -> Result<(), TagError> {
    // Read existing tags to preserve fields not in the update
    let existing = read_tags(path)?;

    // Build a new TagData with only the updated fields applied
    let mut new_tags = TagData {
        format: existing.format,
        ..Default::default()
    };

    // Helper: get field from update (Some(Some(v)) = set, Some(None) = clear, None = skip)
    macro_rules! apply_field {
        ($field:ident, $key:expr) => {
            match fields.get($key) {
                Some(Some(v)) if v.is_empty() => {
                    // Explicit empty string — clear the field
                    new_tags.$field = Some(String::new());
                }
                Some(Some(v)) => {
                    new_tags.$field = Some(v.clone());
                }
                Some(None) => {
                    // Explicit null — clear the field
                    new_tags.$field = Some(String::new());
                }
                None => {
                    // Not in update — preserve existing
                    new_tags.$field = existing.$field.clone();
                }
            }
        };
    }

    apply_field!(title, "title");
    apply_field!(artist, "artist");
    apply_field!(album, "album");
    apply_field!(album_artist, "albumArtist");
    apply_field!(year, "year");
    apply_field!(genre, "genre");
    apply_field!(comment, "comment");

    // Track and disc — parse "N" or "N/T" format
    match fields.get("track") {
        Some(Some(v)) => new_tags.track = parse_number_pair(v),
        Some(None) => new_tags.track = None,
        None => new_tags.track = existing.track.clone(),
    }
    match fields.get("disc") {
        Some(Some(v)) => new_tags.disc = parse_number_pair(v),
        Some(None) => new_tags.disc = None,
        None => new_tags.disc = existing.disc.clone(),
    }

    // Preserve cover art — not managed by tag panel (cover-art change)
    new_tags.cover_art = existing.cover_art;

    write_tags(path, &new_tags, false)
}

fn parse_number_pair(s: &str) -> Option<crate::types::NumberPair> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    if let Some((num, total)) = s.split_once('/') {
        let n = num.trim().parse::<u32>().ok()?;
        let t = total.trim().parse::<u32>().ok();
        Some(crate::types::NumberPair::new(n, t))
    } else {
        let n = s.parse::<u32>().ok()?;
        Some(crate::types::NumberPair::new(n, None))
    }
}
