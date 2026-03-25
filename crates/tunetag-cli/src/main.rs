use clap::{Parser, Subcommand};
use serde_json::{json, Value as JsonValue};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process;
use tunetag_core::{
    read_audio_properties, read_tags, remove_cover_art, write_tags, CoverArt, NumberPair, TagData,
};

/// TuneTag — cross-platform audio tag editor
#[derive(Parser)]
#[command(name = "tunetag", version, about, long_about = None)]
struct Cli {
    /// Output as JSON instead of human-readable format
    #[arg(long, global = true)]
    json: bool,

    /// Preview changes without writing to disk
    #[arg(long, global = true)]
    dry_run: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Print all tags from an audio file
    Read {
        /// Path to the audio file
        file: PathBuf,
    },

    /// Set one or more tag fields on an audio file
    Write {
        /// Path to the audio file(s)
        #[arg(required = true)]
        files: Vec<PathBuf>,

        /// Set the title
        #[arg(long)]
        title: Option<String>,

        /// Set the artist
        #[arg(long)]
        artist: Option<String>,

        /// Set the album
        #[arg(long)]
        album: Option<String>,

        /// Set the album artist
        #[arg(long)]
        album_artist: Option<String>,

        /// Set the year
        #[arg(long)]
        year: Option<String>,

        /// Set the track number (N or N/Total)
        #[arg(long)]
        track: Option<String>,

        /// Set the disc number (N or N/Total)
        #[arg(long)]
        disc: Option<String>,

        /// Set the genre
        #[arg(long)]
        genre: Option<String>,

        /// Set the comment
        #[arg(long)]
        comment: Option<String>,
    },

    /// Rename files on disk using a format string based on tag values
    Rename {
        /// Audio files to rename
        #[arg(required = true)]
        files: Vec<PathBuf>,

        /// Format string (e.g., "%artist% - %title%")
        #[arg(long)]
        format: String,
    },

    /// Manage cover art
    Cover {
        #[command(subcommand)]
        action: CoverAction,
    },

    /// Print audio properties (duration, bitrate, sample rate)
    Info {
        /// Path to the audio file
        file: PathBuf,
    },

    /// Auto-number tracks in a batch of files
    Autonumber {
        /// Audio files to number
        #[arg(required = true)]
        files: Vec<PathBuf>,

        /// Starting track number
        #[arg(long, default_value = "1")]
        start: u32,

        /// Total number of tracks (defaults to file count)
        #[arg(long)]
        total: Option<u32>,

        /// Write total count with track number (default: true)
        #[arg(long, default_value = "true")]
        write_total: bool,

        /// Disable writing total count
        #[arg(long, conflicts_with = "write_total")]
        no_write_total: bool,

        /// Disc number to write to all files
        #[arg(long)]
        disc: Option<u32>,

        /// Sort files by filename before numbering
        #[arg(long)]
        sort: Option<SortOrder>,
    },
}

#[derive(Clone, clap::ValueEnum)]
enum SortOrder {
    Filename,
}

#[derive(Subcommand)]
enum CoverAction {
    /// Embed cover art into an audio file
    Set {
        /// Path to the audio file
        file: PathBuf,

        /// Path to the image file (JPEG or PNG)
        #[arg(long)]
        image: PathBuf,
    },

    /// Remove cover art from an audio file
    Remove {
        /// Path to the audio file
        file: PathBuf,
    },
}

// ---------------------------------------------------------------------------
// Write field bundle (avoids too-many-arguments)
// ---------------------------------------------------------------------------

struct WriteFields {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    album_artist: Option<String>,
    year: Option<String>,
    track: Option<String>,
    disc: Option<String>,
    genre: Option<String>,
    comment: Option<String>,
}

impl WriteFields {
    fn has_any(&self) -> bool {
        self.title.is_some()
            || self.artist.is_some()
            || self.album.is_some()
            || self.album_artist.is_some()
            || self.year.is_some()
            || self.track.is_some()
            || self.disc.is_some()
            || self.genre.is_some()
            || self.comment.is_some()
    }

    fn to_tag_data(&self) -> TagData {
        TagData {
            title: self.title.clone(),
            artist: self.artist.clone(),
            album: self.album.clone(),
            album_artist: self.album_artist.clone(),
            year: self.year.clone(),
            track: self.track.as_ref().and_then(|s| parse_number_pair_str(s)),
            disc: self.disc.as_ref().and_then(|s| parse_number_pair_str(s)),
            genre: self.genre.clone(),
            comment: self.comment.clone(),
            cover_art: None,
            format: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Error collector for batch operations
// ---------------------------------------------------------------------------

struct ErrorCollector {
    total: usize,
    errors: Vec<(PathBuf, String)>,
}

impl ErrorCollector {
    fn new(total: usize) -> Self {
        Self {
            total,
            errors: Vec::new(),
        }
    }

    fn record(&mut self, path: PathBuf, err: impl std::fmt::Display) {
        eprintln!("Error: {}: {}", path.display(), err);
        self.errors.push((path, err.to_string()));
    }

    fn succeeded(&self) -> usize {
        self.total - self.errors.len()
    }

    fn exit_code(&self) -> i32 {
        if self.errors.is_empty() {
            0
        } else if self.errors.len() < self.total {
            1
        } else {
            2
        }
    }

    fn print_summary(&self, verb: &str) {
        if self.total > 1 {
            if self.errors.is_empty() {
                eprintln!("{} {}/{} files", verb, self.succeeded(), self.total);
            } else {
                eprintln!(
                    "{} {}/{} files ({} failed)",
                    verb,
                    self.succeeded(),
                    self.total,
                    self.errors.len()
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Format string resolver for rename
// ---------------------------------------------------------------------------

fn resolve_format_string(fmt: &str, tags: &TagData) -> String {
    let mut result = fmt.to_string();

    let replacements: [(&str, Option<String>); 8] = [
        ("%title%", tags.title.clone()),
        ("%artist%", tags.artist.clone()),
        ("%album%", tags.album.clone()),
        ("%year%", tags.year.clone()),
        (
            "%track%",
            tags.track.as_ref().map(|np| np.number.to_string()),
        ),
        (
            "%disc%",
            tags.disc.as_ref().map(|np| np.number.to_string()),
        ),
        ("%albumartist%", tags.album_artist.clone()),
        ("%genre%", tags.genre.clone()),
    ];

    for (placeholder, value) in &replacements {
        let replacement = value.as_deref().unwrap_or("");
        result = result.replace(placeholder, replacement);
    }

    result
}

/// Sanitize filesystem-unsafe characters in a filename component.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}

/// Check for case-insensitive filename collisions. Returns a map of
/// lowercased name -> list of original paths that resolve to it.
fn detect_collisions(mappings: &[(PathBuf, String)]) -> HashMap<String, Vec<PathBuf>> {
    let mut seen: HashMap<String, Vec<PathBuf>> = HashMap::new();
    for (original, new_name) in mappings {
        seen.entry(new_name.to_lowercase())
            .or_default()
            .push(original.clone());
    }
    seen.into_iter()
        .filter(|(_, paths)| paths.len() > 1)
        .collect()
}

// ---------------------------------------------------------------------------
// Number pair parsing
// ---------------------------------------------------------------------------

fn parse_number_pair_str(s: &str) -> Option<NumberPair> {
    if let Some((num_str, total_str)) = s.split_once('/') {
        let number = num_str.trim().parse::<u32>().ok()?;
        let total = total_str.trim().parse::<u32>().ok()?;
        Some(NumberPair::new(number, Some(total)))
    } else {
        let number = s.trim().parse::<u32>().ok()?;
        Some(NumberPair::new(number, None))
    }
}

// ---------------------------------------------------------------------------
// Tag field helpers
// ---------------------------------------------------------------------------

fn number_pair_display(np: &Option<NumberPair>) -> String {
    match np {
        Some(np) => match np.total {
            Some(t) => format!("{}/{}", np.number, t),
            None => np.number.to_string(),
        },
        None => String::new(),
    }
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

fn print_tags_human(tags: &TagData) {
    if let Some(ref v) = tags.title {
        println!("Title={v}");
    }
    if let Some(ref v) = tags.artist {
        println!("Artist={v}");
    }
    if let Some(ref v) = tags.album {
        println!("Album={v}");
    }
    if let Some(ref v) = tags.album_artist {
        println!("AlbumArtist={v}");
    }
    if let Some(ref v) = tags.year {
        println!("Year={v}");
    }
    if let Some(ref np) = tags.track {
        let val = number_pair_display(&Some(np.clone()));
        println!("Track={val}");
    }
    if let Some(ref np) = tags.disc {
        let val = number_pair_display(&Some(np.clone()));
        println!("Disc={val}");
    }
    if let Some(ref v) = tags.genre {
        println!("Genre={v}");
    }
    if let Some(ref v) = tags.comment {
        println!("Comment={v}");
    }
    if tags.cover_art.is_some() {
        println!("CoverArt=<embedded>");
    }
}

fn tags_to_json(tags: &TagData) -> serde_json::Map<String, JsonValue> {
    let mut map = serde_json::Map::new();
    if let Some(ref v) = tags.title {
        map.insert("Title".to_string(), json!(v));
    }
    if let Some(ref v) = tags.artist {
        map.insert("Artist".to_string(), json!(v));
    }
    if let Some(ref v) = tags.album {
        map.insert("Album".to_string(), json!(v));
    }
    if let Some(ref v) = tags.album_artist {
        map.insert("AlbumArtist".to_string(), json!(v));
    }
    if let Some(ref v) = tags.year {
        map.insert("Year".to_string(), json!(v));
    }
    if let Some(ref np) = tags.track {
        map.insert(
            "Track".to_string(),
            json!(number_pair_display(&Some(np.clone()))),
        );
    }
    if let Some(ref np) = tags.disc {
        map.insert(
            "Disc".to_string(),
            json!(number_pair_display(&Some(np.clone()))),
        );
    }
    if let Some(ref v) = tags.genre {
        map.insert("Genre".to_string(), json!(v));
    }
    if let Some(ref v) = tags.comment {
        map.insert("Comment".to_string(), json!(v));
    }
    if tags.cover_art.is_some() {
        map.insert("CoverArt".to_string(), json!("<embedded>"));
    }
    map
}

fn format_duration(secs: u64) -> String {
    let minutes = secs / 60;
    let seconds = secs % 60;
    format!("{minutes}:{seconds:02}")
}

// ---------------------------------------------------------------------------
// Diff helpers for write --dry-run
// ---------------------------------------------------------------------------

struct FieldChange {
    field: String,
    old: String,
    new: String,
}

fn compute_write_diff(current: &TagData, proposed: &TagData) -> Vec<FieldChange> {
    let mut changes = Vec::new();

    macro_rules! diff_string_field {
        ($field:ident, $name:expr) => {
            if let Some(ref new_val) = proposed.$field {
                let old_val = current.$field.as_deref().unwrap_or("");
                if old_val != new_val.as_str() {
                    changes.push(FieldChange {
                        field: $name.to_string(),
                        old: old_val.to_string(),
                        new: new_val.clone(),
                    });
                }
            }
        };
    }

    diff_string_field!(title, "Title");
    diff_string_field!(artist, "Artist");
    diff_string_field!(album, "Album");
    diff_string_field!(album_artist, "AlbumArtist");
    diff_string_field!(year, "Year");

    if let Some(ref new_np) = proposed.track {
        let old_val = number_pair_display(&current.track);
        let new_val = number_pair_display(&Some(new_np.clone()));
        if old_val != new_val {
            changes.push(FieldChange {
                field: "Track".to_string(),
                old: old_val,
                new: new_val,
            });
        }
    }

    if let Some(ref new_np) = proposed.disc {
        let old_val = number_pair_display(&current.disc);
        let new_val = number_pair_display(&Some(new_np.clone()));
        if old_val != new_val {
            changes.push(FieldChange {
                field: "Disc".to_string(),
                old: old_val,
                new: new_val,
            });
        }
    }

    diff_string_field!(genre, "Genre");
    diff_string_field!(comment, "Comment");

    changes
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

fn cmd_read(file: &Path, use_json: bool) -> i32 {
    match read_tags(file) {
        Ok(tags) => {
            if use_json {
                let obj = json!({
                    "file": file.display().to_string(),
                    "tags": JsonValue::Object(tags_to_json(&tags)),
                });
                println!("{}", serde_json::to_string_pretty(&obj).unwrap());
            } else {
                print_tags_human(&tags);
            }
            0
        }
        Err(e) => {
            eprintln!("Error: {e}");
            2
        }
    }
}

fn cmd_write(files: &[PathBuf], fields: &WriteFields, dry_run: bool, use_json: bool) -> i32 {
    if !fields.has_any() {
        eprintln!("Error: at least one field must be specified");
        return 2;
    }

    let proposed = fields.to_tag_data();
    let mut collector = ErrorCollector::new(files.len());

    if dry_run {
        let mut all_json_entries: Vec<JsonValue> = Vec::new();

        for file in files {
            match read_tags(file) {
                Ok(current) => {
                    let changes = compute_write_diff(&current, &proposed);
                    if use_json {
                        let changes_json: Vec<JsonValue> = changes
                            .iter()
                            .map(|c| {
                                json!({
                                    "field": c.field,
                                    "old": c.old,
                                    "new": c.new,
                                })
                            })
                            .collect();
                        all_json_entries.push(json!({
                            "file": file.display().to_string(),
                            "changes": changes_json,
                        }));
                    } else if !changes.is_empty() {
                        println!("{}:", file.display());
                        for c in &changes {
                            println!("  {}: \"{}\" \u{2192} \"{}\"", c.field, c.old, c.new);
                        }
                    }
                }
                Err(e) => {
                    collector.record(file.clone(), e);
                }
            }
        }

        if use_json {
            println!(
                "{}",
                serde_json::to_string_pretty(&all_json_entries).unwrap()
            );
        }
    } else {
        for file in files {
            match write_tags(file, &proposed, false) {
                Ok(()) => {
                    if !use_json && files.len() == 1 {
                        eprintln!("Saved {}", file.display());
                    }
                }
                Err(e) => {
                    collector.record(file.clone(), e);
                }
            }
        }
    }

    collector.print_summary("Wrote");
    collector.exit_code()
}

fn cmd_rename(files: &[PathBuf], fmt: &str, dry_run: bool, use_json: bool) -> i32 {
    if files.is_empty() {
        eprintln!("Error: no files specified");
        return 2;
    }

    // Build mappings: (original_path, new_filename)
    let mut mappings: Vec<(PathBuf, String)> = Vec::new();
    let mut collector = ErrorCollector::new(files.len());

    for file in files {
        match read_tags(file) {
            Ok(tags) => {
                let resolved = resolve_format_string(fmt, &tags);
                let sanitized = sanitize_filename(&resolved);

                // Preserve original extension
                let ext = file
                    .extension()
                    .map(|e| format!(".{}", e.to_string_lossy()))
                    .unwrap_or_default();
                let new_filename = format!("{sanitized}{ext}");

                if new_filename.trim().is_empty()
                    || new_filename == ext
                    || sanitized.trim().is_empty()
                {
                    collector.record(file.clone(), "format string produced an empty filename");
                    continue;
                }

                mappings.push((file.clone(), new_filename));
            }
            Err(e) => {
                collector.record(file.clone(), e);
            }
        }
    }

    // Collision detection
    let collisions = detect_collisions(&mappings);
    if !collisions.is_empty() {
        eprintln!("Error: filename collisions detected, aborting rename:");
        for (name, paths) in &collisions {
            eprintln!(
                "  \"{}\" would be used by: {}",
                name,
                paths
                    .iter()
                    .map(|p| p.display().to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            );
        }
        return 2;
    }

    if dry_run {
        if use_json {
            let entries: Vec<JsonValue> = mappings
                .iter()
                .map(|(original, new_name)| {
                    json!({
                        "file": original.display().to_string(),
                        "new_name": new_name,
                    })
                })
                .collect();
            println!("{}", serde_json::to_string_pretty(&entries).unwrap());
        } else {
            for (original, new_name) in &mappings {
                let old_name = original
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| original.display().to_string());
                println!("{old_name} \u{2192} {new_name}");
            }
        }
    } else {
        for (original, new_name) in &mappings {
            let new_path = original
                .parent()
                .unwrap_or_else(|| Path::new("."))
                .join(new_name);

            if let Err(e) = std::fs::rename(original, &new_path) {
                collector.record(original.clone(), e);
            }
        }
    }

    collector.print_summary("Renamed");
    collector.exit_code()
}

fn cmd_cover_set(file: &Path, image: &Path) -> i32 {
    // Read the image file
    let image_data = match std::fs::read(image) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("Error: failed to read image {}: {}", image.display(), e);
            return 2;
        }
    };

    // Detect format from magic bytes
    let cover = match CoverArt::from_bytes(image_data) {
        Some(c) => c,
        None => {
            eprintln!(
                "Error: unsupported image format for {}. Only JPEG and PNG are supported.",
                image.display()
            );
            return 2;
        }
    };

    // Read current tags to preserve ID3 version
    let tags = match read_tags(file) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("Error: {e}");
            return 2;
        }
    };

    // Write only the cover_art field, preserving tag format
    let write_data = TagData {
        cover_art: Some(cover),
        format: tags.format,
        ..TagData::default()
    };

    match write_tags(file, &write_data, false) {
        Ok(()) => {
            eprintln!("Cover art set for {}", file.display());
            0
        }
        Err(e) => {
            eprintln!("Error: {e}");
            2
        }
    }
}

fn cmd_cover_remove(file: &Path) -> i32 {
    match remove_cover_art(file) {
        Ok(()) => {
            eprintln!("Cover art removed from {}", file.display());
            0
        }
        Err(e) => {
            eprintln!("Error: {e}");
            2
        }
    }
}

fn cmd_info(file: &Path, use_json: bool) -> i32 {
    match read_audio_properties(file) {
        Ok(props) => {
            if use_json {
                let obj = json!({
                    "file": file.display().to_string(),
                    "duration_secs": props.duration.as_secs(),
                    "bitrate_kbps": props.bitrate_kbps,
                    "sample_rate_hz": props.sample_rate_hz,
                    "channels": props.channels,
                });
                println!("{}", serde_json::to_string_pretty(&obj).unwrap());
            } else {
                println!("Duration: {}", format_duration(props.duration.as_secs()));
                if let Some(b) = props.bitrate_kbps {
                    println!("Bitrate: {b} kbps");
                }
                if let Some(sr) = props.sample_rate_hz {
                    println!("Sample Rate: {sr} Hz");
                }
                if let Some(ch) = props.channels {
                    println!("Channels: {ch}");
                }
            }
            0
        }
        Err(e) => {
            eprintln!("Error: {e}");
            2
        }
    }
}

fn cmd_autonumber(
    files: &mut [PathBuf],
    start: u32,
    total: Option<u32>,
    write_total: bool,
    no_write_total: bool,
    disc: Option<u32>,
    sort: &Option<SortOrder>,
) -> i32 {
    if files.is_empty() {
        eprintln!("Error: no files specified");
        return 2;
    }

    // Sort if requested
    if sort.is_some() {
        files.sort_by(|a, b| {
            let a_name = a.file_name().unwrap_or_default();
            let b_name = b.file_name().unwrap_or_default();
            a_name.cmp(b_name)
        });
    }

    let should_write_total = !no_write_total && write_total;
    let total_count = total.unwrap_or(files.len() as u32);
    let mut collector = ErrorCollector::new(files.len());

    for (i, file) in files.iter().enumerate() {
        let track_number = start + i as u32;
        let track_total = if should_write_total {
            Some(total_count)
        } else {
            None
        };

        let mut tag_data = TagData {
            track: Some(NumberPair::new(track_number, track_total)),
            ..TagData::default()
        };

        if let Some(disc_num) = disc {
            tag_data.disc = Some(NumberPair::new(disc_num, None));
        }

        // Read existing format to preserve ID3 version
        if let Ok(existing) = read_tags(file) {
            tag_data.format = existing.format;
        }

        match write_tags(file, &tag_data, false) {
            Ok(()) => {
                let track_display = number_pair_display(&tag_data.track);
                eprintln!(
                    "{}: track {}",
                    file.file_name().unwrap_or_default().to_string_lossy(),
                    track_display
                );
            }
            Err(e) => {
                collector.record(file.clone(), e);
            }
        }
    }

    collector.print_summary("Numbered");
    collector.exit_code()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

fn main() {
    let mut cli = Cli::parse();

    let exit_code = match cli.command {
        Command::Read { ref file } => cmd_read(file, cli.json),
        Command::Write {
            ref files,
            ref title,
            ref artist,
            ref album,
            ref album_artist,
            ref year,
            ref track,
            ref disc,
            ref genre,
            ref comment,
        } => {
            let fields = WriteFields {
                title: title.clone(),
                artist: artist.clone(),
                album: album.clone(),
                album_artist: album_artist.clone(),
                year: year.clone(),
                track: track.clone(),
                disc: disc.clone(),
                genre: genre.clone(),
                comment: comment.clone(),
            };
            cmd_write(files, &fields, cli.dry_run, cli.json)
        }
        Command::Rename {
            ref files,
            ref format,
        } => cmd_rename(files, format, cli.dry_run, cli.json),
        Command::Cover { ref action } => match action {
            CoverAction::Set { ref file, ref image } => cmd_cover_set(file, image),
            CoverAction::Remove { ref file } => cmd_cover_remove(file),
        },
        Command::Info { ref file } => cmd_info(file, cli.json),
        Command::Autonumber {
            ref mut files,
            start,
            total,
            write_total,
            no_write_total,
            disc,
            ref sort,
        } => cmd_autonumber(files, start, total, write_total, no_write_total, disc, sort),
    };

    process::exit(exit_code);
}
