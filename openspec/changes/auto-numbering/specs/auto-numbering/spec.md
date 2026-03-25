## ADDED Requirements

### Requirement: Auto-number dialog access
The system SHALL provide an "Auto-number tracks…" item in the Convert menu that opens a modal dialog. The menu item SHALL be enabled only when at least one file is selected.

#### Scenario: Open auto-number dialog
- **WHEN** the user has one or more files selected and clicks Convert → Auto-number tracks…
- **THEN** a modal dialog opens with auto-numbering options and a preview table

#### Scenario: Menu item disabled with no selection
- **WHEN** no files are selected
- **THEN** the Convert → Auto-number tracks… menu item SHALL be disabled

### Requirement: Starting track number option
The dialog SHALL provide a "Starting track number" numeric input field with a default value of 1. The minimum allowed value SHALL be 1.

#### Scenario: Default starting number
- **WHEN** the auto-number dialog opens
- **THEN** the starting track number field SHALL display 1

#### Scenario: Custom starting number
- **WHEN** the user sets the starting track number to 5 and 3 files are selected
- **THEN** the files SHALL be assigned track numbers 5, 6, and 7

#### Scenario: Invalid starting number rejected
- **WHEN** the user attempts to enter a value less than 1 or a non-numeric value
- **THEN** the input SHALL be rejected and the OK button SHALL remain disabled until a valid value is entered

### Requirement: Total tracks option
The dialog SHALL provide a "Total tracks" numeric input field. When the dialog opens, this field SHALL be auto-filled with the count of selected files. The user MAY manually override this value. The minimum allowed value SHALL be 1.

#### Scenario: Auto-filled total from selection
- **WHEN** the user opens the dialog with 12 files selected
- **THEN** the total tracks field SHALL display 12

#### Scenario: Manual total override
- **WHEN** the user changes the total tracks field to 15 while 12 files are selected
- **THEN** the total SHALL be 15 and track values SHALL use 15 as the denominator (e.g., "1/15", "2/15")

#### Scenario: Total does not cap the sequence
- **WHEN** start is 1, total is 10, and 15 files are selected
- **THEN** all 15 files SHALL receive sequential track numbers (1/10 through 15/10)

### Requirement: Track number format toggle
The dialog SHALL provide a toggle to choose between writing track numbers as "N/Total" (e.g., "3/12") or "N" only (e.g., "3"). The default format SHALL be "N/Total".

#### Scenario: N/Total format
- **WHEN** the format toggle is set to "N/Total", start is 1, and total is 12
- **THEN** the first file's track value SHALL be "1/12", the second "2/12", and so on

#### Scenario: N-only format
- **WHEN** the format toggle is set to "N" only
- **THEN** the first file's track value SHALL be "1", the second "2", and so on, with no total component

#### Scenario: Total field disabled in N-only mode
- **WHEN** the format toggle is set to "N" only
- **THEN** the total tracks input field SHALL be disabled

### Requirement: Optional disc number
The dialog SHALL provide an optional "Disc number" input field. When left empty, the system SHALL not modify the Disc field of any file. When a value is provided, the system SHALL write that disc number to all selected files.

#### Scenario: No disc number provided
- **WHEN** the disc number field is empty and the user applies auto-numbering
- **THEN** the Disc field of all selected files SHALL remain unchanged

#### Scenario: Disc number provided
- **WHEN** the user enters disc number 2
- **THEN** all selected files SHALL have their Disc field set to "2"

#### Scenario: Disc number with total format
- **WHEN** the user enters disc number 1 and total tracks format is N/Total
- **THEN** the Track field SHALL use the N/Total format and the Disc field SHALL be set to "1" (disc does not use a total format)

### Requirement: Sort order option
The dialog SHALL provide a sort order selector with two options: "File list order" (default) and "By filename". This determines the order in which sequential track numbers are assigned to the selected files.

#### Scenario: File list order
- **WHEN** sort order is "File list order"
- **THEN** files SHALL be numbered in the order they appear in the file list (respecting any active column sort)

#### Scenario: By filename order
- **WHEN** sort order is "By filename"
- **THEN** files SHALL be sorted alphabetically by filename (case-insensitive) before assigning track numbers

### Requirement: Preview table
The dialog SHALL display a preview table showing the effect of the current options on each selected file. The preview SHALL update live as the user changes any option.

#### Scenario: Preview table columns
- **WHEN** the dialog is open with no disc number set
- **THEN** the preview table SHALL show columns: #, Filename, Current Track, New Track

#### Scenario: Preview table with disc number
- **WHEN** the dialog is open with a disc number set
- **THEN** the preview table SHALL additionally show Current Disc and New Disc columns

#### Scenario: Live preview update
- **WHEN** the user changes the starting track number from 1 to 5
- **THEN** the preview table SHALL immediately update to show the new track assignments starting from 5

### Requirement: Apply auto-numbering
When the user clicks OK in the dialog, the system SHALL write the computed track numbers (and disc number, if provided) to all selected files as in-memory tag changes. The files SHALL be marked as unsaved.

#### Scenario: Successful apply
- **WHEN** the user clicks OK with valid options and 10 files selected
- **THEN** all 10 files SHALL have their Track field updated to the computed values, files SHALL be marked as unsaved, and the dialog SHALL close

#### Scenario: Cancel without changes
- **WHEN** the user clicks Cancel
- **THEN** no tag values SHALL be modified and the dialog SHALL close

### Requirement: Undo integration
Applying auto-numbering SHALL create a single entry in the undo/redo stack. Undoing this entry SHALL restore the previous Track (and Disc, if modified) values for all affected files.

#### Scenario: Undo auto-numbering
- **WHEN** the user applies auto-numbering to 10 files and then performs undo
- **THEN** all 10 files SHALL have their Track and Disc fields restored to the values they held before auto-numbering was applied, in a single undo step

#### Scenario: Redo auto-numbering
- **WHEN** the user undoes auto-numbering and then performs redo
- **THEN** the auto-numbered Track and Disc values SHALL be re-applied to all affected files

### Requirement: CLI autonumber subcommand
The CLI SHALL provide a `tunetag autonumber` subcommand that assigns sequential track numbers to the specified files. The subcommand SHALL support `--start`, `--total`, `--disc`, `--format`, and `--dry-run` flags.

#### Scenario: Basic CLI auto-numbering
- **WHEN** the user runs `tunetag autonumber file1.mp3 file2.mp3 file3.mp3 --start 1`
- **THEN** the files SHALL be written with track numbers 1/3, 2/3, and 3/3 (total defaults to file count, format defaults to n/total)

#### Scenario: CLI with custom options
- **WHEN** the user runs `tunetag autonumber *.mp3 --start 5 --total 12 --disc 1 --format n`
- **THEN** files SHALL be written with track numbers 5, 6, 7… (N-only format) and disc number 1

#### Scenario: CLI dry-run
- **WHEN** the user runs `tunetag autonumber *.mp3 --start 1 --dry-run`
- **THEN** the system SHALL print the proposed track assignments without writing any changes to disk

#### Scenario: CLI file ordering
- **WHEN** files are passed as command-line arguments
- **THEN** files SHALL be numbered in the order they appear on the command line
