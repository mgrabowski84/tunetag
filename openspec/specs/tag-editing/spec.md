## ADDED Requirements

### Requirement: Tag panel displays fields for selected files
The tag panel SHALL be a persistent sidebar that displays editable fields for the currently selected file(s) in the file list. The fields SHALL be: Title, Artist, Album, Album Artist, Year, Track, Disc, Genre, and Comment.

#### Scenario: Single file selected
- **WHEN** the user selects a single file in the file list
- **THEN** the tag panel displays that file's tag values in the corresponding fields

#### Scenario: No files selected
- **WHEN** no files are selected in the file list
- **THEN** the tag panel fields SHALL be empty and disabled

#### Scenario: Fields match PRD tag panel definition
- **WHEN** the tag panel is rendered
- **THEN** it SHALL display exactly these fields: Title (text), Artist (text), Album (text), Album Artist (text), Year (text), Track (text), Disc (text), Genre (text with autocomplete), Comment (multiline text)

### Requirement: Multi-file editing with shared and differing values
When multiple files are selected, the tag panel SHALL display a merged view of tag values across all selected files.

#### Scenario: All selected files share the same value for a field
- **WHEN** two or more files are selected
- **AND** all selected files have the same value for a given field
- **THEN** the tag panel SHALL display that shared value in the field

#### Scenario: Selected files have differing values for a field
- **WHEN** two or more files are selected
- **AND** the selected files have different values for a given field
- **THEN** the tag panel SHALL display the `<keep>` placeholder in that field

#### Scenario: Editing a field with keep placeholder
- **WHEN** a field displays the `<keep>` placeholder
- **AND** the user begins typing in that field
- **THEN** the `<keep>` placeholder SHALL be cleared and replaced with the user's input

### Requirement: Save writes edited values to selected files
The save command (Ctrl/Cmd+S) SHALL write tag changes to the currently selected files via lofty.

#### Scenario: Save explicit value to all selected files
- **WHEN** the user has entered an explicit value in a tag field
- **AND** the user triggers save
- **THEN** that value SHALL be written to all selected files

#### Scenario: Keep placeholder fields are not written on save
- **WHEN** a field still displays the `<keep>` placeholder (user did not edit it)
- **AND** the user triggers save
- **THEN** that field SHALL NOT be modified on any selected file

#### Scenario: Explicit blank clears field on all files
- **WHEN** the user explicitly clears a tag field (empty string)
- **AND** the user triggers save
- **THEN** that field SHALL be cleared on all selected files

#### Scenario: Save via keyboard shortcut
- **WHEN** the user presses Ctrl+S (Windows/Linux) or Cmd+S (macOS)
- **THEN** the save command SHALL execute for the currently selected files

### Requirement: Genre field has autocomplete from ID3v1 genre list
The genre field SHALL provide autocomplete suggestions from the full ID3v1 genre list (80 original + Winamp extensions, 192 total genres).

#### Scenario: Genre autocomplete filters as user types
- **WHEN** the user types in the genre field
- **THEN** a dropdown SHALL appear showing genres matching the typed text (case-insensitive substring match)

#### Scenario: Genre accepts free text
- **WHEN** the user types a value not in the ID3v1 genre list
- **THEN** the system SHALL accept the value as-is (the autocomplete list is a suggestion, not a constraint)

#### Scenario: Genre selected from autocomplete
- **WHEN** the user selects a genre from the autocomplete dropdown
- **THEN** the genre field SHALL be populated with the selected genre name

### Requirement: Unsaved changes indicator
The application SHALL indicate when files have unsaved tag changes.

#### Scenario: Window title shows asterisk when changes exist
- **WHEN** one or more files have unsaved tag changes
- **THEN** the window title SHALL display an asterisk prefix (e.g., `*TuneTag`)

#### Scenario: Window title clears asterisk after save
- **WHEN** all unsaved changes have been saved
- **THEN** the window title SHALL no longer display the asterisk

#### Scenario: Per-file unsaved indicator in file list
- **WHEN** a file has unsaved tag changes
- **THEN** the file list SHALL display a visual indicator on that file's row

#### Scenario: Per-file indicator clears after save
- **WHEN** a file's tag changes are successfully saved
- **THEN** the per-file unsaved indicator SHALL be removed from that file's row

### Requirement: Prompt on close with unsaved changes
The application SHALL prompt the user before closing if there are unsaved tag changes.

#### Scenario: Close with unsaved changes
- **WHEN** the user attempts to close the application window
- **AND** one or more files have unsaved tag changes
- **THEN** the application SHALL display a confirmation dialog asking whether to discard changes or cancel

#### Scenario: Close with no unsaved changes
- **WHEN** the user attempts to close the application window
- **AND** no files have unsaved tag changes
- **THEN** the application SHALL close without prompting

### Requirement: Batch save error handling
When saving tags to multiple files, the system SHALL skip files that fail and continue with remaining files.

#### Scenario: All files save successfully
- **WHEN** the user saves tags for multiple files
- **AND** all files save successfully
- **THEN** all files SHALL be marked as saved and their unsaved indicators removed

#### Scenario: Some files fail during batch save
- **WHEN** the user saves tags for multiple files
- **AND** one or more files fail to save
- **THEN** the system SHALL continue saving remaining files
- **AND** after completion, display an error report dialog showing "Saved N/M files. K files failed:" with a table of filename and error reason

#### Scenario: Failed files remain marked as unsaved
- **WHEN** a file fails to save during a batch operation
- **THEN** that file SHALL remain marked as having unsaved changes
- **AND** the user can attempt to save it again

### Requirement: Tag panel reacts to selection changes
The tag panel SHALL update its displayed values whenever the file list selection changes.

#### Scenario: Selection changes to a different file
- **WHEN** the user changes selection from one file to another
- **THEN** the tag panel SHALL display the newly selected file's tag values (including any unsaved edits for that file)

#### Scenario: Selection changes to multiple files
- **WHEN** the user extends selection to include multiple files
- **THEN** the tag panel SHALL recompute and display the merged view of all selected files

#### Scenario: Edits are preserved when selection changes
- **WHEN** the user edits a tag field for file A
- **AND** then selects file B (without saving)
- **AND** then reselects file A
- **THEN** the tag panel SHALL display file A's edited (unsaved) values
