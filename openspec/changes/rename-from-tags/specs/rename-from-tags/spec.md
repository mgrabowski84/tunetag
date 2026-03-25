## ADDED Requirements

### Requirement: Format string parsing
The system SHALL parse format strings containing `%placeholder%` tokens, where each token is a tag field name enclosed in percent signs. The parser SHALL recognize the following placeholders: `%title%`, `%artist%`, `%album%`, `%year%`, `%track%`, `%disc%`, `%albumartist%`, `%genre%`. Any text not enclosed in `%` delimiters SHALL be treated as literal text and included in the output unchanged. Unrecognized placeholders (e.g., `%foo%`) SHALL be left as literal text in the output.

#### Scenario: Format string with two placeholders and literal separator
- **WHEN** the format string is `%artist% - %title%`
- **THEN** the parser SHALL produce a parsed representation with three segments: placeholder `artist`, literal ` - `, placeholder `title`

#### Scenario: Format string with only literal text
- **WHEN** the format string is `my_song`
- **THEN** the parser SHALL produce a single literal segment `my_song`

#### Scenario: Format string with unrecognized placeholder
- **WHEN** the format string is `%artist% - %foo%`
- **THEN** the parser SHALL treat `%foo%` as literal text and produce: placeholder `artist`, literal ` - %foo%`

#### Scenario: Format string with all supported placeholders
- **WHEN** the format string is `%track% %disc% %title% %artist% %album% %year% %albumartist% %genre%`
- **THEN** the parser SHALL recognize all eight as valid placeholders

### Requirement: Placeholder resolution against tag values
The system SHALL resolve each placeholder in a parsed format string by substituting the corresponding tag field value from the audio file. If a tag field is empty or missing, the placeholder SHALL resolve to an empty string. The `%track%` and `%disc%` placeholders SHALL resolve to the numeric part only (e.g., `3` from `3/12`).

#### Scenario: All placeholders have values
- **WHEN** the format string is `%artist% - %title%` and the file has Artist=`Radiohead` and Title=`Creep`
- **THEN** the resolved filename SHALL be `Radiohead - Creep`

#### Scenario: A placeholder has no value
- **WHEN** the format string is `%artist% - %title%` and the file has Artist=`` (empty) and Title=`Creep`
- **THEN** the resolved filename SHALL be ` - Creep`

#### Scenario: Track number with total
- **WHEN** the format string is `%track% %title%` and the file has Track=`3/12` and Title=`Song`
- **THEN** the resolved filename SHALL be `3 Song`

#### Scenario: All tags missing
- **WHEN** the format string is `%artist% - %title%` and the file has no Artist or Title tags
- **THEN** the resolved filename SHALL be ` - `

### Requirement: Filename sanitization
The system SHALL sanitize resolved filenames by replacing characters that are invalid on the current operating system's filesystem. The original file extension SHALL be preserved and appended to the sanitized name. If the sanitized name is empty, the system SHALL use a fallback name. Leading and trailing whitespace and dots SHALL be trimmed. Consecutive whitespace SHALL be collapsed to a single space.

#### Scenario: Filename with slash character
- **WHEN** the resolved name contains a `/` character (e.g., `AC/DC - Thunderstruck`)
- **THEN** the system SHALL replace `/` with `_` producing `AC_DC - Thunderstruck`

#### Scenario: Filename with Windows-illegal characters
- **WHEN** running on Windows and the resolved name contains `*` or `?` characters
- **THEN** the system SHALL replace those characters with `_`

#### Scenario: Empty resolved name
- **WHEN** all placeholders resolve to empty strings and no literal text remains after trimming
- **THEN** the system SHALL use a fallback name (e.g., `untitled`) with the original file extension

#### Scenario: File extension preserved
- **WHEN** the original file is `track01.mp3` and the resolved name is `Radiohead - Creep`
- **THEN** the final filename SHALL be `Radiohead - Creep.mp3`

#### Scenario: Leading and trailing whitespace
- **WHEN** the resolved name is `  Radiohead - Creep  `
- **THEN** the system SHALL trim it to `Radiohead - Creep`

### Requirement: Live preview
The system SHALL display a live preview of the resolved filename for the first selected file as the user types in the format string input field. The preview SHALL update in real time (with debouncing) and show the full resolved filename including the file extension.

#### Scenario: User types a format string with one selected file
- **WHEN** the user types `%artist% - %title%` in the format input and one file is selected with Artist=`Radiohead` and Title=`Creep` and extension `.mp3`
- **THEN** the preview SHALL display `Radiohead - Creep.mp3`

#### Scenario: User modifies the format string
- **WHEN** the user changes the format string from `%artist% - %title%` to `%track% - %title%`
- **THEN** the preview SHALL update to reflect the new format string

#### Scenario: Empty format string
- **WHEN** the format string is empty
- **THEN** the preview SHALL display the fallback name with the original extension

### Requirement: Dry run preview
The system SHALL support a dry-run mode that resolves the format string for all selected files and displays a table of original filename to new filename mappings without modifying any files. The dry run SHALL include collision detection and permission pre-check results.

#### Scenario: Dry run with no conflicts
- **WHEN** the user triggers a dry-run preview for 5 selected files and all resolve to unique names
- **THEN** the system SHALL display a table with 5 rows showing `original_name → new_name` for each file

#### Scenario: Dry run with collisions detected
- **WHEN** the user triggers a dry-run preview and two files resolve to the same name
- **THEN** the system SHALL display the preview table AND a collision error listing the conflicting files

#### Scenario: Dry run via CLI
- **WHEN** the user runs `tunetag rename --format "%artist% - %title%" --dry-run`
- **THEN** the system SHALL print `original_name → new_name` for each file to stdout without renaming any files

### Requirement: Collision detection
The system SHALL detect name collisions before executing any renames. If any two or more files in the same directory would resolve to the same target filename, the system SHALL abort the entire batch and report all conflicting files. On case-insensitive filesystems (macOS, Windows), collision detection SHALL compare filenames case-insensitively.

#### Scenario: Two files resolve to the same name
- **WHEN** two selected files in the same directory both resolve to `Radiohead - Creep.mp3`
- **THEN** the system SHALL abort the batch, rename zero files, and report both files as conflicting

#### Scenario: Case-insensitive collision on macOS
- **WHEN** on a case-insensitive filesystem, one file resolves to `Song.mp3` and another to `song.mp3`
- **THEN** the system SHALL detect this as a collision and abort the batch

#### Scenario: Same name in different directories
- **WHEN** two files in different directories both resolve to `Creep.mp3`
- **THEN** the system SHALL NOT treat this as a collision (files are in separate directories)

#### Scenario: File resolves to its own current name
- **WHEN** a file named `Radiohead - Creep.mp3` resolves to the target name `Radiohead - Creep.mp3`
- **THEN** the system SHALL skip this file (no-op rename) and NOT count it as a collision

### Requirement: Rename pre-checks
Before executing any renames, the system SHALL verify write permissions on all target directories. If any directory is not writable, the system SHALL abort the entire batch and report which directories lack write permissions. Pre-checks SHALL run after collision detection — both must pass before any file is renamed.

#### Scenario: All directories writable
- **WHEN** all selected files reside in directories where the user has write permissions
- **THEN** the pre-check SHALL pass and the system SHALL proceed with renaming

#### Scenario: One directory not writable
- **WHEN** one selected file resides in a directory without write permission
- **THEN** the system SHALL abort the entire batch and report the unwritable directory

#### Scenario: Pre-checks run after collision detection
- **WHEN** the user initiates a rename
- **THEN** the system SHALL first check for collisions, then check permissions — if collisions exist, permission checks are not required

### Requirement: Batch rename execution
The system SHALL rename all selected files on disk by applying the resolved format string. Renames SHALL only execute after pre-checks (collision detection and permission verification) pass. The system SHALL apply renames to all selected files in a single batch operation.

#### Scenario: Successful batch rename
- **WHEN** 10 files are selected, the format string resolves to unique names, and all pre-checks pass
- **THEN** the system SHALL rename all 10 files on disk to their resolved names

#### Scenario: File list updates after rename
- **WHEN** files are successfully renamed
- **THEN** the file list in the GUI SHALL update to reflect the new filenames and paths

### Requirement: Batch rename error handling
If a file rename fails at runtime (after pre-checks have passed), the system SHALL skip the failed file and continue renaming remaining files. After all renames complete, the system SHALL report successes and failures.

#### Scenario: One file fails during batch rename
- **WHEN** 10 files are being renamed and the 3rd file fails (e.g., file locked by another process)
- **THEN** the system SHALL skip the 3rd file, continue renaming files 4–10, and report that 9/10 files were renamed with 1 failure

#### Scenario: GUI error reporting
- **WHEN** a batch rename completes with errors
- **THEN** the GUI SHALL display a modal showing the count of successes and failures, with a table listing each failed file and its error reason

#### Scenario: CLI error reporting
- **WHEN** a batch rename completes with errors in CLI mode
- **THEN** errors SHALL be printed to stderr as they occur, with a summary line at the end (e.g., `Renamed 9/10 files (1 failed)`), and the exit code SHALL be `1`

### Requirement: Rename dialog access
The rename dialog SHALL be accessible from the Convert menu as "Rename Files from Tags…". The menu item SHALL be enabled only when one or more files are selected.

#### Scenario: Open rename dialog from menu
- **WHEN** the user has files selected and clicks Convert → "Rename Files from Tags…"
- **THEN** the system SHALL open the rename modal dialog

#### Scenario: No files selected
- **WHEN** no files are selected in the file list
- **THEN** the Convert → "Rename Files from Tags…" menu item SHALL be disabled
