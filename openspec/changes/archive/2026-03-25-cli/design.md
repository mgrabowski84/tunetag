## Context

TuneTag's CLI binary (`tunetag`) was scaffolded in the `project-scaffolding` change with clap-derived subcommand definitions. Each subcommand currently prints "not yet implemented" and exits. The `tunetag-core` crate provides the underlying tag I/O (`read_tags`, `write_tags`), audio property reading (`read_audio_properties`), and cover art operations. The `core-tag-io` change established a synchronous API with unified `TagData` and `AudioProperties` types and typed `TagError` errors.

This change wires the CLI subcommands to `tunetag-core`, adds output formatting (human-readable and JSON), implements `--dry-run` for write and rename, and adds batch error handling with appropriate exit codes.

Key constraints:
- CLI must use `tunetag-core` for all logic — no duplication of tag I/O or rename logic
- Output goes to stdout; errors go to stderr
- `--dry-run` must never modify any file
- Batch operations use skip-and-continue error handling (PRD §7.5)
- Exit codes: 0 success, 1 partial failure, 2 fatal error (PRD §8)

## Goals / Non-Goals

**Goals:**

- Make all CLI subcommands functional: `read`, `write`, `rename`, `cover set`, `cover remove`, `info`, `autonumber`
- Support two output modes: human-readable `key=value` (default) and structured `--json`
- Implement `--dry-run` on `write` (diff of old → new per field) and `rename` (old → new filename)
- Implement batch error handling with skip-and-continue, stderr error reporting, summary lines, and correct exit codes
- Keep the CLI thin — subcommand handlers are glue code that calls `tunetag-core` and formats output

**Non-Goals:**

- Adding new functionality to `tunetag-core` (the core API is assumed complete for CLI needs)
- Interactive prompts or TUI — the CLI is non-interactive, designed for scripting
- Parallel file processing (sequential is sufficient for v1; `rayon` can be added later)
- Shell completions (nice-to-have, not part of this change)
- Config file support (e.g., default `--format` string) — out of scope for v1

## Decisions

### 1. Subcommand-to-core mapping

**Decision:** Each CLI subcommand maps directly to one or two `tunetag-core` functions. The CLI handler is responsible for argument extraction, calling core, formatting output, and collecting errors.

| Subcommand | Core function(s) |
|---|---|
| `read <file>` | `read_tags(path)` |
| `write <file> --field value` | `read_tags(path)` + `write_tags(path, tag_data)` |
| `rename <files> --format` | `read_tags(path)` + filesystem rename |
| `cover set <file> --image` | `read_tags(path)` + `write_tags(path, tag_data_with_cover)` |
| `cover remove <file>` | `read_tags(path)` + `write_tags(path, tag_data_cover_removed)` |
| `info <file>` | `read_audio_properties(path)` |
| `autonumber <files>` | `read_tags(path)` + `write_tags(path, tag_data_with_track)` |

**Rationale:** The CLI is a thin adapter layer. Core already handles format detection, ID3 version preservation, and error typing. The CLI should not duplicate any of this logic.

**Alternative considered:** A higher-level "CLI operations" module in `tunetag-core`. Rejected — this would couple core to CLI-specific concepts (output formatting, dry-run) that don't belong in a library crate.

### 2. Output formatting strategy

**Decision:** Introduce an `OutputFormatter` abstraction in the CLI crate with two implementations: `HumanFormatter` (default) and `JsonFormatter` (activated by `--json`).

**Human format rules:**
- `read`: `Key=Value` per line (e.g., `Title=Creep`)
- `write --dry-run`: `field: "old" → "new"` per changed field, grouped by file
- `rename --dry-run`: `old_filename → new_filename` per file
- `info`: `Key: Value` per property (e.g., `Duration: 3:42`, `Bitrate: 320 kbps`)
- Batch operations: summary line at end (e.g., `Saved 95/100 files (5 failed)`)

**JSON format rules:**
- `read`: `{ "file": "...", "tags": { "Title": "...", ... } }`
- `write --dry-run`: `[{ "file": "...", "changes": [{ "field": "...", "old": "...", "new": "..." }] }]`
- `rename --dry-run`: `[{ "file": "...", "new_name": "..." }]`
- `info`: `{ "file": "...", "duration_secs": N, "bitrate_kbps": N, ... }`
- Errors in JSON mode: `{ "error": "...", "file": "..." }` objects in an errors array

**Rationale:** The formatter abstraction keeps subcommand handlers clean — they produce structured data and delegate rendering to the formatter. JSON output uses `serde_json` serialization of intermediate structs.

**Alternative considered:** Direct `println!` in each handler with conditional `--json` checks. Rejected — leads to scattered formatting logic and makes it hard to ensure consistent JSON structure across subcommands.

### 3. Dry-run implementation

**Decision:** `--dry-run` is implemented entirely in the CLI layer. For `write --dry-run`, the handler reads current tags, computes the diff against the proposed changes, and outputs the diff without calling `write_tags`. For `rename --dry-run`, the handler resolves all new filenames from tags and outputs the mapping without performing any filesystem rename.

**`write --dry-run` flow:**
1. Read current tags via `read_tags(path)`
2. Build proposed `TagData` from CLI flags
3. Compare each field: if the proposed value differs from current, include it in the diff
4. Format and output the diff (no write call)

**`rename --dry-run` flow:**
1. For each file, read tags via `read_tags(path)`
2. Resolve the format string with tag values to produce the new filename
3. Check for collisions across all resolved names
4. If collisions exist, report them and exit with code 2
5. If no collisions, output `old → new` for each file (no rename call)

**Rationale:** Dry-run is a CLI-specific concern. Core doesn't need a "preview" mode — the CLI simply skips the write/rename step. This keeps core simple and gives the CLI full control over diff formatting.

### 4. Format string resolution for rename

**Decision:** The rename format string uses `%field%` placeholders (e.g., `%artist% - %title%`). The CLI resolves these by reading tags from each file and substituting values. Unresolved placeholders (tag field is empty/missing) are replaced with an empty string. The file extension from the original file is always preserved.

**Supported placeholders:** `%title%`, `%artist%`, `%album%`, `%year%`, `%track%`, `%disc%`, `%albumartist%`, `%genre%`

**Collision detection:** Before any rename executes, all resolved filenames are collected and checked for duplicates. If any two files would resolve to the same target name, the entire batch is aborted with all conflicts listed. This matches PRD §7.4.

**Rationale:** This mirrors Mp3tag's format string syntax which the target audience already knows. Collision detection before execution prevents partial renames that leave the filesystem in an inconsistent state.

### 5. Batch error handling and exit codes

**Decision:** Batch operations (`write`, `rename`, `autonumber`, `cover set/remove` when given multiple files) use skip-and-continue semantics. Errors are printed to stderr as they occur. A summary line is printed at the end. Exit codes follow the PRD:

| Code | Meaning |
|---|---|
| 0 | All operations succeeded |
| 1 | Partial failure (some files failed, some succeeded) |
| 2 | Fatal error (no files processed — e.g., no files matched glob, invalid arguments) |

**Implementation:** An `ErrorCollector` struct accumulates `(file, error)` pairs during batch execution. After the loop, it determines the exit code and formats the summary.

```
struct ErrorCollector {
    total: usize,
    errors: Vec<(PathBuf, TagError)>,
}
```

**Rationale:** This matches the PRD's batch error handling specification (§7.5) and is the expected behavior for CLI tools that process multiple files (similar to `find -exec`, `rsync`).

### 6. Autonumber implementation

**Decision:** The `autonumber` subcommand assigns sequential track numbers starting from `--start` (default 1). Files are numbered in the order provided on the command line (which reflects glob expansion order, typically alphabetical). Options:

- `--start N`: starting track number (default: 1)
- `--total N`: total tracks to write (default: count of files)
- `--write-total` / `--no-write-total`: whether to write `N/Total` format or just `N` (default: write total)
- `--disc N`: optional disc number to set on all files
- `--sort filename`: sort files by filename before numbering (default: input order)

**Rationale:** Matches the GUI Auto-Numbering Wizard options from PRD §7.8. The `--sort filename` option is important because shell glob order may not match desired track order on all platforms.

### 7. Cover art operations

**Decision:** `cover set` reads the image file, validates it (JPEG/PNG via magic bytes, reusing core's validation), and writes it as cover art via `write_tags`. `cover remove` reads tags, marks cover art for removal, and writes. Both support batch files (multiple positional args).

**Rationale:** Cover art operations are simple wrappers around the existing `TagData.cover_art` field in core. The CLI just needs to handle file I/O for the image and delegate to core.

## Risks / Trade-offs

- **[Risk] Format string placeholders with special filesystem characters** → Tag values like `Artist: "AC/DC"` produce filenames with `/`, which is a path separator. Mitigation: Sanitize resolved values by replacing filesystem-illegal characters (`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`) with `_` before constructing the filename.

- **[Risk] Glob expansion produces no files** → If `tunetag rename *.flac --format "..."` matches no files, the CLI should exit with code 2 and a clear error. The shell does glob expansion, so the CLI receives zero positional args. Mitigation: Check for empty file list before processing and exit with a descriptive fatal error.

- **[Trade-off] Sequential vs. parallel batch processing** → Sequential processing is simpler and deterministic. For v1, processing 1,000 files sequentially is acceptable (PRD target: <10s for rename). Parallel processing with `rayon` can be added later if needed.

- **[Trade-off] Human-readable output is not machine-parseable** → The `key=value` format could break if values contain `=` or newlines. This is acceptable because `--json` exists for machine consumption. The human format prioritizes readability.

- **[Risk] Rename collision false positives on case-insensitive filesystems** → macOS (HFS+/APFS default) and Windows (NTFS) are case-insensitive. Two files resolving to `radiohead - creep.mp3` and `Radiohead - Creep.mp3` would collide. Mitigation: Perform case-insensitive collision detection on all platforms to be safe.
