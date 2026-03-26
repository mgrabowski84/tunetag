use std::fmt;
use std::path::PathBuf;

/// Errors that can occur during tag I/O operations.
#[derive(Debug)]
pub enum TagError {
    /// The file format is not supported (not MP3, FLAC, or M4A).
    UnsupportedFormat { path: PathBuf, detail: String },
    /// The file was not found at the given path.
    FileNotFound(PathBuf),
    /// An error occurred while reading tags or audio properties.
    ReadError {
        path: PathBuf,
        source: Box<dyn std::error::Error + Send + Sync>,
    },
    /// An error occurred while writing tags.
    WriteError {
        path: PathBuf,
        source: Box<dyn std::error::Error + Send + Sync>,
    },
    /// The cover art data is invalid (not JPEG or PNG).
    InvalidCoverArt(String),
}

impl fmt::Display for TagError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TagError::UnsupportedFormat { path, detail } => {
                write!(f, "Unsupported format for {}: {}", path.display(), detail)
            }
            TagError::FileNotFound(path) => {
                write!(f, "File not found: {}", path.display())
            }
            TagError::ReadError { path, source } => {
                write!(f, "Error reading {}: {}", path.display(), source)
            }
            TagError::WriteError { path, source } => {
                write!(f, "Error writing {}: {}", path.display(), source)
            }
            TagError::InvalidCoverArt(detail) => {
                write!(f, "Invalid cover art: {}", detail)
            }
        }
    }
}

impl std::error::Error for TagError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            TagError::ReadError { source, .. } | TagError::WriteError { source, .. } => {
                Some(source.as_ref())
            }
            _ => None,
        }
    }
}
