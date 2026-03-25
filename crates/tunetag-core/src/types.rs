use serde::{Deserialize, Serialize};
use std::time::Duration;

/// The detected tag format of an audio file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TagFormat {
    /// ID3v2.3 (MP3)
    Id3v2_3,
    /// ID3v2.4 (MP3)
    Id3v2_4,
    /// Vorbis Comments (FLAC)
    VorbisComments,
    /// MP4/iTunes atoms (M4A/AAC)
    Mp4Atoms,
}

/// A track or disc number with an optional total.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NumberPair {
    pub number: u32,
    pub total: Option<u32>,
}

impl NumberPair {
    pub fn new(number: u32, total: Option<u32>) -> Self {
        Self { number, total }
    }
}

/// Format of embedded cover art.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CoverArtFormat {
    Jpeg,
    Png,
}

/// Embedded cover art data.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoverArt {
    pub data: Vec<u8>,
    pub format: CoverArtFormat,
}

impl CoverArt {
    pub fn new(data: Vec<u8>, format: CoverArtFormat) -> Self {
        Self { data, format }
    }

    /// Detect the format from the image data's magic bytes.
    pub fn from_bytes(data: Vec<u8>) -> Option<Self> {
        let format = if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
            CoverArtFormat::Jpeg
        } else if data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
            CoverArtFormat::Png
        } else {
            return None;
        };
        Some(Self { data, format })
    }
}

/// Unified tag data across all supported formats.
///
/// All text fields are `Option<String>` — `None` means the field is absent
/// or was not read. On write, `None` fields are not touched (existing values preserved).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TagData {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub year: Option<String>,
    pub track: Option<NumberPair>,
    pub disc: Option<NumberPair>,
    pub genre: Option<String>,
    pub comment: Option<String>,
    pub cover_art: Option<CoverArt>,
    /// The detected tag format (set on read, used to preserve ID3 version on write).
    pub format: Option<TagFormat>,
}

/// Audio properties read from the audio stream (read-only, never written).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioProperties {
    pub duration: Duration,
    pub bitrate_kbps: Option<u32>,
    pub sample_rate_hz: Option<u32>,
    pub channels: Option<u8>,
}
