## Why

When opening a large folder (especially over SFTP/NAS), the UI is completely blank until the entire directory scan completes — users stare at an empty file list for many seconds with no feedback. This is particularly noticeable for music libraries with hundreds or thousands of files on network storage.

## What Changes

- Add a new `scan_paths_progressive` Tauri command that returns immediately and streams file entries to the frontend as they are read, using Tauri events
- Emit micro-batches of ~20 file entries every ~100ms rather than one event per file (balances visual responsiveness with IPC efficiency)
- Add `ADD_FILES_BATCH` and `FINALIZE_SORT` reducer actions to `FilesContext` so the file list populates incrementally during the scan
- Add a thin loading bar above the file list column headers showing a spinner and live file count ("Loading... 47 files")
- Replace `scan_paths` calls in Open Files, Open Folder, and drag-and-drop flows with the new progressive variant
- Users can interact with (select, view, edit tags on) files that have already loaded while scanning continues

## Capabilities

### New Capabilities
- `progressive-file-loading`: Streaming file scan via Tauri events, micro-batch strategy, FilesContext batch append, loading indicator UI

### Modified Capabilities
- `file-loading`: The file loading flow changes from a blocking IPC call to an event-driven streaming model. Open Files, Open Folder, and drag-and-drop all now use `scan_paths_progressive` instead of `scan_paths`.
- `file-list`: The file list component now renders a loading indicator (thin bar with spinner and counter) while a scan is in progress.

## Impact

- `crates/tunetag-gui/src-tauri/src/lib.rs` — new `scan_paths_progressive` command and background task
- `crates/tunetag-gui/src/FilesContext.tsx` — new `CLEAR_FILES`, `ADD_FILES_BATCH`, `FINALIZE_SORT` reducer actions
- `crates/tunetag-gui/src/App.tsx` — event listener setup, scanning state, replace invoke calls
- `crates/tunetag-gui/src/components/MenuBar.tsx` — `handleOpenFiles` and `handleOpenFolder` updated to use progressive flow via callback
- `crates/tunetag-gui/src/components/FileList.tsx` — thin loading bar above column headers
- No changes to the Rust core library, CLI, tag panel, cover art, or any other features
- `scan_paths` command remains for backward compatibility (used by refresh and small file selections)
