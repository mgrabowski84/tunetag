## Why

The core editing workflow — selecting files and modifying their tags — has no implementation yet. Without a tag panel and save mechanism, TuneTag is just a file browser. This is the central feature that every other editing capability (cover art, rename, auto-numbering, metadata lookup) depends on.

## What Changes

- Add a persistent sidebar (tag panel) displaying editable tag fields for the currently selected file(s)
- Fields: Title, Artist, Album, Album Artist, Year, Track, Disc, Genre (with autocomplete from ID3v1 genre list), Comment
- Multi-file editing: shared values shown normally, differing values display `<keep>` placeholder
- Save (Ctrl/Cmd+S) writes tag changes to selected files via lofty
- Dirty state tracking: asterisk in window title, per-file unsaved indicator in file list
- Prompt on window close if unsaved changes exist
- Batch save error handling: skip failed files, continue with remaining, show error report on completion

## Capabilities

### New Capabilities
- `tag-editing`: Tag panel sidebar, multi-file editing logic, save flow, and dirty state tracking

### Modified Capabilities

## Impact

- **Frontend:** New `TagPanel` component with form fields, genre autocomplete, and save button; state management for edited tags and dirty tracking
- **Backend (Rust):** New Tauri command for writing tags to files via lofty; error handling for batch saves
- **Dependencies:** Relies on `core-tag-io` for reading tag data and `file-loading-and-list` for file selection state
- **UX:** Window title now reflects unsaved state; file list rows show per-file dirty indicators; close prompt prevents accidental data loss
