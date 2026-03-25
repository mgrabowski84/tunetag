//! TuneTag Core — shared library for audio tag I/O and utilities.
//!
//! This crate provides the core functionality used by both the TuneTag GUI
//! application and the `tunetag` CLI binary.

pub mod audio_properties;
pub mod error;
pub mod tag_io;
pub mod types;

// Public API re-exports
pub use audio_properties::read_audio_properties;
pub use error::TagError;
pub use tag_io::{read_tags, remove_cover_art, write_tags};
pub use types::{AudioProperties, CoverArt, CoverArtFormat, NumberPair, TagData, TagFormat};
