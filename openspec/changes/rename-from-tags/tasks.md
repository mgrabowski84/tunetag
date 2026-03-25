## 1. Rust Backend — Format String Engine

- [ ] 1.1 Create a `rename` module in the Rust backend with a format string parser that scans for `%placeholder%` tokens and produces a list of segments (literal text or placeholder reference)
- [ ] 1.2 Implement placeholder resolution: given a parsed format string and a map of tag field values, substitute each placeholder with its tag value (empty string if missing); extract numeric-only part for `%track%` and `%disc%`
- [ ] 1.3 Implement platform-aware filename sanitization: replace OS-illegal characters with `_`, trim leading/trailing whitespace and dots, collapse consecutive whitespace, use fallback name for empty results
- [ ] 1.4 Implement file extension preservation: extract the original extension and append it to the sanitized resolved name

## 2. Rust Backend — Collision Detection & Pre-checks

- [ ] 2.1 Implement collision detection: group resolved filenames by target directory, detect duplicates using case-folded comparison on case-insensitive filesystems and exact comparison on case-sensitive filesystems
- [ ] 2.2 Implement filesystem case-sensitivity detection heuristic (default: case-insensitive on macOS/Windows, case-sensitive on Linux)
- [ ] 2.3 Implement write permission pre-check: verify the user has write access to each target directory before executing renames
- [ ] 2.4 Implement no-op detection: skip files whose resolved name matches their current name

## 3. Rust Backend — Rename Execution & Tauri Commands

- [ ] 3.1 Implement `rename_preview_single` Tauri command: resolve the format string for a single file and return the resolved filename (for live preview)
- [ ] 3.2 Implement `rename_preview` Tauri command: resolve the format string for all provided file paths, run collision detection and permission pre-checks, return the full list of `(original → new)` mappings plus any errors/collisions
- [ ] 3.3 Implement `rename_execute` Tauri command: run the preview internally as a safety check, then execute `std::fs::rename` for each file with skip-and-continue error handling; return per-file success/failure results
- [ ] 3.4 Ensure rename core logic is structured as library functions (not Tauri-specific) so the CLI can call the same code

## 4. Frontend — Rename Dialog Component

- [ ] 4.1 Create `RenameDialog` modal React component with format string text input, live preview area, "Preview All" button, results table, and Cancel/Rename action buttons
- [ ] 4.2 Implement live preview: debounce format string input (~150ms), call `rename_preview_single` Tauri command, display resolved filename below the input
- [ ] 4.3 Implement "Preview All" dry-run: call `rename_preview` Tauri command and populate the results table with original → new name for all selected files
- [ ] 4.4 Display collision errors: show a warning banner listing conflicting files when collisions are detected; disable the Rename button
- [ ] 4.5 Display permission errors: show a warning banner listing unwritable directories when permission pre-checks fail; disable the Rename button
- [ ] 4.6 Implement Rename button: call `rename_execute`, show progress, display success/failure summary modal on completion

## 5. Frontend — Menu Integration & File List Update

- [ ] 5.1 Add "Rename Files from Tags…" entry to the Convert menu, enabled only when one or more files are selected
- [ ] 5.2 Wire the menu entry to open the `RenameDialog` modal, passing the current file selection
- [ ] 5.3 After successful renames, update the file list state to reflect new filenames and paths for renamed files

## 6. Testing & Validation

- [ ] 6.1 Test format string parsing: literal-only, single placeholder, multiple placeholders, unrecognized placeholder treated as literal
- [ ] 6.2 Test placeholder resolution: all values present, missing values produce empty strings, track/disc numeric extraction from `N/Total` format
- [ ] 6.3 Test filename sanitization: illegal characters replaced, empty result uses fallback, extension preserved, whitespace trimmed
- [ ] 6.4 Test collision detection: same-name in same directory detected, same-name in different directories allowed, case-insensitive collision on macOS/Windows, no-op files skipped
- [ ] 6.5 Test batch execution: successful batch, single-file failure skipped with remaining files renamed, permission failure aborts batch
- [ ] 6.6 Test live preview and dry-run table in the rename dialog with various format strings and file selections
