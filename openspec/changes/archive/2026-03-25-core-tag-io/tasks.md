## 1. Error Types and Core Data Structures

- [x] 1.1 Define `TagError` enum with variants: `UnsupportedFormat`, `FileNotFound`, `ReadError`, `WriteError`, `InvalidCoverArt` — each wrapping the underlying error source
- [x] 1.2 Define `TagData` struct with `Option<String>` fields for Title, Artist, Album, Album Artist, Year, Genre, Comment, plus `TrackNumber` and `DiscNumber` structs (number + optional total), `Option<CoverArt>`, and detected `TagFormat` enum
- [x] 1.3 Define `CoverArt` struct with `data: Vec<u8>` and `format: CoverArtFormat` enum (Jpeg, Png)
- [x] 1.4 Define `AudioProperties` struct with `duration: Duration`, `bitrate_kbps: Option<u32>`, `sample_rate_hz: Option<u32>`, `channels: Option<u8>`
- [x] 1.5 Define `TagFormat` enum representing the detected tag type (Id3v2_3, Id3v2_4, VorbisComments, Mp4Atoms) for ID3 version preservation

## 2. Tag Reading

- [x] 2.1 Implement `read_tags(path: &Path) -> Result<TagData, TagError>` that opens a file with lofty, detects format, and maps tag fields to `TagData`
- [x] 2.2 Implement ID3v2 field mapping (TRCK, TIT2, TPE1, TALB, TPE2, TDRC/TYER, TPOS, TCON, COMM frames → TagData fields)
- [x] 2.3 Implement Vorbis Comments field mapping (TITLE, ARTIST, ALBUM, ALBUMARTIST, DATE, TRACKNUMBER, DISCNUMBER, GENRE, COMMENT keys → TagData fields)
- [x] 2.4 Implement MP4 atoms field mapping (©nam, ©ART, ©alb, aART, ©day, trkn, disk, ©gen, ©cmt atoms → TagData fields)
- [x] 2.5 Detect and store ID3v2 version (v2.3 vs v2.4) in TagData's `TagFormat` field on read

## 3. Tag Writing

- [x] 3.1 Implement `write_tags(path: &Path, tags: &TagData, force_id3v2_4: bool) -> Result<(), TagError>` that writes tag fields back to the file via lofty
- [x] 3.2 Implement ID3 version preservation: pass detected version to lofty `WriteOptions` so v2.3 files stay v2.3 unless `force_id3v2_4` is true
- [x] 3.3 Handle `None` fields correctly: do not remove existing tags for fields set to `None` in `TagData`
- [x] 3.4 Implement Track/Disc number writing with proper formatting per format (N/Total for ID3v2, separate atoms for MP4)

## 4. Audio Properties

- [x] 4.1 Implement `read_audio_properties(path: &Path) -> Result<AudioProperties, TagError>` that reads duration, bitrate, sample rate, and channels from MP3, FLAC, and M4A files via lofty
- [x] 4.2 Map lofty's `FileProperties` to the `AudioProperties` domain struct, using `Option` for fields that may not be available

## 5. Cover Art

- [x] 5.1 Implement cover art reading: extract front cover `Picture` from lofty tags and map to `CoverArt` struct with detected JPEG/PNG format
- [x] 5.2 Implement cover art writing: embed `CoverArt` bytes as front cover picture in the appropriate tag format (APIC frame for ID3v2, METADATA_BLOCK_PICTURE for FLAC, covr atom for MP4)
- [x] 5.3 Implement cover art removal: clear embedded cover art when explicitly requested

## 6. Unit Tests

- [x] 6.1 Add sample audio test fixtures: minimal MP3 (ID3v2.3), MP3 (ID3v2.4), FLAC, and M4A files with known tag values and cover art
- [x] 6.2 Write tests for tag reading across all three formats verifying all fields map correctly
- [x] 6.3 Write tests for tag writing round-trip: write tags then read back and assert equality
- [x] 6.4 Write tests for ID3 version preservation: verify v2.3 stays v2.3 and v2.4 stays v2.4 after round-trip
- [x] 6.5 Write tests for force-v2.4 mode: verify v2.3 file is upgraded to v2.4 when flag is set
- [x] 6.6 Write tests for cover art read/write/remove across all formats
- [x] 6.7 Write tests for audio properties reading across all three formats
- [x] 6.8 Write tests for error cases: unsupported format, file not found, file with no tags, corrupted file

## 7. Module Structure and Exports

- [x] 7.1 Set up `tunetag-core` crate structure with `tag_io` and `audio_properties` modules, add `lofty` dependency to `Cargo.toml`
- [x] 7.2 Define public API surface in `lib.rs`: re-export `TagData`, `AudioProperties`, `TagError`, `CoverArt`, `read_tags`, `write_tags`, `read_audio_properties`
