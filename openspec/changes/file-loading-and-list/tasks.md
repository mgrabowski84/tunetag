## 1. Rust Backend — File Scanning & Metadata

- [ ] 1.1 Define `FileEntry` struct with serde serialization (all tag fields + audio properties as specified in design)
- [ ] 1.2 Implement `scan_paths` Tauri command: accept `Vec<PathBuf>` + `recursive` flag, walk directories, filter by supported extensions (.mp3, .flac, .m4a), read tags and audio properties via lofty, return `Vec<FileEntry>`
- [ ] 1.3 Handle edge cases in `scan_paths`: skip unreadable/corrupted files, case-insensitive extension matching, deduplicate files if same path appears twice
- [ ] 1.4 Register `scan_paths` command in the Tauri app builder

## 2. Rust Backend — Column Config Persistence

- [ ] 2.1 Define `ColumnConfig` and `ColumnSetting` structs with serde serialization
- [ ] 2.2 Implement `load_column_config` Tauri command: read from app data directory JSON file, return `Option<ColumnConfig>` (None if file missing or corrupted)
- [ ] 2.3 Implement `save_column_config` Tauri command: write column config JSON to app data directory
- [ ] 2.4 Register column config commands in the Tauri app builder

## 3. Frontend — File State Management

- [ ] 3.1 Define TypeScript types for `FileEntry` and `ColumnConfig` matching Rust structs
- [ ] 3.2 Create `FilesContext` with useReducer: store files as `Map<string, FileEntry>`, sorted ID list, current sort column + direction
- [ ] 3.3 Implement sort logic: sort `sortedIds` array by any column field, ascending/descending toggle

## 4. Frontend — File Loading Integration

- [ ] 4.1 Implement Open Files menu action: invoke Tauri file dialog (filter to supported formats), call `scan_paths` command, update FilesContext
- [ ] 4.2 Implement Open Folder menu action: invoke Tauri folder dialog, call `scan_paths` with recursive flag from state, update FilesContext
- [ ] 4.3 Implement drag-and-drop handler: listen for Tauri drag-drop events, extract paths, call `scan_paths`, update FilesContext
- [ ] 4.4 Add recursive subfolder toggle to View menu, store toggle state

## 5. Frontend — File List Table

- [ ] 5.1 Install @tanstack/react-virtual dependency
- [ ] 5.2 Build `FileListTable` component with virtualized rows using @tanstack/react-virtual
- [ ] 5.3 Implement column header rendering with click-to-sort (ascending on first click, descending on second)
- [ ] 5.4 Display sort indicator (arrow) on the active sort column header
- [ ] 5.5 Implement row number (#) column that reflects current display order

## 6. Frontend — Column Customization

- [ ] 6.1 Define default columns list and all available columns (all tag fields + audio properties)
- [ ] 6.2 Implement column header right-click context menu with checkboxes for all available columns
- [ ] 6.3 Implement column drag-to-reorder (with # column fixed in first position)
- [ ] 6.4 Load column config from Tauri on app startup, fall back to defaults if missing
- [ ] 6.5 Save column config to Tauri whenever columns are added, removed, reordered, or resized

## 7. Menu Bar Integration

- [ ] 7.1 Add File > Open Files (Ctrl+O) menu item
- [ ] 7.2 Add File > Open Folder (Ctrl+Shift+O) menu item
- [ ] 7.3 Add View > Toggle Recursive Folder Loading menu item

## 8. Testing & Verification

- [ ] 8.1 Test loading a folder with 1,000+ files — verify all files appear and scrolling is smooth
- [ ] 8.2 Test drag-and-drop with mixed file types — verify only supported formats are loaded
- [ ] 8.3 Test column sorting, customization, reorder, and persistence across app restart
- [ ] 8.4 Test recursive vs non-recursive folder scanning
- [ ] 8.5 Test with files that have missing tags and corrupted files
