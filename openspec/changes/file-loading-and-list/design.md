## Context

TuneTag is a Tauri v2 application with a Rust backend and React/TypeScript frontend. The app currently has no file loading or display capabilities. This change introduces the foundational data pipeline: scanning files from disk in Rust, reading metadata via the `lofty` crate, serializing it to the frontend, and rendering it in a performant table.

The PRD specifies support for MP3, FLAC, and M4A formats, with a performance target of loading 1,000 files from a local SSD in under 3 seconds.

## Goals / Non-Goals

**Goals:**

- Define the Tauri command API for file/folder scanning and metadata reading
- Establish the data flow from Rust (lofty) → serialized JSON → React state
- Choose a virtualized table approach that handles 1,000+ files without jank
- Define column persistence strategy across sessions
- Support drag-and-drop and native file/folder dialogs

**Non-Goals:**

- Tag editing or saving (future change)
- File list filtering or search (out of scope for v1)
- File watching for external changes (manual refresh only)
- CLI file loading (CLI has its own path)

## Decisions

### 1. Tauri Command API Design

**Decision:** Two primary commands — `scan_paths` and `read_file_metadata`.

`scan_paths` accepts a list of paths (files or directories), a recursive flag, and returns a flat list of `FileEntry` structs. It handles directory traversal, filters by supported extensions (`.mp3`, `.flac`, `.m4a`), and reads tags + audio properties for each file in a single pass.

```
#[tauri::command]
async fn scan_paths(paths: Vec<PathBuf>, recursive: bool) -> Result<Vec<FileEntry>, String>
```

`FileEntry` struct (serialized to frontend via serde):
```rust
struct FileEntry {
    id: String,           // UUID or hash-based unique ID
    path: String,         // absolute path
    filename: String,     // basename
    format: String,       // "MP3", "FLAC", "M4A"
    // Standard tags
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    album_artist: Option<String>,
    year: Option<String>,
    track: Option<String>,
    disc: Option<String>,
    genre: Option<String>,
    comment: Option<String>,
    // Audio properties
    duration_secs: Option<f64>,
    bitrate_kbps: Option<u32>,
    sample_rate_hz: Option<u32>,
    channels: Option<u8>,
}
```

**Why a single `scan_paths` command instead of separate scan + read:** Reduces IPC round-trips. Reading metadata during scanning is fast with lofty (pure Rust, no subprocess), and sending one batch to the frontend is simpler than coordinating incremental updates. For 1,000 files, the entire scan + read cycle should complete within the 3-second target.

**Alternative considered:** Streaming results via Tauri events as files are discovered. Rejected for v1 because it adds complexity (partial state, progress tracking) without clear benefit — the 3-second budget is achievable in a single batch. Can revisit if users load 10K+ file libraries.

### 2. File ID Strategy

**Decision:** Use the absolute file path as the unique identifier, with a deterministic hash (e.g., `blake3` of the path string) as the `id` field.

**Why not UUID:** UUIDs would change on reload, breaking any future state references. Path-based hashes are deterministic — the same file always gets the same ID.

**Why hash instead of raw path:** Paths can contain special characters and be very long. A fixed-length hash is safer as a map key and React list key.

### 3. Frontend State Management

**Decision:** Store loaded files in a React context (`FilesContext`) as a `Map<string, FileEntry>` keyed by `id`. A separate `sortedIds: string[]` array tracks the current display order.

Sorting is performed entirely on the frontend. When the user clicks a column header, the `sortedIds` array is re-sorted based on the column's field value. This avoids IPC round-trips for sort operations.

**Alternative considered:** Zustand or Redux. Rejected — React context + useReducer is sufficient for this data shape and avoids adding a state management dependency.

### 4. Virtualized Table Rendering

**Decision:** Use `@tanstack/react-virtual` for row virtualization.

The table renders only the visible rows plus a small overscan buffer. With 1,000 files at ~32px row height and a ~600px viewport, only ~20-25 rows are rendered at a time.

**Why @tanstack/react-virtual over react-window or react-virtualized:**
- Headless — no imposed DOM structure, full control over table markup (`<table>`, `<tr>`, `<td>`)
- Smaller bundle size (~5KB vs 30KB+ for react-virtualized)
- Active maintenance, aligns with TanStack ecosystem

**Column rendering:** Each column is defined by a `ColumnDef` object specifying: `id`, `label`, `field` (key into `FileEntry`), `width`, and `sortable`. The row number column (`#`) is computed from the display index, not stored in the data.

### 5. Column Persistence Strategy

**Decision:** Store column configuration in the Tauri app data directory using a JSON file (`column-config.json`), accessed via a Tauri command.

```rust
#[tauri::command]
async fn load_column_config(app: AppHandle) -> Result<Option<ColumnConfig>, String>

#[tauri::command]
async fn save_column_config(app: AppHandle, config: ColumnConfig) -> Result<(), String>
```

```rust
struct ColumnConfig {
    columns: Vec<ColumnSetting>,
}
struct ColumnSetting {
    field: String,
    width: u32,
    visible: bool,
}
```

Column order is determined by array position. The frontend loads this on startup and saves on any column change (add/remove/reorder/resize).

**Why file-based via Tauri instead of localStorage:** Tauri apps can clear webview storage between updates. File-based config in the app data directory is durable and consistent with how Tauri apps manage settings.

### 6. Drag-and-Drop Implementation

**Decision:** Use Tauri v2's drag-and-drop event system (`tauri://drag-drop` events) to receive file paths from the OS, then call the same `scan_paths` command.

The frontend listens for the Tauri drag-drop event, extracts the file paths, and invokes `scan_paths`. This ensures identical behavior whether files are opened via dialog or drag-and-drop.

### 7. Format Filtering

**Decision:** Filter by file extension (case-insensitive) during directory traversal: `.mp3`, `.flac`, `.m4a`. Do not attempt to read file headers for format detection.

**Why extension-only:** Header detection adds I/O overhead and complexity. Misnamed files are an edge case that doesn't justify the cost. lofty will return an error for truly unsupported files, which can be skipped gracefully.

## Risks / Trade-offs

- **[Large directory performance]** → If a user opens a folder with 10K+ files, the single-batch approach may cause a noticeable freeze. Mitigation: the 3-second target is for 1,000 files; for v1 this is acceptable. A future change can add streaming/progress if needed.

- **[Path-based IDs break on file rename]** → If a file is renamed externally, its ID changes on next load. Mitigation: acceptable for v1 since there's no persistent cross-session state referencing file IDs. Refresh (F5) reloads everything.

- **[Column config file corruption]** → If the JSON config file is corrupted, column settings are lost. Mitigation: fall back to default columns if parsing fails. The config file is small and written atomically.

- **[Drag-and-drop platform differences]** → Tauri's drag-drop events may behave differently across OS. Mitigation: test on all three platforms; the fallback (File > Open) always works.
