## Why

The file list currently has no keyboard navigation, forcing users to rely entirely on mouse interactions. Power users and accessibility-conscious workflows need full keyboard control for efficient file list navigation, selection, and panel switching. Additionally, there is no way to re-read tags from disk after external changes — a manual Refresh (F5) is needed to keep the UI in sync without file system watchers.

## What Changes

- **Keyboard navigation in file list:** Arrow Up/Down to move selection, Shift+Arrow to extend range, Home/End to jump to first/last file, Page Up/Page Down to scroll by visible page height.
- **Tab focus management:** Tab key moves focus between file list and tag panel. Enter in the file list begins editing the first field in the tag panel for the selected file.
- **Type-to-jump:** Typing characters while the file list is focused jumps to the first filename matching the typed prefix. The prefix buffer resets after 1 second of inactivity.
- **Refresh (F5):** Re-reads all tags from disk for all loaded files. Prompts if unsaved changes exist. Files deleted externally are removed from the list on refresh.

## Capabilities

### New Capabilities

- `keyboard-navigation`: Keyboard-driven selection, navigation, focus management, and type-to-jump in the file list and between panels.
- `refresh`: F5 re-reads tags from disk, handles unsaved changes prompt, and removes externally deleted files.

### Modified Capabilities

_(none)_

## Impact

- **Frontend (React/TypeScript):** File list component gains keyboard event handlers, focus state management, scroll-into-view logic, and type-to-jump debounce. Tag panel needs focus-receive handling triggered by Enter key from file list.
- **Backend (Rust/Tauri):** Refresh command re-reads tags for all loaded file paths via lofty; returns list of files that no longer exist on disk.
- **State management:** Dirty-file tracking must integrate with refresh flow (prompt, then discard or abort). Selection state needs cursor index and anchor index for range operations.
- **Menu:** F5 bound under View → Refresh (already specified in PRD menu structure).
