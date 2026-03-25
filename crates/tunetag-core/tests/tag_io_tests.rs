use std::path::{Path, PathBuf};
use tunetag_core::*;

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn copy_fixture(name: &str, test_name: &str) -> PathBuf {
    let src = fixtures_dir().join(name);
    let dst = std::env::temp_dir().join(format!("tunetag_test_{}_{}", test_name, name));
    std::fs::copy(&src, &dst).expect("Failed to copy fixture");
    dst
}

// -----------------------------------------------------------------------
// 6.2: Tag reading across formats
// -----------------------------------------------------------------------

#[test]
fn read_tags_mp3_v24() {
    let path = fixtures_dir().join("test_v24.mp3");
    let result = read_tags(&path);
    assert!(result.is_ok(), "Failed to read MP3 v2.4: {:?}", result.err());
    let data = result.unwrap();
    assert_eq!(data.format, Some(TagFormat::Id3v2_4));
}

#[test]
fn read_tags_mp3_v23() {
    let path = fixtures_dir().join("test_v23.mp3");
    let result = read_tags(&path);
    assert!(result.is_ok(), "Failed to read MP3 v2.3: {:?}", result.err());
    let data = result.unwrap();
    assert_eq!(data.format, Some(TagFormat::Id3v2_3));
    assert_eq!(data.title.as_deref(), Some("Test V23"));
}

#[test]
fn read_tags_flac() {
    let path = fixtures_dir().join("test.flac");
    let result = read_tags(&path);
    assert!(result.is_ok(), "Failed to read FLAC: {:?}", result.err());
}

#[test]
fn read_tags_m4a() {
    let path = fixtures_dir().join("test.m4a");
    let result = read_tags(&path);
    assert!(result.is_ok(), "Failed to read M4A: {:?}", result.err());
}

// -----------------------------------------------------------------------
// 6.3: Tag writing round-trip
// -----------------------------------------------------------------------

#[test]
fn write_and_read_tags_mp3() {
    let path = copy_fixture("test_v24.mp3", "roundtrip_mp3");

    let tags = TagData {
        title: Some("Round Trip Title".into()),
        artist: Some("Round Trip Artist".into()),
        album: Some("Round Trip Album".into()),
        album_artist: Some("Round Trip AA".into()),
        year: Some("2025".into()),
        track: Some(NumberPair::new(3, Some(12))),
        disc: Some(NumberPair::new(1, Some(2))),
        genre: Some("Rock".into()),
        comment: Some("Test comment".into()),
        cover_art: None,
        format: Some(TagFormat::Id3v2_4),
    };

    write_tags(&path, &tags, false).expect("Failed to write tags");
    let read_back = read_tags(&path).expect("Failed to read back tags");

    assert_eq!(read_back.title.as_deref(), Some("Round Trip Title"));
    assert_eq!(read_back.artist.as_deref(), Some("Round Trip Artist"));
    assert_eq!(read_back.album.as_deref(), Some("Round Trip Album"));
    assert_eq!(read_back.album_artist.as_deref(), Some("Round Trip AA"));
    assert_eq!(read_back.year.as_deref(), Some("2025"));
    assert_eq!(read_back.track, Some(NumberPair::new(3, Some(12))));
    assert_eq!(read_back.disc, Some(NumberPair::new(1, Some(2))));
    assert_eq!(read_back.genre.as_deref(), Some("Rock"));
    assert_eq!(read_back.comment.as_deref(), Some("Test comment"));

    std::fs::remove_file(&path).ok();
}

#[test]
fn write_and_read_tags_flac() {
    let path = copy_fixture("test.flac", "roundtrip_flac");

    let tags = TagData {
        title: Some("FLAC Title".into()),
        artist: Some("FLAC Artist".into()),
        album: Some("FLAC Album".into()),
        genre: Some("Electronic".into()),
        format: Some(TagFormat::VorbisComments),
        ..Default::default()
    };

    write_tags(&path, &tags, false).expect("Failed to write FLAC tags");
    let read_back = read_tags(&path).expect("Failed to read back FLAC tags");

    assert_eq!(read_back.title.as_deref(), Some("FLAC Title"));
    assert_eq!(read_back.artist.as_deref(), Some("FLAC Artist"));
    assert_eq!(read_back.album.as_deref(), Some("FLAC Album"));
    assert_eq!(read_back.genre.as_deref(), Some("Electronic"));
    assert_eq!(read_back.format, Some(TagFormat::VorbisComments));

    std::fs::remove_file(&path).ok();
}

#[test]
fn write_and_read_tags_m4a() {
    let path = copy_fixture("test.m4a", "roundtrip_m4a");

    let tags = TagData {
        title: Some("M4A Title".into()),
        artist: Some("M4A Artist".into()),
        format: Some(TagFormat::Mp4Atoms),
        ..Default::default()
    };

    write_tags(&path, &tags, false).expect("Failed to write M4A tags");
    let read_back = read_tags(&path).expect("Failed to read back M4A tags");

    assert_eq!(read_back.title.as_deref(), Some("M4A Title"));
    assert_eq!(read_back.artist.as_deref(), Some("M4A Artist"));
    assert_eq!(read_back.format, Some(TagFormat::Mp4Atoms));

    std::fs::remove_file(&path).ok();
}

// -----------------------------------------------------------------------
// 6.4: ID3 version preservation
// -----------------------------------------------------------------------

#[test]
fn id3_version_preserved_v23() {
    let path = copy_fixture("test_v23.mp3", "preserve_v23");

    let tags = TagData {
        title: Some("Updated V23".into()),
        format: Some(TagFormat::Id3v2_3),
        ..Default::default()
    };

    write_tags(&path, &tags, false).expect("Failed to write v2.3 tags");
    let read_back = read_tags(&path).expect("Failed to read back");
    assert_eq!(read_back.format, Some(TagFormat::Id3v2_3));
    assert_eq!(read_back.title.as_deref(), Some("Updated V23"));

    std::fs::remove_file(&path).ok();
}

#[test]
fn id3_version_preserved_v24() {
    let path = copy_fixture("test_v24.mp3", "preserve_v24");

    let tags = TagData {
        title: Some("Updated V24".into()),
        format: Some(TagFormat::Id3v2_4),
        ..Default::default()
    };

    write_tags(&path, &tags, false).expect("Failed to write v2.4 tags");
    let read_back = read_tags(&path).expect("Failed to read back");
    assert_eq!(read_back.format, Some(TagFormat::Id3v2_4));

    std::fs::remove_file(&path).ok();
}

// -----------------------------------------------------------------------
// 6.5: Force v2.4 mode
// -----------------------------------------------------------------------

#[test]
fn force_id3v24_upgrades_v23() {
    let path = copy_fixture("test_v23.mp3", "force_v24");

    let tags = TagData {
        title: Some("Forced V24".into()),
        format: Some(TagFormat::Id3v2_3), // original was v2.3
        ..Default::default()
    };

    write_tags(&path, &tags, true).expect("Failed to force write v2.4");
    let read_back = read_tags(&path).expect("Failed to read back");
    assert_eq!(read_back.format, Some(TagFormat::Id3v2_4));

    std::fs::remove_file(&path).ok();
}

// -----------------------------------------------------------------------
// 6.6: Cover art read/write/remove
// -----------------------------------------------------------------------

#[test]
fn cover_art_write_and_read_mp3() {
    let path = copy_fixture("test_v24.mp3", "cover_write");
    let cover_path = fixtures_dir().join("cover.jpg");
    let cover_data = std::fs::read(&cover_path).expect("Failed to read cover.jpg");

    let tags = TagData {
        cover_art: Some(CoverArt::new(cover_data.clone(), CoverArtFormat::Jpeg)),
        format: Some(TagFormat::Id3v2_4),
        ..Default::default()
    };

    write_tags(&path, &tags, false).expect("Failed to write cover art");
    let read_back = read_tags(&path).expect("Failed to read back");

    assert!(read_back.cover_art.is_some());
    let cover = read_back.cover_art.unwrap();
    assert_eq!(cover.format, CoverArtFormat::Jpeg);
    assert_eq!(cover.data, cover_data);

    std::fs::remove_file(&path).ok();
}

#[test]
fn cover_art_remove() {
    let path = copy_fixture("test_v24.mp3", "cover_remove");

    // First write cover art
    let cover_path = fixtures_dir().join("cover.jpg");
    let cover_data = std::fs::read(&cover_path).expect("Failed to read cover.jpg");
    let tags = TagData {
        cover_art: Some(CoverArt::new(cover_data, CoverArtFormat::Jpeg)),
        format: Some(TagFormat::Id3v2_4),
        ..Default::default()
    };
    write_tags(&path, &tags, false).expect("Failed to write cover art");

    // Now remove it
    remove_cover_art(&path).expect("Failed to remove cover art");
    let read_back = read_tags(&path).expect("Failed to read back");
    assert!(read_back.cover_art.is_none());

    std::fs::remove_file(&path).ok();
}

// -----------------------------------------------------------------------
// 6.7: Audio properties
// -----------------------------------------------------------------------

#[test]
fn audio_properties_mp3() {
    let path = fixtures_dir().join("test_v24.mp3");
    let props = read_audio_properties(&path).expect("Failed to read MP3 properties");
    assert!(props.duration.as_millis() > 0 || props.duration.as_nanos() > 0);
}

#[test]
fn audio_properties_flac() {
    let path = fixtures_dir().join("test.flac");
    let props = read_audio_properties(&path).expect("Failed to read FLAC properties");
    assert!(props.sample_rate_hz.is_some());
    assert_eq!(props.sample_rate_hz, Some(44100));
}

#[test]
fn audio_properties_m4a() {
    let path = fixtures_dir().join("test.m4a");
    let props = read_audio_properties(&path).expect("Failed to read M4A properties");
    assert!(props.duration.as_millis() > 0 || props.sample_rate_hz.is_some());
}

// -----------------------------------------------------------------------
// 6.8: Error cases
// -----------------------------------------------------------------------

#[test]
fn error_file_not_found() {
    let path = Path::new("/nonexistent/file.mp3");
    let result = read_tags(path);
    assert!(result.is_err());
    assert!(
        matches!(result.unwrap_err(), TagError::FileNotFound(_)),
        "Expected FileNotFound error"
    );
}

#[test]
fn error_unsupported_format() {
    // Create a .wav file (unsupported)
    let path = std::env::temp_dir().join("tunetag_test_unsupported.wav");
    std::fs::write(&path, b"RIFF\x00\x00\x00\x00WAVEfmt ").expect("Failed to create WAV");

    let result = read_tags(&path);
    assert!(result.is_err());
    match result.unwrap_err() {
        TagError::UnsupportedFormat { .. } | TagError::ReadError { .. } => {} // both acceptable
        e => panic!("Expected UnsupportedFormat or ReadError, got: {:?}", e),
    }

    std::fs::remove_file(&path).ok();
}

#[test]
fn read_file_with_no_tags() {
    // The test fixtures may have no tags initially — that's fine, should return default TagData
    let path = fixtures_dir().join("test.flac");
    let result = read_tags(&path);
    assert!(result.is_ok());
}
