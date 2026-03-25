## Context

TuneTag is a Tauri v2 app with a Rust backend and React/TypeScript frontend. Tag I/O is handled by lofty-rs, which supports reading and writing cover art (pictures) for all v1 formats: ID3v2 (MP3), Vorbis Comments (FLAC), and MP4 atoms (M4A). The Tag Panel is a persistent sidebar that shows editable fields for selected files. Cover art (PRD §7.3) needs to be integrated into this panel with display, embed, remove, and export functionality.

The key architectural challenge is efficiently passing image data between the Rust backend and React frontend across Tauri's IPC boundary, and performing byte-for-byte multi-file comparison without excessive memory or transfer overhead.

## Goals / Non-Goals

**Goals:**
- Display embedded cover art in the Tag Panel for single and multi-file selections
- Allow embedding cover art via drag-and-drop of JPEG/PNG files
- Support removing and exporting cover art via right-click context menu
- Efficient multi-file cover art comparison (byte-for-byte)
- Integration with the undo/redo stack

**Non-Goals:**
- Cover art editing (crop, resize, rotate) — out of scope
- Fetching cover art from online sources (handled separately by MusicBrainz lookup)
- Supporting image formats beyond JPEG and PNG
- Cover art in file list columns
- Batch cover art operations beyond what multi-file selection provides

## Decisions

### Decision 1: Base64 encoding for cover art transfer over IPC

**Choice:** Encode cover art as base64 strings when passing from Rust to React via Tauri commands.

**Rationale:** Tauri v2 commands serialize return values as JSON. Binary data cannot be directly represented in JSON. Base64 is the standard approach, adding ~33% overhead but keeping the architecture simple and compatible with `<img src="data:...">` rendering.

**Alternatives considered:**
- **Write to temp file, pass path:** Avoids base64 overhead but introduces temp file lifecycle management, platform-specific path issues, and file:// security restrictions in the webview. More complexity for marginal gain — cover art is typically 100KB–500KB.
- **Tauri asset protocol:** Could serve images via `asset://` URLs, but requires registering a custom protocol scope and managing file references. Overkill for a single image display.

**Details:**
- Rust reads cover art bytes from lofty `Picture` → base64-encodes → returns `{ data: string, mime_type: string }` to frontend
- Frontend renders as `<img src="data:{mime_type};base64,{data}" />`
- For embed: frontend reads dropped file, sends file path to Rust; Rust reads file bytes, validates format, and writes to tag

### Decision 2: Hash-based multi-file cover art comparison

**Choice:** Compute a SHA-256 hash of each file's cover art bytes on the Rust side. Compare hashes rather than transferring all images to the frontend.

**Rationale:** Byte-for-byte comparison is the PRD requirement. Transferring full cover art for N selected files just to compare them would be wasteful (N × 500KB over IPC). Instead, Rust computes a hash per file and returns: (a) the base64 image data if all hashes match, or (b) a `"mixed"` indicator if they differ. This reduces IPC to a single image transfer in the common case.

**Alternatives considered:**
- **Transfer all images, compare in JS:** Simple but O(N) IPC transfers of full image data. Unacceptable for large selections.
- **Compare first bytes only:** Would miss images that differ only in later bytes. Violates the byte-for-byte requirement.

**Flow for multi-file selection:**
1. Frontend sends list of file paths to `get_cover_art_for_selection` command
2. Rust iterates files, reads cover art bytes, computes SHA-256 hash for each
3. If all hashes are identical (and at least one file has art): return the base64 image data
4. If hashes differ: return `{ status: "mixed" }` — frontend shows placeholder
5. If no files have cover art: return `{ status: "none" }` — frontend shows empty state

### Decision 3: Embed via file path, not frontend bytes

**Choice:** When the user drops an image file onto the cover area, the frontend sends the file path to Rust. Rust reads the file, validates it, and embeds it.

**Rationale:** Drag-and-drop in the webview provides the file path. Reading the file in Rust avoids sending potentially large image data over IPC from JS to Rust. Rust also handles format validation (checking JPEG/PNG magic bytes) in one place.

**Alternatives considered:**
- **Read file in JS, send base64 to Rust:** Works but doubles memory usage (JS buffer + Rust decode). Also moves validation to the wrong layer.

**Validation rules:**
- Check file magic bytes: JPEG (`FF D8 FF`) or PNG (`89 50 4E 47`)
- Reject other formats with a user-facing error message
- No file size limit enforced (lofty handles arbitrarily large pictures), but consider a UI warning for images > 5MB

### Decision 4: Export writes to user-chosen path via save dialog

**Choice:** Export cover uses Tauri's native save file dialog to let the user pick the destination. Rust extracts the cover art bytes and writes them to the chosen path.

**Rationale:** Native dialog is the expected UX for "save to file" on all platforms. The file extension is determined by the image's MIME type (`.jpg` for JPEG, `.png` for PNG).

### Decision 5: Undo/redo integration

**Choice:** Cover art changes (embed, remove) are discrete undo actions, consistent with the existing undo model (PRD §7.6).

**Details:**
- Embed: stores the previous cover art state (bytes or None) as the undo payload
- Remove: stores the removed cover art bytes as the undo payload
- Multi-file embed/remove counts as a single undo step

## Risks / Trade-offs

- **[Base64 overhead for large images]** → Acceptable for typical cover art (100–500KB). A 1MB image becomes ~1.3MB base64. If this becomes a bottleneck, Tauri's asset protocol can be added later without changing the data model.

- **[SHA-256 computation for many files]** → SHA-256 of a 500KB image takes ~microseconds. Even for 1000 files, total hash time is negligible compared to file I/O. The bottleneck is reading cover art from disk, which is already part of tag loading.

- **[Memory for undo payloads]** → Storing full cover art bytes in the undo stack could consume significant memory if users repeatedly embed large images. Mitigated by the 100-action stack depth limit. Worst case: 100 × 1MB = 100MB, which is acceptable for a desktop app.

- **[Drag-and-drop file path access]** → Tauri v2's drag-and-drop API provides file paths from the OS drop event. This works on all target platforms (Windows, macOS, Linux). The frontend uses Tauri's `onDragDropEvent` listener, not the HTML5 drag-and-drop API, to get native file paths.
