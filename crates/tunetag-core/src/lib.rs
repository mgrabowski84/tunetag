//! TuneTag Core — shared library for audio tag I/O and utilities.
//!
//! This crate provides the core functionality used by both the TuneTag GUI
//! application and the `tunetag` CLI binary.

pub mod audio_properties;
pub mod batch;
pub mod error;
pub mod rename;
pub mod tag_io;
pub mod types;

// Public API re-exports
pub use audio_properties::read_audio_properties;
pub use batch::{save_tags_batch, SaveError, SaveResult, TagUpdate};
pub use error::TagError;
pub use rename::{
    execute_renames, parse_format, plan_renames, resolve_filename, RenamePreview, RenameResult,
};
pub use tag_io::{read_tags, remove_cover_art, write_tags};
pub use types::{AudioProperties, CoverArt, CoverArtFormat, NumberPair, TagData, TagFormat};
