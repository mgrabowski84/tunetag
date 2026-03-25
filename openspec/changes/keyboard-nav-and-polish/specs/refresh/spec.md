## ADDED Requirements

### Requirement: Refresh re-reads tags from disk
Pressing F5 or selecting View → Refresh SHALL re-read all tags from disk for every file currently loaded in the file list. The in-memory tag data SHALL be replaced with the freshly read data from disk. The selection state and cursor position SHALL be preserved where possible (if the previously selected file still exists after refresh, it remains selected).

#### Scenario: Refresh updates tags changed externally
- **WHEN** a file's tags were modified by an external application and the user presses F5
- **THEN** the file list and tag panel display the updated tag values from disk

#### Scenario: Refresh with no external changes
- **WHEN** no files have been modified externally and the user presses F5
- **THEN** the displayed tags remain the same (re-read produces identical data)

#### Scenario: Selection is preserved after refresh
- **WHEN** the user has files A, B, C selected and presses F5, and all three files still exist
- **THEN** files A, B, C remain selected after refresh

### Requirement: Unsaved changes prompt before refresh
If any loaded files have unsaved in-memory changes when refresh is triggered, the system SHALL display a confirmation dialog before proceeding. The dialog SHALL state: "You have unsaved changes in N files. Refresh will discard them. Continue?" with "Refresh" and "Cancel" options. Choosing "Refresh" SHALL discard all unsaved changes and proceed with the refresh. Choosing "Cancel" SHALL abort the refresh and leave all state unchanged.

#### Scenario: Refresh with unsaved changes prompts user
- **WHEN** 3 files have unsaved changes and the user presses F5
- **THEN** a dialog appears: "You have unsaved changes in 3 files. Refresh will discard them. Continue?" with "Refresh" and "Cancel" buttons

#### Scenario: User confirms refresh discards unsaved changes
- **WHEN** the unsaved changes prompt appears and the user clicks "Refresh"
- **THEN** all unsaved in-memory changes are discarded and tags are re-read from disk

#### Scenario: User cancels refresh preserves state
- **WHEN** the unsaved changes prompt appears and the user clicks "Cancel"
- **THEN** the refresh is aborted, all unsaved changes remain, and no disk reads occur

#### Scenario: Refresh with no unsaved changes skips prompt
- **WHEN** no files have unsaved changes and the user presses F5
- **THEN** the refresh proceeds immediately without showing a confirmation dialog

### Requirement: Externally deleted files removed on refresh
During a refresh, any file whose path no longer exists on disk SHALL be removed from the file list. If a removed file was selected, it SHALL be removed from the selection. If the cursor was on a removed file, the cursor SHALL move to the nearest remaining row (prefer next row; if at end, move to previous row). If all files were deleted, the file list SHALL be empty.

#### Scenario: Deleted file is removed from list
- **WHEN** file B was deleted externally and the user presses F5
- **THEN** file B is removed from the file list

#### Scenario: Deleted file was selected
- **WHEN** files A, B, C are selected, file B was deleted externally, and the user presses F5
- **THEN** after refresh, files A and C remain selected; file B is gone

#### Scenario: Cursor on deleted file moves to nearest row
- **WHEN** the cursor is on file B, file B was deleted externally, and the user presses F5
- **THEN** the cursor moves to the row that was immediately after file B (or the previous row if B was last)

#### Scenario: All files deleted externally
- **WHEN** all loaded files were deleted externally and the user presses F5
- **THEN** the file list is empty, selection is cleared, and the tag panel shows no data
