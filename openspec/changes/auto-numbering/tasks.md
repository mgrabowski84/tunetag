## 1. Numbering Logic

- [ ] 1.1 Implement the core numbering function that takes a sorted list of file IDs, start number, total, format (N/Total or N), and optional disc number, and returns a map of file ID → { track: string, disc?: string }
- [ ] 1.2 Add input validation: start ≥ 1, total ≥ 1, disc ≥ 1 (if provided)
- [ ] 1.3 Unit test the numbering function: default options, custom start, N-only format, disc number, total override, edge case where file count exceeds total

## 2. Auto-Number Command (Undo Integration)

- [ ] 2.1 Implement `AutoNumberCommand` conforming to the `Command` interface — captures before/after Track and Disc values for all affected files
- [ ] 2.2 `apply()` writes the computed track/disc values to editor state for all affected files
- [ ] 2.3 `undo()` restores the previous track/disc values from the before-snapshot
- [ ] 2.4 Unit test AutoNumberCommand: apply sets correct values, undo restores previous values, redo re-applies

## 3. Auto-Number Dialog Component

- [ ] 3.1 Create the modal dialog component with form controls: starting track number input, total tracks input, N/Total vs N-only toggle, disc number input, sort order selector (file list order / by filename)
- [ ] 3.2 Implement default values on open: start=1, total=selection count, format=N/Total, disc=empty, sort=file list order
- [ ] 3.3 Implement the "by filename" sort — case-insensitive alphabetical sort of selected files by filename
- [ ] 3.4 Disable the total tracks field when format is set to N-only
- [ ] 3.5 Implement the preview table showing #, Filename, Current Track, New Track (plus Current Disc, New Disc when disc is set)
- [ ] 3.6 Wire live preview updates — recompute preview on every option change
- [ ] 3.7 Implement OK button: create and execute `AutoNumberCommand` via the undo stack, then close the dialog
- [ ] 3.8 Implement Cancel button: close the dialog with no changes

## 4. Menu Integration

- [ ] 4.1 Add "Auto-number tracks…" item to the Convert menu
- [ ] 4.2 Gate the menu item's enabled state on having at least one file selected
- [ ] 4.3 Wire the menu item to open the auto-number dialog, passing the current selection and file list order

## 5. CLI Subcommand

- [ ] 5.1 Add the `autonumber` subcommand to the CLI with arguments: files (positional), `--start`, `--total`, `--disc`, `--format` (n/total or n), `--dry-run`
- [ ] 5.2 Implement the CLI numbering flow: read existing tags, compute new values using the shared numbering logic, write tags via lofty (or print preview for --dry-run)
- [ ] 5.3 Support `--dry-run` output: print current → new track (and disc) for each file; with `--json`, output structured JSON
- [ ] 5.4 Handle errors: skip-and-continue for batch write failures, print summary with exit code 1 for partial failure

## 6. Testing

- [ ] 6.1 Integration test: open dialog with selected files, verify preview table matches expected numbering
- [ ] 6.2 Integration test: apply auto-numbering, verify files are marked unsaved with correct track values
- [ ] 6.3 Integration test: apply auto-numbering → undo → verify original track/disc values restored → redo → verify re-applied
- [ ] 6.4 Integration test: CLI `autonumber --dry-run` prints correct preview without modifying files
- [ ] 6.5 Integration test: CLI `autonumber` writes correct track/disc values to files on disk
