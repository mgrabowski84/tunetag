## ADDED Requirements

### Requirement: Read tags from audio files

The system SHALL read tag data from MP3 (ID3v2), FLAC (Vorbis Comments), and M4A (MP4 atoms) files and return a unified `TagData` structure containing all supported fields.

#### Scenario: Read tags from an MP3 file with ID3v2.4 tags

- **WHEN** `read_tags` is called with a path to an MP3 file containing ID3v2.4 tags
- **THEN** the system returns a `TagData` struct with all populated fields (Title, Artist, Album, Album Artist, Year, Track, Disc, Genre, Comment) and the detected tag format set to ID3v2.4

#### Scenario: Read tags from a FLAC file with Vorbis Comments

- **WHEN** `read_tags` is called with a path to a FLAC file containing Vorbis Comments
- **THEN** the system returns a `TagData` struct with all populated fields mapped from Vorbis Comment keys

#### Scenario: Read tags from an M4A file with MP4 atoms

- **WHEN** `read_tags` is called with a path to an M4A file containing iTunes-style MP4 atom tags
- **THEN** the system returns a `TagData` struct with all populated fields mapped from MP4 atoms

#### Scenario: Read tags from a file with missing fields

- **WHEN** `read_tags` is called with a file that has only Title and Artist tags set
- **THEN** the system returns a `TagData` struct with Title and Artist populated and all other fields set to `None`

### Requirement: Write tags to audio files

The system SHALL write tag data from a `TagData` structure back to MP3, FLAC, and M4A files, updating only the tag metadata without modifying the audio stream data.

#### Scenario: Write tags to an MP3 file

- **WHEN** `write_tags` is called with a path to an MP3 file and a `TagData` struct
- **THEN** the system writes the tag fields to the file's ID3v2 tag and the audio stream data remains byte-identical

#### Scenario: Write tags to a FLAC file

- **WHEN** `write_tags` is called with a path to a FLAC file and a `TagData` struct
- **THEN** the system writes the tag fields as Vorbis Comments and the audio stream data remains byte-identical

#### Scenario: Write tags to an M4A file

- **WHEN** `write_tags` is called with a path to an M4A file and a `TagData` struct
- **THEN** the system writes the tag fields as MP4 atoms and the audio stream data remains byte-identical

#### Scenario: Write only changed fields

- **WHEN** `write_tags` is called with a `TagData` struct where some fields are `None`
- **THEN** the system SHALL NOT remove existing tags for fields set to `None`; only fields with `Some` values are written

### Requirement: Support standard tag fields

The system SHALL support reading and writing the following tag fields across all supported formats: Title, Artist, Album, Album Artist, Year, Track (number and optional total), Disc (number and optional total), Genre, and Comment.

#### Scenario: Round-trip all standard fields

- **WHEN** a `TagData` struct with all fields populated is written to a file and then read back
- **THEN** all field values MUST match the original `TagData` values exactly

#### Scenario: Track and Disc number formatting

- **WHEN** a Track or Disc field is set with a number and a total (e.g., track 3 of 12)
- **THEN** the system writes both the number and total in the format appropriate for the file's tag standard (e.g., `3/12` for ID3v2 TRCK frame, separate atoms for MP4)

### Requirement: Preserve ID3v2 version on write

The system SHALL detect the existing ID3v2 version (v2.3 or v2.4) when reading an MP3 file and write back using the same version by default. A `force_id3v2_4` option SHALL override this to always write ID3v2.4.

#### Scenario: Preserve ID3v2.3 on round-trip

- **WHEN** an MP3 file with ID3v2.3 tags is read and written back with `force_id3v2_4` set to `false`
- **THEN** the file's ID3v2 tags remain version 2.3 after the write

#### Scenario: Preserve ID3v2.4 on round-trip

- **WHEN** an MP3 file with ID3v2.4 tags is read and written back with `force_id3v2_4` set to `false`
- **THEN** the file's ID3v2 tags remain version 2.4 after the write

#### Scenario: Force upgrade to ID3v2.4

- **WHEN** an MP3 file with ID3v2.3 tags is read and written back with `force_id3v2_4` set to `true`
- **THEN** the file's ID3v2 tags are written as version 2.4

#### Scenario: Force v2.4 has no effect on non-MP3 formats

- **WHEN** a FLAC or M4A file is written with `force_id3v2_4` set to `true`
- **THEN** the system writes tags normally using the format's native tag standard (Vorbis Comments or MP4 atoms) and ignores the `force_id3v2_4` flag

### Requirement: Read embedded cover art

The system SHALL read embedded cover art from MP3, FLAC, and M4A files and return it as raw bytes with the detected image format (JPEG or PNG).

#### Scenario: Read JPEG cover art from an MP3 file

- **WHEN** `read_tags` is called on an MP3 file with an embedded JPEG front cover image
- **THEN** the returned `TagData` includes a `CoverArt` with the JPEG bytes and format set to JPEG

#### Scenario: Read PNG cover art from a FLAC file

- **WHEN** `read_tags` is called on a FLAC file with an embedded PNG front cover image
- **THEN** the returned `TagData` includes a `CoverArt` with the PNG bytes and format set to PNG

#### Scenario: No cover art present

- **WHEN** `read_tags` is called on a file with no embedded cover art
- **THEN** the returned `TagData` has `cover_art` set to `None`

### Requirement: Write embedded cover art

The system SHALL write embedded cover art (JPEG or PNG) to MP3, FLAC, and M4A files as the front cover picture type.

#### Scenario: Embed JPEG cover art into an MP3 file

- **WHEN** `write_tags` is called with a `TagData` containing a `CoverArt` with JPEG bytes
- **THEN** the system embeds the image as the front cover in the file's ID3v2 APIC frame

#### Scenario: Embed PNG cover art into a FLAC file

- **WHEN** `write_tags` is called with a `TagData` containing a `CoverArt` with PNG bytes
- **THEN** the system embeds the image as the front cover in the FLAC metadata block

#### Scenario: Remove cover art

- **WHEN** `write_tags` is called with a `TagData` where `cover_art` is explicitly set to remove
- **THEN** the system removes any existing embedded cover art from the file

### Requirement: Error handling for tag operations

The system SHALL return typed `Result` errors for all tag operations and MUST never leave a file in a corrupted state on error. If a write operation fails, the original file MUST remain intact.

#### Scenario: Read from unsupported file format

- **WHEN** `read_tags` is called with a path to a WAV or OGG file
- **THEN** the system returns an `UnsupportedFormat` error

#### Scenario: Read from non-existent file

- **WHEN** `read_tags` is called with a path that does not exist
- **THEN** the system returns a `FileNotFound` error

#### Scenario: Write fails mid-operation

- **WHEN** a write operation fails (e.g., due to permission denied or disk full)
- **THEN** the system returns a `WriteError` and the original file remains unmodified

#### Scenario: Read from file with no tags

- **WHEN** `read_tags` is called on a valid audio file that contains no tag metadata
- **THEN** the system returns a `TagData` struct with all fields set to `None` (not an error)
