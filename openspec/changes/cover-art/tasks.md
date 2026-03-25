## 1. Rust Backend — Cover Art Core

- [ ] 1.1 Add a `cover_art` module to the Rust backend with functions to read cover art bytes and MIME type from a tagged file using lofty-rs (support MP3, FLAC, M4A)
- [ ] 1.2 Implement `get_cover_art` Tauri command: given a file path, return `{ data: base64, mime_type: string }` or `null` if no cover art exists
- [ ] 1.3 Implement `get_cover_art_for_selection` Tauri command: given a list of file paths, compute SHA-256 hash of each file's cover art bytes, return the shared image (base64) if all match, or a status indicator (`"mixed"`, `"none"`)
- [ ] 1.4 Implement `embed_cover_art` Tauri command: given a file path and an image file path, validate magic bytes (JPEG `FF D8 FF` / PNG `89 50 4E 47`), read image bytes, write as Front Cover picture via lofty
- [ ] 1.5 Implement `remove_cover_art` Tauri command: given a file path, remove all cover art pictures via lofty
- [ ] 1.6 Implement `export_cover_art` Tauri command: given a file path and a destination path, extract cover art bytes and write to the destination file

## 2. Frontend — CoverArt Component

- [ ] 2.1 Create `CoverArt` React component with three visual states: image display, empty-state placeholder (no art), and mixed-state placeholder (differing art)
- [ ] 2.2 Integrate `CoverArt` component into the Tag Panel layout, positioned below or alongside the tag fields
- [ ] 2.3 Wire up the component to call `get_cover_art` / `get_cover_art_for_selection` Tauri commands when file selection changes, and render the returned base64 image or appropriate placeholder

## 3. Frontend — Drag-and-Drop Embed

- [ ] 3.1 Implement drag-and-drop handling on the `CoverArt` component using Tauri's `onDragDropEvent` API to capture native file paths
- [ ] 3.2 On drop, invoke the `embed_cover_art` Tauri command for each selected file, then refresh the cover art display
- [ ] 3.3 Show a visual drop zone indicator (highlight/border) when a file is dragged over the cover art area
- [ ] 3.4 Display an error toast/message when a dropped file is rejected (unsupported format or non-image file)

## 4. Frontend — Context Menu (Remove & Export)

- [ ] 4.1 Implement right-click context menu on the `CoverArt` component with "Remove cover" and "Export cover to file" options
- [ ] 4.2 Wire "Remove cover" to invoke `remove_cover_art` for all selected files and refresh the display; disable option when no cover art exists
- [ ] 4.3 Wire "Export cover to file" to open a native save dialog (via Tauri dialog API) with default extension based on MIME type, then invoke `export_cover_art`; disable option when showing placeholder states

## 5. Undo/Redo Integration

- [ ] 5.1 Register cover art embed as a discrete undo action, storing the previous cover art state (bytes or None) for each affected file as the undo payload
- [ ] 5.2 Register cover art remove as a discrete undo action, storing the removed cover art bytes for each affected file as the undo payload
- [ ] 5.3 Ensure multi-file embed and remove operations are grouped as a single undo step

## 6. Testing & Validation

- [ ] 6.1 Test cover art display for single file selection across MP3, FLAC, and M4A formats
- [ ] 6.2 Test multi-file selection: identical art shows image, differing art shows mixed placeholder, no art shows empty placeholder
- [ ] 6.3 Test drag-and-drop embed with valid JPEG, valid PNG, unsupported format (GIF), and non-image file
- [ ] 6.4 Test magic-byte validation: correct extension with wrong bytes rejected, wrong extension with correct bytes accepted
- [ ] 6.5 Test remove cover art and export cover art via context menu, including disabled states
- [ ] 6.6 Test undo/redo for embed and remove operations (single and multi-file)
