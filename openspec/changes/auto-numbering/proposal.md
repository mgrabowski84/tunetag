## Why

When organizing an album rip or a compilation, users need to assign sequential track numbers — and often a disc number — to a batch of files. Doing this manually one file at a time is tedious and error-prone, especially for large selections. An auto-numbering wizard (PRD §7.8) lets users assign track (and disc) numbers to the entire selection in one action, with a preview before committing.

## What Changes

- Add a modal dialog accessible from **Convert → Auto-number tracks…** that assigns sequential track numbers to selected files
- Options: starting track number (default 1), total tracks (auto-filled from selection count or manual override), N/Total vs N-only toggle, optional disc number, sort order (current file list order or by filename)
- Preview table showing current track value → new value for each selected file
- Apply writes Track (and optionally Disc) fields in-memory for all selected files as a single undo step
- CLI subcommand `tunetag autonumber` with matching options (`--start`, `--total`, `--disc`)

## Capabilities

### New Capabilities

- `auto-numbering`: Auto-number tracks wizard that assigns sequential track and optional disc numbers to selected files, with configurable options, preview, and undo integration

### Modified Capabilities

_None — auto-numbering is a new capability. It produces commands for the undo/redo stack, but the undo/redo specification itself does not change._

## Impact

- **Frontend:** New modal dialog component with form controls and preview table; wired to Convert menu item
- **Frontend state:** Auto-numbering produces a single `Command` object for the undo/redo stack, writing Track and optionally Disc fields on all selected files
- **Rust backend:** New `autonumber` CLI subcommand sharing the core numbering logic; no new Tauri commands needed (numbering operates on in-memory frontend state in the GUI)
- **Menu:** Convert → Auto-number tracks… menu item with enabled state gated on having a selection
- **No new dependencies:** Pure logic — no external libraries needed
