## 1. Rust Backend — File Scanning & Metadata

- [x] 1.1 Define `FileEntry` struct with serde serialization (all tag fields + audio properties as specified in design)
- [x] 1.2 Implement `scan_paths` Tauri command: accept `Vec<PathBuf>` + `recursive` flag, walk directories, filter by supported extensions (.mp3, .flac, .m4a), read tags and audio properties via lofty, return `Vec<FileEntry>`
- [x] 1.3 Handle edge cases in `scan_paths`: skip unreadable/corrupted files, case-insensitive extension matching, deduplicate files if same path appears twice
- [x] 1.4 Register `scan_paths` command in the Tauri app builder

## 2. Rust Backend — Column Config Persistence

- [x] 2.1 Define `ColumnConfig` and `ColumnSetting` structs with serde serialization
- [x] 2.2 Implement `load_column_config` Tauri command: read from app data directory JSON file, return `Option<ColumnConfig>` (None if file missing or corrupted)
- [x] 2.3 Implement `save_column_config` Tauri command: write column config JSON to app data directory
- [x] 2.4 Register column config commands in the Tauri app builder

## 3. Frontend — File State Management

- [x] 3.1 Define TypeScript types for `FileEntry` and `ColumnConfig` matching Rust structs
- [x] 3.2 Create `FilesContext` with useReducer: store files as `Map<string, FileEntry>`, sorted ID list, current sort column + direction
- [x] 3.3 Implement sort logic: sort `sortedIds` array by any column field, ascending/descending toggle

## 4. Frontend — File Loading Integration

- [x] 4.1 Implement Open Files menu action: invoke Tauri file dialog (filter to supported formats), call `scan_paths` command, update FilesContext
- [x] 4.2 Implement Open Folder menu action: invoke Tauri folder dialog, call `scan_paths` with recursive flag from state, update FilesContext
- [x] 4.3 Implement drag-and-drop handler: listen for Tauri drag-drop events, extract paths, call `scan_paths`, update FilesContext
- [x] 4.4 Add recursive subfolder toggle to View menu, store toggle state

## 5. Frontend — File List Table

- [x] 5.1 Install @tanstack/react-virtual dependency
- [x] 5.2 Build `FileListTable` component with virtualized rows using @tanstack/react-virtual
- [x] 5.3 Implement column header rendering with click-to-sort (ascending on first click, descending on second)
- [x] 5.4 Display sort indicator (arrow) on the active sort column header
- [x] 5.5 Implement row number (#) column that reflects current display order

## 6. Frontend — Column Customization

- [x] 6.1 Define default columns list and all available columns (all tag fields + audio properties)
- [x] 6.2 Implement column header right-click context menu with checkboxes for all available columns
- [x] 6.3 Implement column drag-to-reorder (with # column fixed in first position)
- [x] 6.4 Load column config from Tauri on app startup, fall back to defaults if missing
- [x] 6.5 Save column config to Tauri whenever columns are added, removed, reordered, or resized

## 7. Menu Bar Integration

- [x] 7.1 Add File > Open Files (Ctrl+O) menu item
- [x] 7.2 Add File > Open Folder (Ctrl+Shift+O) menu item
- [x] 7.3 Add View > Toggle Recursive Folder Loading menu item

## 8. Testing & Verification

- [x] 8.1 Test loading a folder with 1,000+ files — verify all files appear and scrolling is smooth
- [x] 8.2 Test drag-and-drop with mixed file types — verify only supported formats are loaded
- [x] 8.3 Test column sorting, customization, reorder, and persistence across app restart
- [x] 8.4 Test recursive vs non-recursive folder scanning
- [x] 8.5 Test with files that have missing tags and corrupted files
