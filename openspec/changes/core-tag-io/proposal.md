## Why

TuneTag's GUI and CLI both need to read and write audio tags and read audio properties — but no shared Rust library exists yet. The `tunetag-core` crate needs a tag I/O module that wraps lofty to provide a unified API for MP3 (ID3v2), FLAC (Vorbis Comments), and M4A (MP4 atoms), including ID3 version preservation so existing v2.3 tags are not silently upgraded to v2.4.

## What Changes

- Add a `tag-io` module to `tunetag-core` that reads and writes audio tags across MP3, FLAC, and M4A formats via lofty
- Support all v1 tag fields: Title, Artist, Album, Album Artist, Year, Track, Disc, Genre, Comment, and embedded cover art (JPEG/PNG)
- Preserve ID3v2 version on write (v2.3 stays v2.3, v2.4 stays v2.4) with an optional force-v2.4 mode
- Add an `audio-properties` module that reads duration, bitrate, sample rate, and channel count as structured Rust types
- Define error types that surface lofty errors as domain-specific `Result` types — never corrupt audio data on failure

## Capabilities

### New Capabilities

- `tag-io`: Read and write audio tags (Title, Artist, Album, Album Artist, Year, Track, Disc, Genre, Comment, cover art) for MP3/ID3v2, FLAC/Vorbis Comments, and M4A/MP4 atoms with ID3 version preservation
- `audio-properties`: Read audio metadata (duration, bitrate, sample rate, channels) from MP3, FLAC, and M4A files as structured Rust types

### Modified Capabilities

_None — these are the first capabilities in the project._

## Impact

- **New crate code:** `tunetag-core/src/tag_io/` and `tunetag-core/src/audio_properties/` modules
- **New dependency:** `lofty` crate added to `tunetag-core/Cargo.toml`
- **API surface:** Public Rust API consumed by both the Tauri GUI backend and the CLI binary
- **No breaking changes:** This is greenfield — no existing consumers yet
- **Audio data integrity:** Tag writes use lofty's safe write path; errors return `Result::Err` without partial writes
