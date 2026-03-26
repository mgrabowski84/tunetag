## Context

Currently `scan_paths` walks a directory, reads all tags and audio properties, and returns the full `Vec<FileEntry>` in a single Tauri IPC response. For large or slow folders (NAS over SFTP, external drives), this blocks the UI completely — the file list stays empty for many seconds. The fix is to stream results to the frontend as files are processed.

Tauri v2 provides an event system (`AppHandle::emit`) that allows Rust background tasks to push data to the webview at any time, decoupled from command request/response cycles. This is the right primitive for streaming.

## Goals / Non-Goals

**Goals:**
- File list rows appear progressively as files are read — no more blank screen during large folder scans
- User can interact with already-loaded files (select, view tags, edit) while scan is still in progress
- Loading indicator gives clear feedback: spinner + live count
- IPC overhead stays reasonable — micro-batching avoids one event per file
- Existing `scan_paths` command stays unchanged (used by refresh and CLI)

**Non-Goals:**
- Cancellation of an in-progress scan (out of scope for now — opening a new folder supersedes the old scan naturally by clearing the file list)
- Progress percentage (we don't know total count until the walk finishes)
- Streaming for the CLI (CLI doesn't use Tauri events; it waits for full results)

## Decisions

### 1. Tauri events vs. streaming response

**Decision:** Use Tauri `AppHandle::emit()` from a background `tauri::async_runtime::spawn` task. The command returns `Ok(())` immediately; data flows via events.

**Rationale:** Tauri IPC commands are inherently request/response — there's no streaming response primitive. Events are the correct Tauri-idiomatic way to push unsolicited data from Rust to the webview. The frontend listens for named events and handles them as they arrive.

**Alternative considered:** Chunked command with offset/limit pagination (frontend polls). Rejected — polling wastes CPU and adds round-trip latency between chunks.

### 2. Batch size and flush interval

**Decision:** Buffer up to 20 entries in Rust, flush when buffer hits 20 OR 100ms has elapsed since the last flush, whichever comes first.

**Rationale:** 
- 1 event per file = too many IPC calls (1000 events for 1000 files, each with serialization overhead)
- 1 event for everything = no progressive loading
- 20 files / 100ms = ~50 events for a 1000-file folder — visually smooth, negligible IPC cost
- 100ms flush interval ensures the first rows appear quickly even when reads are slow (SFTP)

**Alternative considered:** Fixed batches only (no time-based flush). Rejected — on slow NAS where each file takes 200ms to read, you'd wait 4 seconds for the first 20-file batch to appear. Time-based flushing ensures the UI updates at least every 100ms.

### 3. Sort behavior during progressive load

**Decision:** Append new entries to `sortedIds` unsorted during scan. Apply the current sort config once on `FINALIZE_SORT` when `scan-complete` fires.

**Rationale:** Re-sorting on every batch (e.g., every 20 files) would cause the list to jump around visually as items find their sorted position. Appending in read order (which correlates with filesystem order) is predictable. The final sort happens once, quickly, after all files are loaded.

**Alternative considered:** Insert into sorted position per batch. Rejected — list jumping is jarring and binary search insertion into a 1000-element array per batch adds complexity with no user benefit.

### 4. CLEAR_FILES action

**Decision:** Add a `CLEAR_FILES` action that resets `files`, `sortedIds`, and `selectedIds` to empty, without triggering a new scan. This is dispatched before `scan_paths_progressive` is called.

**Rationale:** Separating "clear old results" from "start new scan" makes the flow explicit and ensures the loading indicator appears as soon as the folder is opened, before any results arrive.

### 5. Scan deduplication across concurrent scans

**Decision:** Track a `scanId` (incrementing integer, stored in `useRef`) on the frontend. When a new scan starts, increment the `scanId`. Event handlers check if the event's `scanId` matches the current one; stale events from a superseded scan are discarded.

**Rationale:** If the user opens a second folder before the first scan completes, events from the first scan would intermix with the second. The scanId approach cleanly handles this without needing to cancel the background Rust task (which would require `CancellationToken` complexity).

## Risks / Trade-offs

- **[Risk] SFTP file reads fail mid-scan** → Per-file errors are silently skipped (same as current `read_file_entry` behavior). Files that fail to read simply don't appear in the list.
- **[Risk] scan-complete event lost** → If the Tauri window reloads between scan start and complete, the loading indicator would spin forever. Mitigation: add a 60-second timeout in the frontend that clears `scanning` if `scan-complete` never arrives.
- **[Trade-off] No progress percentage** → We can show "N files loaded" but not "N / M total". Knowing the total requires a full directory walk before reading any tags, which defeats the purpose. The counter is sufficient UX.
- **[Trade-off] Files appear in filesystem order initially** → Until `FINALIZE_SORT` fires, rows are in read order. Users who immediately try to sort by clicking a column header mid-scan will have the sort applied only to already-loaded rows; the final `FINALIZE_SORT` will re-sort everything. Acceptable edge case.
