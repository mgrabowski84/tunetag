use crate::error::TagError;
use crate::types::AudioProperties;

use lofty::file::{AudioFile, FileType, TaggedFileExt};
use lofty::probe::Probe;

use std::path::Path;

/// Read audio properties (duration, bitrate, sample rate, channels) from an audio file.
pub fn read_audio_properties(path: &Path) -> Result<AudioProperties, TagError> {
    if !path.exists() {
        return Err(TagError::FileNotFound(path.to_path_buf()));
    }

    let tagged_file = Probe::open(path)
        .map_err(|e| TagError::ReadError {
            path: path.to_path_buf(),
            source: Box::new(e),
        })?
        .guess_file_type()
        .map_err(|e| TagError::ReadError {
            path: path.to_path_buf(),
            source: Box::new(e),
        })?
        .read()
        .map_err(|e| TagError::ReadError {
            path: path.to_path_buf(),
            source: Box::new(e),
        })?;

    let file_type = tagged_file.file_type();
    match file_type {
        FileType::Mpeg | FileType::Flac | FileType::Mp4 => {}
        _ => {
            return Err(TagError::UnsupportedFormat {
                path: path.to_path_buf(),
                detail: format!("{:?} is not supported", file_type),
            });
        }
    }

    let props = tagged_file.properties();

    Ok(AudioProperties {
        duration: props.duration(),
        bitrate_kbps: props.audio_bitrate(),
        sample_rate_hz: props.sample_rate(),
        channels: props.channels(),
    })
}
