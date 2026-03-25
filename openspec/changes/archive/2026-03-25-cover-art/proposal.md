## Why

The Tag Panel currently has no support for cover art. Users need to view, embed, remove, and export cover art as part of their tagging workflow — this is a core feature of any serious tag editor and is listed as a v1 requirement in the PRD (§7.3). Without it, users must fall back to separate tools to manage album artwork.

## What Changes

- Add an image widget to the Tag Panel that displays embedded cover art for selected file(s)
- Support drag-and-drop of JPEG/PNG image files onto the cover area to embed cover art
- Add right-click context menu on the cover widget with "Remove cover" and "Export cover to file" actions
- Implement byte-for-byte comparison of embedded image data across multi-file selections: show the cover if all selected files share identical art, otherwise show a placeholder
- Expose cover art operations (set, remove) through the existing Rust backend via Tauri commands
- CLI already defines `tunetag cover set` and `tunetag cover remove` subcommands (PRD §8); the Rust core functions added here will serve both GUI and CLI

## Capabilities

### New Capabilities
- `cover-art`: Display, embed, remove, and export embedded cover art in audio files. Covers the image widget UI, Rust backend commands, multi-file comparison logic, and format validation (JPEG/PNG).

### Modified Capabilities

## Impact

- **Rust backend**: New Tauri commands for reading, writing, removing, and exporting cover art using lofty-rs. Cover image data passed to the frontend as base64-encoded strings.
- **Frontend (React/TS)**: New `CoverArt` component in the Tag Panel with drag-and-drop, context menu, and placeholder states.
- **Tag read pipeline**: Cover art bytes must be read alongside text tags when files are loaded or selected.
- **Multi-file selection logic**: Existing tag panel multi-file handling must be extended with byte-for-byte cover art comparison.
- **Undo/Redo**: Cover art embed and remove operations must integrate with the existing undo stack as discrete actions.
- **Dependencies**: No new external dependencies — lofty-rs already supports reading/writing cover art for all v1 formats (MP3/ID3v2, FLAC/Vorbis Comments, M4A/MP4 atoms).
