## Why

The application has no way to load audio files or display them to the user. File loading and a file list table are the foundational features that every other capability (tag editing, renaming, metadata lookup) depends on. Without them, the app is an empty shell.

## What Changes

- **File/Folder opening**: Open individual files via File > Open Files dialog, or entire folders via File > Open Folder dialog
- **Drag-and-drop**: Drop files or folders onto the app window to load them
- **Recursive subfolder toggle**: View menu toggle to control whether subfolders are scanned recursively
- **Tauri backend commands**: New Rust commands to scan directories, filter supported formats (MP3, FLAC, M4A), read tags and audio properties via lofty, and return structured metadata to the frontend
- **File list table**: Display loaded files in a sortable, column-based table occupying the main content area
- **Default columns**: #, Filename, Title, Artist, Album, Year, Track, Genre, Format
- **Column sorting**: Click column header to sort ascending, click again for descending
- **Column customization**: Right-click header to add/remove columns; any tag field or audio property can be a column; drag-to-reorder columns; settings persist across sessions
- **Performance**: Virtualized rendering to handle 1,000+ files smoothly

## Capabilities

### New Capabilities

- `file-loading`: Opening files/folders via dialogs and drag-and-drop, recursive scanning, format filtering, reading tags and audio properties from disk
- `file-list`: Displaying loaded files in a sortable table with configurable columns, column sorting, column customization, and persistent column settings

### Modified Capabilities

_(none — no existing specs are modified)_

## Impact

- **Rust backend**: New Tauri commands for file scanning and metadata reading; new structs for file metadata serialization; dependency on `lofty` crate for tag I/O and audio properties
- **Frontend**: New React components for the file list table (virtualized), column header interactions, drag-and-drop handling, and column configuration UI
- **State management**: Frontend state for loaded files, sort order, column configuration
- **Persistence**: Column settings stored via Tauri's app data (localStorage or file-based config)
- **Menu bar**: File menu gains Open Files / Open Folder items; View menu gains recursive toggle
