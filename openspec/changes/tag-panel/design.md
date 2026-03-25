## Context

TuneTag has a project scaffold (Rust workspace with `tunetag-core`, `tunetag-gui`, `tunetag-cli`) and will have file loading / tag reading via `core-tag-io` and `file-loading-and-list`. This change adds the tag editing UI and save flow — the core user-facing editing feature. The frontend selection state (which files are selected) already exists from the file list change. We need to build the tag panel that reacts to selection, manages in-memory edits, and writes changes back to disk through lofty.

## Goals / Non-Goals

**Goals:**
- Display a sidebar that shows editable tag fields for whatever files are currently selected
- Handle multi-file merging: compute shared vs. differing values across the selection
- Track dirty state per-file so the UI can show unsaved indicators and the close prompt works
- Provide a save command that writes tag changes via a Tauri command backed by lofty
- Handle batch save errors gracefully (skip and continue)

**Non-Goals:**
- Cover art editing (separate `cover-art` change)
- Undo/redo (separate `undo-redo` change)
- File renaming from tags (separate `rename-from-tags` change)
- CLI tag writing (separate `cli` change)
- Genre list management or custom genre additions

## Decisions

### 1. Tag edit state management

**Decision:** Maintain an `editedTags` map in frontend state keyed by file path. Each entry stores only the fields the user has changed (sparse updates). The tag panel displays either the original value (from loaded tags) or the edited value if one exists. On save, the edited values are merged with originals and sent to the backend.

**Rationale:** Sparse edits mean we only track what changed, which makes dirty detection trivial (file is dirty if it has any entry in `editedTags`) and keeps memory usage proportional to actual edits, not total loaded files.

**Alternative considered:** Deep-cloning all tag data on first edit and diffing on save. Rejected — wastes memory for large file sets (1000+ files) and complicates the diff logic.

### 2. Multi-file merge logic

**Decision:** When multiple files are selected, compute a "merged view" by iterating each tag field across all selected files:
- If all files share the same value (or edited value) for a field → display that value
- If values differ → display the `<keep>` placeholder text and mark the input as mixed-state

On save:
- Fields where the user typed an explicit value → write to all selected files
- Fields still showing `<keep>` → skip (do not write)
- Fields explicitly cleared (empty string) → clear the field on all selected files

**Rationale:** This matches Mp3tag's behavior exactly. The `<keep>` sentinel is never written to disk — it's a UI-only concept.

**Implementation detail:** The merged view is computed reactively (derived state) from the selection + `editedTags` + loaded tags. It's recomputed whenever selection changes or an edit is made.

### 3. Frontend state structure

**Decision:** Use React context + useReducer for tag editing state. The state shape:

```typescript
interface TagEditState {
  // Sparse map: filePath → { field → edited value }
  editedTags: Map<string, Partial<TagFields>>;
}

interface TagFields {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: string;
  track: string;
  disc: string;
  genre: string;
  comment: string;
}
```

Actions: `SET_FIELD` (file paths + field + value), `CLEAR_EDITS` (file paths — after save), `CLEAR_ALL_EDITS` (on close all).

**Rationale:** useReducer gives predictable state transitions and works well with the undo/redo change later (undo can replay or reverse actions). Context avoids prop drilling between file list (dirty indicators) and tag panel.

**Alternative considered:** Zustand or Jotai. Rejected — adds a dependency for state management that useReducer handles adequately. Can revisit if state complexity grows.

### 4. Save flow (Tauri command)

**Decision:** Create a Tauri command `save_tags` that accepts a batch of file updates:

```rust
#[tauri::command]
async fn save_tags(updates: Vec<TagUpdate>) -> Result<SaveResult, String>

struct TagUpdate {
    path: String,
    fields: HashMap<String, Option<String>>,  // None = clear field
}

struct SaveResult {
    succeeded: Vec<String>,    // file paths
    failed: Vec<SaveError>,
}

struct SaveError {
    path: String,
    error: String,
}
```

The command iterates files, reads existing tags via lofty, applies updates, and writes back. On failure for a single file, it records the error and continues.

**Rationale:** Batch operation in a single IPC call reduces overhead. The skip-and-continue strategy matches the PRD requirement. Returning structured results lets the frontend show the error report dialog.

**Alternative considered:** One IPC call per file. Rejected — too many round-trips for large batches (hundreds of files). The overhead of Tauri's IPC serialization makes batching significantly faster.

### 5. Dirty state indicators

**Decision:** Dirty state is derived purely from the `editedTags` map:
- A file is dirty if `editedTags.has(filePath)`
- The window title shows an asterisk if `editedTags.size > 0`
- The file list shows a per-file indicator (e.g., bullet/dot) for dirty files
- The status bar shows "K unsaved" count

On successful save, the saved file paths are removed from `editedTags`. On save failure, the failed file paths remain in `editedTags`.

**Rationale:** Single source of truth — no separate `isDirty` flag to keep in sync.

### 6. Genre autocomplete

**Decision:** Hardcode the ID3v1 genre list (192 entries) as a static array in the frontend. The genre input uses a combobox pattern: free-text input with a filtered dropdown that narrows as the user types. Matching is case-insensitive substring match.

**Rationale:** The list is static and small (192 items). No need for server-side filtering. Hardcoding avoids an IPC call and guarantees instant response.

**Alternative considered:** Fetch the list from the Rust backend. Rejected — unnecessary complexity for a static list.

### 7. Close prompt

**Decision:** Use Tauri's `on_window_event` with `CloseRequested` to intercept the window close. If `editedTags` is non-empty, show a confirmation dialog ("You have unsaved changes in N files. Save before closing?" with Save / Discard / Cancel). This requires the frontend to communicate dirty state to the backend via a Tauri event or command.

**Rationale:** The close event must be handled on the Rust side (Tauri window event), but dirty state lives in the frontend. A lightweight approach: frontend sets a flag via a Tauri command (`set_has_unsaved_changes(bool)`) whenever dirty state changes. The backend checks this flag on close.

## Risks / Trade-offs

- **[Risk] Large multi-file selections could be slow to merge** — Computing merged values across 1000+ files on every selection change could cause UI lag. → Mitigation: Memoize the merge computation; only recompute when selection or editedTags change. For very large selections, the merge is O(S × F) where S = selected files and F = 9 fields — still fast even for 1000 files.
- **[Risk] Concurrent file modification** — If an external program modifies a file while TuneTag has unsaved edits, the save will overwrite external changes silently. → Mitigation: Accepted for v1 per PRD (manual refresh with F5). No file watchers.
- **[Trade-off] Frontend-driven dirty state vs. backend-driven** — Keeping dirty state in the frontend means the backend needs explicit notification for the close prompt. Accepted because the frontend is the source of truth for edits and this avoids duplicating edit tracking in Rust.
- **[Risk] Save fails silently for unsupported tag fields on certain formats** — lofty may not support all fields on all formats (e.g., some MP4 atom limitations). → Mitigation: lofty returns errors for unsupported operations; these are captured in the `SaveError` results and shown to the user.
