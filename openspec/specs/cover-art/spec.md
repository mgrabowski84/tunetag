## ADDED Requirements

### Requirement: Display embedded cover art
The system SHALL display the embedded cover art image in the Tag Panel when one or more files are selected. The cover art widget SHALL render the image at a fixed area within the Tag Panel. If the selected file(s) have no embedded cover art, the widget SHALL display an empty-state placeholder (e.g., a generic music note icon).

#### Scenario: Single file with cover art
- **WHEN** the user selects a single file that has embedded cover art
- **THEN** the Tag Panel SHALL display the embedded cover art image

#### Scenario: Single file without cover art
- **WHEN** the user selects a single file that has no embedded cover art
- **THEN** the Tag Panel SHALL display an empty-state placeholder in the cover art area

#### Scenario: No files selected
- **WHEN** no files are selected
- **THEN** the cover art widget SHALL display the empty-state placeholder

### Requirement: Multi-file cover art comparison
When multiple files are selected, the system SHALL perform a byte-for-byte comparison of the embedded cover art data across all selected files. If all selected files contain identical cover art (same bytes), the system SHALL display that cover art. If the cover art differs between any files, the system SHALL display a mixed-state placeholder. If no selected files have cover art, the system SHALL display the empty-state placeholder.

#### Scenario: All selected files share identical cover art
- **WHEN** the user selects multiple files that all have embedded cover art with identical byte content
- **THEN** the Tag Panel SHALL display the shared cover art image

#### Scenario: Selected files have different cover art
- **WHEN** the user selects multiple files whose embedded cover art bytes differ
- **THEN** the Tag Panel SHALL display a mixed-state placeholder (distinct from the empty-state placeholder)

#### Scenario: Some selected files have cover art and some do not
- **WHEN** the user selects multiple files where at least one has cover art and at least one does not
- **THEN** the Tag Panel SHALL display the mixed-state placeholder

#### Scenario: No selected files have cover art
- **WHEN** the user selects multiple files that all lack embedded cover art
- **THEN** the Tag Panel SHALL display the empty-state placeholder

### Requirement: Embed cover art via drag-and-drop
The system SHALL allow the user to embed cover art by dragging and dropping an image file onto the cover art area in the Tag Panel. The dropped image SHALL be embedded into all currently selected audio files. The embed operation SHALL be applied in-memory (unsaved) and follow the normal save flow.

#### Scenario: Drop a JPEG image onto cover area
- **WHEN** the user drags a JPEG file and drops it onto the cover art area
- **THEN** the system SHALL embed the image as cover art in all selected files (in-memory) and display the new cover art in the widget

#### Scenario: Drop a PNG image onto cover area
- **WHEN** the user drags a PNG file and drops it onto the cover art area
- **THEN** the system SHALL embed the image as cover art in all selected files (in-memory) and display the new cover art in the widget

#### Scenario: Drop an unsupported image format
- **WHEN** the user drags a file that is not JPEG or PNG (e.g., GIF, BMP, WebP) onto the cover art area
- **THEN** the system SHALL reject the drop and display an error message indicating only JPEG and PNG are supported

#### Scenario: Drop a non-image file
- **WHEN** the user drags a non-image file (e.g., a text file) onto the cover art area
- **THEN** the system SHALL reject the drop and display an error message

### Requirement: Supported cover art input formats
The system SHALL accept JPEG and PNG as the only supported image formats for embedding cover art. Format validation SHALL be based on file magic bytes (JPEG: `FF D8 FF`; PNG: `89 50 4E 47`), not file extension.

#### Scenario: JPEG file with correct magic bytes
- **WHEN** a file with JPEG magic bytes (`FF D8 FF`) is provided for embedding
- **THEN** the system SHALL accept the file as valid cover art

#### Scenario: PNG file with correct magic bytes
- **WHEN** a file with PNG magic bytes (`89 50 4E 47`) is provided for embedding
- **THEN** the system SHALL accept the file as valid cover art

#### Scenario: File with wrong extension but correct magic bytes
- **WHEN** a file has a `.bmp` extension but contains JPEG magic bytes
- **THEN** the system SHALL accept the file as valid cover art (magic bytes take precedence over extension)

#### Scenario: File with correct extension but wrong magic bytes
- **WHEN** a file has a `.jpg` extension but does not contain JPEG magic bytes
- **THEN** the system SHALL reject the file with an error message

### Requirement: Remove cover art
The system SHALL allow the user to remove embedded cover art from all selected files via a right-click context menu on the cover art widget. The remove operation SHALL be applied in-memory and follow the normal save flow.

#### Scenario: Remove cover art from a single file
- **WHEN** the user right-clicks the cover art widget and selects "Remove cover"
- **THEN** the system SHALL remove the cover art from the selected file (in-memory) and display the empty-state placeholder

#### Scenario: Remove cover art from multiple files
- **WHEN** the user has multiple files selected and right-clicks the cover art widget and selects "Remove cover"
- **THEN** the system SHALL remove cover art from all selected files (in-memory)

#### Scenario: Remove cover when no cover art exists
- **WHEN** the selected file(s) have no embedded cover art and the user right-clicks the cover art area
- **THEN** the "Remove cover" option SHALL be disabled or hidden in the context menu

### Requirement: Export cover art to file
The system SHALL allow the user to export the displayed cover art to a file on disk via a right-click context menu on the cover art widget. The system SHALL present a native save file dialog. The default file extension SHALL match the image's MIME type (`.jpg` for JPEG, `.png` for PNG).

#### Scenario: Export JPEG cover art
- **WHEN** the user right-clicks the cover art widget showing a JPEG image and selects "Export cover to file"
- **THEN** the system SHALL open a save dialog with a default `.jpg` extension and write the cover art bytes to the chosen path

#### Scenario: Export PNG cover art
- **WHEN** the user right-clicks the cover art widget showing a PNG image and selects "Export cover to file"
- **THEN** the system SHALL open a save dialog with a default `.png` extension and write the cover art bytes to the chosen path

#### Scenario: Export when no cover art or mixed state
- **WHEN** the cover art widget shows the empty-state or mixed-state placeholder
- **THEN** the "Export cover to file" option SHALL be disabled or hidden in the context menu

### Requirement: Cover art undo/redo integration
Cover art embed and remove operations SHALL integrate with the undo/redo stack as discrete actions. A multi-file embed or remove SHALL count as a single undo step.

#### Scenario: Undo an embed operation
- **WHEN** the user embeds cover art and then performs Undo
- **THEN** the system SHALL restore the previous cover art state (original art or no art) for all affected files

#### Scenario: Undo a remove operation
- **WHEN** the user removes cover art and then performs Undo
- **THEN** the system SHALL restore the previously embedded cover art for all affected files

#### Scenario: Redo after undoing an embed
- **WHEN** the user undoes a cover art embed and then performs Redo
- **THEN** the system SHALL re-apply the embedded cover art

### Requirement: Cover art persistence across formats
The system SHALL support reading and writing cover art for all v1 audio formats: MP3 (ID3v2), FLAC (Vorbis Comments), and M4A (MP4 atoms). The cover art type SHALL be set to "Front Cover" when embedding.

#### Scenario: Embed cover art in MP3 file
- **WHEN** the user embeds cover art in an MP3 file
- **THEN** the system SHALL write the image as a Front Cover picture in the ID3v2 tag

#### Scenario: Embed cover art in FLAC file
- **WHEN** the user embeds cover art in a FLAC file
- **THEN** the system SHALL write the image as a Front Cover picture in the Vorbis Comments metadata block

#### Scenario: Embed cover art in M4A file
- **WHEN** the user embeds cover art in an M4A file
- **THEN** the system SHALL write the image as cover art in the MP4 atoms

#### Scenario: Read cover art from any supported format
- **WHEN** the user selects a file in any supported format that has embedded cover art
- **THEN** the system SHALL read and display the cover art regardless of the audio format
