## ADDED Requirements

### Requirement: Read audio properties from supported formats

The system SHALL read audio properties from MP3, FLAC, and M4A files and return them as a structured `AudioProperties` type containing duration, bitrate, sample rate, and channel count.

#### Scenario: Read properties from an MP3 file

- **WHEN** `read_audio_properties` is called with a path to a valid MP3 file
- **THEN** the system returns an `AudioProperties` struct with duration (as `std::time::Duration`), bitrate in kbps, sample rate in Hz, and channel count

#### Scenario: Read properties from a FLAC file

- **WHEN** `read_audio_properties` is called with a path to a valid FLAC file
- **THEN** the system returns an `AudioProperties` struct with duration, bitrate, sample rate, and channel count

#### Scenario: Read properties from an M4A file

- **WHEN** `read_audio_properties` is called with a path to a valid M4A file
- **THEN** the system returns an `AudioProperties` struct with duration, bitrate, sample rate, and channel count

#### Scenario: Handle missing property fields

- **WHEN** a file does not expose a specific property (e.g., VBR file without a stored bitrate)
- **THEN** the corresponding field in `AudioProperties` SHALL be `None` rather than a default or estimated value

### Requirement: Return structured types not raw lofty types

The system SHALL return audio properties as tunetag-core domain types (`AudioProperties` struct). Lofty types MUST NOT appear in the public API.

#### Scenario: Public API type independence

- **WHEN** a consumer calls `read_audio_properties`
- **THEN** the return type is `Result<AudioProperties, TagError>` where `AudioProperties` is defined in `tunetag-core`, not re-exported from lofty

### Requirement: Error handling for audio property reading

The system SHALL return typed `Result` errors when audio properties cannot be read.

#### Scenario: Read properties from unsupported format

- **WHEN** `read_audio_properties` is called with a path to an unsupported file format (e.g., WAV, OGG)
- **THEN** the system returns an `UnsupportedFormat` error

#### Scenario: Read properties from non-existent file

- **WHEN** `read_audio_properties` is called with a path that does not exist
- **THEN** the system returns a `FileNotFound` error

#### Scenario: Read properties from corrupted file

- **WHEN** `read_audio_properties` is called with a file that has a corrupted audio stream
- **THEN** the system returns a `ReadError` with details about the failure
