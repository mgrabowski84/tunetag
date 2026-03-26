## 1. Rust Backend — scan_paths_progressive command

- [x] 1.1 Add `scan_id` counter (AtomicU64) to track concurrent scans and add `ScanBatch` event payload struct `{ scan_id: u64, entries: Vec<FileEntry> }` and `ScanComplete` struct `{ scan_id: u64, total: usize }`
- [x] 1.2 Implement `scan_paths_progressive` Tauri command: resolve paths, spawn background task via `tauri::async_runtime::spawn`, return `Ok(())` immediately
- [x] 1.3 Implement background task: collect audio file paths, iterate with per-file `read_file_entry`, accumulate into buffer of up to 20 entries
- [x] 1.4 Implement time-based flush: track last-flush `Instant`, emit `"file-batch-loaded"` event when buffer reaches 20 entries OR 100ms has elapsed since last flush
- [x] 1.5 After all files processed, flush remaining buffer and emit `"scan-complete"` event
- [x] 1.6 Register `scan_paths_progressive` in the Tauri `invoke_handler`

## 2. FilesContext — new reducer actions

- [x] 2.1 Add `CLEAR_FILES` action: reset `files` Map, `sortedIds`, and `selectedIds` to empty
- [x] 2.2 Add `ADD_FILES_BATCH` action: append a `FileEntry[]` batch to the `files` Map and push IDs to the end of `sortedIds` (no sort — append order)
- [x] 2.3 Add `FINALIZE_SORT` action: re-sort `sortedIds` using the current `sort` config (called once on scan-complete)
- [x] 2.4 Expose `clearFiles`, `addFilesBatch`, and `finalizeSort` callbacks from the FilesProvider

## 3. App.tsx — event-driven scan flow

- [x] 3.1 Add `scanning: boolean` and `scanCount: number` state
- [x] 3.2 Add `scanIdRef: useRef<number>` to track current scan ID and discard stale events
- [x] 3.3 Add `startProgressiveScan(paths: string[], recursive: boolean)` function: increment scanId, dispatch `CLEAR_FILES`, `clearAllEdits`, set `scanning(true)`, `scanCount(0)`, invoke `scan_paths_progressive`
- [x] 3.4 Set up `"file-batch-loaded"` event listener in a `useEffect`: check `event.payload.scanId === scanIdRef.current`, dispatch `ADD_FILES_BATCH`, update `scanCount`
- [x] 3.5 Set up `"scan-complete"` event listener: check scanId, dispatch `FINALIZE_SORT`, set `scanning(false)`
- [x] 3.6 Add 60-second timeout that clears `scanning` if `scan-complete` never arrives
- [x] 3.7 Pass `startProgressiveScan` as a prop/callback to `MenuBar` to replace the current inline `invoke("scan_paths")` calls

## 4. MenuBar — use progressive scan callback

- [x] 4.1 Accept `onScanPaths: (paths: string[], recursive: boolean) => void` prop
- [x] 4.2 Update `handleOpenFiles` to call `onScanPaths(paths, false)` instead of `invoke("scan_paths")` + `setFiles`
- [x] 4.3 Update `handleOpenFolder` to call `onScanPaths([folderPath], state.recursive)` instead of `invoke("scan_paths")` + `setFiles`

## 5. App.tsx — update drag-and-drop

- [x] 5.1 Update the drag-drop `onDragDropEvent` handler to call `startProgressiveScan(paths, state.recursive)` instead of the old `loadDroppedPaths` function

## 6. FileList — loading indicator

- [x] 6.1 Accept `scanning: boolean` and `scanCount: number` props
- [x] 6.2 Render a thin bar above the column headers when `scanning` is true: spinner + "Loading... N files" text using the design system colors (`bg-primary-container`, `text-on-primary-container`)
- [x] 6.3 Ensure the loading bar does not displace the column headers (use `shrink-0` and keep column headers below it)

## 7. Wire up in App.tsx

- [x] 7.1 Pass `scanning` and `scanCount` to `FileList`
- [x] 7.2 Pass `onScanPaths={startProgressiveScan}` to `MenuBar`
- [x] 7.3 Remove the now-unused `loadDroppedPaths` function and `setFiles` call from the drag-drop handler

## 8. Testing & Verification

- [x] 8.1 Verify `cargo build --workspace` compiles clean
- [x] 8.2 Verify `npx tsc --noEmit` passes
- [x] 8.3 Verify `cargo clippy --workspace -- -D warnings` passes
- [x] 8.4 Manual test: open a folder with 100+ files, confirm rows appear progressively and loading bar shows count
- [x] 8.5 Manual test: open a second folder while first scan is in progress, confirm old results are replaced cleanly
