## Context

TuneTag is a cross-platform audio tag editor built with Tauri v2 (Rust backend, React frontend) and a standalone CLI. Both the GUI and CLI need to read/write audio tags and read audio properties for MP3, FLAC, and M4A files. The `tunetag-core` crate will house this shared logic, wrapping the `lofty` crate (pure Rust, MIT licensed) which supports ID3v2, Vorbis Comments, and MP4 atoms natively.

No tag I/O code exists yet — this is the foundational layer that all higher-level features (batch editing, rename-from-tags, MusicBrainz lookup apply) depend on.

Key constraint from the PRD: ID3v2 version must be preserved on write (v2.3 stays v2.3) to avoid breaking playback on older hardware. An opt-in "force v2.4" mode is available via a configuration flag.

## Goals / Non-Goals

**Goals:**

- Provide a single Rust API for reading and writing tags across MP3/ID3v2, FLAC/Vorbis Comments, and M4A/MP4 atoms
- Abstract away format-specific details behind unified types so consumers don't handle format branching
- Preserve ID3v2 version on round-trip writes; support optional force-v2.4
- Read audio properties (duration, bitrate, sample rate, channels) as structured types
- Read and write embedded cover art (JPEG, PNG)
- Return `Result` types with domain-specific errors — never corrupt audio data on failure
- Keep the API synchronous (file I/O is fast for local files; async adds complexity without benefit here)

**Non-Goals:**

- Streaming/async I/O — not needed for local file tag operations
- Format conversion or transcoding
- Support for formats beyond MP3, FLAC, M4A (OGG, OPUS, WAV are out of scope for v1)
- Custom/extended tag fields or lyrics
- Filename-to-tag parsing (out of scope for v1)
- In-memory tag diffing or undo tracking — that's the GUI layer's responsibility

## Decisions

### 1. Unified `TagData` struct instead of per-format types

**Decision:** A single `TagData` struct holds all tag fields regardless of source format. Consumers never see ID3v2 frames, Vorbis Comment keys, or MP4 atom names directly.

**Rationale:** The GUI tag panel and CLI both operate on the same fields (Title, Artist, Album, etc.). Exposing format-specific types would force every consumer to handle three code paths. lofty already provides a `Tag` abstraction; we build our domain type on top of it.

**Alternative considered:** Trait-based polymorphism (`impl TagReader for Mp3File`). Rejected because it pushes format branching to the caller via dynamic dispatch without adding value — the field set is identical across formats.

### 2. ID3 version preservation via `WriteOptions`

**Decision:** On read, detect and store the ID3v2 version (v2.3 or v2.4) in the returned metadata. On write, pass this version to lofty's `WriteOptions` so the file is written back in its original version. A `force_id3v2_4: bool` parameter on the write function overrides this to always write v2.4.

**Rationale:** The PRD explicitly requires version preservation to avoid breaking playback on older hardware. Lofty supports specifying the ID3 version at write time via `WriteOptions::new().id3v2_version(Id3v2Version::V3)`.

**Alternative considered:** Always write v2.4 and let users opt out. Rejected because the PRD mandates preserve-by-default, and silent upgrades are the primary user complaint this policy addresses.

### 3. `CoverArt` as a separate struct with bytes + MIME type

**Decision:** Cover art is represented as `CoverArt { data: Vec<u8>, mime_type: CoverArtFormat }` where `CoverArtFormat` is an enum of `Jpeg` and `Png`. It's an `Option<CoverArt>` field on `TagData`.

**Rationale:** Cover art is large (potentially megabytes) and needs format awareness for embedding. Keeping it as a typed struct with raw bytes allows the GUI to display it directly and the CLI to write it to disk. JPEG and PNG are the only formats specified in the PRD.

### 4. Error types: `TagError` enum wrapping lofty errors

**Decision:** Define a `TagError` enum with variants like `UnsupportedFormat`, `FileNotFound`, `ReadError`, `WriteError`, `InvalidCoverArt`, each wrapping the underlying lofty or `std::io` error where applicable. All public functions return `Result<T, TagError>`.

**Rationale:** Consumers need actionable error variants (e.g., the GUI shows "Unsupported format" vs. "File not found" differently). Exposing raw lofty errors would leak implementation details and make error handling fragile if lofty's error types change.

**Alternative considered:** Using `anyhow::Error` for simplicity. Rejected because a library crate should provide typed errors — `anyhow` is better suited for applications.

### 5. `AudioProperties` as a read-only struct

**Decision:** `AudioProperties { duration: Duration, bitrate_kbps: Option<u32>, sample_rate_hz: Option<u32>, channels: Option<u8> }` is returned from a standalone `read_audio_properties()` function.

**Rationale:** Audio properties are read-only metadata derived from the audio stream, not tags. They're always read (never written) and are logically separate from tag data. Using `Option` for bitrate/sample_rate/channels because some formats or files may not expose all properties.

### 6. Synchronous API

**Decision:** All functions are synchronous (`fn read_tags(path: &Path) -> Result<...>`). No `async`.

**Rationale:** Tag I/O is local file access — typically <10ms per file. The GUI layer (Tauri commands) can call these from a background thread if needed. Adding `async` would require an async runtime dependency in the core crate and complicate the API without measurable benefit.

## Risks / Trade-offs

- **[Risk] lofty API changes break our wrapper** → Mitigation: Pin lofty to a specific minor version in `Cargo.toml`. The wrapper layer isolates consumers from lofty's API surface, so upgrades only require changes in `tunetag-core`.

- **[Risk] ID3v2.3 frame compatibility** → Mitigation: Some tag features differ between v2.3 and v2.4 (e.g., UTF-8 encoding is only native in v2.4). Lofty handles frame encoding conversion transparently when writing to a specified version. We rely on lofty's correctness here and add integration tests with real v2.3 files.

- **[Risk] Large cover art causes memory pressure** → Mitigation: Cover art bytes are loaded into memory as `Vec<u8>`. For batch operations on thousands of files, the GUI layer should avoid holding all cover art in memory simultaneously. The core API reads one file at a time; memory management is the caller's responsibility.

- **[Trade-off] `Option` fields on `TagData` vs. separate "partial" types** → We use `Option<String>` for all text fields, which means the type system doesn't distinguish "field was empty" from "field was absent." This is acceptable because the user-facing behavior is identical for both cases (show empty in the UI).

- **[Trade-off] Synchronous API limits concurrency** → Callers must manage their own threading for batch operations. This is acceptable because Tauri already provides a thread pool for commands, and the CLI can use `rayon` for parallelism at the application level.
