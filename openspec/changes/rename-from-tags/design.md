## Context

TuneTag is a Tauri v2 app (Rust backend + React/TypeScript frontend). Tag values are already read into memory via lofty-rs when files are loaded. The rename feature (PRD §7.4) needs to resolve format strings like `%artist% - %title%` against these in-memory tag values, preview the results, detect collisions, and execute batch renames on disk. The same core logic must be usable from both the GUI modal and the CLI `tunetag rename` subcommand.

The key design challenges are: (1) a robust format string parser that handles missing/empty tag values gracefully, (2) filename sanitization across three OSes, (3) collision detection that must account for case-insensitive filesystems (macOS, Windows), and (4) a two-phase workflow (preview → execute) that keeps the UI responsive.

## Goals / Non-Goals

**Goals:**
- Implement a format string engine in Rust that parses `%placeholder%` tokens and resolves them against tag field values
- Sanitize resolved filenames for the target platform's filesystem constraints
- Detect name collisions before any file is renamed (abort entire batch on conflict)
- Verify write permissions on target directories before executing renames
- Provide live preview (single file) and dry-run preview (all selected files) in the GUI
- Skip-and-continue error handling if a rename fails at runtime after pre-checks pass
- Share the core rename logic between GUI and CLI

**Non-Goals:**
- Filename-to-tag (parsing tags from filenames) — explicitly out of scope for v1
- Regex or conditional expressions in format strings — only `%placeholder%` tokens
- Moving files to different directories as part of rename — rename stays in the same directory
- Undo support for renames — disk operations are not reversible via the in-memory undo stack
- Custom placeholder definitions beyond the PRD-specified set

## Decisions

### Decision 1: Simple token-replacement parser (no nested expressions)

**Choice:** The format string parser uses a straightforward scan for `%name%` delimiters. Any text between `%` pairs is looked up as a placeholder name. Literal `%` is not supported (no escaping).

**Rationale:** The PRD specifies a fixed set of 8 placeholders with `%name%` syntax. There is no requirement for conditionals, nested expressions, or escaping. A simple parser keeps the code minimal and the user-facing format strings easy to understand.

**Alternatives considered:**
- **Template engine (e.g., Tera, Handlebars):** Massively overengineered for 8 fixed placeholders. Adds a dependency and exposes complex syntax the user doesn't need.
- **Regex-based parsing:** Could work, but a hand-written scanner is clearer and avoids regex compilation overhead on every keystroke during live preview.

**Placeholder mapping:**

| Placeholder | Tag field (lofty) |
|---|---|
| `%title%` | Title |
| `%artist%` | Artist |
| `%album%` | Album |
| `%year%` | Year |
| `%track%` | Track number (numeric part only, no total) |
| `%disc%` | Disc number (numeric part only, no total) |
| `%albumartist%` | Album Artist |
| `%genre%` | Genre |

**Missing/empty values:** If a tag field is empty or missing, the placeholder resolves to an empty string. This may produce filenames with leading/trailing separators (e.g., ` - Creep.mp3` if artist is empty). This is acceptable — the dry-run preview makes it visible before execution.

### Decision 2: Platform-aware filename sanitization

**Choice:** After resolving the format string, sanitize the result by replacing characters illegal on the current OS filesystem. The original file extension is always preserved (appended after the resolved name).

**Rationale:** Different OSes have different invalid filename characters. Sanitization must happen in Rust where the rename executes, using the build target to determine rules.

**Sanitization rules:**
- **All platforms:** Replace `/` and null byte with `_`. Trim leading/trailing whitespace and dots. Collapse consecutive whitespace to a single space. If the result is empty after sanitization, use a fallback name (e.g., `untitled`).
- **Windows (additional):** Replace `\ : * ? " < > |` with `_`. Reject reserved names (CON, PRN, NUL, etc.) by appending `_`.
- **macOS (additional):** Replace `:` with `_` (HFS+ uses `:` as path separator internally).
- **Linux:** No additional restrictions beyond `/` and null byte.

The file extension (e.g., `.mp3`, `.flac`, `.m4a`) is taken from the original filename and appended unchanged.

### Decision 3: Case-aware collision detection

**Choice:** Before executing any renames, build a map of all resolved target filenames and check for duplicates. On case-insensitive filesystems (macOS, Windows), compare using case-folded names. On Linux, compare case-sensitively.

**Rationale:** The PRD requires aborting the entire batch if any files would resolve to the same name. On macOS and Windows, `Creep.mp3` and `creep.mp3` are the same file — collision detection must account for this. We detect the filesystem case-sensitivity at runtime rather than using compile-time OS checks, to handle edge cases (e.g., case-sensitive APFS on macOS).

**Algorithm:**
1. Resolve format string for every selected file → list of `(original_path, new_name)` pairs
2. Group by target directory (files in different directories cannot collide)
3. For each directory group, insert new names into a `HashMap` (case-folded on case-insensitive FS)
4. If any insertion finds a duplicate key, collect all conflicting pairs
5. If conflicts exist, return them all to the caller — no files are renamed

**Case-sensitivity detection:** Use a heuristic: attempt to stat a temp-named file in the target directory with different casing. Cache the result per directory. Fallback: assume case-insensitive on Windows/macOS, case-sensitive on Linux.

### Decision 4: Two-phase rename flow (preview → execute)

**Choice:** The rename operation is split into two phases, both in GUI and CLI:

1. **Preview (dry run):** Resolve all format strings, run collision detection and permission checks, return a list of `(old_name → new_name)` pairs or errors. No files are modified.
2. **Execute:** Perform `std::fs::rename` for each file. If a rename fails at runtime, skip it and continue with remaining files.

**Rationale:** The PRD requires dry-run support and pre-checks before execution. Separating preview from execution means the same preview logic serves the live preview, dry-run table, and CLI `--dry-run` flag.

**Tauri commands:**
- `rename_preview(file_paths: Vec<String>, format: String) → RenamePreviewResult` — returns resolved names, collisions, permission errors
- `rename_execute(file_paths: Vec<String>, format: String) → RenameExecuteResult` — runs preview internally first (as a safety check), then executes renames, returns success/failure per file

### Decision 5: Live preview resolves against the first selected file

**Choice:** As the user types in the format string input, the modal shows a live preview resolving the format against the first selected file only.

**Rationale:** Resolving against all selected files on every keystroke would be expensive for large selections and would clutter the UI. The PRD specifies "show resolved filename for the first selected file as the user types." The full dry-run table (all files) is shown when the user explicitly clicks a "Preview" button.

**Implementation:** The frontend debounces keystrokes (~150ms) and calls a lightweight Tauri command (`rename_preview_single`) that resolves the format string for one file. This is fast enough for real-time feedback.

### Decision 6: Modal dialog UI structure

**Choice:** The rename dialog is a modal opened from Convert → "Rename Files from Tags…" with the following layout:

```
┌─────────────────────────────────────────┐
│  Rename Files from Tags                 │
├─────────────────────────────────────────┤
│  Format: [%artist% - %title%        ]  │
│  Preview: Radiohead - Creep.mp3         │
│                                         │
│  [Preview All]                          │
│  ┌─────────────────────────────────┐    │
│  │ Original          → New         │    │
│  │ track01.mp3       → Radiohead … │    │
│  │ track02.mp3       → Radiohead … │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ⚠ 2 files would have the same name    │
│                                         │
│          [Cancel]  [Rename]             │
└─────────────────────────────────────────┘
```

- **Format input** with live preview (first file) below it
- **Preview All** button triggers full dry-run and populates the table
- **Results table** showing original → new name for all selected files
- **Collision/error banner** shown if pre-checks fail — Rename button disabled
- **Cancel** and **Rename** buttons at the bottom

### Decision 7: Write permission pre-check

**Choice:** Before executing renames, check write permissions on each target directory by testing `std::fs::metadata` on the directory and verifying write permission bits (Unix) or attempting a test operation (Windows).

**Rationale:** The PRD specifies verifying write permissions before execution. Checking upfront avoids partial execution where some files rename and others fail due to permissions.

**Implementation:**
- On Unix: check directory metadata for write permission (`mode & 0o200`)
- On Windows: attempt to create and immediately delete a temp file in the target directory
- If any directory fails the permission check, abort the entire batch and report which directories are unwritable

## Risks / Trade-offs

- **[Case-sensitivity detection is a heuristic]** → On unusual filesystem configurations (e.g., case-sensitive APFS volume on macOS), the heuristic may get it wrong. Mitigation: the runtime rename itself will fail if there's a true collision the pre-check missed, and the skip-and-continue strategy handles it gracefully.

- **[Empty placeholders produce ugly filenames]** → If tags are incomplete, resolved names may have dangling separators like ` - .mp3`. Mitigation: the dry-run preview makes this visible. Users can fix tags before renaming. Adding automatic cleanup of dangling separators is a potential future enhancement.

- **[Rename is not undoable]** → Unlike tag edits, file renames are disk operations outside the undo stack. If a user makes a mistake, they must manually rename or re-run with corrected tags. Mitigation: the mandatory dry-run preview and collision detection reduce the risk of accidental renames.

- **[Race condition between pre-check and execution]** → Another process could create a file with the target name between the pre-check and the actual rename. Mitigation: the skip-and-continue strategy handles this — `std::fs::rename` will fail for the affected file, and the error is reported.

- **[Large batch performance]** → Resolving format strings for 10,000+ files should still be fast (tag values are already in memory). The bottleneck is I/O for the actual `fs::rename` calls, which is inherently sequential per-file. Mitigation: for typical batches (hundreds of files), this completes in under a second.
