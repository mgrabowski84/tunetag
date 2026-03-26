## 1. Selection Model & State

- [x] 1.1 Add selection state: `cursorIndex`, `anchorIndex`, and `selectedIndices` (Set) to file list state management
- [x] 1.2 Implement selection helpers: `selectSingle(index)`, `selectRange(anchor, cursor)`, `toggleSelect(index)` that update the selection state
- [x] 1.3 Render cursor indicator (focus ring) and selected-row highlighting in the file list UI based on selection state

## 2. Arrow Key Navigation

- [x] 2.1 Add `tabIndex={0}` and `onKeyDown` handler to the file list container element
- [x] 2.2 Handle Arrow Down: move cursor +1, clamp to last row, call `selectSingle`, scroll into view
- [x] 2.3 Handle Arrow Up: move cursor -1, clamp to first row, call `selectSingle`, scroll into view
- [x] 2.4 Handle Shift+Arrow Down: set anchor if not set, move cursor +1, call `selectRange`, scroll into view
- [x] 2.5 Handle Shift+Arrow Up: set anchor if not set, move cursor -1, call `selectRange`, scroll into view

## 3. Home, End, Page Up, Page Down

- [x] 3.1 Handle Home: move cursor to index 0, call `selectSingle`, scroll into view
- [x] 3.2 Handle End: move cursor to last index, call `selectSingle`, scroll into view
- [x] 3.3 Calculate visible page size from scroll container `clientHeight` and row height
- [x] 3.4 Handle Page Down: move cursor by +pageSize rows (clamp to last), call `selectSingle`, scroll into view
- [x] 3.5 Handle Page Up: move cursor by -pageSize rows (clamp to first), call `selectSingle`, scroll into view

## 4. Scroll Into View

- [x] 4.1 Implement `scrollCursorIntoView` helper that calls `scrollIntoView({ block: 'nearest' })` on the cursor row DOM element
- [x] 4.2 Call `scrollCursorIntoView` after every cursor movement (arrow, home/end, page up/down, type-to-jump)

## 5. Tab Focus Management

- [x] 5.1 Intercept Tab key in file list `onKeyDown`: `preventDefault()` and focus the tag panel's first input field
- [x] 5.2 Intercept Shift+Tab on the tag panel's first field: `preventDefault()` and focus the file list container
- [x] 5.3 Handle Tab on the tag panel's last field: wrap focus back to the file list container
- [x] 5.4 On file list focus restore, ensure keyboard navigation resumes from the current cursor position

## 6. Enter to Edit

- [x] 6.1 Handle Enter key in file list `onKeyDown`: if selection is non-empty, focus the Title field in the tag panel
- [x] 6.2 If selection is empty, Enter has no effect (no-op)

## 7. Type-to-Jump

- [x] 7.1 Add `useRef` for the prefix buffer string and timeout ID
- [x] 7.2 On printable keypress (no Ctrl/Cmd/Alt modifier), append character to buffer, reset 1-second clear timeout
- [x] 7.3 Search loaded filenames for first case-insensitive prefix match; move cursor and selection to it if found
- [x] 7.4 After 1 second of inactivity, clear the prefix buffer via the timeout callback
- [x] 7.5 Verify modifier keys (Ctrl, Meta, Alt) do not trigger type-to-jump

## 8. Refresh Backend Command

- [x] 8.1 Create Tauri command `refresh_files(paths: Vec<String>)` that re-reads tags via lofty for each path
- [x] 8.2 Return `RefreshResult { updated: Vec<FileData>, deleted: Vec<String> }` — files read successfully and paths no longer on disk
- [x] 8.3 Handle per-file read errors gracefully (file that fails to read is treated as deleted or flagged with error)

## 9. Refresh Frontend Flow

- [x] 9.1 Bind F5 key and View → Refresh menu item to trigger the refresh action
- [x] 9.2 Check for unsaved changes; if any exist, show confirmation dialog with message and file count
- [x] 9.3 On confirm (or if no unsaved changes), invoke `refresh_files` Tauri command with all loaded file paths
- [x] 9.4 On response, replace in-memory tag data with updated data, remove deleted files from state
- [x] 9.5 Preserve selection: keep files selected if they still exist; adjust cursor if it was on a deleted file (move to nearest row)
- [x] 9.6 Clear dirty flags for all files after refresh (all data now matches disk)
- [x] 9.7 Return focus to the file list after refresh dialog dismissal
