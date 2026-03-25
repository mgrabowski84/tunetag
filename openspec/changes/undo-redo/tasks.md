## 1. Command Infrastructure

- [ ] 1.1 Define the `Command` interface with `label`, `fileIds`, `apply(state)`, and `undo(state)` methods
- [ ] 1.2 Implement the `UndoRedoManager` module with `undoStack` and `redoStack` arrays, exposing `execute(cmd)`, `undo()`, `redo()`, and `clear()` operations
- [ ] 1.3 Enforce the 100-action stack depth limit — drop the oldest entry when executing the 101st command
- [ ] 1.4 Ensure `execute()` clears the redo stack when a new command is pushed

## 2. Integrate with Editor State

- [ ] 2.1 Add `UndoRedoManager` to the editor store (Zustand slice or standalone module consumed by the store)
- [ ] 2.2 Create an `executeCommand()` action on the store that replaces direct tag-state mutations — all tag changes must go through this function
- [ ] 2.3 Expose `canUndo` and `canRedo` boolean selectors derived from stack length

## 3. Command Implementations

- [ ] 3.1 Implement `EditFieldCommand` for single/multi-file tag field edits (captures before/after snapshots of affected fields per file)
- [ ] 3.2 Implement `ApplyMetadataCommand` for MusicBrainz lookup results (captures all changed fields across all affected files)
- [ ] 3.3 Implement `AutoNumberCommand` for auto-numbering (captures before/after Track and optionally Disc fields)
- [ ] 3.4 Implement `SetCoverArtCommand` for embedding cover art (captures previous cover art reference per file)
- [ ] 3.5 Implement `RemoveCoverArtCommand` for stripping cover art (captures previous cover art reference per file)

## 4. Dirty-State Integration

- [ ] 4.1 Store a `savedTagSnapshot` per file that captures the tag state at load time and updates on each save
- [ ] 4.2 After every `undo()` and `redo()` call, recompute dirty status for each affected file by comparing current tag state against `savedTagSnapshot`
- [ ] 4.3 Verify the scenario: edit → save → undo → file shows as unsaved; then redo → file shows as saved again

## 5. Session Lifecycle

- [ ] 5.1 Clear both undo and redo stacks on Close All
- [ ] 5.2 Clear both stacks when opening a new folder that replaces the current file list
- [ ] 5.3 Verify that saving does NOT clear either stack

## 6. Keyboard Shortcuts and Menu

- [ ] 6.1 Register Ctrl/Cmd+Z as the global Undo shortcut, gated on `canUndo`
- [ ] 6.2 Register Ctrl/Cmd+Shift+Z and Ctrl+Y (Windows/Linux only) as Redo shortcuts, gated on `canRedo`
- [ ] 6.3 Update Edit → Undo menu item to show the command label (e.g., "Undo Edit Artist") and disable when undo stack is empty
- [ ] 6.4 Update Edit → Redo menu item to show the command label and disable when redo stack is empty

## 7. Testing

- [ ] 7.1 Unit test `UndoRedoManager`: execute, undo, redo, stack depth limit, clear, redo-cleared-on-new-action
- [ ] 7.2 Unit test each command type: verify `apply()` and `undo()` produce correct state
- [ ] 7.3 Unit test dirty-state integration: edit → save → undo → dirty; edit → save → undo → redo → clean
- [ ] 7.4 Integration test: multi-file edit is a single undo step
- [ ] 7.5 Integration test: keyboard shortcuts trigger undo/redo when stacks are non-empty and are no-ops when empty
