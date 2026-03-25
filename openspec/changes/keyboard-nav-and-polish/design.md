## Context

TuneTag is a cross-platform audio tag editor built with Tauri v2 (Rust backend) and React/TypeScript frontend. The file list is the primary UI component — users load folders of audio files, select files, and edit tags in the adjacent tag panel.

Currently, no keyboard navigation exists in the file list, and there is no mechanism to re-read tags from disk after external modifications. The PRD (sections 7.7 and 7.10) specifies full keyboard navigation and F5 refresh as v1 requirements.

The frontend uses React with TypeScript. The file list is a scrollable, sortable table. State management tracks loaded files, selection state, and dirty (unsaved) status per file. The backend exposes Tauri commands for file I/O operations via lofty-rs.

## Goals / Non-Goals

**Goals:**

- Full keyboard navigation in the file list matching PRD section 7.7 (arrow keys, shift-extend, Home/End, Page Up/Down, Tab focus, Enter to edit, type-to-jump).
- F5 refresh that re-reads all tags from disk, prompts on unsaved changes, and removes externally deleted files.
- Clean focus management between file list and tag panel.
- Responsive keyboard handling — no perceptible lag on key events.

**Non-Goals:**

- File system watcher / automatic refresh (PRD decision #11: manual refresh only in v1).
- Keyboard shortcuts for menu items beyond what's defined in this change (F5 only).
- Virtual scrolling or windowed rendering optimizations (separate concern if needed for performance with large lists).
- CLI impact — refresh is GUI-only; keyboard navigation is GUI-only.

## Decisions

### 1. Keyboard event handling: single `onKeyDown` handler on file list container

**Decision:** Attach a single `onKeyDown` event handler to the file list container `<div>` (with `tabIndex={0}` for focusability). All keyboard navigation logic is routed through this handler.

**Rationale:** Centralizing keyboard handling in one handler avoids scattered listeners, makes key binding conflicts easy to detect, and keeps the event flow predictable. The container element receives focus, so individual rows don't need to be focusable — this avoids tab-trapping inside the list.

**Alternative considered:** Making each row focusable (`tabIndex={0}` per row) and using `onKeyDown` per row. Rejected because it creates tab-stop pollution (Tab would cycle through every row instead of jumping to the tag panel) and complicates focus management.

### 2. Selection model: cursor + anchor + selected set

**Decision:** Track three pieces of state:
- `cursorIndex: number` — the currently focused row (drawn with a distinct focus indicator).
- `anchorIndex: number | null` — the start of a shift-select range.
- `selectedIndices: Set<number>` — the set of selected file indices.

Arrow Up/Down moves the cursor and sets selection to just the cursor. Shift+Arrow extends from the anchor. Home/End jump the cursor. Ctrl/Cmd+Click toggles individual items (already exists for mouse, unchanged).

**Rationale:** This mirrors the standard OS list selection model (Windows Explorer, macOS Finder). Users expect this behavior. The cursor is separate from selection so that navigation (moving focus) and selection (choosing files) can be independent when Ctrl is involved.

### 3. Type-to-jump: local timeout with `useRef` buffer

**Decision:** Maintain a `typedPrefix` string in a `useRef`. On each printable keypress while the file list is focused, append the character to the buffer and search for the first filename starting with that prefix (case-insensitive). Set a `setTimeout` of 1000ms that clears the buffer. Each new keypress resets the timer.

**Rationale:** `useRef` avoids re-renders on each keystroke. A 1-second timeout matches common OS behavior (Windows Explorer uses ~1s). No external debounce library needed — a simple `setTimeout` + `clearTimeout` pattern suffices.

**Alternative considered:** Using a debounce utility. Rejected as overkill — the logic is 10 lines and introducing a dependency or util for this alone is unnecessary.

### 4. Focus management: Tab cycles between two focus zones

**Decision:** Define two focus zones: the file list container and the tag panel container. Tab moves focus forward (file list → tag panel → file list), Shift+Tab moves backward. When the tag panel receives focus, the first input field is focused. When the file list receives focus, the container element is focused (keyboard events resume from cursor position).

**Rationale:** Two-zone focus is the simplest model that satisfies the PRD. Within the tag panel, standard Tab behavior between form fields applies (browser-native). The file list is a single tab stop, consistent with OS list controls.

**Implementation:** Use `onKeyDown` on both containers to intercept Tab. In the file list handler, if Tab is pressed, call `preventDefault()` and focus the tag panel's first input. In the tag panel, the last input's Tab (or Shift+Tab on the first input) moves focus back to the file list.

### 5. Scroll-into-view on cursor movement

**Decision:** After any cursor movement (arrow, Home/End, Page Up/Down, type-to-jump), scroll the file list so the cursor row is visible. Use `Element.scrollIntoView({ block: 'nearest' })` on the cursor row's DOM element.

**Rationale:** `block: 'nearest'` only scrolls if the element is outside the viewport, avoiding jarring jumps when the cursor is already visible. This is the standard behavior users expect from keyboard-navigable lists.

### 6. Page Up/Down: scroll by visible row count

**Decision:** Page Up/Down moves the cursor by `Math.floor(visibleHeight / rowHeight)` rows. Calculate visible height from the scroll container's `clientHeight` and use a known fixed row height.

**Rationale:** This matches standard OS behavior. Using a fixed row height (consistent with the file list's tabular design) makes the calculation simple and deterministic.

### 7. Refresh: backend command returns updated file data + deleted file paths

**Decision:** Create a Tauri command `refresh_files` that accepts the list of currently loaded file paths. For each path, attempt to re-read tags via lofty. Return a result containing:
- `updated: Vec<FileData>` — files that were successfully re-read (with fresh tag data).
- `deleted: Vec<String>` — file paths that no longer exist on disk.

The frontend is responsible for the unsaved-changes prompt before invoking this command.

**Rationale:** Keeping the prompt in the frontend allows the UI to handle the confirmation dialog natively (React state). The backend stays stateless — it just reads files and reports results. Returning deleted paths explicitly lets the frontend cleanly remove them from state without guessing.

**Alternative considered:** Having the backend manage dirty state and prompt logic. Rejected because the backend doesn't own UI state, and it would couple tag-editing state with the refresh operation unnecessarily.

### 8. Refresh unsaved-changes prompt: confirmation dialog before refresh

**Decision:** When F5 is pressed and any files have unsaved changes, show a confirmation dialog: "You have unsaved changes in N files. Refresh will discard them. Continue?" with "Refresh" and "Cancel" buttons. On confirm, proceed with refresh (discard all in-memory changes). On cancel, do nothing.

**Rationale:** Directly from PRD section 7.10. A single prompt for all files (not per-file) keeps the UX simple.

## Risks / Trade-offs

**[Risk] Type-to-jump conflicts with global shortcuts** → Mitigation: Only handle printable characters (not modifier keys or function keys). Check `event.ctrlKey`, `event.metaKey`, `event.altKey` — if any modifier is held, skip type-to-jump. This prevents Ctrl+S from appending "s" to the jump buffer.

**[Risk] Focus loss after dialog dismissal** → Mitigation: After the refresh confirmation dialog closes (confirm or cancel), explicitly return focus to the file list container. Same pattern for any modal that overlays the file list.

**[Risk] Large file count makes refresh slow** → Mitigation: Refresh re-reads all files sequentially via lofty, which is I/O-bound. For the v1 target of ~1,000 files on local SSD (PRD NFR: < 3s load), sequential refresh should remain under the performance target. If profiling shows issues, batch parallelism can be added later.

**[Trade-off] Fixed row height assumption for Page Up/Down** → Limits future flexibility if variable-height rows are introduced. Acceptable for v1 since the file list uses uniform rows.
