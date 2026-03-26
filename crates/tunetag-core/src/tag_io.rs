use crate::error::TagError;
use crate::types::*;

use lofty::config::WriteOptions;
use lofty::file::{FileType, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::Accessor;
use lofty::probe::Probe;
use lofty::tag::{ItemKey, ItemValue, Tag, TagExt, TagItem, TagType};

use std::fs;
use std::io::Read;
use std::path::Path;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/// Read tags from an audio file and return a unified `TagData`.
pub fn read_tags(path: &Path) -> Result<TagData, TagError> {
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

    // Ensure supported format
    match file_type {
        FileType::Mpeg | FileType::Flac | FileType::Mp4 => {}
        _ => {
            return Err(TagError::UnsupportedFormat {
                path: path.to_path_buf(),
                detail: format!("{:?} is not supported", file_type),
            });
        }
    }

    let tag = match tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag())
    {
        Some(t) => t,
        None => return Ok(TagData::default()),
    };

    let format = detect_tag_format(path, tag, file_type)?;
    let mut data = map_tag_to_data(tag);
    data.format = Some(format);

    Ok(data)
}

/// Detect the tag format, including ID3v2 version for MP3 files.
fn detect_tag_format(path: &Path, tag: &Tag, file_type: FileType) -> Result<TagFormat, TagError> {
    match (file_type, tag.tag_type()) {
        (FileType::Mpeg, TagType::Id3v2) => {
            // Detect ID3v2 version by reading the header bytes directly.
            // ID3v2 header: "ID3" (3 bytes) + version major (1 byte) at offset 3.
            // Version 3 = ID3v2.3, version 4 = ID3v2.4.
            let version = detect_id3v2_version(path).unwrap_or(4);
            Ok(if version == 3 {
                TagFormat::Id3v2_3
            } else {
                TagFormat::Id3v2_4
            })
        }
        (FileType::Flac, _) => Ok(TagFormat::VorbisComments),
        (FileType::Mp4, _) => Ok(TagFormat::Mp4Atoms),
        _ => Ok(TagFormat::Id3v2_4), // fallback
    }
}

/// Read the ID3v2 major version byte from the file header.
fn detect_id3v2_version(path: &Path) -> Option<u8> {
    let mut file = fs::File::open(path).ok()?;
    let mut header = [0u8; 4];
    file.read_exact(&mut header).ok()?;
    // Check "ID3" magic
    if &header[..3] == b"ID3" {
        Some(header[3])
    } else {
        None
    }
}

/// Map lofty `Tag` fields to our `TagData`.
fn map_tag_to_data(tag: &Tag) -> TagData {
    TagData {
        title: tag.title().map(|s| s.to_string()),
        artist: tag.artist().map(|s| s.to_string()),
        album: tag.album().map(|s| s.to_string()),
        album_artist: get_text_item(tag, &ItemKey::AlbumArtist),
        year: tag
            .year()
            .map(|y| y.to_string())
            .or_else(|| get_text_item(tag, &ItemKey::Year)),
        track: parse_number_pair(tag.track(), tag.track_total()),
        disc: parse_number_pair(tag.disk(), tag.disk_total()),
        genre: tag.genre().map(|s| s.to_string()),
        comment: tag.comment().map(|s| s.to_string()),
        cover_art: read_cover_art(tag),
        format: None, // set by caller
    }
}

fn get_text_item(tag: &Tag, key: &ItemKey) -> Option<String> {
    tag.get(key).and_then(|item| match item.value() {
        ItemValue::Text(t) => Some(t.to_string()),
        _ => None,
    })
}

fn parse_number_pair(number: Option<u32>, total: Option<u32>) -> Option<NumberPair> {
    number.map(|n| NumberPair::new(n, total))
}

// ---------------------------------------------------------------------------
// Cover art reading
// ---------------------------------------------------------------------------

fn read_cover_art(tag: &Tag) -> Option<CoverArt> {
    let pictures = tag.pictures();
    // Prefer front cover, fall back to first picture
    let pic = pictures
        .iter()
        .find(|p| p.pic_type() == PictureType::CoverFront)
        .or_else(|| pictures.first())?;

    let format = match pic.mime_type() {
        Some(MimeType::Jpeg) => CoverArtFormat::Jpeg,
        Some(MimeType::Png) => CoverArtFormat::Png,
        _ => {
            // Try detecting from bytes
            let data = pic.data();
            if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
                CoverArtFormat::Jpeg
            } else if data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                CoverArtFormat::Png
            } else {
                return None; // Unsupported image format
            }
        }
    };

    Some(CoverArt::new(pic.data().to_vec(), format))
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/// Write tag fields from `TagData` to an audio file.
///
/// - Fields set to `Some(value)` are written.
/// - Fields set to `None` are **not** removed from the file (existing values are preserved).
/// - `force_id3v2_4`: if true, MP3 files are always written as ID3v2.4 regardless of original version.
pub fn write_tags(path: &Path, tags: &TagData, force_id3v2_4: bool) -> Result<(), TagError> {
    if !path.exists() {
        return Err(TagError::FileNotFound(path.to_path_buf()));
    }

    let mut tagged_file = Probe::open(path)
        .map_err(|e| TagError::WriteError {
            path: path.to_path_buf(),
            source: Box::new(e),
        })?
        .guess_file_type()
        .map_err(|e| TagError::WriteError {
            path: path.to_path_buf(),
            source: Box::new(e),
        })?
        .read()
        .map_err(|e| TagError::WriteError {
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

    // Get or create the primary tag
    let tag_type = file_type.primary_tag_type();
    let tag = match tagged_file.tag_mut(tag_type) {
        Some(t) => t,
        None => {
            tagged_file.insert_tag(Tag::new(tag_type));
            tagged_file.tag_mut(tag_type).unwrap()
        }
    };

    // Apply fields — only write Some values
    apply_tag_fields(tag, tags);

    // Build write options with ID3 version preservation
    let write_options = build_write_options(tags.format, force_id3v2_4);

    tag.save_to_path(path, write_options)
        .map_err(|e| TagError::WriteError {
            path: path.to_path_buf(),
            source: e.into(),
        })?;

    Ok(())
}

fn apply_tag_fields(tag: &mut Tag, data: &TagData) {
    if let Some(ref v) = data.title {
        tag.set_title(v.clone());
    }
    if let Some(ref v) = data.artist {
        tag.set_artist(v.clone());
    }
    if let Some(ref v) = data.album {
        tag.set_album(v.clone());
    }
    if let Some(ref v) = data.album_artist {
        tag.insert(TagItem::new(
            ItemKey::AlbumArtist,
            ItemValue::Text(v.clone()),
        ));
    }
    if let Some(ref v) = data.year {
        if let Ok(y) = v.parse::<u32>() {
            tag.set_year(y);
        }
    }
    if let Some(ref np) = data.track {
        tag.set_track(np.number);
        if let Some(total) = np.total {
            tag.set_track_total(total);
        }
    }
    if let Some(ref np) = data.disc {
        tag.set_disk(np.number);
        if let Some(total) = np.total {
            tag.set_disk_total(total);
        }
    }
    if let Some(ref v) = data.genre {
        tag.set_genre(v.clone());
    }
    if let Some(ref v) = data.comment {
        tag.set_comment(v.clone());
    }

    // Cover art
    if let Some(ref cover) = data.cover_art {
        write_cover_art(tag, cover);
    }
}

fn write_cover_art(tag: &mut Tag, cover: &CoverArt) {
    // Remove existing cover art first
    tag.remove_picture_type(PictureType::CoverFront);

    let mime = match cover.format {
        CoverArtFormat::Jpeg => MimeType::Jpeg,
        CoverArtFormat::Png => MimeType::Png,
    };

    let pic = Picture::new_unchecked(
        PictureType::CoverFront,
        Some(mime),
        None,
        cover.data.clone(),
    );
    tag.push_picture(pic);
}

/// Remove all cover art from a file.
pub fn remove_cover_art(path: &Path) -> Result<(), TagError> {
    if !path.exists() {
        return Err(TagError::FileNotFound(path.to_path_buf()));
    }

    let mut tagged_file = Probe::open(path)
        .map_err(|e| TagError::WriteError {
            path: path.to_path_buf(),
            source: Box::new(e),
        })?
        .guess_file_type()
        .map_err(|e| TagError::WriteError {
            path: path.to_path_buf(),
            source: Box::new(e),
        })?
        .read()
        .map_err(|e| TagError::WriteError {
            path: path.to_path_buf(),
            source: Box::new(e),
        })?;

    let file_type = tagged_file.file_type();
    let tag_type = file_type.primary_tag_type();

    if let Some(tag) = tagged_file.tag_mut(tag_type) {
        tag.remove_picture_type(PictureType::CoverFront);
        // Also remove Other and any other picture types
        while !tag.pictures().is_empty() {
            tag.remove_picture(0);
        }

        let write_options = WriteOptions::new();
        tag.save_to_path(path, write_options)
            .map_err(|e| TagError::WriteError {
                path: path.to_path_buf(),
                source: e.into(),
            })?;
    }

    Ok(())
}

fn build_write_options(format: Option<TagFormat>, force_id3v2_4: bool) -> WriteOptions {
    let mut options = WriteOptions::new();

    if force_id3v2_4 {
        // Default is v2.4, so nothing to change
        return options;
    }

    // Preserve original version
    if let Some(TagFormat::Id3v2_3) = format {
        options.use_id3v23(true);
    }

    options
}
