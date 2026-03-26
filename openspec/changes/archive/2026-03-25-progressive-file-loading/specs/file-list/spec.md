## ADDED Requirements

### Requirement: Loading indicator shown during progressive scan
The file list SHALL display a thin loading bar above the column headers while a progressive scan is in progress.

#### Scenario: Loading bar appears when scan starts
- **WHEN** a progressive scan begins
- **THEN** a thin bar SHALL appear above the column headers containing a spinner and the text "Loading... N files" where N is the current count of loaded files

#### Scenario: Loading counter updates with each batch
- **WHEN** a `"file-batch-loaded"` event arrives and files are appended to the list
- **THEN** the loading counter in the bar SHALL update to reflect the new total count of loaded files

#### Scenario: Loading bar disappears when scan completes
- **WHEN** the `"scan-complete"` event is received
- **THEN** the loading bar SHALL be hidden

#### Scenario: File list rows are visible and interactive during loading
- **WHEN** the loading bar is visible
- **THEN** the file list rows below it SHALL be fully visible and interactive (selection, tag viewing)
