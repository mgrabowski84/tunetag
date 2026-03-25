## Why

The CLI binary (`tunetag`) exists as a scaffold with placeholder subcommands from the `project-scaffolding` change. Users need the CLI to actually work — read tags, write tags, rename files, manage cover art, show audio info, and auto-number tracks — so they can script batch tagging workflows and use TuneTag headlessly in CI/automation pipelines. This change makes every CLI subcommand functional by wiring them to `tunetag-core`.

## What Changes

- Implement `read` subcommand: reads all tags from a file and prints them as `key=value` (or JSON with `--json`)
- Implement `write` subcommand: sets one or more tag fields on a file; supports `--dry-run` to show a diff of old → new values without writing
- Implement `rename` subcommand: renames files on disk using a format string with tag placeholders; supports `--dry-run` to preview renames; aborts entire batch on collision
- Implement `cover set` subcommand: embeds a JPEG/PNG image as cover art
- Implement `cover remove` subcommand: strips embedded cover art
- Implement `info` subcommand: prints audio properties (duration, bitrate, sample rate, channels)
- Implement `autonumber` subcommand: assigns sequential track (and optional disc) numbers to a batch of files
- Add output formatting layer: human-readable `key=value` default and structured `--json` mode
- Add `--dry-run` support for `write` and `rename` with diff-style output
- Add batch error handling: skip-and-continue with errors to stderr, summary line, and exit codes (0/1/2)

## Capabilities

### New Capabilities
- `cli-commands`: All CLI subcommand implementations including output formatting, dry-run behavior, exit code semantics, and batch error handling

### Modified Capabilities

## Impact

- **Code:** `tunetag-cli` crate — replaces placeholder "not yet implemented" handlers with real implementations calling `tunetag-core`
- **Dependencies:** `tunetag-core` (tag I/O, audio properties, cover art); `serde_json` for `--json` output; potentially `rayon` if parallel batch processing is desired (optional)
- **APIs:** No public API changes to `tunetag-core`; all new code is in the CLI crate
- **Systems:** The `tunetag` binary becomes usable for real workflows after this change
