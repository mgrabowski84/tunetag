## Context

TuneTag is a cross-platform audio tag editor (Tauri v2 + React/TypeScript frontend, Rust backend). Tag edits happen in-memory on the frontend — the Rust backend is only invoked on save. Currently there is no mechanism to reverse an accidental edit; the user must close without saving and reload. The PRD (section 7.6) requires a per-action undo/redo stack with 100-action depth that survives saves but clears when files are closed.

All tag-mutating operations happen in the frontend: field edits in the tag panel, metadata apply from MusicBrainz lookup, auto-numbering, and cover art changes. These must all become reversible.

## Goals / Non-Goals

**Goals:**
- Implement a command pattern that wraps every tag-mutating operation as a reversible command
- Maintain an undo stack (max 100) and a redo stack, managed as a single frontend store/module
- Integrate with dirty-state tracking so undo/redo correctly flips the unsaved indicator per file
- Wire keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y) and Edit menu items

**Non-Goals:**
- Undo/redo for non-tag actions (file list selection, column reordering, panel resizing)
- Undo of file renames (renames write to disk immediately — not reversible via this stack)
- Undo of save operations (save is a persist action, not a tag mutation)
- Persistent undo history across sessions (stack is in-memory only)
- CLI undo/redo support (CLI operations are fire-and-forget)

## Decisions

### 1. Command pattern for reversible actions

**Decision:** Every tag-mutating user action produces a `Command` object with `apply()` and `undo()` methods. The command captures the before-state (snapshot of affected fields for affected files) at creation time and the after-state when applied.

```typescript
interface Command {
  /** Human-readable label for UI (e.g., "Edit Artist on 3 files") */
  label: string;
  /** File IDs affected by this command */
  fileIds: string[];
  /** Apply the forward mutation to the editor state */
  apply(state: EditorState): void;
  /** Reverse the mutation, restoring previous state */
  undo(state: EditorState): void;
}
```

**Rationale:** The command pattern is the standard approach for undo/redo. Capturing before/after snapshots per field is simpler and more robust than inverse-operation computation. For tag editing (small string values), the memory cost of storing snapshots is negligible.

**Alternative considered:** Operation-based undo (store a delta like "set Artist from X to Y"). This is more memory-efficient but harder to implement correctly for complex operations (e.g., metadata lookup that changes 8 fields on 12 files). Snapshot-based approach is simpler and the data sizes are trivial.

### 2. Stack data structure

**Decision:** Two arrays — `undoStack: Command[]` and `redoStack: Command[]` — managed by an `UndoRedoManager` (either a dedicated Zustand slice or a standalone module consumed by the editor store).

- **Execute:** Push command onto `undoStack`, call `command.apply()`, clear `redoStack`.
- **Undo:** Pop from `undoStack`, call `command.undo()`, push onto `redoStack`.
- **Redo:** Pop from `redoStack`, call `command.apply()`, push onto `undoStack`.
- **Stack limit:** When `undoStack` exceeds 100 entries, drop the oldest (shift from front).
- **Clear:** On Close All or open-new-folder, both stacks are emptied.

**Rationale:** Two-array approach is the simplest correct implementation. Clearing the redo stack on new actions matches universal UX expectations (you can't redo after making a new edit).

**Alternative considered:** A single array with a cursor index. Equivalent behavior but slightly more complex index management with no benefit.

### 3. Multi-file edits as a single command

**Decision:** When a user action affects multiple files (e.g., writing "Radiohead" to the Artist field on 50 selected files), a single `Command` object is created that contains the before/after state for all 50 files. This counts as one undo step.

**Rationale:** The PRD explicitly requires multi-file edits to be a single undo step. Grouping at command creation time (not post-hoc batching) is simplest.

### 4. Dirty-state integration via save-point tracking

**Decision:** Each file tracks a `savedVersion: number` — a counter incremented each time the file is saved. Each command stores the version numbers of affected files at the time of execution. After any undo/redo, the system compares each file's current tag state against the state at its last save point to determine dirty status.

Implementation approach: Each file maintains a `savedTagSnapshot` — the tag values as of the last save (or initial load). After undo/redo, the file is dirty if its current tags differ from `savedTagSnapshot`. This is a simple deep-equality check on a small object (10-12 string fields + cover art hash).

**Rationale:** This correctly handles the key scenario: save → undo → file is dirty again (current state ≠ saved state). And: save → undo → redo → file is clean again (current state = saved state). Using a snapshot comparison rather than a counter avoids edge cases with branching undo paths.

**Alternative considered:** Tracking dirty as a boolean that undo/redo toggles. Fails for multi-step undo: if the user makes 5 edits, saves, then undoes 3, the file is dirty — a boolean toggle can't track this correctly.

### 5. Where undo/redo state lives

**Decision:** The undo/redo stacks live in the frontend state management layer (Zustand store or equivalent), alongside the editor's file/tag state. The `UndoRedoManager` is a module that the store calls into. All mutations to tag state go through `executeCommand()` instead of direct state updates.

**Rationale:** Undo/redo is purely a frontend concern — the Rust backend only sees final tag values on save. Co-locating with the editor state avoids synchronization issues.

### 6. Keyboard shortcut binding

**Decision:** Register global keyboard shortcuts for Undo (Ctrl/Cmd+Z) and Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y) at the application level. These shortcuts are only active when the undo/redo stacks are non-empty (respectively). The Edit → Undo/Redo menu items reflect the same enabled/disabled state and show the command label (e.g., "Undo Edit Artist").

**Rationale:** Global shortcuts match user expectations from every other editor. Showing the command label in the menu is standard UX and easy to implement since commands carry a `label` field.

## Risks / Trade-offs

- **[Risk] Missed command wrapping** — If a new tag-mutating feature is added without wrapping it as a command, those edits won't be undoable. → Mitigation: All tag state mutations must go through `executeCommand()`. Direct state mutation should be linted/code-reviewed against. Document the pattern clearly in contributing guidelines.
- **[Risk] Memory usage for large batches** — A single command on 1,000 files stores before/after snapshots for all 1,000 files, and the stack holds up to 100 such commands. → Mitigation: Tag snapshots are small (~1 KB per file for string fields). 100 commands × 1,000 files × 1 KB = ~100 MB worst case. Acceptable for a desktop app. Cover art is stored by reference/hash, not duplicated in snapshots.
- **[Trade-off] Snapshot-based vs. delta-based undo** — Snapshots use more memory but are simpler to implement and debug. Accepted because tag data is small.
- **[Trade-off] No undo for file renames** — Renames write to disk immediately and are not captured in the undo stack. This matches the PRD scope (undo is for tag edits) and avoids filesystem operation reversal complexity. Users see a preview before committing renames.
