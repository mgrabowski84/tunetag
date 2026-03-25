## Why

Users need to rename audio files on disk based on their tag values — a fundamental workflow for organizing music libraries. The PRD (§7.4) specifies this as a core v1 feature, accessible from the Convert menu and CLI. Without it, users must manually rename files or use external tools, breaking the all-in-one tagging workflow that TuneTag aims to provide.

## What Changes

- Add a format string parser in the Rust backend that resolves `%placeholder%` tokens against tag values to produce filenames
- Add a "Rename Files from Tags" modal dialog accessible from the Convert menu with format string input, live preview, dry-run table, and collision detection
- Implement batch rename execution with pre-checks (write permissions, collision detection) and skip-and-continue error handling
- Expose rename functionality through the Rust core so the CLI `tunetag rename` subcommand can share the same logic
- Sanitize resolved filenames to remove characters invalid on the target OS filesystem

## Capabilities

### New Capabilities
- `rename-from-tags`: Parse format strings with tag-value placeholders, resolve them per-file, detect collisions, preview renames (dry run), and execute batch file renames on disk. Covers the modal dialog UI, format string engine, pre-checks, and error reporting.

### Modified Capabilities

## Impact

- **Rust backend**: New `rename` module with format string parsing, placeholder resolution, filename sanitization, collision detection, and `std::fs::rename` execution. New Tauri commands for preview and execute.
- **Frontend (React/TS)**: New `RenameDialog` modal component with format string input, live preview, dry-run results table, and collision error display. New Convert menu entry wiring.
- **File list state**: After successful renames, file list entries must update to reflect new filenames/paths.
- **Undo**: Rename is a disk operation — it is NOT undoable via the in-memory undo stack. Users must re-rename to revert.
- **Dependencies**: No new external dependencies. `std::fs::rename` for file operations; lofty-rs for reading tag values (already present).
