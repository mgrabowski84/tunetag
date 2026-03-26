## MODIFIED Requirements

### Requirement: Open folder uses progressive loading
The Open Folder action SHALL use `scan_paths_progressive` instead of `scan_paths` so that files appear in the list as they are read rather than all at once.

#### Scenario: Open Folder triggers progressive scan
- **WHEN** the user opens a folder via File → Open Folder or drag-and-drop
- **THEN** the file list SHALL be cleared immediately
- **AND** a progressive scan SHALL start, with files appearing in the list as batches arrive

#### Scenario: Open Files uses progressive loading for consistency
- **WHEN** the user opens individual files via File → Open Files
- **THEN** the same progressive flow SHALL be used (even for small selections, for consistency)

#### Scenario: User can interact with loaded files during scan
- **WHEN** a progressive scan is in progress and some files have already loaded
- **THEN** the user SHALL be able to select, view tags, and edit tags on the already-loaded files while scanning continues

#### Scenario: Opening a new folder cancels the display of old scan results
- **WHEN** the user opens a new folder while a previous scan is still in progress
- **THEN** the file list SHALL clear and show only the new scan's results
- **AND** events from the previous scan SHALL be discarded
