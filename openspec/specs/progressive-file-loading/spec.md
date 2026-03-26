## ADDED Requirements

### Requirement: scan_paths_progressive streams file entries via Tauri events
The system SHALL provide a `scan_paths_progressive` Tauri command that accepts the same inputs as `scan_paths` but returns immediately and emits file data to the frontend via named Tauri events.

#### Scenario: Command returns immediately
- **WHEN** `scan_paths_progressive` is invoked with a folder path
- **THEN** it SHALL return `Ok(())` without waiting for any files to be read

#### Scenario: file-batch-loaded events are emitted during scan
- **WHEN** files are being scanned in the background
- **THEN** the system SHALL emit `"file-batch-loaded"` events with payload `{ scanId: u64, entries: Vec<FileEntry> }` as files are read

#### Scenario: Batches contain up to 20 entries
- **WHEN** files are read during a progressive scan
- **THEN** each `"file-batch-loaded"` event SHALL contain at most 20 `FileEntry` objects

#### Scenario: Time-based flush emits partial batches
- **WHEN** fewer than 20 files have accumulated but 100ms have elapsed since the last flush
- **THEN** the system SHALL emit a `"file-batch-loaded"` event with the accumulated entries (even if fewer than 20)

#### Scenario: scan-complete event fires when done
- **WHEN** all files in the scan have been processed
- **THEN** the system SHALL emit a `"scan-complete"` event with payload `{ scanId: u64, total: usize }`

### Requirement: Stale scan events are discarded on the frontend
The frontend SHALL track a `scanId` and discard events from superseded scans.

#### Scenario: New scan supersedes old scan
- **WHEN** the user opens a second folder before the first scan completes
- **THEN** events from the first scan SHALL be discarded by the frontend

#### Scenario: Current scan events are processed
- **WHEN** a `"file-batch-loaded"` event arrives with a matching `scanId`
- **THEN** the frontend SHALL append the entries to the file list

### Requirement: Loading times out if scan-complete never arrives
The frontend SHALL clear the loading state after 60 seconds if `scan-complete` is never received.

#### Scenario: Timeout clears loading indicator
- **WHEN** 60 seconds pass after a progressive scan starts without a `scan-complete` event
- **THEN** the loading indicator SHALL be hidden and `scanning` state SHALL be set to false
