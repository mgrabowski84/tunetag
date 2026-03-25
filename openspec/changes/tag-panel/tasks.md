## 1. Tag Edit State Management

- [x] 1.1 Define `TagFields` interface and `TagEditState` types in a shared types file
- [x] 1.2 Create `TagEditContext` with useReducer — actions: `SET_FIELD`, `CLEAR_EDITS`, `CLEAR_ALL_EDITS`
- [x] 1.3 Wire `TagEditContext` provider into the app component tree

## 2. Tag Panel UI

- [x] 2.1 Create `TagPanel` component with form layout for all 9 fields (Title, Artist, Album, Album Artist, Year, Track, Disc, Genre, Comment)
- [x] 2.2 Implement single-file display: when one file is selected, populate fields from loaded tags merged with any pending edits
- [x] 2.3 Implement multi-file merged view: compute shared vs. differing values, display `<keep>` placeholder for differing fields
- [x] 2.4 Disable all fields when no files are selected
- [x] 2.5 Wire field onChange handlers to dispatch `SET_FIELD` actions to the edit state (applying edits to all selected file paths)

## 3. Genre Autocomplete

- [x] 3.1 Add static array of 192 ID3v1 genre names (80 original + Winamp extensions)
- [x] 3.2 Build genre combobox component: free-text input with filtered dropdown, case-insensitive substring matching
- [x] 3.3 Integrate genre combobox into the tag panel Genre field

## 4. Save Command (Backend)

- [x] 4.1 Define `TagUpdate` and `SaveResult`/`SaveError` structs in `tunetag-core`
- [x] 4.2 Implement `save_tags` function in core: iterate files, read existing tags via lofty, apply field updates, write back; skip on failure and collect errors
- [x] 4.3 Register `save_tags` as a Tauri command in `tunetag-gui`

## 5. Save Flow (Frontend)

- [x] 5.1 Implement save handler: collect edited fields for selected files, call `save_tags` Tauri command, process results
- [x] 5.2 On successful save, dispatch `CLEAR_EDITS` for succeeded file paths
- [x] 5.3 On partial failure, show error report dialog ("Saved N/M files. K files failed:" with filename + error table)
- [x] 5.4 Bind Ctrl/Cmd+S keyboard shortcut to trigger save

## 6. Dirty State Indicators

- [x] 6.1 Derive dirty file set from `editedTags` map and expose via context
- [x] 6.2 Update window title with asterisk prefix when any files are dirty
- [x] 6.3 Add per-file unsaved indicator (visual marker) to file list rows for dirty files
- [x] 6.4 Update status bar to show unsaved file count ("K unsaved")

## 7. Close Prompt

- [x] 7.1 Implement `set_has_unsaved_changes` Tauri command to track dirty state flag on the backend
- [x] 7.2 Call `set_has_unsaved_changes` from frontend whenever dirty state changes
- [x] 7.3 Handle Tauri `CloseRequested` window event: check dirty flag, show confirmation dialog if unsaved changes exist, cancel close on user cancel

## 8. Integration and Selection Reactivity

- [x] 8.1 Wire tag panel to react to file list selection changes — recompute displayed values on selection change
- [x] 8.2 Verify edits are preserved across selection changes (edit file A, select B, reselect A — edits for A still shown)
- [x] 8.3 Integration test: end-to-end flow of select → edit → save → verify dirty state cleared
