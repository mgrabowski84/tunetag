## Why

Users expect Ctrl+Z/Redo in any editor. Currently TuneTag has no way to revert an accidental tag edit — a mistyped field, an unintended metadata lookup apply, or an auto-number on the wrong selection. Without undo/redo, the only recovery is to close files without saving and re-open them, losing all in-progress work.

## What Changes

- Add a per-session undo/redo stack (depth 100) that records every discrete user action as a reversible command
- Each action (field edit, metadata apply, auto-number, cover art change) is one undo step — multi-file edits that happen as a single user gesture count as one step
- Wire Ctrl/Cmd+Z for undo and Ctrl/Cmd+Shift+Z (or Ctrl+Y) for redo
- Add Edit → Undo and Edit → Redo menu items with enabled/disabled state reflecting stack availability
- Integrate undo/redo with dirty-state tracking: undoing past a save point re-marks files as unsaved; redoing back to the save point clears the unsaved indicator
- Clear the undo stack when files are closed (Close All or opening a new folder); saving does NOT clear the stack

## Capabilities

### New Capabilities

- `undo-redo`: Per-session undo/redo stack using the command pattern — records, reverses, and re-applies discrete user actions across single and multi-file edits with correct dirty-state integration

### Modified Capabilities

_None — undo/redo is a new capability. Existing features (tag panel edits, auto-numbering, metadata lookup, cover art) will emit commands into the stack, but their own specifications do not change._

## Impact

- **Frontend state management:** A new undo/redo store (or module within the existing editor store) that holds the command stack and exposes undo/redo actions
- **Action refactoring:** All tag-mutating operations (field edits, metadata apply, auto-number, cover art set/remove) must be wrapped as reversible command objects instead of direct state mutations
- **Keyboard shortcuts:** New global shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y) added to the keybinding layer
- **Menu state:** Edit → Undo/Redo menu items need dynamic enabled/disabled state
- **Dirty tracking:** The existing unsaved-changes indicator must cooperate with undo — undoing past a save point re-marks the file as dirty
- **No backend (Rust) changes:** Undo/redo operates on in-memory tag state in the frontend; Rust tag I/O is only called on explicit save
- **No CLI impact:** Undo/redo is a GUI-only feature
