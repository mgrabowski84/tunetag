use clap::{Parser, Subcommand};
use std::path::PathBuf;

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
        /// Path to the audio file
        file: PathBuf,

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

        /// Disc number to write to all files
        #[arg(long)]
        disc: Option<u32>,
    },
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

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Command::Read { file } => {
            eprintln!("tunetag read: not yet implemented (file: {})", file.display());
        }
        Command::Write { file, .. } => {
            eprintln!("tunetag write: not yet implemented (file: {})", file.display());
        }
        Command::Rename { files, format } => {
            eprintln!(
                "tunetag rename: not yet implemented ({} files, format: \"{}\")",
                files.len(),
                format
            );
        }
        Command::Cover { action } => match action {
            CoverAction::Set { file, image } => {
                eprintln!(
                    "tunetag cover set: not yet implemented (file: {}, image: {})",
                    file.display(),
                    image.display()
                );
            }
            CoverAction::Remove { file } => {
                eprintln!(
                    "tunetag cover remove: not yet implemented (file: {})",
                    file.display()
                );
            }
        },
        Command::Info { file } => {
            eprintln!("tunetag info: not yet implemented (file: {})", file.display());
        }
        Command::Autonumber {
            files,
            start,
            total,
            disc,
        } => {
            eprintln!(
                "tunetag autonumber: not yet implemented ({} files, start: {}, total: {:?}, disc: {:?})",
                files.len(),
                start,
                total,
                disc
            );
        }
    }
}
