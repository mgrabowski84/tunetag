## ADDED Requirements

### Requirement: Read subcommand prints all tags

The `tunetag read <file>` subcommand SHALL read all tag fields from the specified audio file and print them to stdout. Fields with no value SHALL be omitted from output.

#### Scenario: Read tags from a fully tagged MP3 file

- **WHEN** `tunetag read track.mp3` is run on a file with Title, Artist, Album, Album Artist, Year, Track, Disc, Genre, and Comment tags set
- **THEN** the CLI prints each field as `Key=Value` on separate lines (e.g., `Title=Creep`) to stdout and exits with code 0

#### Scenario: Read tags from a file with partial tags

- **WHEN** `tunetag read track.flac` is run on a file with only Title and Artist tags set
- **THEN** the CLI prints only `Title=...` and `Artist=...` lines (omitting fields with no value) and exits with code 0

#### Scenario: Read tags from a file with no tags

- **WHEN** `tunetag read track.mp3` is run on a valid audio file with no tag metadata
- **THEN** the CLI prints nothing to stdout and exits with code 0

#### Scenario: Read tags from a non-existent file

- **WHEN** `tunetag read nonexistent.mp3` is run
- **THEN** the CLI prints an error message to stderr and exits with code 2

#### Scenario: Read tags from an unsupported format

- **WHEN** `tunetag read track.wav` is run
- **THEN** the CLI prints an error message to stderr indicating the format is not supported and exits with code 2

### Requirement: Read subcommand JSON output

When the `--json` flag is provided, `tunetag read` SHALL output tags as a JSON object to stdout.

#### Scenario: Read tags with --json flag

- **WHEN** `tunetag read track.mp3 --json` is run on a file with Title and Artist tags set
- **THEN** the CLI prints a JSON object with `"file"` and `"tags"` keys, where `"tags"` is an object mapping field names to values (e.g., `{"file": "track.mp3", "tags": {"Title": "Creep", "Artist": "Radiohead"}}`) and exits with code 0

#### Scenario: Read tags with --json flag on a file with no tags

- **WHEN** `tunetag read track.mp3 --json` is run on a file with no tag metadata
- **THEN** the CLI prints a JSON object with `"file"` and an empty `"tags"` object and exits with code 0

### Requirement: Write subcommand sets tag fields

The `tunetag write <file> [--field value ...]` subcommand SHALL write the specified tag fields to the audio file. The supported field flags SHALL be: `--title`, `--artist`, `--album`, `--albumartist`, `--year`, `--track`, `--disc`, `--genre`, `--comment`. Fields not specified on the command line SHALL NOT be modified.

#### Scenario: Write a single tag field

- **WHEN** `tunetag write track.mp3 --artist "Radiohead"` is run
- **THEN** the CLI writes the Artist tag to the file, leaving all other tags unchanged, and exits with code 0

#### Scenario: Write multiple tag fields

- **WHEN** `tunetag write track.mp3 --artist "Radiohead" --title "Creep" --year "1993"` is run
- **THEN** the CLI writes Artist, Title, and Year tags to the file, leaving other tags unchanged, and exits with code 0

#### Scenario: Write to a non-existent file

- **WHEN** `tunetag write nonexistent.mp3 --title "Test"` is run
- **THEN** the CLI prints an error to stderr and exits with code 2

#### Scenario: Write with no field flags

- **WHEN** `tunetag write track.mp3` is run with no field flags
- **THEN** the CLI prints an error to stderr indicating that at least one field must be specified and exits with code 2

#### Scenario: Clear a tag field by writing an empty value

- **WHEN** `tunetag write track.mp3 --artist ""` is run
- **THEN** the CLI clears the Artist tag from the file and exits with code 0

### Requirement: Write subcommand dry-run

When `--dry-run` is provided, `tunetag write` SHALL read the current tags, compute the diff against the proposed changes, and print the diff to stdout without modifying the file.

#### Scenario: Write dry-run shows diff

- **WHEN** `tunetag write track.mp3 --artist "Radiohead" --title "Creep" --dry-run` is run on a file where Artist is "Unknown" and Title is empty
- **THEN** the CLI prints a diff showing `Artist: "Unknown" → "Radiohead"` and `Title: "" → "Creep"` and the file remains unmodified

#### Scenario: Write dry-run with --json

- **WHEN** `tunetag write track.mp3 --artist "Radiohead" --dry-run --json` is run
- **THEN** the CLI prints a JSON array with objects containing `"file"`, `"changes"` (array of `{"field", "old", "new"}`) and the file remains unmodified

#### Scenario: Write dry-run with no changes

- **WHEN** `tunetag write track.mp3 --artist "Radiohead" --dry-run` is run on a file where Artist is already "Radiohead"
- **THEN** the CLI prints no diff output (or an empty changes list in JSON mode) and exits with code 0

### Requirement: Rename subcommand renames files from tags

The `tunetag rename <files...> --format <fmt>` subcommand SHALL rename each specified file on disk using the format string with tag placeholders resolved from the file's tags. The original file extension SHALL always be preserved. The `--format` flag SHALL be required.

#### Scenario: Rename a single file

- **WHEN** `tunetag rename track01.mp3 --format "%artist% - %title%"` is run on a file with Artist="Radiohead" and Title="Creep"
- **THEN** the file is renamed to `Radiohead - Creep.mp3` and the CLI exits with code 0

#### Scenario: Rename multiple files

- **WHEN** `tunetag rename *.mp3 --format "%track% - %title%"` is run on 3 files with sequential track numbers and titles
- **THEN** all 3 files are renamed according to their tags and the CLI prints a summary and exits with code 0

#### Scenario: Rename with missing tag value

- **WHEN** a file has no Artist tag and the format string is `%artist% - %title%`
- **THEN** the missing placeholder resolves to an empty string, producing ` - Title.mp3`

#### Scenario: Rename with filesystem-unsafe characters

- **WHEN** a file's Artist tag is `AC/DC` and the format string is `%artist% - %title%`
- **THEN** the `/` character in the resolved value SHALL be replaced with `_` (producing `AC_DC - ...`) to ensure a valid filename

### Requirement: Rename collision detection

Before executing any renames, the CLI SHALL check for filename collisions across all target files. If any two files would resolve to the same target filename, the entire batch SHALL be aborted with no files renamed. Collision detection SHALL be case-insensitive.

#### Scenario: Collision detected aborts batch

- **WHEN** `tunetag rename track1.mp3 track2.mp3 --format "%album%"` is run and both files have Album="OK Computer"
- **THEN** the CLI prints an error listing all collisions to stderr, no files are renamed, and the CLI exits with code 2

#### Scenario: Case-insensitive collision detected

- **WHEN** two files would resolve to `Creep.mp3` and `creep.mp3`
- **THEN** the CLI detects this as a collision, aborts the batch, and exits with code 2

#### Scenario: No collisions allows rename

- **WHEN** all files resolve to unique target filenames
- **THEN** the renames proceed normally

### Requirement: Rename subcommand dry-run

When `--dry-run` is provided, `tunetag rename` SHALL print the mapping of current filename to new filename for each file without performing any renames.

#### Scenario: Rename dry-run shows mapping

- **WHEN** `tunetag rename track01.mp3 track02.mp3 --format "%artist% - %title%" --dry-run` is run
- **THEN** the CLI prints `track01.mp3 → Radiohead - Creep.mp3` and `track02.mp3 → Radiohead - Everything in Its Right Place.mp3` and no files are renamed

#### Scenario: Rename dry-run with --json

- **WHEN** `tunetag rename *.mp3 --format "%title%" --dry-run --json` is run
- **THEN** the CLI prints a JSON array of objects with `"file"` and `"new_name"` keys and no files are renamed

#### Scenario: Rename dry-run detects collisions

- **WHEN** `tunetag rename *.mp3 --format "%album%" --dry-run` is run and multiple files share the same album
- **THEN** the CLI prints the collision error to stderr and exits with code 2 (same behavior as non-dry-run collision detection)

### Requirement: Cover set subcommand embeds cover art

The `tunetag cover set <file> --image <path>` subcommand SHALL read the specified image file, validate it as JPEG or PNG (via magic bytes), and embed it as front cover art in the audio file.

#### Scenario: Embed a JPEG cover image

- **WHEN** `tunetag cover set track.mp3 --image cover.jpg` is run with a valid JPEG file
- **THEN** the image is embedded as front cover art in the audio file and the CLI exits with code 0

#### Scenario: Embed a PNG cover image

- **WHEN** `tunetag cover set track.flac --image cover.png` is run with a valid PNG file
- **THEN** the image is embedded as front cover art in the audio file and the CLI exits with code 0

#### Scenario: Reject unsupported image format

- **WHEN** `tunetag cover set track.mp3 --image icon.gif` is run with a GIF file
- **THEN** the CLI prints an error to stderr indicating only JPEG and PNG are supported and exits with code 2

#### Scenario: Image file not found

- **WHEN** `tunetag cover set track.mp3 --image nonexistent.jpg` is run
- **THEN** the CLI prints an error to stderr and exits with code 2

### Requirement: Cover remove subcommand strips cover art

The `tunetag cover remove <file>` subcommand SHALL remove any embedded cover art from the audio file.

#### Scenario: Remove existing cover art

- **WHEN** `tunetag cover remove track.mp3` is run on a file with embedded cover art
- **THEN** the embedded cover art is removed from the file and the CLI exits with code 0

#### Scenario: Remove cover art from file with no cover

- **WHEN** `tunetag cover remove track.mp3` is run on a file with no embedded cover art
- **THEN** the CLI exits with code 0 (no-op, not an error)

### Requirement: Info subcommand prints audio properties

The `tunetag info <file>` subcommand SHALL read audio properties from the specified file and print them to stdout.

#### Scenario: Print audio properties for an MP3 file

- **WHEN** `tunetag info track.mp3` is run on a 320kbps MP3 file
- **THEN** the CLI prints Duration, Bitrate, Sample Rate, and Channels in human-readable format (e.g., `Duration: 3:42`, `Bitrate: 320 kbps`, `Sample Rate: 44100 Hz`, `Channels: 2`) and exits with code 0

#### Scenario: Print audio properties with --json

- **WHEN** `tunetag info track.mp3 --json` is run
- **THEN** the CLI prints a JSON object with `"file"`, `"duration_secs"`, `"bitrate_kbps"`, `"sample_rate_hz"`, and `"channels"` keys and exits with code 0

#### Scenario: Property not available

- **WHEN** `tunetag info track.mp3` is run on a VBR file where bitrate is not stored
- **THEN** the Bitrate field is omitted from output (or `null` in JSON mode)

#### Scenario: Info on non-existent file

- **WHEN** `tunetag info nonexistent.mp3` is run
- **THEN** the CLI prints an error to stderr and exits with code 2

### Requirement: Autonumber subcommand assigns track numbers

The `tunetag autonumber <files...>` subcommand SHALL assign sequential track numbers to the specified files. The default starting number SHALL be 1. The default total SHALL be the number of files provided.

#### Scenario: Autonumber with defaults

- **WHEN** `tunetag autonumber 01.mp3 02.mp3 03.mp3` is run with no additional flags
- **THEN** the files receive track numbers `1/3`, `2/3`, `3/3` (in input order) and the CLI exits with code 0

#### Scenario: Autonumber with custom start

- **WHEN** `tunetag autonumber *.mp3 --start 5` is run on 3 files
- **THEN** the files receive track numbers `5/3`, `6/3`, `7/3`

#### Scenario: Autonumber without total

- **WHEN** `tunetag autonumber *.mp3 --no-write-total` is run on 3 files
- **THEN** the files receive track numbers `1`, `2`, `3` (without `/Total`)

#### Scenario: Autonumber with custom total

- **WHEN** `tunetag autonumber *.mp3 --total 12` is run on 3 files
- **THEN** the files receive track numbers `1/12`, `2/12`, `3/12`

#### Scenario: Autonumber with disc number

- **WHEN** `tunetag autonumber *.mp3 --disc 2` is run
- **THEN** each file's disc number is set to `2` in addition to the sequential track number

#### Scenario: Autonumber with filename sort

- **WHEN** `tunetag autonumber c.mp3 a.mp3 b.mp3 --sort filename` is run
- **THEN** the files are sorted by filename before numbering: a.mp3 gets track 1, b.mp3 gets track 2, c.mp3 gets track 3

### Requirement: Exit codes

The CLI SHALL use the following exit codes for all subcommands: 0 for success (all operations completed), 1 for partial failure (some operations failed in a batch), 2 for fatal error (no operations completed, invalid arguments, or critical failure).

#### Scenario: Successful single-file operation

- **WHEN** any subcommand completes successfully on a single file
- **THEN** the CLI exits with code 0

#### Scenario: Successful batch operation

- **WHEN** a batch operation (write, rename, autonumber) completes successfully on all files
- **THEN** the CLI exits with code 0

#### Scenario: Partial batch failure

- **WHEN** a batch write operation processes 100 files and 5 fail (e.g., permission denied)
- **THEN** the CLI prints each error to stderr as it occurs, prints a summary line (e.g., `Wrote 95/100 files (5 failed)`), and exits with code 1

#### Scenario: Fatal error — no files matched

- **WHEN** a subcommand receives zero files (e.g., glob matched nothing)
- **THEN** the CLI prints an error to stderr and exits with code 2

#### Scenario: Fatal error — invalid arguments

- **WHEN** a subcommand is called with invalid or missing required arguments
- **THEN** the CLI prints an error to stderr and exits with code 2

### Requirement: Error output to stderr

All error messages SHALL be written to stderr, not stdout. This includes per-file errors during batch operations, fatal errors, and the summary line for batch operations with failures.

#### Scenario: Error goes to stderr

- **WHEN** `tunetag read nonexistent.mp3` is run
- **THEN** the error message is written to stderr and stdout is empty

#### Scenario: Batch errors interleaved with output

- **WHEN** a batch write processes files and some fail
- **THEN** successful output goes to stdout, error messages go to stderr, and the summary line goes to stderr

### Requirement: Batch operation summary line

For batch operations that process multiple files, the CLI SHALL print a summary line to stderr at completion. The summary SHALL include the count of successful and failed operations.

#### Scenario: Summary after fully successful batch

- **WHEN** `tunetag write *.mp3 --artist "Radiohead"` processes 50 files with no errors
- **THEN** the CLI prints `Wrote 50/50 files` to stderr and exits with code 0

#### Scenario: Summary after partial failure batch

- **WHEN** `tunetag rename *.mp3 --format "%title%"` processes 20 files and 3 fail
- **THEN** the CLI prints `Renamed 17/20 files (3 failed)` to stderr and exits with code 1

### Requirement: Supported format string placeholders for rename

The rename format string SHALL support the following placeholders: `%title%`, `%artist%`, `%album%`, `%year%`, `%track%`, `%disc%`, `%albumartist%`, `%genre%`. Any unrecognized placeholder SHALL be left as-is in the output filename.

#### Scenario: All placeholders resolve

- **WHEN** the format string `%track% - %artist% - %title%` is used on a file with Track=1, Artist="Radiohead", Title="Creep"
- **THEN** the resolved filename is `1 - Radiohead - Creep.mp3`

#### Scenario: Unknown placeholder left as-is

- **WHEN** the format string `%artist% - %foo%` is used
- **THEN** the resolved filename contains the literal text `%foo%`
