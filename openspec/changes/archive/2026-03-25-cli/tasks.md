## 1. Output Formatting and Error Handling Infrastructure

- [x] 1.1 Implement `OutputFormatter` trait with `HumanFormatter` and `JsonFormatter` implementations in `tunetag-cli` for rendering structured data to stdout
- [x] 1.2 Implement `ErrorCollector` struct for batch error accumulation, summary line formatting, and exit code determination (0/1/2)
- [x] 1.3 Implement format string resolver for rename: parse `%field%` placeholders, substitute from `TagData`, sanitize filesystem-unsafe characters, preserve original extension
- [x] 1.4 Implement collision detection for rename: collect all resolved target filenames, case-insensitive duplicate check, report all conflicts

## 2. Read and Info Subcommands

- [x] 2.1 Implement `read` subcommand: call `read_tags`, format output as `Key=Value` lines (human) or JSON object with `file` and `tags` keys
- [x] 2.2 Implement `info` subcommand: call `read_audio_properties`, format duration as `M:SS`, bitrate as `N kbps`, sample rate as `N Hz`, channels as integer; omit unavailable properties; support `--json`

## 3. Write Subcommand

- [x] 3.1 Implement `write` subcommand (non-dry-run): parse field flags, build `TagData` from CLI args, call `write_tags`; validate at least one field flag is provided
- [x] 3.2 Implement `write --dry-run`: read current tags, compare each field against proposed values, output diff (`field: "old" → "new"` human / JSON changes array); skip fields with no change
- [x] 3.3 Add batch support for `write`: accept multiple file args, iterate with `ErrorCollector`, print summary line

## 4. Rename Subcommand

- [x] 4.1 Implement `rename` subcommand (non-dry-run): read tags per file, resolve format string, run collision detection, execute filesystem renames with `ErrorCollector`
- [x] 4.2 Implement `rename --dry-run`: resolve all filenames, run collision detection, print `old → new` mapping (human/JSON) without renaming
- [x] 4.3 Handle edge cases: empty file list (exit 2), missing `--format` flag (exit 2), format string producing empty filename

## 5. Cover Art Subcommands

- [x] 5.1 Implement `cover set` subcommand: read image file, validate JPEG/PNG magic bytes, read current tags, set cover art field, call `write_tags`; handle image-not-found and unsupported-format errors
- [x] 5.2 Implement `cover remove` subcommand: read current tags, mark cover art for removal, call `write_tags`; no-op (exit 0) if no cover art exists

## 6. Autonumber Subcommand

- [x] 6.1 Implement `autonumber` subcommand: parse `--start`, `--total`, `--write-total`/`--no-write-total`, `--disc`, `--sort filename` flags; assign sequential track numbers; write via `write_tags` with `ErrorCollector`

## 7. Integration Testing

- [x] 7.1 Add integration tests for `read` and `info` subcommands with real audio fixture files (MP3, FLAC, M4A)
- [x] 7.2 Add integration tests for `write` and `write --dry-run` verifying tags are written/not-written and diff output matches expected format
- [x] 7.3 Add integration tests for `rename` and `rename --dry-run` verifying files are renamed/not-renamed, collision detection works, and dry-run output is correct
- [x] 7.4 Add integration tests for `cover set` and `cover remove` verifying cover art embedding/removal
- [x] 7.5 Add integration tests for `autonumber` verifying sequential numbering, `--start`, `--total`, `--disc`, `--sort`, and `--no-write-total` flags
- [x] 7.6 Add integration tests for exit codes: 0 (success), 1 (partial failure), 2 (fatal error) across batch operations
- [x] 7.7 Add integration tests for `--json` output format across all subcommands that support it
